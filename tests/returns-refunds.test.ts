import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import {
  saveTaxClass,
  saveCommerceConfig,
  defaultCommerceConfig,
} from "../src/lib/commerce-config";
import {
  saveReturnPolicy,
  requestReturn,
  listReturns,
  updateReturn,
} from "../src/lib/returns";
import { createCheckoutQuote } from "../src/lib/pricing";
import { reserveOrder, confirmCapturedPayment } from "../src/lib/commerce";
import {
  customerOrders,
  fulfillOrder,
  cancelPendingOrder,
} from "../src/lib/orders";
import {
  requestRefund,
  reviewRefund,
  executeRefund,
  applyRefundEvidence,
  refundList,
  receiveRefundEvent,
  confirmManualRefund,
  requestEvidenceCorrection,
  approveEvidenceCorrection,
  type RefundProvider,
  type RefundEvidence,
} from "../src/lib/refunds";
import {
  enqueueJob,
  runJobs,
  DeferredJobError,
  retryJob,
} from "../src/lib/jobs";
import { recordCodEntry } from "../src/lib/cod";
import {
  requestShipment,
  executeShipment,
  shipmentList,
  applyTracking,
  receiveTracking,
  type CourierProvider,
} from "../src/lib/fulfillment";
import { rupeesToPaise } from "../src/lib/shipping";
import type { User, Order } from "../src/lib/types";

