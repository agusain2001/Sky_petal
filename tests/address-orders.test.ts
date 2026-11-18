import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { getDB, getProducts, schema } from "../src/lib/db";
import { applyMigrations } from "../src/lib/migrations";
import {
  addressSchema,
  checkoutAddress,
  saveAddress,
  listAddresses,
  deleteAddress,
} from "../src/lib/addresses";
import {
  reserveOrder,
  confirmCapturedPayment,
  expireReservations,
} from "../src/lib/commerce";
import {
  cancelPendingOrder,
  customerOrders,
  fulfillOrder,
} from "../src/lib/orders";
import type { Order, User } from "../src/lib/types";

const address = {
  name: "Test Shopper",
  phone: "9876543210",
  line1: "123 Test Street",
  line2: "Floor 2",
  landmark: "Near the park",
  city: "Mumbai",
  state: "Maharashtra",
  postal: "400001",
  country: "IN" as const,
};

test("additive migrations preserve existing orders and address books", async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.query(
      "INSERT INTO users(id,email,name) VALUES('legacy','legacy@example.test','Legacy')",
    );
    await db.query("INSERT INTO addresses VALUES('legacy-home','legacy',$1)", [
      JSON.stringify(address),
    ]);
    await db.query(
      "INSERT INTO orders(id,user_id,status,subtotal,shipping,total,address,idempotency_key) VALUES('legacy-delivered','legacy','delivered',100,0,100,$1,'legacy')",
      [JSON.stringify(address)],
    );
    await db.query(
      "INSERT INTO refunds(id,order_id,amount,status) VALUES('legacy-refund','legacy-delivered',100,'processed')",
    );
    await db.query(
      "INSERT INTO newsletter(email) VALUES('legacy@example.test')",
    );
    await applyMigrations(db);
    await applyMigrations(db);
    const order = (
      await db.query<Order>("SELECT * FROM orders WHERE id='legacy-delivered'")
    ).rows[0];
    assert.equal(order.status, "delivered");
    assert.equal(order.order_state, "completed");
    assert.equal(order.payment_state, "captured");
    assert.equal(order.delivered_at, null);
    assert.deepEqual(order.address, address);
    const saved = (
      await db.query<{ default_shipping: boolean; content: unknown }>(
        "SELECT * FROM addresses",
      )
    ).rows[0];
    assert.equal(saved.default_shipping, true);
    assert.deepEqual(saved.content, address);
    assert.equal(
      (
        await db.query<{ amount: number }>(
          "SELECT amount FROM refunds WHERE id='legacy-refund'",
        )
      ).rows[0].amount,
      100,
    );
    await assert.rejects(
      db.query(
        "UPDATE refunds SET evidence_ref='invented-backfill' WHERE id='legacy-refund'",
      ),
      /immutable/,
    );
    assert.equal(
      (await db.query("SELECT * FROM marketing_eligible_subscribers")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("SELECT * FROM order_status_events")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("SELECT * FROM schema_migrations")).rows.length,
      (await readdir("migrations")).filter((name) => /^\d+_.+\.sql$/.test(name))
        .length,
    );
    await db.query(
      "UPDATE schema_migrations SET checksum='tampered' WHERE name='002_address_book.sql'",
    );
    await assert.rejects(applyMigrations(db), /Applied migration changed/);
  } finally {
    await db.close();
  }
});

