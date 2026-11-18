import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/[...path]/route";
import { getDB, getProducts } from "../src/lib/db";
import { reserveOrder } from "../src/lib/commerce";
import { paymentInbox } from "../src/lib/payment-inbox";

test("signed payment ingress and bearer-protected maintenance", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-ingress-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  const secret = randomBytes(32).toString("hex");
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  async function request(
    route: string,
    body: string,
    headers: Record<string, string> = {},
  ) {
    return POST(
      new NextRequest(`http://localhost:4320/api/${route}`, {
        method: "POST",
        body,
        headers,
      }),
      { params: Promise.resolve({ path: route.split("/") }) },
    );
  }
  const sign = (body: string) =>
    createHmac("sha256", secret).update(body).digest("hex");
  try {
    await t.test(
      "courier ingress requires its server token and retains only allowlisted evidence once",
      async () => {
        const body = JSON.stringify({
          awb: "QA-UNKNOWN-AWB",
          sr_order_id: 123456,
          shipment_status_id: 18,
          shipment_status: "IN TRANSIT",
          current_timestamp: new Date().toISOString(),
          customer_email: "private@example.test",
        });
        delete process.env.COURIER_WEBHOOK_TOKEN;
        assert.equal((await request("shipping/events", body)).status, 503);
        process.env.COURIER_WEBHOOK_TOKEN = secret;
        assert.equal(
          (await request("shipping/events", body, { "x-api-key": "forged" }))
            .status,
          401,
        );
        assert.equal(
          (await request("shipping/events", body, { "x-api-key": secret }))
            .status,
          200,
        );
        assert.equal(
          (await request("shipping/events", body, { "x-api-key": secret }))
            .status,
          200,
        );
        const rows = (
          await db.query<{ payload: unknown }>(
            "SELECT payload FROM commerce_jobs WHERE kind='shipping.tracking'",
          )
        ).rows;
        assert.equal(rows.length, 1);
        assert.equal(
          JSON.stringify(rows).includes("private@example.test"),
          false,
        );
      },
    );
    await t.test(
      "refund ingress verifies the raw signature and retains a deduplicated provider event",
      async () => {
        const body = JSON.stringify({
          event: "refund.processed",
          payload: {
            refund: {
              entity: {
                id: "rfnd_unknown_ingress",
                payment_id: "pay_unknown_ingress",
                amount: 100,
                currency: "INR",
                status: "processed",
                receipt: "unknown-refund-request",
                notes: { private: "do not retain" },
              },
            },
          },
        });
        assert.equal(
          (
            await request("payments/webhook", body, {
              "x-razorpay-signature": "0".repeat(64),
            })
          ).status,
          401,
        );
        for (let i = 0; i < 2; i++)
          assert.equal(
            (
              await request("payments/webhook", body, {
                "x-razorpay-signature": sign(body),
                "x-razorpay-event-id": "refund-ingress-001",
              })
            ).status,
            200,
          );
        const rows = (
          await db.query<{ payload: unknown }>(
            "SELECT payload FROM commerce_jobs WHERE kind='refund.event'",
          )
        ).rows;
        assert.equal(rows.length, 1);
        assert.equal(JSON.stringify(rows).includes("do not retain"), false);
      },
    );
    await t.test("missing webhook configuration fails closed", async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      assert.equal((await request("payments/webhook", "{}")).status, 503);
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    });
    await t.test(
      "forged signature or signed malformed event cannot create inbox evidence",
      async () => {
        assert.equal(
          (
            await request("payments/webhook", "{}", {
              "x-razorpay-signature": "0".repeat(64),
            })
          ).status,
          401,
        );
        const body = JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_bad",
                order_id: "order_bad",
                status: "captured",
                amount: -1,
                currency: "INR",
              },
            },
          },
        });
        assert.equal(
          (
            await request("payments/webhook", body, {
              "x-razorpay-signature": sign(body),
            })
          ).status,
          400,
        );
        assert.equal((await paymentInbox()).length, 0);
      },
    );
    const uid = randomUUID(),
      cart = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name) VALUES($1,$2,'Ingress QA')",
      [uid, `${uid}@example.test`],
    );
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, uid]);
    const variant = (await getProducts())[0].variants.find(
      (variant) => variant.stock > 0,
    )!;
    await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
      cart,
      variant.id,
    ]);
    const order = await reserveOrder(
      uid,
      cart,
      {
        name: "Ingress QA",
        phone: "9876543210",
        line1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postal: "400001",
      },
      "",
      randomUUID(),
    );
    const provider = `order_${randomUUID()}`;
    await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
      provider,
      order.id,
    ]);
    const eventId = `evt_${randomUUID()}`;
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_${randomUUID()}`,
            order_id: provider,
            status: "captured",
            amount: order.total,
            currency: "INR",
            email: "must-not-be-persisted@example.test",
            card: { last4: "0000" },
          },
        },
      },
    });
    await t.test(
      "signed raw-body capture succeeds once; retries deduplicate and discard PII",
      async () => {
        const headers = {
          "x-razorpay-signature": sign(body),
          "x-razorpay-event-id": eventId,
        };
        assert.equal(
          (await request("payments/webhook", body, headers)).status,
          200,
        );
        assert.equal(
          (await request("payments/webhook", body, headers)).status,
          200,
        );
        const records = await paymentInbox();
        assert.equal(records.length, 1);
        assert.equal(records[0].status, "processed");
        assert.equal(records[0].attempts, 1);
        assert.equal(
          JSON.stringify(records).includes("must-not-be-persisted"),
          false,
        );
        assert.equal(JSON.stringify(records).includes("last4"), false);
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              order.id,
            ])
          ).rows.length,
          1,
        );
        assert.equal(
          (await request("payments/webhook", body + " ", headers)).status,
          401,
        );
      },
    );
    await t.test(
      "valid but unprocessable capture returns retryable failure and retains exception",
      async () => {
        const failedBody = JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: `pay_${randomUUID()}`,
                order_id: "order_unknown",
                status: "captured",
                amount: 100,
                currency: "INR",
              },
            },
          },
        });
        const response = await request("payments/webhook", failedBody, {
          "x-razorpay-signature": sign(failedBody),
          "x-razorpay-event-id": `evt_${randomUUID()}`,
        });
        assert.equal(response.status, 503);
        assert.ok(
          (await paymentInbox()).some((event) => event.status === "failed"),
        );
      },
    );
    await t.test(
      "maintenance rejects missing/incorrect credentials and accepts the configured bearer",
      async () => {
        delete process.env.COMMERCE_MAINTENANCE_SECRET;
        assert.equal((await request("internal/maintenance", "")).status, 503);
        const token = randomBytes(32).toString("hex");
        process.env.COMMERCE_MAINTENANCE_SECRET = token;
        assert.equal((await request("internal/maintenance", "")).status, 401);
        assert.equal(
          (
            await request("internal/maintenance", "", {
              authorization: "Bearer forged",
            })
          ).status,
          401,
        );
        const response = await request("internal/maintenance", "", {
          authorization: `Bearer ${token}`,
        });
        assert.equal(response.status, 200);
        assert.equal(typeof (await response.json()).expired, "number");
      },
    );
  } finally {
    delete process.env.COURIER_WEBHOOK_TOKEN;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.COMMERCE_MAINTENANCE_SECRET;
    await db.close();
  }
});
