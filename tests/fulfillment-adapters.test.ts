import { test } from "node:test";
import assert from "node:assert/strict";
import { shiprocketProvider, courierTime } from "../src/lib/fulfillment";
import { razorpayRefundProvider } from "../src/lib/refunds";
test("courier and refund HTTP contracts validate identities, secrets, money and document URLs", async (t) => {
  const original = globalThis.fetch;
  process.env.SHIPROCKET_TOKEN = "synthetic-courier-token";
  process.env.RAZORPAY_KEY_ID = "synthetic-key";
  process.env.RAZORPAY_KEY_SECRET = "synthetic-secret";
  try {
    await t.test(
      "courier lookup, create, inspect, AWB, pickup, label and manifest use fixed authenticated endpoints",
      async () => {
        const calls: { path: string; body: unknown }[] = [];
        const replies: Record<string, unknown> = {
          "/v1/external/orders": {
            data: [
              {
                id: 11,
                channel_order_id: "own-order",
                shipments: [{ id: 12 }],
              },
            ],
          },
          "/v1/external/orders/create/adhoc": { order_id: 11, shipment_id: 12 },
          "/v1/external/orders/show/11": {
            data: {
              id: 11,
              channel_order_id: "own-order",
              currency: "INR",
              payment_method: "COD",
              total: "123.45",
            },
          },
          "/v1/external/shipments/12": {
            data: {
              id: 12,
              order_id: 11,
              awb: "QA-AWB",
              courier: "QA courier",
              sr_courier_id: 101,
              pickup_generated_date: "2026-11-01 12:00:00",
              pickup_token_number: "QA-PICKUP",
              shipping_address: { pincode: 400001 },
            },
          },
          "/v1/external/courier/assign/awb": {
            awb_assign_status: 1,
            response: {
              data: {
                shipment_id: 12,
                courier_company_id: 101,
                awb_code: "QA-AWB",
                courier_name: "QA courier",
              },
            },
          },
          "/v1/external/courier/generate/pickup": {
            pickup_status: 1,
            response: { pickup_token_number: "QA-PICKUP" },
          },
          "/v1/external/courier/generate/label": {
            label_created: 1,
            label_url: "https://example.test/label.pdf",
          },
          "/v1/external/manifests/generate": {
            manifest_url: "https://example.test/manifest.pdf",
          },
        };
        globalThis.fetch = (async (input, init) => {
          const url = new URL(String(input));
          assert.equal(url.origin, "https://apiv2.shiprocket.in");
          assert.equal(
            new Headers(init?.headers).get("Authorization"),
            "Bearer synthetic-courier-token",
          );
          assert.equal(init?.redirect, "error");
          calls.push({
            path: url.pathname,
            body: init?.body ? JSON.parse(String(init.body)) : null,
          });
          assert.ok(replies[url.pathname], url.pathname);
          return Response.json(replies[url.pathname]);
        }) as typeof fetch;
        assert.deepEqual(await shiprocketProvider.find("own-order"), {
          order_id: 11,
          shipment_id: 12,
        });
        assert.equal(await shiprocketProvider.find("foreign-order"), null);
        assert.deepEqual(
          await shiprocketProvider.create({ order_id: "own-order" }),
          { order_id: 11, shipment_id: 12 },
        );
        const inspected = await shiprocketProvider.inspect(11, 12);
        assert.equal(inspected.total_paise, 12345);
        assert.equal(inspected.postal, "400001");
        assert.equal(inspected.pickup_reference, "QA-PICKUP");
        assert.equal((await shiprocketProvider.assign(12, 101)).awb, "QA-AWB");
        assert.equal(await shiprocketProvider.pickup(12), "QA-PICKUP");
        assert.equal(
          await shiprocketProvider.label(12),
          "https://example.test/label.pdf",
        );
        assert.equal(
          await shiprocketProvider.manifest(12),
          "https://example.test/manifest.pdf",
        );
        assert.deepEqual(
          calls.find((c) => c.path.endsWith("generate/pickup"))?.body,
          { shipment_id: [12] },
        );
        replies["/v1/external/courier/generate/label"] = {
          label_created: 1,
          label_url: "javascript:alert(1)",
        };
        await assert.rejects(shiprocketProvider.label(12), /unsafe|URL|url/);
        replies["/v1/external/courier/assign/awb"] = {
          awb_assign_status: 1,
          response: {
            data: {
              shipment_id: 99,
              courier_company_id: 101,
              awb_code: "wrong",
              courier_name: "QA courier",
            },
          },
        };
        await assert.rejects(
          shiprocketProvider.assign(12, 101),
          /different shipment/,
        );
      },
    );
    await t.test(
      "refund lookup stays on one payment and reuses receipt, body and provider key",
      async () => {
        const receipt = "01234567-89ab-4cde-8fab-0123456789ab",
          entity = {
            id: "rfnd_qa",
            payment_id: "pay_qa",
            amount: 12345,
            currency: "INR",
            status: "pending",
            receipt,
          };
        const calls: string[] = [];
        globalThis.fetch = (async (input, init) => {
          const url = new URL(String(input));
          assert.equal(url.origin, "https://api.razorpay.com");
          assert.equal(
            new Headers(init?.headers).get("Authorization"),
            `Basic ${Buffer.from("synthetic-key:synthetic-secret").toString("base64")}`,
          );
          assert.equal(init?.redirect, "error");
          calls.push(url.pathname);
          if (
            url.pathname.endsWith("/refunds") &&
            url.pathname.includes("/payments/")
          )
            return Response.json({ items: [entity] });
          if (init?.method === "POST") {
            assert.equal(
              new Headers(init.headers).get("X-Refund-Idempotency"),
              receipt,
            );
            assert.deepEqual(JSON.parse(String(init.body)), {
              amount: 12345,
              speed: "normal",
              receipt,
            });
          }
          return Response.json(entity);
        }) as typeof fetch;
        assert.equal(
          (await razorpayRefundProvider.find("pay_qa", receipt))?.id,
          "rfnd_qa",
        );
        assert.equal(
          await razorpayRefundProvider.find("pay_qa", "other-receipt"),
          null,
        );
        assert.equal(
          (await razorpayRefundProvider.create("pay_qa", receipt, 12345))
            .status,
          "pending",
        );
        assert.equal(
          (await razorpayRefundProvider.fetch("rfnd_qa")).amount,
          12345,
        );
        assert.ok(calls.includes("/v1/payments/pay_qa/refunds"));
        globalThis.fetch = (async () =>
          Response.json(
            { error: { description: "Private provider detail" } },
            { status: 502 },
          )) as typeof fetch;
        await assert.rejects(
          razorpayRefundProvider.fetch("rfnd_qa"),
          (error) =>
            error instanceof Error &&
            /HTTP 502/.test(error.message) &&
            !error.message.includes("Private provider detail"),
        );
        globalThis.fetch = (async () =>
          Response.json({ ...entity, currency: "USD" })) as typeof fetch;
        await assert.rejects(razorpayRefundProvider.fetch("rfnd_qa"));
      },
    );
    await t.test(
      "courier timestamps use India time and reject ambiguous or impossible dates",
      () => {
        assert.equal(
          courierTime("23 05 2023 11:43:52"),
          "2023-05-23T06:13:52.000Z",
        );
        assert.equal(
          courierTime("2026-11-01 12:00:00"),
          "2026-11-01T06:30:00.000Z",
        );
        assert.throws(() => courierTime("01/02/03"));
        assert.throws(() => courierTime("2026-02-31 12:00:00"));
      },
    );
  } finally {
    globalThis.fetch = original;
    delete process.env.SHIPROCKET_TOKEN;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  }
});
