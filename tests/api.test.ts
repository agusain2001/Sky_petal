import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL;
test("HTTP customer journey and authorization", { skip: !base }, async (t) => {
  let jar = "";
  async function call(
    path: string,
    body?: unknown,
    guest = false,
    method?: string,
  ) {
    const r = await fetch(`${base}/api/${path}`, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        ...(guest ? {} : { Cookie: jar }),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Origin: base!,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookies = r.headers.getSetCookie();
    if (!guest && cookies.length) {
      const values = new Map(
        jar
          .split("; ")
          .filter(Boolean)
          .map((c) => c.split("=") as [string, string]),
      );
      for (const c of cookies) {
        const [k, v] = c.split(";")[0].split("=");
        values.set(k, v);
      }
      jar = [...values.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    return { status: r.status, data: await r.json() };
  }
  const catalog = await call("catalog");
  assert.equal(catalog.status, 200);
  const product = catalog.data.products[0];
  const variant = product.variants.find((v: { stock: number }) => v.stock > 0);
  await t.test("guest can browse and add exact SKU", async () => {
    const r = await call("cart", { variant_id: variant.id, quantity: 1 });
    assert.equal(r.status, 200);
    assert.equal((await call("cart")).data.items[0].variant_id, variant.id);
  });
  await t.test("guest bag survives subsequent requests", async () => {
    assert.equal((await call("cart")).data.items[0].quantity, 1);
  });
  await t.test("guest cannot check out or read orders/admin", async () => {
    assert.equal((await call("checkout", {})).status, 401);
    assert.equal((await call("orders")).status, 401);
    assert.equal((await call("admin")).status, 401);
  });
  await t.test("invalid SKU and excess stock rejected", async () => {
    assert.equal(
      (await call("cart", { variant_id: "nonexistent", quantity: 1 })).status,
      400,
    );
    assert.equal(
      (await call("cart", { variant_id: variant.id, quantity: 20 })).status,
      400,
    );
  });
  await t.test("combined URL filters use matching SKU", async () => {
    const r = await call(
      "catalog?category=" +
        product.category +
        "&size=" +
        encodeURIComponent(variant.size) +
        "&color=" +
        encodeURIComponent(variant.color) +
        "&stock=true&sort=price-asc",
    );
    assert.equal(r.status, 200);
    assert.ok(r.data.products.length > 0);
    for (const p of r.data.products)
      assert.ok(
        p.variants.some(
          (v: { size: string; color: string; stock: number }) =>
            v.size === variant.size && v.color === variant.color && v.stock > 0,
        ),
      );
  });
  const email = randomUUID() + "@example.test";
  await t.test("registration merges guest bag into account", async () => {
    const r = await call("auth", {
      action: "register",
      email,
      password: "Testing-Password-123!",
      name: "QA shopper",
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, "customer");
    assert.equal((await call("cart")).data.items[0].quantity, 1);
  });
  await t.test("customer cannot gain administrator access", async () => {
    assert.equal((await call("admin")).status, 403);
    assert.equal((await call("admin/product", {})).status, 403);
    assert.equal((await call("admin/cms", {})).status, 403);
    assert.equal((await call("admin/payments")).status, 403);
    assert.equal((await call("admin/payment-attempts")).status, 403);
    assert.equal(
      (await call("admin/payment-attempts/reconcile", { id: "forged" })).status,
      403,
    );
    assert.equal((await call("admin/commerce")).status, 403);
    assert.equal((await call("admin/cod")).status, 403);
    assert.equal((await call("admin/cod", { verified: true })).status, 403);
    assert.equal((await call("admin/tax-class", {})).status, 403);
    assert.equal(
      (await call("admin/payments/retry", { id: "forged" })).status,
      403,
    );
  });
  await t.test(
    "private address create/edit/default/delete and cross-origin checks",
    async () => {
      const address = {
        name: "QA Shopper",
        phone: "9876543210",
        line1: "123 QA Street",
        line2: "Floor 2",
        landmark: "Near QA Park",
        city: "Mumbai",
        state: "Maharashtra",
        postal: "400001",
        country: "IN",
        label: "Home",
      };
      assert.equal((await call("addresses")).status, 200);
      assert.equal(
        (await call("addresses", { ...address, postal: "000000" })).status,
        400,
      );
      assert.equal((await call("addresses", address, true)).status, 401);
      const created = await call("addresses", address);
      assert.equal(created.status, 201);
      assert.equal(created.data.default_shipping, true);
      const savedId = created.data.id;
      const updated = await call(
        `addresses/${savedId}`,
        { ...address, label: "Office", line1: "456 QA Street" },
        false,
        "PATCH",
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.data.content.line1, "456 QA Street");
      const list = await call("addresses");
      assert.equal(list.data.length, 1);
      assert.equal(list.data[0].label, "Office");
      assert.equal(
        (await call("addresses/other-customer-id", address, false, "PATCH"))
          .status,
        404,
      );
      const forbidden = await fetch(base + `/api/addresses/${savedId}`, {
        method: "DELETE",
        headers: { Cookie: jar, Origin: "https://attacker.invalid" },
      });
      assert.equal(forbidden.status, 403);
      assert.equal(
        (await call(`addresses/${savedId}`, {}, false, "DELETE")).status,
        200,
      );
      assert.equal((await call("addresses")).data.length, 0);
    },
  );
  await t.test("server quote ignores forged client prices", async () => {
    const r = await call("quote", { coupon: "SOFT10", subtotal: 1, price: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.data.subtotal, variant.price);
    assert.equal(r.data.discount, Math.floor(variant.price * 0.1));
  });
  await t.test(
    "customer support persists private requests and replies without staff access",
    async () => {
      const ticket = await call("support/tickets", {
        subject: "A fit question",
        body: "Please help me understand the fit of this garment.",
        topic: "fit",
        idempotency_key: randomUUID(),
      });
      assert.equal(ticket.status, 201);
      const id = ticket.data.id;
      assert.equal(
        (await call(`support/tickets/${id}`)).data.messages.length,
        1,
      );
      assert.equal(
        (
          await call(`support/tickets/${id}/reply`, {
            body: "Here is an additional fit detail.",
          })
        ).status,
        200,
      );
      assert.equal(
        (await call(`support/tickets/${id}`)).data.messages.length,
        2,
      );
      assert.equal(
        (
          await call(`support/tickets/${id}/reply`, {
            body: "A forbidden note",
            visibility: "internal",
          })
        ).status,
        403,
      );
      assert.equal((await call("admin/support")).status, 403);
    },
  );
  await t.test("unconfigured payment fails closed", async () => {
    assert.equal(
      (await call("checkout", { address: {}, idempotency: "test" })).status,
      503,
    );
    assert.equal((await call("payments/webhook", {})).status, 503);
  });
  await t.test("account only sees own orders", async () => {
    assert.equal((await call("orders")).status, 200);
    assert.deepEqual((await call("orders")).data, []);
  });
  await t.test("cross-origin mutations rejected", async () => {
    const r = await fetch(base + "/api/cart", {
      method: "POST",
      headers: {
        Cookie: jar,
        Origin: "https://attacker.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ variant_id: variant.id, quantity: 1 }),
    });
    assert.equal(r.status, 403);
  });
  await t.test(
    "logout removes private access; guest cart merges on next login",
    async () => {
      await call("logout", {});
      assert.equal((await call("orders")).status, 401);
      await call("cart", { variant_id: variant.id, quantity: 2 });
      const r = await call("auth", {
        action: "login",
        email,
        password: "Testing-Password-123!",
      });
      assert.equal(r.status, 200);
      assert.equal((await call("cart")).data.items[0].quantity, 3);
    },
  );
  await t.test("data export returns only signed-in profile", async () => {
    const r = await call("privacy", { kind: "export" });
    assert.equal(r.data.profile.email, email);
    assert.equal(r.data.profile.password_hash, undefined);
  });
  await t.test(
    "password changes require the current password and preserve account ownership",
    async () => {
      assert.equal(
        (
          await call("password", {
            password: "A-New-Testing-Password-123!",
            current_password: "wrong-password",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("password", {
            password: "A-New-Testing-Password-123!",
            current_password: "Testing-Password-123!",
          })
        ).status,
        200,
      );
      await call("logout", {});
      assert.equal(
        (
          await call("auth", {
            action: "login",
            email,
            password: "Testing-Password-123!",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("auth", {
            action: "login",
            email,
            password: "A-New-Testing-Password-123!",
          })
        ).status,
        200,
      );
    },
  );
});