test("address book and order lifecycle vertical slices", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-domains-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  async function shopper(role = "customer") {
    const id = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,role) VALUES($1,$2,'QA shopper',$3)",
      [id, `${id}@example.test`, role],
    );
    const cart = randomUUID();
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, id]);
    return { id, cart, email: `${id}@example.test`, name: "QA shopper", role };
  }
  const one = await shopper(),
    two = await shopper(),
    staff = await shopper("fulfillment");
  try {
    let home = await saveAddress(one.id, { ...address, label: "Home" });
    let billing = await saveAddress(one.id, {
      ...address,
      label: "Office",
      kind: "billing",
    });
    await t.test(
      "first eligible address becomes default; billing addresses cannot ship",
      async () => {
        assert.equal(home.default_shipping, true);
        assert.equal(home.default_billing, true);
        assert.equal(billing.default_shipping, false);
        await assert.rejects(
          checkoutAddress(one.id, billing.id, "shipping"),
          /saved shipping/,
        );
        assert.deepEqual(
          await checkoutAddress(one.id, home.id, "shipping"),
          address,
        );
      },
    );
    await t.test(
      "address validation trims input and rejects country, PIN and phone errors",
      () => {
        assert.equal(
          addressSchema.parse({ ...address, name: "  Test Shopper  " }).name,
          address.name,
        );
        for (const invalid of [
          { postal: "000000" },
          { postal: "40001" },
          { phone: "1234567890" },
          { country: "US" },
          { line1: "   " },
        ])
          assert.equal(
            addressSchema.safeParse({ ...address, ...invalid }).success,
            false,
          );
      },
    );
    await t.test(
      "ownership applies to edit, delete, shipping and billing resolution",
      async () => {
        await assert.rejects(
          saveAddress(two.id, { ...address, label: "Stolen" }, home.id),
          /not found/,
        );
        await assert.rejects(deleteAddress(two.id, home.id), /not found/);
        await assert.rejects(
          checkoutAddress(two.id, home.id, "shipping"),
          /saved shipping/,
        );
        await assert.rejects(
          checkoutAddress(two.id, billing.id, "billing"),
          /saved billing/,
        );
        assert.equal((await listAddresses(two.id)).length, 0);
      },
    );
    await t.test(
      "parallel default changes retain exactly one default per purpose",
      async () => {
        await Promise.all([
          saveAddress(one.id, {
            ...address,
            label: "Work",
            default_shipping: true,
          }),
          saveAddress(one.id, {
            ...address,
            label: "Family",
            default_shipping: true,
          }),
        ]);
        const all = await listAddresses(one.id);
        assert.equal(all.filter((item) => item.default_shipping).length, 1);
        assert.equal(all.filter((item) => item.default_billing).length, 1);
      },
    );
    await t.test(
      "changing address purpose repairs defaults; deleting a default promotes another",
      async () => {
        billing = await saveAddress(
          one.id,
          {
            ...address,
            label: "Office",
            kind: "billing",
            default_billing: true,
          },
          billing.id,
        );
        const changed = await saveAddress(
          one.id,
          { ...address, label: "Office", kind: "shipping" },
          billing.id,
        );
        assert.equal(changed.default_billing, false);
        await deleteAddress(
          one.id,
          (await listAddresses(one.id)).find((item) => item.default_shipping)!
            .id,
        );
        const all = await listAddresses(one.id);
        assert.equal(all.filter((item) => item.default_shipping).length, 1);
        assert.equal(all.filter((item) => item.default_billing).length, 1);
      },
    );
    home = await saveAddress(
      one.id,
      {
        ...address,
        label: "Home",
        kind: "both",
        default_shipping: true,
        default_billing: true,
      },
      home.id,
    );
    const variant = (await getProducts())[0].variants.find(
      (item) => item.stock > 4,
    )!;
    async function reserve(user = one) {
      await db.query(
        "INSERT INTO cart_items VALUES($1,$2,1) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=1",
        [user.cart, variant.id],
      );
      return (await reserveOrder(
        user.id,
        user.cart,
        await checkoutAddress(one.id, home.id, "shipping"),
        "",
        randomUUID(),
        address,
      )) as unknown as Order;
    }
    const order = await reserve();
    await t.test(
      "order preserves shipping, billing and SKU snapshots after address edits",
      async () => {
        await saveAddress(
          one.id,
          { ...address, line1: "999 New Street", label: "Home" },
          home.id,
        );
        const saved = (await customerOrders(one.id, order.id))[0];
        assert.deepEqual(saved.address, address);
        assert.deepEqual(saved.billing_address, address);
        assert.equal(
          (
            await db.query<{ sku: string }>(
              "SELECT sku FROM order_items WHERE order_id=$1",
              [order.id],
            )
          ).rows[0].sku,
          variant.sku,
        );
        assert.equal(saved.order_state, "pending_payment");
        assert.equal(saved.payment_state, "pending");
        assert.equal(saved.fulfillment_state, "unfulfilled");
        assert.equal(saved.events?.length, 1);
      },
    );
    await t.test(
      "customers cannot inspect or cancel another customer's order",
      async () => {
        assert.deepEqual(await customerOrders(two.id, order.id), []);
        await assert.rejects(cancelPendingOrder(two.id, order.id), /not found/);
      },
    );
    await t.test(
      "concurrent cancellation releases reservation exactly once and records one transition",
      async () => {
        const before = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        await Promise.all([
          cancelPendingOrder(one.id, order.id),
          cancelPendingOrder(one.id, order.id),
        ]);
        const after = (
          await db.query<{ stock: number }>(
            "SELECT stock FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0].stock;
        assert.equal(after, before + 1);
        const saved = (await customerOrders(one.id, order.id))[0];
        assert.equal(saved.order_state, "cancelled");
        assert.equal(saved.payment_state, "pending");
        assert.equal(saved.events?.length, 2);
        assert.equal(
          (
            await db.query("SELECT * FROM audit_logs WHERE target_id=$1", [
              order.id,
            ])
          ).rows.length,
          1,
        );
      },
    );
    const paid = await reserve();
    const provider = `order_${randomUUID()}`;
    const payment = `pay_${randomUUID()}`;
    await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
      provider,
      paid.id,
    ]);
    await t.test(
      "wrong currency and capture without provider evidence cannot mark paid",
      async () => {
        await assert.rejects(
          confirmCapturedPayment(
            provider,
            payment,
            paid.total,
            "USD",
            randomUUID(),
          ),
          /does not match/,
        );
        await assert.rejects(
          db.query("UPDATE orders SET status='paid' WHERE id=$1", [paid.id]),
          /evidence/,
        );
        await assert.rejects(
          db.query("UPDATE orders SET payment_state='captured' WHERE id=$1", [
            paid.id,
          ]),
          /Lifecycle/,
        );
      },
    );
    await confirmCapturedPayment(
      provider,
      payment,
      paid.total,
      "INR",
      `event_${randomUUID()}`,
    );
    await t.test(
      "capture and fulfillment keep payment and fulfillment independent",
      async () => {
        let saved = (await customerOrders(one.id, paid.id))[0];
        assert.equal(saved.payment_state, "captured");
        assert.equal(saved.fulfillment_state, "unfulfilled");
        await assert.rejects(
          fulfillOrder(one as User, {
            id: paid.id,
            status: "processing",
            carrier: "",
            tracking: "",
          }),
          /permission/,
        );
        await assert.rejects(
          fulfillOrder(staff, {
            id: paid.id,
            status: "delivered",
            carrier: "",
            tracking: "",
          }),
          /cannot move/,
        );
        await fulfillOrder(staff, {
          id: paid.id,
          status: "processing",
          carrier: "",
          tracking: "",
        });
        saved = (await customerOrders(one.id, paid.id))[0];
        assert.equal(saved.payment_state, "captured");
        assert.equal(saved.fulfillment_state, "processing");
        await assert.rejects(
          cancelPendingOrder(one.id, paid.id),
          /cannot be cancelled/,
        );
      },
    );
    await t.test(
      "shipment persistence failure rolls back fulfillment and history together",
      async () => {
        await db.query("INSERT INTO shipments(id,order_id) VALUES($1,$2)", [
          randomUUID(),
          paid.id,
        ]);
        await assert.rejects(
          fulfillOrder(staff, {
            id: paid.id,
            status: "shipped",
            carrier: "QA courier",
            tracking: "QA-AWB",
          }),
          /duplicate key/,
        );
        assert.equal(
          (await customerOrders(one.id, paid.id))[0].fulfillment_state,
          "processing",
        );
        await db.query("DELETE FROM shipments WHERE order_id=$1", [paid.id]);
        await assert.rejects(
          fulfillOrder(staff, {
            id: paid.id,
            status: "shipped",
            carrier: "",
            tracking: "",
          }),
          /carrier/,
        );
        await fulfillOrder(staff, {
          id: paid.id,
          status: "shipped",
          carrier: "QA courier",
          tracking: "QA-AWB",
        });
        const saved = (await customerOrders(one.id, paid.id))[0];
        assert.equal(saved.shipment?.tracking, "QA-AWB");
        assert.equal(saved.payment_state, "captured");
      },
    );
    await t.test(
      "delivery records its actual timestamp and immutable state history",
      async () => {
        await fulfillOrder(staff, {
          id: paid.id,
          status: "delivered",
          carrier: "",
          tracking: "",
        });
        const saved = (await customerOrders(one.id, paid.id))[0];
        assert.equal(saved.order_state, "completed");
        assert.equal(saved.fulfillment_state, "delivered");
        assert.equal(saved.payment_state, "captured");
        assert.ok(saved.delivered_at);
        assert.equal(saved.events?.length, 5);
        await assert.rejects(
          db.query("UPDATE orders SET status='processing' WHERE id=$1", [
            paid.id,
          ]),
          /transition/,
        );
        for (const sql of [
          "UPDATE orders SET total=1 WHERE id=$1",
          "UPDATE orders SET address='{}' WHERE id=$1",
          "DELETE FROM orders WHERE id=$1",
        ])
          await assert.rejects(db.query(sql, [paid.id]), /immutable/);
        for (const table of ["order_items", "order_status_events", "payments"])
          await assert.rejects(
            db.query(`DELETE FROM ${table} WHERE order_id=$1`, [paid.id]),
            /append-only/,
          );
      },
    );
    await t.test(
      "different payment on an already paid order requires reconciliation",
      async () => {
        await assert.rejects(
          confirmCapturedPayment(
            provider,
            "pay_extra",
            paid.total,
            "INR",
            randomUUID(),
          ),
          /Additional payment/,
        );
        const result = await confirmCapturedPayment(
          provider,
          payment,
          paid.total,
          "INR",
          randomUUID(),
        );
        assert.equal(result.duplicate, true);
      },
    );
    await t.test(
      "capture versus cancellation cannot both commit inventory",
      async () => {
        const contested = await reserve(two),
          provider = `order_${randomUUID()}`;
        await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
          provider,
          contested.id,
        ]);
        const before = (
          await db.query<{ stock: number; reserved: number }>(
            "SELECT stock,reserved FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0];
        const results = await Promise.allSettled([
          cancelPendingOrder(two.id, contested.id),
          confirmCapturedPayment(
            provider,
            `pay_${randomUUID()}`,
            contested.total,
            "INR",
            randomUUID(),
          ),
        ]);
        assert.equal(
          results.filter((result) => result.status === "fulfilled").length,
          1,
        );
        const saved = (await customerOrders(two.id, contested.id))[0];
        const after = (
          await db.query<{ stock: number; reserved: number }>(
            "SELECT stock,reserved FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0];
        assert.equal(after.reserved, before.reserved - 1);
        assert.equal(
          after.stock,
          before.stock + (saved.status === "cancelled" ? 1 : 0),
        );
        assert.equal(saved.events?.length, 2);
      },
    );
    await t.test(
      "capture after reservation expiry fails safely and releases stock once",
      async () => {
        const late = await reserve(two);
        const lateProvider = `order_${randomUUID()}`;
        await db.query(
          "UPDATE orders SET provider_id=$1,expires_at=now()-interval '1 hour' WHERE id=$2",
          [lateProvider, late.id],
        );
        await assert.rejects(
          confirmCapturedPayment(
            lateProvider,
            `pay_${randomUUID()}`,
            late.total,
            "INR",
            randomUUID(),
          ),
          /reconciliation/,
        );
        await expireReservations(db);
        const saved = (await customerOrders(two.id, late.id))[0];
        assert.equal(saved.order_state, "expired");
        assert.equal(saved.payment_state, "expired");
      },
    );
    await t.test(
      "browser RLS hides another customer's state events and addresses",
      async () => {
        await db.exec(
          "CREATE ROLE domain_browser NOLOGIN; GRANT USAGE ON SCHEMA public TO domain_browser; GRANT SELECT ON addresses,orders,order_status_events TO domain_browser;",
        );
        await db.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE domain_browser");
          await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
            two.id,
          ]);
          assert.equal(
            (await tx.query("SELECT * FROM addresses")).rows.length,
            0,
          );
          assert.equal(
            (
              await tx.query(
                "SELECT * FROM order_status_events WHERE order_id=$1",
                [paid.id],
              )
            ).rows.length,
            0,
          );
        });
      },
    );
  } finally {
    await db.close();
  }
});
