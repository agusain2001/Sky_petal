import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import { hashPassword, hashToken } from "../src/lib/auth";
import {
  base32,
  totp,
  beginMfa,
  verifyMfa,
  mfaStatus,
  requireStaffFactor,
} from "../src/lib/staff-mfa";
import {
  saveTaxClass,
  saveCommerceConfig,
  defaultCommerceConfig,
} from "../src/lib/commerce-config";
import { createCheckoutQuote } from "../src/lib/pricing";
import { reserveOrder, confirmCapturedPayment } from "../src/lib/commerce";
import {
  customerOrders,
  fulfillOrder,
  cancelPendingOrder,
} from "../src/lib/orders";
import {
  saveInvoiceConfig,
  issueInvoice,
  issueCreditNote,
  readDocument,
  documentPdf,
  financialPeriod,
} from "../src/lib/invoices";
import { requestReturn, listReturns, updateReturn } from "../src/lib/returns";
import { linkExchange, listExchanges } from "../src/lib/exchanges";
import {
  requestRefund,
  reviewRefund,
  executeRefund,
  type RefundProvider,
} from "../src/lib/refunds";
import {
  requestDeletion,
  saveRetentionPolicy,
  approveDeletion,
  fulfillDeletion,
} from "../src/lib/privacy-deletion";
import { subscribeNewsletter } from "../src/lib/newsletter";
import { enqueueJob, runJobs, retryJob } from "../src/lib/jobs";
import { receiveTracking } from "../src/lib/fulfillment";
import { releaseReadiness } from "../src/lib/release-readiness";
import type { Order } from "../src/lib/types";
test("local completion: MFA, immutable documents, exchanges and scoped retention erasure", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-completion-"),
  );
  delete process.env.DATABASE_URL;
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const db = await getDB(),
    password = "Synthetic-Password-2026!";
  async function user(role = "customer") {
    const id = randomUUID(),
      email = `${id}@example.test`,
      cart = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,'Completion QA',$3,$4)",
      [id, email, role, hashPassword(password)],
    );
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, id]);
    return { id, email, name: "Completion QA", role, cart };
  }
  const owner = await user("owner"),
    customer = await user(),
    other = await user(),
    finance = await user("finance");
  const session = async (id: string) => {
    const token = hashToken(randomUUID());
    await db.query(
      "INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",
      [token, id],
    );
    return token;
  };
  try {
    await t.test(
      "RFC 6238 vectors; encrypted enrollment, per-session proof, replay rejection and single-use recovery",
      async () => {
        const seed = base32(Buffer.from("12345678901234567890"));
        assert.equal(totp(seed, 59000, 8), "94287082");
        assert.equal(totp(seed, 1111111109000, 8), "07081804");
        const token = await session(owner.id);
        await assert.rejects(beginMfa(owner, token, "wrong"), /password/);
        const setup = await beginMfa(owner, token, password);
        assert.ok(setup.uri.startsWith("otpauth://"));
        assert.ok(
          !JSON.stringify(
            (await db.query("SELECT * FROM staff_mfa")).rows,
          ).includes(setup.secret),
        );
        const enabled = await verifyMfa(owner, token, totp(setup.secret), true);
        assert.equal(enabled.recovery_codes?.length, 10);
        assert.equal((await mfaStatus(owner, token)).verified, true);
        const second = await session(owner.id);
        await assert.rejects(requireStaffFactor(owner, second), /MFA/);
        await assert.rejects(
          verifyMfa(owner, second, totp(setup.secret)),
          /already used/,
        );
        await verifyMfa(owner, second, enabled.recovery_codes![0]);
        await assert.rejects(
          verifyMfa(owner, second, enabled.recovery_codes![0]),
          /already used/,
        );
        await db.query(
          "UPDATE staff_session_factors SET verified_at=now()-interval '11 minutes' WHERE token_hash=$1",
          [second],
        );
        await requireStaffFactor(owner, second);
        await assert.rejects(requireStaffFactor(owner, second, true), /MFA/);
        await assert.rejects(
          beginMfa(customer, await session(customer.id), password),
          /permission/,
        );
        const providerStaff = await user("support"),
          providerToken = await session(providerStaff.id);
        await db.query("UPDATE users SET password_hash=NULL WHERE id=$1", [
          providerStaff.id,
        ]);
        await assert.rejects(
          beginMfa(providerStaff, providerToken, ""),
          /Sign in again/,
        );
        await db.query(
          "INSERT INTO session_primary_proofs(token_hash,provider,verified_at) VALUES($1,'supabase',now()-interval '6 minutes')",
          [providerToken],
        );
        await assert.rejects(
          beginMfa(providerStaff, providerToken, ""),
          /Sign in again/,
        );
        await db.query(
          "UPDATE session_primary_proofs SET verified_at=now() WHERE token_hash=$1",
          [providerToken],
        );
        assert.ok((await beginMfa(providerStaff, providerToken, "")).secret);
        await assert.rejects(
          beginMfa(providerStaff, await session(providerStaff.id), ""),
          /Sign in again/,
        );
      },
    );
    const variant = (await getProducts())[0].variants.find((v) => v.stock > 5)!;
    await db.query(
      "UPDATE product_variants SET stock=100,weight_grams=250 WHERE id=$1",
      [variant.id],
    );
    const tax = await saveTaxClass(owner, {
      name: "Synthetic test tax",
      hsn: "9999",
      rate_bps: 1250,
      valid_from: "2020-01-01T00:00:00Z",
    });
    await db.query(
      "UPDATE products SET tax_class_id=$1,return_window_days=30 WHERE id=$2",
      [tax.id, variant.product_id],
    );
    await saveCommerceConfig(owner, {
      ...defaultCommerceConfig,
      checkout_enabled: true,
      origin_pincode: "400001",
      origin_state: "Maharashtra",
      shipping_tax_bps: 1800,
    });
    const address = {
      name: "Completion QA",
      phone: "9876543210",
      line1: "123 Synthetic Road",
      city: "Mumbai",
      state: "Maharashtra",
      postal: "400001",
    };
    async function order(who = customer, deliver = true, paid = true) {
      await db.query(
        "INSERT INTO cart_items VALUES($1,$2,1) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=1",
        [who.cart, variant.id],
      );
      const quote = await createCheckoutQuote(
        who.id,
        who.cart,
        { address, coupon: "", payment_method: "prepaid" },
        async () => [
          {
            courier_id: 101,
            courier_name: "Synthetic courier",
            rate_paise: 0,
            cod: false,
            estimated_delivery: null,
            destination_city: "Mumbai",
            destination_state: "Maharashtra",
            destination_postcode: "400001",
          },
        ],
      );
      const row = await reserveOrder(
        who.id,
        who.cart,
        address,
        "",
        randomUUID(),
        address,
        quote.id,
        "prepaid",
      );
      if (paid) {
        const provider = "order_" + randomUUID();
        await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
          provider,
          row.id,
        ]);
        await confirmCapturedPayment(
          provider,
          "pay_" + randomUUID(),
          Number(row.total),
          "INR",
          randomUUID(),
        );
      }
      if (deliver)
        for (const status of ["processing", "shipped", "delivered"] as const)
          await fulfillOrder(owner, {
            id: String(row.id),
            status,
            carrier: "Synthetic courier",
            tracking: "QA-" + randomUUID(),
          });
      return (await customerOrders(who.id, String(row.id)))[0];
    }
    const original = await order();
    let invoice: Awaited<ReturnType<typeof issueInvoice>>;
    await t.test(
      "invoice ownership, immutable snapshots and concurrent unique issuance; private PDF parses",
      async () => {
        assert.equal(financialPeriod(new Date("2026-03-31T18:29:59Z")), "2526");
        assert.equal(financialPeriod(new Date("2026-03-31T18:30:00Z")), "2627");
        await assert.rejects(issueInvoice(customer, original.id), /permission/);
        await assert.rejects(issueInvoice(owner, original.id));
        await saveInvoiceConfig(owner, {
          legal_name: "Synthetic QA Seller",
          address: "123 Synthetic Seller Road, Mumbai",
          gstin: "27ABCDE1234F1Z5",
          state_code: "27",
          prefix: "QA",
          approval_reference: "SYNTHETIC-TEST-ONLY",
        });
        const [a, b] = await Promise.all([
          issueInvoice(owner, original.id),
          issueInvoice(finance, original.id),
        ]);
        invoice = a;
        assert.equal(a.id, b.id);
        assert.ok(a.number.length <= 16);
        const second = await issueInvoice(owner, (await order(other)).id);
        assert.notEqual(second.number, a.number);
        await assert.rejects(readDocument(other, a.id), /not found/);
        assert.equal(
          (await readDocument(customer, a.id)).total,
          original.total,
        );
        await assert.rejects(
          db.query("UPDATE invoice_documents SET total=total+1 WHERE id=$1", [
            a.id,
          ]),
          /immutable|append-only/,
        );
        const bytes = await documentPdf(a);
        assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "%PDF");
        const { PDFDocument } = await import("pdf-lib");
        assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1);
      },
    );
    let returnId = "",
      refundId = "";
    await t.test(
      "exchange links one owned exact-SKU replacement order and refund stays bounded by inspected value",
      async () => {
        const requested = await requestReturn(customer, {
          order_id: original.id,
          request_key: randomUUID(),
          reason: "Synthetic defect for exchange",
          reason_code: "defect",
          resolution: "exchange",
          items: [{ order_item_id: original.items[0].id, quantity: 1 }],
        });
        returnId = requested.id;
        await updateReturn(owner, {
          id: returnId,
          action: "approve",
          note: "Approved for synthetic inspection",
        });
        await updateReturn(owner, {
          id: returnId,
          action: "receive",
          note: "Synthetic item received",
          reference: "SYNTHETIC-RECEIPT",
        });
        const rma = (await listReturns(customer)).find(
          (r) => r.id === returnId,
        )!;
        await updateReturn(owner, {
          id: returnId,
          action: "inspect",
          note: "Synthetic defect confirmed",
          inspections: rma.items.map((i) => ({
            return_item_id: i.id,
            disposition: "quarantine",
            condition_note: "Synthetic quarantine decision",
          })),
        });
        await assert.rejects(
          linkExchange(other, {
            return_id: returnId,
            replacement_order_id: original.id,
          }),
          /not found/,
        );
        const refund = await requestRefund(owner, {
          order_id: original.id,
          return_id: returnId,
          amount: original.total,
          reason: "Synthetic refund before replacement",
          request_key: randomUUID(),
        });
        const replacement = await order(customer, false);
        const before = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        await linkExchange(customer, {
          return_id: returnId,
          replacement_order_id: replacement.id,
        });
        await linkExchange(customer, {
          return_id: returnId,
          replacement_order_id: replacement.id,
        });
        assert.equal((await listExchanges(customer)).length, 1);
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0].stock,
          before,
        );
        await assert.rejects(
          linkExchange(customer, {
            return_id: returnId,
            replacement_order_id: original.id,
          }),
          /different/,
        );
        refundId = refund.id;
        await reviewRefund(finance, { id: refund.id, approve: true });
        const provider: RefundProvider = {
          find: async () => null,
          fetch: async () => {
            throw Error("not used");
          },
          create: async (payment, receipt, amount) => ({
            id: "rfnd_" + randomUUID(),
            payment_id: payment,
            receipt,
            amount,
            currency: "INR",
            status: "processed",
          }),
        };
        await executeRefund(refund.id, provider);
        assert.equal(
          Number((await listExchanges(customer))[0].refunded),
          original.total,
        );
        for (const status of ["processing", "shipped", "delivered"] as const)
          await fulfillOrder(owner, {
            id: replacement.id,
            status,
            tracking: "QA-EXCHANGE",
            carrier: "Synthetic courier",
          });
      },
    );
    await t.test(
      "credit note follows completed refund, remains idempotent and preserves original invoice",
      async () => {
        const credit = await issueCreditNote(finance, refundId);
        assert.equal((await issueCreditNote(finance, refundId)).id, credit.id);
        assert.equal(credit.invoice_id, invoice.id);
        assert.equal(credit.total, original.total);
        assert.equal(
          credit.snapshot.credit_tax!.taxable_paise +
            credit.snapshot.credit_tax!.tax_paise,
          credit.total,
        );
        assert.equal(
          (await readDocument(customer, invoice.id)).total,
          original.total,
        );
      },
    );
    await t.test(
      "mixed-tax item credits retain their exact source rates and manual partial credits need explicit allocation",
      async () => {
        const shopper = await user(),
          second = (await getProducts())
            .find((p) => p.id !== variant.product_id)!
            .variants.find((v) => v.stock > 2)!;
        const lower = await saveTaxClass(owner, {
          name: "Synthetic lower tax",
          hsn: "9998",
          rate_bps: 500,
          valid_from: "2020-01-01T00:00:00Z",
        });
        await db.query("UPDATE products SET tax_class_id=$1 WHERE id=$2", [
          lower.id,
          second.product_id,
        ]);
        await db.query(
          "UPDATE product_variants SET stock=50,weight_grams=100 WHERE id=$1",
          [second.id],
        );
        await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
          shopper.cart,
          second.id,
        ]);
        const purchase = await order(shopper),
          document = await issueInvoice(owner, purchase.id),
          item = purchase.items.find((i) => i.variant_id === variant.id)!;
        const returned = await requestReturn(shopper, {
          order_id: purchase.id,
          request_key: randomUUID(),
          reason: "Synthetic mixed-tax defect",
          reason_code: "defect",
          items: [{ order_item_id: item.id, quantity: 1 }],
        });
        await updateReturn(owner, {
          id: returned.id,
          action: "approve",
          note: "Synthetic return approved",
        });
        await updateReturn(owner, {
          id: returned.id,
          action: "receive",
          note: "Synthetic returned item received",
          reference: "SYNTHETIC-TAX-RECEIPT",
        });
        const rma = (await listReturns(shopper))[0];
        await updateReturn(owner, {
          id: returned.id,
          action: "inspect",
          note: "Synthetic inspection completed",
          inspections: rma.items.map((i) => ({
            return_item_id: i.id,
            disposition: "quarantine",
            condition_note: "Synthetic defective item",
          })),
        });
        const provider: RefundProvider = {
          find: async () => null,
          fetch: async () => {
            throw Error("not used");
          },
          create: async (payment, receipt, amount) => ({
            id: "rfnd_" + randomUUID(),
            payment_id: payment,
            receipt,
            amount,
            currency: "INR",
            status: "processed",
          }),
        };
        async function refund(amount: number, returnId?: string) {
          const value = await requestRefund(owner, {
            order_id: purchase.id,
            return_id: returnId,
            amount,
            reason: "Synthetic allocation regression refund",
            request_key: randomUUID(),
          });
          await reviewRefund(finance, { id: value.id, approve: true });
          await executeRefund(value.id, provider);
          return value;
        }
        const first = await issueCreditNote(
            finance,
            (await refund(101, returned.id)).id,
          ),
          rest = await issueCreditNote(
            finance,
            (await refund(rma.items[0].refund_cap - 101, returned.id)).id,
          );
        const source = document.snapshot.sources!.find(
          (s) => s.reference === `item:${item.id}`,
        )!;
        assert.equal(
          first.snapshot.credit_tax!.tax_paise +
            rest.snapshot.credit_tax!.tax_paise,
          source.tax_paise,
        );
        assert.equal(
          first.snapshot.credit_tax!.cgst_paise +
            rest.snapshot.credit_tax!.cgst_paise,
          source.cgst_paise,
        );
        const partial = await refund(101);
        await assert.rejects(issueCreditNote(finance, partial.id), /Allocate/);
        const otherSource = document.snapshot.sources!.find(
          (s) => s.reference !== source.reference,
        )!;
        const manual = await issueCreditNote(finance, partial.id, [
          { reference: otherSource.reference, amount: 101 },
        ]);
        const final = await issueCreditNote(
          finance,
          (await refund(otherSource.net_paise - 101)).id,
        );
        assert.equal(
          [first, rest, manual, final].reduce(
            (n, d) => n + d.snapshot.credit_tax!.tax_paise,
            0,
          ),
          document.snapshot.tax.tax_paise,
        );
        await assert.rejects(
          db.query("UPDATE document_sequences SET counter=counter-1"),
          /advance/,
        );
        await assert.rejects(
          db.query(
            "INSERT INTO invoice_documents(id,number,kind,order_id,total,snapshot,issued_by) VALUES($1,'FORGED','invoice',$2,$3,'{}',$4)",
            [randomUUID(), purchase.id, purchase.total, owner.id],
          ),
          /snapshot/,
        );
      },
    );
    await t.test(
      "reviewed deletion honors holds, revokes sessions and cannot bypass ledger immutability",
      async () => {
        await subscribeNewsletter({ email: customer.email, consent: true });
        const token = await session(customer.id);
        const request = await requestDeletion(customer);
        assert.equal((await requestDeletion(customer)).id, request.id);
        await assert.rejects(approveDeletion(other, request.id), /permission/);
        await assert.rejects(approveDeletion(owner, request.id));
        await saveRetentionPolicy(owner, {
          financial_days: 365,
          support_days: 30,
          policy_version: "SYNTHETIC-1",
          approval_reference: "SYNTHETIC-TEST-ONLY",
        });
        assert.equal(
          (await approveDeletion(owner, request.id)).status,
          "retained",
        );
        assert.equal(
          (
            await db.query("SELECT * FROM sessions WHERE token_hash=$1", [
              token,
            ])
          ).rows.length,
          0,
        );
        const saved = (
          await db.query<{ deleted_at: string }>(
            "SELECT * FROM users WHERE id=$1",
            [customer.id],
          )
        ).rows[0];
        assert.ok(saved.deleted_at);
        assert.deepEqual(
          (await customerOrders(customer.id, original.id))[0].address,
          original.address,
        );
        await db.transaction(async (tx) => {
          await tx.query("SELECT set_config('sky.privacy_request',$1,true)", [
            request.id,
          ]);
          await assert.rejects(
            tx.query("UPDATE orders SET address='{}' WHERE id=$1", [
              original.id,
            ]),
            /immutable/,
          );
        });
      },
    );
    await t.test(
      "production MFA is mandatory and readiness does not infer provider acceptance",
      async () => {
        const token = await session(finance.id),
          previous = process.env.DEPLOYMENT_ENV;
        try {
          process.env.DEPLOYMENT_ENV = "production";
          assert.equal((await mfaStatus(finance, token)).required, true);
          await assert.rejects(requireStaffFactor(finance, token), /enroll/);
        } finally {
          if (previous === undefined) delete process.env.DEPLOYMENT_ENV;
          else process.env.DEPLOYMENT_ENV = previous;
        }
        const report = await releaseReadiness();
        assert.equal(report.release_decision, "NO-GO");
        assert.equal(
          report.external_campaigns.filter((c) => c.status === "UNVERIFIED")
            .length,
          12,
        );
      },
    );
    await t.test(
      "zero retention never releases stock or erases an open order",
      async () => {
        const fresh = await user(),
          pending = await order(fresh, false, false);
        await saveRetentionPolicy(owner, {
          financial_days: 0,
          support_days: 0,
          policy_version: "SYNTHETIC-OPEN",
          approval_reference: "SYNTHETIC-TEST-ONLY",
        });
        const stock = (
            await db.query<{ stock: number; reserved: number }>(
              "SELECT stock,reserved FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0],
          request = await requestDeletion(fresh);
        assert.equal(
          (await approveDeletion(owner, request.id)).status,
          "retained",
        );
        assert.deepEqual(
          (
            await db.query(
              "SELECT stock,reserved FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0],
          stock,
        );
        assert.equal(
          (await customerOrders(fresh.id, pending.id))[0].address.line1,
          address.line1,
        );
        await cancelPendingOrder(fresh.id, pending.id);
        assert.equal(
          (await fulfillDeletion(request.id, owner)).status,
          "completed",
        );
      },
    );
    await t.test(
      "expired approved policy erases scoped personal fields; other customers and financial totals survive",
      async () => {
        const fresh = await user(),
          own = await order(fresh),
          doc = await issueInvoice(owner, own.id);
        const ticket = randomUUID(),
          booking = randomUUID(),
          jobKey = "privacy-" + randomUUID(),
          awb = "QA-ERASE-" + randomUUID();
        await db.query(
          "INSERT INTO support_tickets(id,user_id,subject,body,status) VALUES($1,$2,'Synthetic personal subject','Synthetic personal body','resolved')",
          [ticket, fresh.id],
        );
        await db.query(
          "INSERT INTO ticket_messages(id,ticket_id,actor_id,body,visibility) VALUES($1,$2,$3,'Synthetic private thread','public')",
          [randomUUID(), ticket, fresh.id],
        );
        await db.query(
          "INSERT INTO shipment_bookings(id,order_id,request_snapshot,actor_id,courier_id,awb,stage,delivery_state) VALUES($1,$2,$3,$4,101,$5,'booked','delivered')",
          [booking, own.id, JSON.stringify({ address }), owner.id, awb],
        );
        await enqueueJob(db, "shipping.tracking", jobKey, {
          event: {
            awb,
            scans: [{ activity: "Synthetic private delivery location" }],
          },
        });
        await db.query(
          "UPDATE commerce_jobs SET status='dead' WHERE dedup_key=$1",
          [jobKey],
        );
        await saveRetentionPolicy(owner, {
          financial_days: 0,
          support_days: 0,
          policy_version: "SYNTHETIC-ERASE",
          approval_reference: "SYNTHETIC-TEST-ONLY",
        });
        await subscribeNewsletter({ email: fresh.email, consent: true });
        const request = await requestDeletion(fresh);
        assert.equal(
          (await approveDeletion(owner, request.id)).status,
          "completed",
        );
        assert.equal(
          (await fulfillDeletion(request.id, owner)).status,
          "completed",
        );
        assert.equal(
          (
            await db.query<{ body: string }>(
              "SELECT body FROM ticket_messages WHERE ticket_id=$1",
              [ticket],
            )
          ).rows[0].body,
          "Removed under approved retention policy",
        );
        const job = (
          await db.query<{ id: string; payload: unknown }>(
            "SELECT id,payload FROM commerce_jobs WHERE dedup_key=$1",
            [jobKey],
          )
        ).rows[0];
        assert.deepEqual(job.payload, { privacy_erased: true });
        await assert.rejects(retryJob(owner, job.id), /not eligible/);
        assert.deepEqual(
          await receiveTracking({
            awb,
            sr_order_id: 999,
            shipment_status_id: 7,
            shipment_status: "Synthetic late delivery",
            current_timestamp: new Date().toISOString(),
            scans: [],
          }),
          { received: true, privacy_erased: true },
        );
        const erased = (await customerOrders(fresh.id, own.id))[0];
        assert.deepEqual(erased.address, { name: "Deleted customer" });
        assert.equal(erased.total, own.total);
        assert.deepEqual(
          (await readDocument(owner, doc.id)).snapshot.buyer,
          {},
        );
        assert.equal(
          (
            await db.query("SELECT * FROM newsletter WHERE email=$1", [
              fresh.email,
            ])
          ).rows.length,
          0,
        );
        assert.ok(
          !JSON.stringify(
            (await db.query("SELECT * FROM newsletter_consent_events")).rows,
          ).includes(fresh.email),
        );
        assert.equal(
          (await customerOrders(other.id))[0].address.line1,
          address.line1,
        );
        await assert.rejects(
          db.query("UPDATE orders SET total=total+1 WHERE id=$1", [own.id]),
          /immutable/,
        );
        await assert.rejects(
          db.query("UPDATE invoice_documents SET total=total+1 WHERE id=$1", [
            doc.id,
          ]),
          /immutable|append-only/,
        );
      },
    );
  } finally {
    await db.close();
    delete process.env.MFA_ENCRYPTION_KEY;
  }
});