test("item-level RMA, inspection, bounded refunds and durable recovery", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-returns-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  async function user(role = "customer") {
    const id = randomUUID(),
      cart = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,role) VALUES($1,$2,'Returns QA',$3)",
      [id, `${id}@example.test`, role],
    );
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, id]);
    return { id, email: `${id}@example.test`, name: "Returns QA", role, cart };
  }
  const owner = await user("owner"),
    finance = await user("finance"),
    staff = await user("fulfillment"),
    customer = await user(),
    other = await user();
  const variant = (await getProducts())[0].variants.find((v) => v.stock > 6)!;
  await db.query(
    "UPDATE product_variants SET stock=100,weight_grams=250 WHERE id=$1",
    [variant.id],
  );
  const tax = await saveTaxClass(owner, {
    name: "Synthetic QA tax",
    hsn: "9999",
    rate_bps: 1250,
    valid_from: "2020-01-01T00:00:00Z",
  });
  await db.query("UPDATE products SET tax_class_id=$1 WHERE id=$2", [
    tax.id,
    variant.product_id,
  ]);
  await saveCommerceConfig(owner, {
    ...defaultCommerceConfig,
    checkout_enabled: true,
    origin_pincode: "400001",
    origin_state: "Maharashtra",
    shipping_tax_bps: 1800,
    cod_enabled: true,
    cod_allowed_pincodes: ["400001"],
    cod_max_total_paise: 10000000,
    cod_max_open_orders: 10,
    cod_tax_bps: 1800,
  });
  await saveReturnPolicy(owner, {
    product_id: variant.product_id,
    return_window_days: 30,
    sealed_return_required: true,
  });
  const address = {
    name: "Synthetic Shopper",
    phone: "9876543210",
    line1: "123 Synthetic Road",
    city: "Mumbai",
    state: "Maharashtra",
    postal: "400001",
  };
  async function order(
    quantity = 3,
    method: "prepaid" | "cod" = "prepaid",
    deliver = true,
  ) {
    await db.query(
      "INSERT INTO cart_items VALUES($1,$2,$3) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=$3",
      [customer.cart, variant.id, quantity],
    );
    const quote = await createCheckoutQuote(
      customer.id,
      customer.cart,
      { address, payment_method: method, coupon: "SOFT10" },
      async () => [
        {
          courier_id: 101,
          courier_name: "Synthetic courier",
          rate_paise: 15001,
          cod: true,
          estimated_delivery: null,
          destination_city: "Mumbai",
          destination_state: "Maharashtra",
          destination_postcode: "400001",
        },
      ],
    );
    const row = (await reserveOrder(
      customer.id,
      customer.cart,
      address,
      "SOFT10",
      randomUUID(),
      address,
      quote.id,
      method,
    )) as unknown as Order;
    if (method === "prepaid") {
      const provider = `order_${randomUUID()}`;
      await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
        provider,
        row.id,
      ]);
      await confirmCapturedPayment(
        provider,
        `pay_${randomUUID()}`,
        row.total,
        "INR",
        randomUUID(),
      );
    }
    if (deliver)
      for (const status of ["processing", "shipped", "delivered"] as const)
        await fulfillOrder(staff, {
          id: row.id,
          status,
          carrier: "Synthetic courier",
          tracking: `QA-${randomUUID()}`,
        });
    return (await customerOrders(customer.id, row.id))[0];
  }
  const mockRecords = new Map<string, RefundEvidence>();
  let creates = 0;
  const provider: RefundProvider = {
    async find(payment, receipt) {
      return (
        [...mockRecords.values()].find(
          (v) => v.payment_id === payment && v.receipt === receipt,
        ) || null
      );
    },
    async fetch(id) {
      const row = mockRecords.get(id);
      if (!row) throw Error("Missing synthetic refund");
      return row;
    },
    async create(payment, receipt, amount) {
      creates++;
      const value = {
        id: `rfnd_${randomUUID()}`,
        payment_id: payment,
        amount,
        currency: "INR" as const,
        status: "processed" as const,
        receipt,
      };
      mockRecords.set(value.id, value);
      return value;
    },
  };
  let delivered: Order, rma: string, cap: number;
  try {
    delivered = await order();
    const item = delivered.items[0];
    await t.test(
      "order terms are copied and later catalog edits do not remove eligibility",
      async () => {
        assert.equal(item.pricing_snapshot?.return_window_days, 30);
        await saveReturnPolicy(owner, {
          product_id: variant.product_id,
          return_window_days: 0,
          sealed_return_required: false,
        });
        const base = {
          order_id: delivered.id,
          request_key: randomUUID(),
          reason: "Fit issue needs review",
          reason_code: "fit",
          sealed: false,
          items: [{ order_item_id: item.id, quantity: 1 }],
        };
        await assert.rejects(requestReturn(customer, base), /hygiene seals/);
        const accepted = await requestReturn(customer, {
          ...base,
          sealed: true,
        });
        assert.equal(
          (await requestReturn(customer, { ...base, sealed: true })).id,
          accepted.id,
        );
        await assert.rejects(
          requestReturn(customer, {
            ...base,
            sealed: true,
            reason: "Changed evidence with same request key",
          }),
          /different details/,
        );
        await updateReturn(owner, {
          id: accepted.id,
          action: "reject",
          note: "Customer withdrew this review request.",
        });
      },
    );
    await t.test(
      "owned item quantities, duplicate request keys and concurrent requests are enforced",
      async () => {
        const body = {
          order_id: delivered.id,
          request_key: randomUUID(),
          reason: "Damaged stitching on receipt",
          reason_code: "defect",
          items: [{ order_item_id: item.id, quantity: 2 }],
        };
        await assert.rejects(requestReturn(other, body), /not found/);
        const results = await Promise.all([
          requestReturn(customer, body),
          requestReturn(customer, body),
        ]);
        assert.equal(results[0].id, results[1].id);
        rma = results[0].id;
        assert.deepEqual(await listReturns(other), []);
        await assert.rejects(
          requestReturn(customer, {
            ...body,
            request_key: randomUUID(),
            items: [{ order_item_id: item.id, quantity: 2 }],
          }),
          /quantity/,
        );
        await assert.rejects(
          updateReturn(customer, {
            id: rma,
            action: "approve",
            note: "Not authorized",
          }),
          /permission/,
        );
      },
    );
    await t.test(
      "receipt and complete inspection precede refunds; quarantine does not restock",
      async () => {
        await updateReturn(owner, {
          id: rma!,
          action: "approve",
          note: "Approved for inspection only.",
        });
        await assert.rejects(
          requestRefund(finance, {
            order_id: delivered.id,
            return_id: rma!,
            amount: 100,
            reason: "Test inspection requirement",
            request_key: randomUUID(),
          }),
          /inspected/,
        );
        await assert.rejects(
          updateReturn(staff, {
            id: rma!,
            action: "receive",
            note: "Received at warehouse.",
          }),
          /reference/,
        );
        await updateReturn(staff, {
          id: rma!,
          action: "receive",
          note: "Received at warehouse.",
          reference: "QA-RECEIPT-001",
        });
        const row = (await listReturns(owner, true)).find((r) => r.id === rma)!;
        cap = row.items.reduce((s, i) => s + i.refund_cap, 0);
        const before = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        await assert.rejects(
          updateReturn(staff, {
            id: rma!,
            action: "inspect",
            note: "All lines require inspection",
            inspections: [],
          }),
          /every return line/,
        );
        const inspection = {
          id: rma!,
          action: "inspect",
          note: "Item condition reviewed; quarantined.",
          inspections: row.items.map((i) => ({
            return_item_id: i.id,
            disposition: "quarantine",
            condition_note: "Damaged stitching; keep unavailable.",
          })),
        };
        await Promise.all([
          updateReturn(staff, inspection),
          updateReturn(staff, inspection),
        ]);
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0].stock,
          before,
        );
      },
    );
    await t.test(
      "refund bounds and permissions protect captured funds and RMA net values",
      async () => {
        await assert.rejects(
          requestRefund(customer, {
            order_id: delivered.id,
            amount: 100,
            reason: "Customer lacks finance permission",
            request_key: randomUUID(),
          }),
          /permission/,
        );
        await assert.rejects(
          requestRefund(finance, {
            order_id: delivered.id,
            return_id: rma!,
            amount: cap! + 1,
            reason: "This exceeds the copied item value",
            request_key: randomUUID(),
          }),
          /net item value/,
        );
        await assert.rejects(
          requestRefund(finance, {
            order_id: delivered.id,
            amount: delivered.total + 1,
            reason: "Too much refund requested",
            request_key: randomUUID(),
          }),
          /verified funds/,
        );
        assert.deepEqual(await refundList(other), []);
      },
    );
    await t.test(
      "partial refunds close an RMA only after all approved item value is processed",
      async () => {
        const first = await requestRefund(finance, {
          order_id: delivered.id,
          return_id: rma!,
          amount: 100,
          reason: "First portion of reviewed item refund",
          request_key: randomUUID(),
        });
        await reviewRefund(owner, { id: first.id, approve: true });
        await executeRefund(first.id, provider);
        assert.equal(
          (await listReturns(customer)).find((r) => r.id === rma)!.status,
          "inspected",
        );
        assert.equal(
          (await listReturns(customer))
            .find((r) => r.id === rma)!
            .events.filter((e) => e.status === "completed").length,
          0,
        );
        const rest = await requestRefund(finance, {
          order_id: delivered.id,
          return_id: rma!,
          amount: cap! - 100,
          reason: "Remaining reviewed item refund balance",
          request_key: randomUUID(),
        });
        await reviewRefund(owner, { id: rest.id, approve: true });
        await executeRefund(rest.id, provider);
        await executeRefund(rest.id, provider);
        const saved = (await customerOrders(customer.id, delivered.id))[0];
        assert.equal(saved.refund_state, "partially_refunded");
        assert.equal(saved.payment_state, "captured");
        assert.equal(saved.fulfillment_state, "delivered");
        assert.equal(
          (await listReturns(customer)).find((r) => r.id === rma)!.status,
          "completed",
        );
        assert.equal(
          (await listReturns(customer))
            .find((r) => r.id === rma)!
            .events.filter((e) => e.status === "completed").length,
          1,
        );
      },
    );
    await t.test(
      "rejected earlier requests cannot allocate an extra paise from a later return",
      async () => {
        const old = (
          await db.query<{ price: number }>(
            "SELECT price FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].price;
        let fresh: Order;
        try {
          await db.query("UPDATE product_variants SET price=1004 WHERE id=$1", [
            variant.id,
          ]);
          fresh = await order(3);
        } finally {
          await db.query("UPDATE product_variants SET price=$1 WHERE id=$2", [
            old,
            variant.id,
          ]);
        }
        const input = {
          order_id: fresh.id,
          reason: "Synthetic defect eligibility review",
          reason_code: "defect",
          items: [{ order_item_id: fresh.items[0].id, quantity: 1 }],
          request_key: randomUUID(),
        };
        const first = await requestReturn(customer, input);
        await requestReturn(customer, {
          ...input,
          request_key: randomUUID(),
          items: [{ order_item_id: fresh.items[0].id, quantity: 2 }],
        });
        await updateReturn(owner, {
          id: first.id,
          action: "reject",
          note: "Withdrawn at customer request.",
        });
        await requestReturn(customer, { ...input, request_key: randomUUID() });
        const rows = await listReturns(customer, false, fresh.id);
        assert.equal(
          rows
            .filter((r) => r.status !== "rejected")
            .reduce((sum, r) => sum + r.items[0].refund_cap, 0),
          fresh.subtotal - fresh.discount,
        );
      },
    );
    await t.test(
      "inspection restocks saleable remaining pieces exactly once",
      async () => {
        const request = await requestReturn(customer, {
          order_id: delivered.id,
          request_key: randomUUID(),
          reason: "Remaining damaged piece review",
          reason_code: "defect",
          items: [{ order_item_id: item.id, quantity: 1 }],
        });
        await updateReturn(owner, {
          id: request.id,
          action: "approve",
          note: "Approved for receipt.",
        });
        await updateReturn(staff, {
          id: request.id,
          action: "receive",
          note: "Received last piece.",
          reference: "QA-RECEIPT-002",
        });
        const row = (await listReturns(customer)).find(
          (r) => r.id === request.id,
        )!;
        assert.equal(
          row.items[0].refund_cap + cap!,
          delivered.subtotal - delivered.discount,
        );
        const before = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        const payload = {
          id: request.id,
          action: "inspect",
          note: "Saleable condition confirmed.",
          inspections: [
            {
              return_item_id: row.items[0].id,
              disposition: "restock",
              condition_note: "Verified intact; approved for sale.",
            },
          ],
        };
        await Promise.all([
          updateReturn(staff, payload),
          updateReturn(staff, payload),
        ]);
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0].stock,
          before + 1,
        );
        await assert.rejects(
          db.query("DELETE FROM return_inspections WHERE return_item_id=$1", [
            row.items[0].id,
          ]),
          /append-only/,
        );
      },
    );
    await t.test(
      "concurrent refund requests cannot reserve more than actual capture",
      async () => {
        const fresh = await order(1);
        const payload = {
          order_id: fresh.id,
          amount: Math.floor(fresh.total * 0.75),
          reason: "Concurrent adjustment test",
          request_key: randomUUID(),
        };
        const results = await Promise.allSettled([
          requestRefund(finance, payload),
          requestRefund(finance, { ...payload, request_key: randomUUID() }),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const granted = (
          results.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<Awaited<ReturnType<typeof requestRefund>>>
        ).value;
        assert.equal((await requestRefund(finance, payload)).id, granted.id);
        await reviewRefund(owner, { id: granted.id, approve: false });
      },
    );
    await t.test(
      "paid cancellation releases committed stock once and requests a reviewed refund",
      async () => {
        const pending = await order(2, "prepaid", false);
        const before = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        await Promise.all([
          cancelPendingOrder(customer.id, pending.id),
          cancelPendingOrder(customer.id, pending.id),
        ]);
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0].stock,
          before + 2,
        );
        const refunds = await refundList(owner, true, pending.id);
        assert.equal(refunds.length, 1);
        assert.equal(refunds[0].amount, pending.total);
        const payment = (
          await db.query<{ id: string }>(
            "SELECT id FROM payments WHERE order_id=$1",
            [pending.id],
          )
        ).rows[0];
        assert.deepEqual(
          await confirmCapturedPayment(
            pending.provider_id!,
            payment.id,
            pending.total,
            "INR",
            randomUUID(),
          ),
          { duplicate: true },
        );
        await assert.rejects(
          confirmCapturedPayment(
            pending.provider_id!,
            `extra_${randomUUID()}`,
            pending.total,
            "INR",
            randomUUID(),
          ),
          /Additional payment/,
        );
        await reviewRefund(finance, { id: refunds[0].id, approve: true });
        await executeRefund(refunds[0].id, provider);
        const saved = (await customerOrders(customer.id, pending.id))[0];
        assert.equal(saved.order_state, "cancelled");
        assert.equal(saved.refund_state, "refunded");
        assert.equal(saved.payment_state, "captured");
      },
    );
    await t.test(
      "lost create response reconciles by the same receipt; pending is not completed",
      async () => {
        const fresh = await order(1);
        const row = await requestRefund(finance, {
          order_id: fresh.id,
          amount: 100,
          reason: "Provider timeout recovery test",
          request_key: randomUUID(),
        });
        await reviewRefund(owner, { id: row.id, approve: true });
        let lost = true;
        const uncertain: RefundProvider = {
          ...provider,
          async create(payment, receipt, amount) {
            const value = await provider.create(payment, receipt, amount);
            const pending = { ...value, status: "pending" as const };
            mockRecords.set(value.id, pending);
            if (lost) {
              lost = false;
              throw Error("Synthetic timeout after provider commit");
            }
            return pending;
          },
        };
        const before = creates;
        await assert.rejects(executeRefund(row.id, uncertain), /timeout/);
        await assert.rejects(
          executeRefund(row.id, uncertain),
          DeferredJobError,
        );
        assert.equal(creates, before + 1);
        const record = [...mockRecords.values()].find(
          (v) => v.receipt === row.id,
        )!;
        assert.equal(
          (await refundList(owner, true, fresh.id))[0].status,
          "pending",
        );
        await applyRefundEvidence(
          { ...record, status: "processed" },
          "verified-process-" + record.id,
        );
        await applyRefundEvidence(record, "late-pending-" + record.id);
        assert.equal(
          (await refundList(owner, true, fresh.id))[0].status,
          "processed",
        );
        await assert.rejects(
          applyRefundEvidence(
            { ...record, amount: 999, status: "processed" },
            "wrong-amount",
          ),
          /does not match/,
        );
      },
    );
    await t.test(
      "verified ingress is retained and deduplicated before background processing",
      async () => {
        const evidence = {
          id: "rfnd_unknown",
          payment_id: "pay_unknown",
          amount: 100,
          currency: "INR",
          status: "processed",
        };
        await receiveRefundEvent(evidence, "unknown-event");
        await receiveRefundEvent(evidence, "unknown-event");
        await assert.rejects(
          receiveRefundEvent({ ...evidence, amount: 200 }, "unknown-event"),
          /conflicts/,
        );
        const result = await runJobs({
          "refund.submit": async (payload) =>
            executeRefund(String(payload.refund_id), provider),
          "refund.event": async (payload) =>
            applyRefundEvidence(payload.evidence, String(payload.event_id)),
        });
        assert.ok(result.failed >= 1);
        assert.equal(
          (
            await db.query(
              "SELECT * FROM commerce_jobs WHERE dedup_key='refund.event:unknown-event'",
            )
          ).rows.length,
          1,
        );
      },
    );
    await t.test(
      "deferred work preserves its retry budget and dead work needs operator retry",
      async () => {
        await enqueueJob(db, "qa.defer", "qa.defer", {});
        const result = await runJobs(
          {
            "qa.defer": async () => {
              throw new DeferredJobError("Synthetic provider pending", 900);
            },
          },
          1,
        );
        assert.equal(result.deferred, 1);
        assert.equal(
          (
            await db.query<{ attempts: number }>(
              "SELECT attempts FROM commerce_jobs WHERE dedup_key='qa.defer'",
            )
          ).rows[0].attempts,
          0,
        );
        await enqueueJob(db, "qa.dead", "qa.dead", {});
        await db.query(
          "UPDATE commerce_jobs SET status='running',attempts=10,lease_until=now()-interval '1 minute' WHERE dedup_key='qa.dead'",
        );
        await runJobs({}, 0);
        const dead = (
          await db.query<{ id: string; status: string }>(
            "SELECT id,status FROM commerce_jobs WHERE dedup_key='qa.dead'",
          )
        ).rows[0];
        assert.equal(dead.status, "dead");
        await assert.rejects(retryJob(customer, dead.id), /permission/);
        await retryJob(owner, dead.id);
        const retried = await runJobs({ "qa.dead": async () => {} }, 1);
        assert.equal(retried.succeeded, 1);
        await assert.rejects(
          db.query(
            "UPDATE commerce_jobs SET payload='{}' WHERE dedup_key='refund.event:unknown-event'",
          ),
          /immutable/,
        );
      },
    );
    await t.test(
      "COD refunds require collected funds, separate approval, and verified payout evidence",
      async () => {
        const cod = await order(1, "cod");
        const body = {
          order_id: cod.id,
          amount: 100,
          reason: "Reviewed COD customer adjustment",
          request_key: randomUUID(),
        };
        await assert.rejects(requestRefund(finance, body), /verified funds/);
        await recordCodEntry(finance, {
          order_id: cod.id,
          kind: "collection",
          amount: cod.total,
          reference: "QA-COD-COLLECT",
          evidence: "Synthetic delivery collection statement",
          occurred_at: new Date().toISOString(),
          verified: true,
        });
        const row = await requestRefund(finance, body);
        await assert.rejects(
          reviewRefund(finance, { id: row.id, approve: true }),
          /second/,
        );
        await reviewRefund(owner, { id: row.id, approve: true });
        await assert.rejects(executeRefund(row.id, provider), /not approved/);
        const input = {
          id: row.id,
          reference: "QA-COD-PAYOUT",
          evidence: "Synthetic completed bank payout statement",
          occurred_at: new Date().toISOString(),
          verified: true,
        };
        await assert.rejects(
          confirmManualRefund(finance, { ...input, verified: false }),
        );
        await confirmManualRefund(finance, input);
        await confirmManualRefund(finance, input);
        assert.equal(
          (await refundList(owner, true, cod.id))[0].status,
          "processed",
        );
        assert.equal(
          (await customerOrders(customer.id, cod.id))[0].payment_state,
          "collected",
        );
        await assert.rejects(
          db.query("UPDATE refunds SET amount=1 WHERE id=$1", [row.id]),
          /immutable/,
        );
        await assert.rejects(
          db.query("UPDATE refunds SET evidence_ref='REPLACED' WHERE id=$1", [
            row.id,
          ]),
          /immutable/,
        );
        await assert.rejects(
          db.query("UPDATE refunds SET evidence_ref=NULL WHERE id=$1", [
            row.id,
          ]),
          /immutable/,
        );
        await db.query(
          "CREATE ROLE recovery_application_writer NOLOGIN BYPASSRLS",
        );
        await db.query(
          "GRANT USAGE ON SCHEMA public TO recovery_application_writer",
        );
        await db.query(
          "GRANT SELECT,UPDATE ON refunds TO recovery_application_writer",
        );
        await assert.rejects(
          db.transaction(async (tx) => {
            await tx.query("SET LOCAL ROLE recovery_application_writer");
            await tx.query(
              "UPDATE refunds SET evidence_ref='SERVER-WRITER-REPLACED' WHERE id=$1",
              [row.id],
            );
          }),
          /immutable/,
        );
        await assert.rejects(
          db.query("DELETE FROM refunds WHERE id=$1", [row.id]),
        );
        const correctionInput = {
          refund_id: row.id,
          request_key: randomUUID(),
          previous_ref: input.reference,
          corrected_ref: "QA-CORRECTED-STATEMENT",
          reason: "Correct a transcription error in the reference",
          independent_proof: "Synthetic independent bank reconciliation proof",
        };
        await assert.rejects(
          requestEvidenceCorrection(customer, correctionInput),
          /permission/,
        );
        const c = await requestEvidenceCorrection(finance, correctionInput);
        assert.equal(
          (await requestEvidenceCorrection(finance, correctionInput)).id,
          c.id,
        );
        await assert.rejects(
          requestEvidenceCorrection(finance, {
            ...correctionInput,
            corrected_ref: "CONFLICT",
          }),
          /different/,
        );
        await assert.rejects(
          approveEvidenceCorrection(finance, {
            id: c.id,
            reconciliation_ref: "QA-RECONCILIATION",
          }),
          /second/,
        );
        await assert.rejects(
          approveEvidenceCorrection(customer, {
            id: c.id,
            reconciliation_ref: "QA-RECONCILIATION",
          }),
          /permission/,
        );
        const competing = await requestEvidenceCorrection(finance, {
          ...correctionInput,
          request_key: randomUUID(),
          corrected_ref: "QA-COMPETING-REFERENCE",
        });
        const approvals = await Promise.allSettled(
          [c, competing].map((c) =>
            approveEvidenceCorrection(owner, {
              id: c.id,
              reconciliation_ref: "QA-RECONCILIATION",
            }),
          ),
        );
        assert.equal(
          approvals.filter((a) => a.status === "fulfilled").length,
          1,
        );
        assert.match(
          String(
            (
              approvals.find(
                (a) => a.status === "rejected",
              ) as PromiseRejectedResult
            ).reason,
          ),
          /stale/,
        );
        const approved = approvals[0].status === "fulfilled" ? c : competing;
        await approveEvidenceCorrection(owner, {
          id: approved.id,
          reconciliation_ref: "QA-RECONCILIATION",
        });
        await assert.rejects(
          db.query(
            "UPDATE refund_evidence_corrections SET reason='overwrite' WHERE id=$1",
            [c.id],
          ),
          /append-only/,
        );
        await assert.rejects(
          db.query(
            "DELETE FROM refund_evidence_approvals WHERE correction_id=$1",
            [approved.id],
          ),
          /append-only/,
        );
        const saved = (await refundList(owner, true, cod.id))[0];
        assert.equal(saved.evidence_ref, input.reference);
        assert.equal(saved.amount, 100);
        assert.equal(saved.status, "processed");
        assert.equal(saved.corrections?.filter((c) => c.approved_by).length, 1);
        assert.equal(
          (await refundList(customer, false, cod.id))[0].corrections,
          undefined,
        );
      },
    );
    await t.test(
      "courier booking stays preparing until authenticated movement and delivery evidence",
      async () => {
        const packed = await order(1, "prepaid", false);
        const input = {
          order_id: packed.id,
          pickup_location: "Synthetic Warehouse",
          length: 20,
          breadth: 15,
          height: 5,
        };
        await assert.rejects(requestShipment(customer, input), /permission/);
        await assert.rejects(requestShipment(staff, input), /Pack/);
        await fulfillOrder(staff, {
          id: packed.id,
          status: "processing",
          tracking: "",
          carrier: "",
        });
        let created = 0,
          assigned = 0,
          pickups = 0;
        let body: Record<string, unknown> | undefined,
          awb: string | null = null,
          pickup: string | null = null;
        const courier: CourierProvider = {
          async find() {
            return body ? { order_id: 1001, shipment_id: 1002 } : null;
          },
          async create(snapshot) {
            created++;
            body = snapshot;
            return { order_id: 1001, shipment_id: 1002 };
          },
          async inspect() {
            return {
              source_order_id: packed.id,
              shipment_id: 1002,
              total_paise: packed.total,
              currency: "INR",
              payment_method: "Prepaid",
              postal: packed.address.postal,
              awb,
              carrier: awb ? "Synthetic courier" : null,
              courier_id: awb ? 101 : null,
              pickup_reference: pickup,
            };
          },
          async assign() {
            assigned++;
            awb = "QA-AWB-1002";
            return { awb, carrier: "Synthetic courier", courier_id: 101 };
          },
          async pickup() {
            pickups++;
            pickup = "QA-PICKUP-1002";
            return pickup;
          },
          async label() {
            return "https://example.test/label.pdf";
          },
          async manifest() {
            return "https://example.test/manifest.pdf";
          },
        };
        const booking = await requestShipment(staff, input);
        assert.equal((await requestShipment(staff, input)).id, booking.id);
        await assert.rejects(
          requestShipment(staff, { ...input, height: 6 }),
          /different parcel/,
        );
        await executeShipment(booking.id, courier);
        await executeShipment(booking.id, courier);
        assert.equal(created, 1);
        assert.equal(assigned, 1);
        assert.equal(pickups, 1);
        assert.equal(rupeesToPaise(body!.sub_total), packed.total);
        assert.equal(body!.billing_address, packed.billing_address!.line1);
        assert.equal(
          (await customerOrders(customer.id, packed.id))[0].fulfillment_state,
          "processing",
        );
        await assert.rejects(
          fulfillOrder(staff, {
            id: packed.id,
            status: "shipped",
            carrier: "Manual",
            tracking: "FAKE",
          }),
          /Courier scans/,
        );
        await assert.rejects(
          requestRefund(finance, {
            order_id: packed.id,
            amount: 100,
            reason: "Refund during an active courier handover",
            request_key: randomUUID(),
          }),
          /active courier handover/,
        );
        const event = {
          awb: "QA-AWB-1002",
          sr_order_id: 1001,
          shipment_status_id: 18,
          shipment_status: "IN TRANSIT",
          current_timestamp: new Date().toISOString(),
          scans: [
            {
              date: "Synthetic scan time",
              activity: "Shipment picked up",
              location: "Synthetic warehouse",
            },
          ],
        };
        await receiveTracking(event);
        assert.equal(
          (await customerOrders(customer.id, packed.id))[0].status,
          "processing",
        );
        await applyTracking(event, "qa-movement-1002");
        assert.equal(
          (await customerOrders(customer.id, packed.id))[0].status,
          "shipped",
        );
        const deliveredAt = new Date().toISOString();
        await applyTracking(
          {
            ...event,
            shipment_status_id: 7,
            shipment_status: "DELIVERED",
            current_timestamp: deliveredAt,
          },
          "qa-delivery-1002",
        );
        await applyTracking(event, "qa-delayed-movement-1002");
        await applyTracking(event, "qa-delayed-movement-1002");
        const saved = (await customerOrders(customer.id, packed.id))[0];
        assert.equal(saved.fulfillment_state, "delivered");
        assert.equal(new Date(saved.delivered_at!).toISOString(), deliveredAt);
        assert.equal(saved.tracking_events!.length, 3);
        assert.equal(
          (await shipmentList(owner)).find((b) => b.id === booking.id)!
            .delivery_state,
          "delivered",
        );
        await assert.rejects(
          applyTracking(
            { ...event, sr_order_id: 999999 },
            "wrong-courier-order",
          ),
          /does not match/,
        );
        await assert.rejects(
          db.query(
            "DELETE FROM shipment_tracking_events WHERE id='qa-delivery-1002'",
          ),
          /append-only/,
        );
      },
    );
    await t.test(
      "lost courier create response is adopted by source identity without duplicate creation",
      async () => {
        const packed = await order(1, "prepaid", false);
        await fulfillOrder(staff, {
          id: packed.id,
          status: "processing",
          tracking: "",
          carrier: "",
        });
        const booking = await requestShipment(staff, {
          order_id: packed.id,
          pickup_location: "Synthetic Warehouse",
          length: 20,
          breadth: 15,
          height: 5,
        });
        let exists = false,
          creates = 0,
          assignment: string | null = null;
        const courier: CourierProvider = {
          async find() {
            return exists ? { order_id: 2001, shipment_id: 2002 } : null;
          },
          async create() {
            exists = true;
            creates++;
            throw new Error("Synthetic lost courier response");
          },
          async inspect() {
            return {
              source_order_id: packed.id,
              shipment_id: 2002,
              total_paise: packed.total,
              currency: "INR",
              payment_method: "Prepaid",
              postal: packed.address.postal,
              awb: assignment,
              carrier: assignment ? "Synthetic courier" : null,
              courier_id: assignment ? 101 : null,
              pickup_reference: assignment ? "QA-PICKUP-2002" : null,
            };
          },
          async assign() {
            assignment = "QA-AWB-2002";
            throw new Error("Synthetic lost AWB response");
          },
          async pickup() {
            return "QA-PICKUP-2002";
          },
          async label() {
            return "https://example.test/label2.pdf";
          },
          async manifest() {
            return "https://example.test/manifest2.pdf";
          },
        };
        await assert.rejects(
          executeShipment(booking.id, courier),
          /lost courier/,
        );
        await assert.rejects(
          executeShipment(booking.id, {
            ...courier,
            async find() {
              return null;
            },
          }),
          /automatic recreation is blocked/,
        );
        assert.equal(creates, 1);
        await assert.rejects(executeShipment(booking.id, courier), /lost AWB/);
        await executeShipment(booking.id, courier);
        assert.equal(creates, 1);
        assert.equal(
          (await shipmentList(owner)).find((b) => b.id === booking.id)!.stage,
          "ready",
        );
      },
    );
    await t.test(
      "courier amount mismatch stops before AWB; RTO evidence never marks delivered or restocks",
      async () => {
        const packed = await order(1, "prepaid", false);
        await fulfillOrder(staff, {
          id: packed.id,
          status: "processing",
          tracking: "",
          carrier: "",
        });
        const booking = await requestShipment(staff, {
          order_id: packed.id,
          pickup_location: "Synthetic Warehouse",
          length: 20,
          breadth: 15,
          height: 5,
        });
        let amount = packed.total - 1,
          assigned = 0;
        const courier: CourierProvider = {
          async find() {
            return { order_id: 3001, shipment_id: 3002 };
          },
          async create() {
            throw Error("Must not create twice");
          },
          async inspect() {
            return {
              source_order_id: packed.id,
              shipment_id: 3002,
              total_paise: amount,
              currency: "INR",
              payment_method: "Prepaid",
              postal: packed.address.postal,
              awb: assigned ? "QA-AWB-3002" : null,
              carrier: assigned ? "Synthetic courier" : null,
              courier_id: assigned ? 101 : null,
              pickup_reference: assigned ? "QA-PICKUP-3002" : null,
            };
          },
          async assign() {
            assigned++;
            return {
              awb: "QA-AWB-3002",
              carrier: "Synthetic courier",
              courier_id: 101,
            };
          },
          async pickup() {
            return "QA-PICKUP-3002";
          },
          async label() {
            return "https://example.test/label3.pdf";
          },
          async manifest() {
            return "https://example.test/manifest3.pdf";
          },
        };
        await assert.rejects(executeShipment(booking.id, courier), /amount/);
        assert.equal(assigned, 0);
        amount = packed.total;
        await executeShipment(booking.id, courier);
        const before = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        await applyTracking(
          {
            awb: "QA-AWB-3002",
            sr_order_id: 3001,
            shipment_status_id: 10,
            shipment_status: "RTO DELIVERED",
            current_timestamp: new Date().toISOString(),
          },
          "qa-rto-3002",
        );
        assert.notEqual(
          (await customerOrders(customer.id, packed.id))[0].fulfillment_state,
          "delivered",
        );
        assert.equal(
          (await shipmentList(owner)).find((b) => b.id === booking.id)!
            .delivery_state,
          "rto_delivered",
        );
        assert.equal(
          (
            await db.query<{ stock: number }>(
              "SELECT stock FROM product_variants WHERE id=$1",
              [variant.id],
            )
          ).rows[0].stock,
          before,
        );
      },
    );
    await t.test(
      "browser policies hide operations, inspections and other customer notifications",
      async () => {
        await db.query("CREATE ROLE rma_browser");
        await db.query("GRANT USAGE ON SCHEMA public TO rma_browser");
        await db.query(
          "GRANT SELECT ON returns,return_items,return_events,refunds,orders,account_notifications,return_inspections,commerce_jobs TO rma_browser",
        );
        await db.transaction(async (tx) => {
          await tx.query("SET LOCAL ROLE rma_browser");
          await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
            other.id,
          ]);
          for (const table of [
            "returns",
            "return_items",
            "return_events",
            "refunds",
            "account_notifications",
            "return_inspections",
            "commerce_jobs",
          ])
            assert.equal(
              (await tx.query(`SELECT * FROM ${table}`)).rows.length,
              0,
            );
        });
      },
    );
  } finally {
    await db.close();
  }
});
