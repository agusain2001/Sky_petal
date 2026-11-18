import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import { expireReservations, reserveOrder } from "../src/lib/commerce";
import {
  ensurePaymentOrder,
  recordPaymentObservation,
  recordPaymentClientEvent,
  reconcilePaymentAttempt,
  runPaymentReconciliation,
  paymentAttempts,
  retryPaymentReconciliation,
  type PaymentAttempt,
  type PaymentProvider,
} from "../src/lib/payment-attempts";
import {
  receiveVerifiedCapture,
  processCapture,
} from "../src/lib/payment-inbox";
import { POST } from "../src/app/api/[...path]/route";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

test("durable payment attempts reconcile uncertainty without a second provider creation", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-payment-attempts-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  const variant = (await getProducts())[0].variants.find((v) => v.stock >= 10)!;
  const address = {
    name: "Synthetic Payment QA",
    phone: "9876543210",
    line1: "123 Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    postal: "400001",
  };
  const attemptFor = async (orderId: string) =>
    (
      await db.query<PaymentAttempt>(
        "SELECT * FROM payment_attempts WHERE order_id=$1",
        [orderId],
      )
    ).rows[0];
  async function fixture() {
    const user = randomUUID(),
      cart = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name) VALUES($1,$2,'Synthetic Payment QA')",
      [user, `${user}@example.test`],
    );
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, user]);
    await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
      cart,
      variant.id,
    ]);
    const order = await reserveOrder(user, cart, address, "", randomUUID());
    let creates = 0;
    const remote = {
      id: `order_${randomUUID()}`,
      receipt: String(order.id),
      amount: Number(order.total),
      currency: "INR" as const,
    };
    const provider: PaymentProvider = {
      async create() {
        creates++;
        return remote;
      },
      async find() {
        return [remote];
      },
      async payments() {
        return [];
      },
    };
    return { user, cart, order, remote, provider, creates: () => creates };
  }
  try {
    await t.test(
      "intent survives lost create response; empty lookup never permits another POST",
      async () => {
        const f = await fixture();
        const create = f.provider.create;
        f.provider.create = async (...args) => {
          assert.equal(
            (await attemptFor(String(f.order.id))).state,
            "creating",
          );
          await create(...args);
          throw new Error(
            "network response lost; must-not-retain-provider-secret",
          );
        };
        await assert.rejects(
          ensurePaymentOrder(f.user, String(f.order.id), f.provider),
          /pending reconciliation/,
        );
        assert.equal((await attemptFor(String(f.order.id))).state, "unknown");
        assert.ok(
          !(await attemptFor(String(f.order.id))).last_error?.includes(
            "provider-secret",
          ),
        );
        await assert.rejects(
          reserveOrder(f.user, f.cart, address, "", randomUUID()),
          /earlier payment/,
        );
        f.provider.find = async () => [];
        await assert.rejects(
          ensurePaymentOrder(f.user, String(f.order.id), f.provider),
          /pending reconciliation/,
        );
        assert.equal(f.creates(), 1);
        f.provider.find = async () => [f.remote];
        assert.equal(
          await ensurePaymentOrder(f.user, String(f.order.id), f.provider),
          f.remote.id,
        );
        assert.equal(
          await ensurePaymentOrder(f.user, String(f.order.id), f.provider),
          f.remote.id,
        );
        assert.equal(f.creates(), 1);
        await assert.rejects(
          ensurePaymentOrder(randomUUID(), String(f.order.id), f.provider),
          /closed/,
        );
      },
    );
    await t.test(
      "concurrent creation has one provider mutation and no network call inside a DB transaction",
      async () => {
        const f = await fixture();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let entered!: () => void;
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const create = f.provider.create;
        f.provider.create = async (...args) => {
          entered();
          await gate;
          return create(...args);
        };
        const first = ensurePaymentOrder(
          f.user,
          String(f.order.id),
          f.provider,
        );
        try {
          await started;
          await assert.rejects(
            ensurePaymentOrder(f.user, String(f.order.id), f.provider),
            /being reconciled/,
          );
          await db.transaction(async (tx) => {
            assert.equal(
              (
                await tx.query("SELECT id FROM orders WHERE id=$1", [
                  f.order.id,
                ])
              ).rows.length,
              1,
            );
          });
        } finally {
          release();
        }
        assert.equal(await first, f.remote.id);
        assert.equal(f.creates(), 1);
      },
    );
    await t.test(
      "authorization is not capture; poll and webhook commit inventory only once",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        const a = await attemptFor(String(f.order.id));
        const payment = {
          id: `pay_${randomUUID()}`,
          order_id: f.remote.id,
          amount: f.remote.amount,
          currency: "INR",
          status: "authorized" as const,
        };
        await recordPaymentObservation(
          {
            ...payment,
            email: "discard@example.test",
            card: { last4: "9999" },
          },
          "authorized:" + payment.id,
          "webhook",
        );
        assert.equal(
          (await attemptFor(String(f.order.id))).state,
          "authorized",
        );
        assert.equal(
          (
            await db.query<{ status: string }>(
              "SELECT status FROM orders WHERE id=$1",
              [f.order.id],
            )
          ).rows[0].status,
          "pending_payment",
        );
        const retained = await db.query(
          "SELECT * FROM payment_observations WHERE payment_id=$1",
          [payment.id],
        );
        assert.ok(!JSON.stringify(retained).includes("discard@example.test"));
        await assert.rejects(
          recordPaymentObservation(
            { ...payment, amount: 1 },
            "authorized:" + payment.id,
            "webhook",
          ),
          /identity conflict/,
        );
        // An eventually consistent empty/failed-only read cannot erase signed
        // authorization evidence and permit another checkout.
        f.provider.payments = async () => [];
        await reconcilePaymentAttempt(a.id, f.provider);
        assert.equal(
          (await attemptFor(String(f.order.id))).state,
          "authorized",
        );
        f.provider.payments = async () => [{ ...payment, status: "failed" }];
        await reconcilePaymentAttempt(a.id, f.provider);
        assert.equal(
          (await attemptFor(String(f.order.id))).state,
          "authorized",
        );
        f.provider.payments = async () => {
          throw new Error("Provider unavailable");
        };
        await assert.rejects(reconcilePaymentAttempt(a.id, f.provider));
        assert.equal(
          (await attemptFor(String(f.order.id))).state,
          "authorized",
        );
        f.provider.payments = async () => [{ ...payment, status: "captured" }];
        await Promise.all([
          reconcilePaymentAttempt(a.id, f.provider),
          receiveVerifiedCapture({
            id: `callback:${payment.id}`,
            provider_order_id: f.remote.id,
            payment_id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            source: "callback",
          }),
        ]);
        assert.equal((await attemptFor(String(f.order.id))).state, "captured");
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              f.order.id,
            ])
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              "SELECT * FROM inventory_movements WHERE reason=$1",
              [`Order ${f.order.id}`],
            )
          ).rows.length,
          1,
        );
        await recordPaymentObservation(
          { ...payment, status: "failed" },
          "failed:" + payment.id,
          "webhook",
        );
        assert.equal((await attemptFor(String(f.order.id))).state, "captured");
        await assert.rejects(
          db.query("UPDATE payment_attempts SET state='unknown' WHERE id=$1", [
            a.id,
          ]),
          /cannot regress/,
        );
      },
    );
    await t.test(
      "late capture remains a financial exception and does not consume released stock",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        const a = await attemptFor(String(f.order.id));
        await db.query(
          "UPDATE orders SET expires_at=now()-interval '1 hour' WHERE id=$1",
          [f.order.id],
        );
        await expireReservations(db);
        const stock = (
          await db.query(
            "SELECT stock,reserved FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0];
        f.provider.payments = async () => [
          {
            id: `pay_${randomUUID()}`,
            order_id: f.remote.id,
            amount: f.remote.amount,
            currency: "INR",
            status: "captured",
          },
        ];
        await assert.rejects(
          reconcilePaymentAttempt(a.id, f.provider),
          /reconciliation/,
        );
        assert.equal(
          (await attemptFor(String(f.order.id))).state,
          "manual_review",
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
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              f.order.id,
            ])
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "signed failed/authorized webhook persists sanitized evidence and enforces signature",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        process.env.RAZORPAY_WEBHOOK_SECRET = "synthetic-local-webhook-secret";
        const body = JSON.stringify({
          event: "payment.failed",
          payload: {
            payment: {
              entity: {
                id: `pay_${randomUUID()}`,
                order_id: f.remote.id,
                amount: f.remote.amount,
                currency: "INR",
                status: "failed",
                email: "do-not-retain@example.test",
              },
            },
          },
        });
        const request = (signature: string) =>
          POST(
            new NextRequest("http://localhost/api/payments/webhook", {
              method: "POST",
              body,
              headers: {
                "x-razorpay-signature": signature,
                "x-razorpay-event-id": "attempt-event",
              },
            }),
            { params: Promise.resolve({ path: ["payments", "webhook"] }) },
          );
        assert.equal((await request("0".repeat(64))).status, 401);
        const signature = createHmac(
          "sha256",
          process.env.RAZORPAY_WEBHOOK_SECRET,
        )
          .update(body)
          .digest("hex");
        assert.equal((await request(signature)).status, 200);
        assert.equal((await request(signature)).status, 200);
        assert.equal((await attemptFor(String(f.order.id))).state, "failed");
        assert.ok(
          !JSON.stringify(
            (await db.query("SELECT * FROM payment_observations")).rows,
          ).includes("do-not-retain"),
        );
      },
    );
    await t.test(
      "browser dismissal/failure is owned, replay-safe and never proof of payment",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        const event = {
          id: randomUUID(),
          order_id: String(f.order.id),
          kind: "dismissed",
        };
        await assert.rejects(
          recordPaymentClientEvent(randomUUID(), event),
          /Order not found/,
        );
        await recordPaymentClientEvent(f.user, event);
        await recordPaymentClientEvent(f.user, event);
        await assert.rejects(
          recordPaymentClientEvent(f.user, { ...event, kind: "failed" }),
          /identity conflict/,
        );
        assert.equal(
          (
            await db.query(
              "SELECT * FROM payment_client_events WHERE order_id=$1",
              [f.order.id],
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query<{ status: string }>(
              "SELECT status FROM orders WHERE id=$1",
              [f.order.id],
            )
          ).rows[0].status,
          "pending_payment",
        );
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              f.order.id,
            ])
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "wrong amount/provider order evidence never attaches to the checkout",
      async () => {
        const f = await fixture();
        f.provider.create = async () => ({ ...f.remote, amount: 1 });
        await assert.rejects(
          ensurePaymentOrder(f.user, String(f.order.id), f.provider),
          /pending reconciliation/,
        );
        assert.equal(
          (
            await db.query<{ provider_id: string | null }>(
              "SELECT provider_id FROM orders WHERE id=$1",
              [f.order.id],
            )
          ).rows[0].provider_id,
          null,
        );
        f.provider.find = async () => [f.remote];
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        f.provider.payments = async () => [
          {
            id: "pay_foreign",
            order_id: "order_foreign",
            amount: f.remote.amount,
            currency: "INR",
            status: "captured",
          },
        ];
        await assert.rejects(
          reconcilePaymentAttempt(
            (await attemptFor(String(f.order.id))).id,
            f.provider,
          ),
          /reconciliation/,
        );
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              f.order.id,
            ])
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "ordinary unpaid expiry exhausts polling without placing a financial hold on the customer",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        await db.query(
          "UPDATE orders SET expires_at=now()-interval '1 hour' WHERE id=$1",
          [f.order.id],
        );
        await expireReservations(db);
        const a = await attemptFor(String(f.order.id));
        await reconcilePaymentAttempt(a.id, f.provider);
        assert.equal((await attemptFor(String(f.order.id))).state, "expired");
        await db.query(
          "UPDATE payment_attempts SET next_check_at=now()+interval '1 day'",
        );
        await db.query(
          "UPDATE payment_attempts SET checks=10,next_check_at=now() WHERE id=$1",
          [a.id],
        );
        await runPaymentReconciliation(f.provider);
        assert.equal((await attemptFor(String(f.order.id))).state, "expired");
        assert.ok(
          (await reserveOrder(f.user, f.cart, address, "", randomUUID())).id,
        );
      },
    );
    await t.test(
      "attempt history is immutable and recovery is role-limited and audited",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        const a = await attemptFor(String(f.order.id));
        const customer = {
          id: f.user,
          email: "synthetic@example.test",
          name: "QA",
          role: "customer",
        };
        await assert.rejects(paymentAttempts(customer), /permission/);
        await assert.rejects(
          retryPaymentReconciliation(customer, a.id),
          /permission/,
        );
        await assert.rejects(
          db.query("UPDATE payment_attempts SET amount=1 WHERE id=$1", [a.id]),
          /immutable/,
        );
        await assert.rejects(
          db.query("DELETE FROM payment_attempts WHERE id=$1", [a.id]),
          /retained/,
        );
        const admin = { ...customer, role: "owner" };
        await retryPaymentReconciliation(admin, a.id);
        assert.equal(
          (
            await db.query(
              "SELECT * FROM audit_logs WHERE action='payment.reconcile' AND target_id=$1",
              [a.id],
            )
          ).rows.length,
          1,
        );
        await db.exec(
          "CREATE ROLE attempt_browser NOLOGIN; GRANT USAGE ON SCHEMA public TO attempt_browser; GRANT SELECT ON payment_attempts,payment_observations TO attempt_browser",
        );
        await db.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE attempt_browser");
          assert.equal(
            (await tx.query("SELECT * FROM payment_attempts")).rows.length,
            0,
          );
          assert.equal(
            (await tx.query("SELECT * FROM payment_observations")).rows.length,
            0,
          );
        });
      },
    );
    await t.test(
      "a capture worker cannot acknowledge a replacement worker's lease",
      async () => {
        const f = await fixture();
        await ensurePaymentOrder(f.user, String(f.order.id), f.provider);
        const evidence = {
          id: `poll:${randomUUID()}`,
          provider_order_id: f.remote.id,
          payment_id: `pay_${randomUUID()}`,
          amount: f.remote.amount,
          currency: "INR",
          source: "poll" as const,
        };
        const query = db.query.bind(db);
        let replaced = false;
        db.query = (async (...args: Parameters<typeof db.query>) => {
          if (
            !replaced &&
            String(args[0]).startsWith(
              "UPDATE payment_webhook_inbox SET status='processed'",
            )
          ) {
            replaced = true;
            await query(
              "UPDATE payment_webhook_inbox SET lease_token='replacement-worker',lease_until=now()+interval '5 minutes' WHERE id=$1",
              [evidence.id],
            );
          }
          return query(...args);
        }) as typeof db.query;
        try {
          const result = await receiveVerifiedCapture(evidence);
          assert.ok("lost" in result && result.lost);
        } finally {
          db.query = query;
        }
        const retained = (
          await db.query<{ status: string; lease_token: string }>(
            "SELECT status,lease_token FROM payment_webhook_inbox WHERE id=$1",
            [evidence.id],
          )
        ).rows[0];
        assert.deepEqual(retained, {
          status: "processing",
          lease_token: "replacement-worker",
        });
        await db.query(
          "UPDATE payment_webhook_inbox SET lease_until=now()-interval '1 minute' WHERE id=$1",
          [evidence.id],
        );
        assert.equal((await processCapture(evidence.id)).duplicate, true);
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              f.order.id,
            ])
          ).rows.length,
          1,
        );
      },
    );
  } finally {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    await db.close();
  }
});
