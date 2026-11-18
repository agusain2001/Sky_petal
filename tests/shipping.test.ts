import { test } from "node:test";
import assert from "node:assert/strict";
import { shiprocketQuote, rupeesToPaise } from "../src/lib/shipping";
test("Shiprocket adapter validates provider results and never invents serviceability", async (t) => {
  const original = globalThis.fetch;
  const old = {
    token: process.env.SHIPROCKET_TOKEN,
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  };
  const request = {
    origin: "400001",
    destination: "110001",
    weight_grams: 500,
    cod: true,
    value_paise: 12345,
  };
  try {
    delete process.env.SHIPROCKET_TOKEN;
    delete process.env.SHIPROCKET_EMAIL;
    delete process.env.SHIPROCKET_PASSWORD;
    await t.test(
      "missing configuration fails before any external request",
      async () => {
        globalThis.fetch = async () => {
          throw new Error("Network must not be called");
        };
        await assert.rejects(shiprocketQuote(request), /not configured/);
      },
    );
    process.env.SHIPROCKET_TOKEN = "synthetic-test-token";
    await t.test(
      "authenticated request sends actual pincodes, weight, method and value",
      async () => {
        globalThis.fetch = async (input, init) => {
          const url = new URL(String(input));
          assert.equal(url.origin, "https://apiv2.shiprocket.in");
          assert.equal(url.searchParams.get("pickup_postcode"), "400001");
          assert.equal(url.searchParams.get("delivery_postcode"), "110001");
          assert.equal(url.searchParams.get("weight"), "0.5");
          assert.equal(url.searchParams.get("cod"), "1");
          assert.equal(url.searchParams.get("declared_value"), "123.45");
          assert.equal(
            new Headers(init?.headers).get("authorization"),
            "Bearer synthetic-test-token",
          );
          assert.equal(init?.redirect, "error");
          assert.ok(init?.signal);
          return Response.json({
            status: 200,
            data: {
              available_courier_companies: [
                {
                  courier_company_id: 1,
                  courier_name: "Prepaid only",
                  rate: 50,
                  cod: 0,
                },
                {
                  courier_company_id: 2,
                  courier_name: "Synthetic COD",
                  city: "NEW DELHI",
                  state: "Delhi",
                  postcode: "110001",
                  rate: "123.45",
                  cod: 1,
                  etd: "Synthetic estimate",
                },
              ],
            },
          });
        };
        const options = await shiprocketQuote(request);
        assert.equal(options.length, 1);
        assert.equal(options[0].rate_paise, 12345);
        assert.equal(options[0].courier_id, 2);
        assert.equal(options[0].destination_state, "Delhi");
        assert.equal(options[0].destination_postcode, "110001");
        assert.equal(
          JSON.stringify(options).includes("synthetic-test-token"),
          false,
        );
      },
    );
    await t.test(
      "invalid rates, malformed responses, unauthorized and unavailable routes fail closed",
      async () => {
        for (const value of [-1, "1.001", "1e3", NaN, Infinity, "not-a-rate"])
          assert.throws(() => rupeesToPaise(value), /invalid rate/);
        globalThis.fetch = async () =>
          Response.json({
            status: 200,
            data: {
              available_courier_companies: [
                {
                  courier_company_id: 1,
                  courier_name: "Bad rate",
                  rate: -1,
                  cod: 1,
                },
              ],
            },
          });
        await assert.rejects(shiprocketQuote(request), /invalid rate/);
        globalThis.fetch = async () => Response.json({ status: 422 });
        await assert.rejects(
          shiprocketQuote(request),
          /not currently available/,
        );
        globalThis.fetch = async () =>
          new Response("sensitive-provider-error", { status: 401 });
        await assert.rejects(shiprocketQuote(request), /could not be checked/);
      },
    );
    await t.test(
      "email authentication obtains a server-only token and caches it",
      async () => {
        delete process.env.SHIPROCKET_TOKEN;
        process.env.SHIPROCKET_EMAIL = "synthetic@example.test";
        process.env.SHIPROCKET_PASSWORD = "synthetic-password";
        let logins = 0;
        globalThis.fetch = async (input, init) => {
          if (String(input).endsWith("/auth/login")) {
            logins++;
            assert.equal(init?.method, "POST");
            assert.deepEqual(JSON.parse(String(init?.body)), {
              email: "synthetic@example.test",
              password: "synthetic-password",
            });
            return Response.json({ token: "synthetic-login-token" });
          }
          assert.equal(
            new Headers(init?.headers).get("authorization"),
            "Bearer synthetic-login-token",
          );
          return Response.json({
            status: 200,
            data: { available_courier_companies: [] },
          });
        };
        await shiprocketQuote(request);
        await shiprocketQuote(request);
        assert.equal(logins, 1);
      },
    );
  } finally {
    globalThis.fetch = original;
    for (const [key, value] of [
      ["SHIPROCKET_TOKEN", old.token],
      ["SHIPROCKET_EMAIL", old.email],
      ["SHIPROCKET_PASSWORD", old.password],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
