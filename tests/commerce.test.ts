import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHmac } from "node:crypto";
import { getDB, getProducts } from "../src/lib/db";
import {
  reserveOrder,
  confirmCapturedPayment,
  expireReservations,
  signatureValid,
} from "../src/lib/commerce";
import { hashPassword, checkPassword } from "../src/lib/auth";
test("Sky Petal commerce and security invariants", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-tests-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  const products = await getProducts();
  const p = products.find(
    (p) => p.variants.filter((v) => v.stock > 0).length >= 2,
  )!;
  const v = p.variants.find((v) => v.stock > 0)!;
  const uid = randomUUID();
  const cart = randomUUID();
  await db.query("INSERT INTO users(id,email,name) VALUES($1,$2,$3)", [
    uid,
    `${uid}@example.test`,
    "Test shopper",
  ]);
  await db.query("INSERT INTO carts VALUES($1,$2)", [cart, uid]);
  const address = {
    name: "Test Shopper",
    line1: "123 Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    postal: "400001",
    phone: "9876543210",
  };
  await t.test(
    "database has actual product variants with unique SKUs and sold-out combinations",
    () => {
      assert.ok(products.length >= 10);
      assert.ok(products.every((p) => p.variants.length > 0));
      const skus = products.flatMap((p) => p.variants.map((v) => v.sku));
      assert.equal(new Set(skus).size, skus.length);
      assert.ok(products.some((p) => p.variants.some((v) => v.stock === 0)));
    },
  );
  await t.test("passwords are salted and wrong passwords fail", () => {
    const one = hashPassword("Correct-Password-123");
    const two = hashPassword("Correct-Password-123");
    assert.notEqual(one, two);
    assert.equal(checkPassword("Correct-Password-123", one), true);
    assert.equal(checkPassword("wrong-password", one), false);
  });
  await t.test(
    "payment signature rejects forged and malformed payloads",
    () => {
      const s = createHmac("sha256", "secret")
        .update("order|payment")
        .digest("hex");
      assert.ok(signatureValid("order|payment", s, "secret"));
      assert.equal(signatureValid("order|other", s, "secret"), false);
      assert.equal(signatureValid("order|payment", "x", "secret"), false);
    },
  );
  await db.query("INSERT INTO cart_items VALUES($1,$2,2)", [cart, v.id]);
  let oid = "";
  await t.test(
    "server computes prices, coupons and shipping and reserves actual inventory",
    async () => {
      const o = await reserveOrder(uid, cart, address, "SOFT10", "checkout-1");
      oid = o.id as string;
      const subtotal = v.price * 2;
      assert.equal(o.subtotal, subtotal);
      assert.equal(o.discount, Math.floor(subtotal * 0.1));
      assert.equal(
        o.total,
        subtotal -
          Math.floor(subtotal * 0.1) +
          (subtotal * 0.9 >= 299000 ? 0 : 9900),
      );
      const after = (
        await db.query<{ stock: number; reserved: number }>(
          "SELECT stock,reserved FROM product_variants WHERE id=$1",
          [v.id],
        )
      ).rows[0];
      assert.equal(after.stock, v.stock - 2);
      assert.equal(after.reserved, 2);
    },
  );
  await t.test(
    "duplicate checkout reuses order without reserving twice",
    async () => {
      const duplicate = await reserveOrder(
        uid,
        cart,
        address,
        "SOFT10",
        "checkout-1",
      );
      assert.equal(duplicate.id, oid);
      assert.equal(
        (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [v.id],
          )
        ).rows[0].stock,
        v.stock - 2,
      );
    },
  );
  await t.test("out of stock rolls back whole checkout", async () => {
    await db.query("UPDATE cart_items SET quantity=20 WHERE cart_id=$1", [
      cart,
    ]);
    const before = (
      await db.query<{ count: string }>("SELECT count(*) FROM orders")
    ).rows[0].count;
    await assert.rejects(
      reserveOrder(uid, cart, address, "", "checkout-oversell"),
      /enough stock/,
    );
    assert.equal(
      (await db.query<{ count: string }>("SELECT count(*) FROM orders")).rows[0]
        .count,
      before,
    );
    await db.query("UPDATE cart_items SET quantity=2 WHERE cart_id=$1", [cart]);
  });
  await t.test("invalid coupons cannot create an order", async () => {
    await assert.rejects(
      reserveOrder(uid, cart, address, "FORGED", "bad-coupon"),
      /not valid/,
    );
  });
  const provider = "order_test_" + randomUUID();
  await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
    provider,
    oid,
  ]);
  const total = (
    await db.query<{ total: number }>("SELECT total FROM orders WHERE id=$1", [
      oid,
    ])
  ).rows[0].total;
  await t.test("captured payment must match amount and currency", async () => {
    await assert.rejects(
      confirmCapturedPayment(
        provider,
        "pay_mismatch",
        total + 1,
        "INR",
        "bad-event",
      ),
      /does not match/,
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          "SELECT status FROM orders WHERE id=$1",
          [oid],
        )
      ).rows[0].status,
      "pending_payment",
    );
  });
  await t.test(
    "verified capture marks paid once and clears purchased cart items",
    async () => {
      const r = await confirmCapturedPayment(
        provider,
        "pay_test_1",
        total,
        "INR",
        "event_1",
      );
      assert.equal(r.paid, true);
      assert.equal(
        (
          await db.query<{ status: string }>(
            "SELECT status FROM orders WHERE id=$1",
            [oid],
          )
        ).rows[0].status,
        "paid",
      );
      assert.equal(
        (await db.query("SELECT * FROM cart_items WHERE cart_id=$1", [cart]))
          .rows.length,
        0,
      );
      assert.equal(
        (
          await db.query<{ reserved: number }>(
            "SELECT reserved FROM product_variants WHERE id=$1",
            [v.id],
          )
        ).rows[0].reserved,
        0,
      );
    },
  );
  await t.test(
    "duplicate webhooks cannot consume inventory twice or duplicate payment",
    async () => {
      const r = await confirmCapturedPayment(
        provider,
        "pay_test_1",
        total,
        "INR",
        "event_1",
      );
      assert.equal(r.duplicate, true);
      assert.equal(
        (await db.query("SELECT * FROM payments WHERE order_id=$1", [oid])).rows
          .length,
        1,
      );
      assert.equal(
        (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [v.id],
          )
        ).rows[0].stock,
        v.stock - 2,
      );
    },
  );
  await t.test(
    "abandoned reservations expire and release stock once",
    async () => {
      await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [cart, v.id]);
      const o = await reserveOrder(uid, cart, address, "", "expiry-test");
      await db.query(
        "UPDATE orders SET expires_at=now()-interval '1 hour' WHERE id=$1",
        [o.id],
      );
      await expireReservations(db);
      await expireReservations(db);
      assert.equal(
        (
          await db.query<{ status: string }>(
            "SELECT status FROM orders WHERE id=$1",
            [o.id],
          )
        ).rows[0].status,
        "expired",
      );
      assert.equal(
        (
          await db.query<{ stock: number; reserved: number }>(
            "SELECT stock,reserved FROM product_variants WHERE id=$1",
            [v.id],
          )
        ).rows[0].stock,
        v.stock - 2,
      );
    },
  );
  await t.test("parallel checkouts cannot oversell the final SKU", async () => {
    const variant = p.variants.find((x) => x.id !== v.id && x.stock > 0)!;
    await db.query("UPDATE product_variants SET stock=1 WHERE id=$1", [
      variant.id,
    ]);
    const shoppers = await Promise.all(
      [0, 1].map(async () => {
        const uid = randomUUID();
        const cid = randomUUID();
        await db.query("INSERT INTO users(id,email,name) VALUES($1,$2,$3)", [
          uid,
          uid + "@example.test",
          "Race shopper",
        ]);
        await db.query("INSERT INTO carts VALUES($1,$2)", [cid, uid]);
        await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
          cid,
          variant.id,
        ]);
        return { uid, cid };
      }),
    );
    const results = await Promise.allSettled(
      shoppers.map((s) =>
        reserveOrder(s.uid, s.cid, address, "", randomUUID()),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (
        await db.query<{ stock: number }>(
          "SELECT stock FROM product_variants WHERE id=$1",
          [variant.id],
        )
      ).rows[0].stock,
      0,
    );
  });
  await t.test(
    "row level security hides other users and sessions from browser roles",
    async () => {
      await db.exec(
        "CREATE ROLE sky_browser NOLOGIN; GRANT USAGE ON SCHEMA public TO sky_browser; GRANT SELECT ON users,orders,order_items,sessions,products,product_variants TO sky_browser;",
      );
      await db.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE sky_browser");
        await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
          uid,
        ]);
        const users = await tx.query<{ id: string }>("SELECT id FROM users");
        assert.deepEqual(
          users.rows.map((x) => x.id),
          [uid],
        );
        const orders = await tx.query<{ user_id: string }>(
          "SELECT user_id FROM orders",
        );
        assert.ok(orders.rows.every((o) => o.user_id === uid));
        assert.equal((await tx.query("SELECT * FROM sessions")).rows.length, 0);
      });
    },
  );
  await db.close();
});
