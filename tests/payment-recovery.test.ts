import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import { reserveOrder } from "../src/lib/commerce";
import {
  paymentInbox,
  receiveVerifiedCapture,
  processCapture,
  runCommerceMaintenance,
  type CaptureEvidence,
} from "../src/lib/payment-inbox";

test("payment inbox, checkout identity and maintenance recovery", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-payment-recovery-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  const address = {
    name: "Recovery QA",
    phone: "9876543210",
    line1: "123 Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    postal: "400001",
  };
  const user = randomUUID(),
    cart = randomUUID();
  await db.query(
    "INSERT INTO users(id,email,name) VALUES($1,$2,'Recovery QA')",
    [user, `${user}@example.test`],
  );
  await db.query("INSERT INTO carts VALUES($1,$2)", [cart, user]);
  const variant = (await getProducts())[0].variants.find(
    (variant) => variant.stock > 5,
  )!;
  async function order(key: string = randomUUID()) {
    await db.query(
      "INSERT INTO cart_items VALUES($1,$2,1) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=1",
      [cart, variant.id],
    );
    return reserveOrder(user, cart, address, "", key);
  }
  const stock = async () =>
    (
      await db.query<{ stock: number; reserved: number }>(
        "SELECT stock,reserved FROM product_variants WHERE id=$1",
        [variant.id],
      )
    ).rows[0];
  try {
    const first = await order("stable-key");
    await t.test(
      "checkout key binds quantities, coupon and both address snapshots",
      async () => {
        const before = await stock();
        assert.equal(
          (await reserveOrder(user, cart, address, "", "stable-key")).id,
          first.id,
        );
        await assert.rejects(
          reserveOrder(
            user,
            cart,
            { ...address, line1: "999 Other Street" },
            "",
            "stable-key",
          ),
          /details changed/,
        );
        await assert.rejects(
          reserveOrder(user, cart, address, "SOFT10", "stable-key"),
          /details changed/,
        );
        await assert.rejects(
          reserveOrder(user, cart, address, "", "stable-key", {
            ...address,
            line1: "999 Billing Street",
          }),
          /details changed/,
        );
        await db.query("UPDATE cart_items SET quantity=2 WHERE cart_id=$1", [
          cart,
        ]);
        await assert.rejects(
          reserveOrder(user, cart, address, "", "stable-key"),
          /details changed/,
        );
        await db.query("UPDATE cart_items SET quantity=1 WHERE cart_id=$1", [
          cart,
        ]);
        await db.query(
          "UPDATE product_variants SET price=price+100 WHERE id=$1",
          [variant.id],
        );
        await assert.rejects(
          reserveOrder(user, cart, address, "", "stable-key"),
          /details changed/,
        );
        await db.query(
          "UPDATE product_variants SET price=price-100 WHERE id=$1",
          [variant.id],
        );
        assert.deepEqual(await stock(), before);
      },
    );
    const evidence: CaptureEvidence = {
      id: `webhook:${randomUUID()}`,
      provider_order_id: `order_${randomUUID()}`,
      payment_id: `pay_${randomUUID()}`,
      amount: first.total as number,
      currency: "INR",
      source: "webhook",
    };
    await t.test(
      "verified capture is retained before processing when its order is unknown",
      async () => {
        await assert.rejects(
          receiveVerifiedCapture(evidence),
          /does not match/,
        );
        const inbox = (await paymentInbox())[0];
        assert.equal(inbox.id, evidence.id);
        assert.equal(inbox.status, "failed");
        assert.equal(inbox.attempts, 1);
        assert.match(inbox.last_error!, /does not match/);
        assert.equal(Object.hasOwn(inbox, "email"), false);
      },
    );
    await t.test(
      "operator retry recovers the retained event without reserving inventory again",
      async () => {
        await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
          evidence.provider_order_id,
          first.id,
        ]);
        const before = await stock();
        const result = await processCapture(evidence.id);
        assert.ok("paid" in result && result.paid);
        assert.equal((await stock()).stock, before.stock);
        assert.equal((await stock()).reserved, before.reserved - 1);
        const inbox = (await paymentInbox()).find(
          (event) => event.id === evidence.id,
        )!;
        assert.equal(inbox.status, "processed");
        assert.equal(inbox.last_error, null);
        assert.equal(inbox.attempts, 2);
        assert.equal((await receiveVerifiedCapture(evidence)).duplicate, true);
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              first.id,
            ])
          ).rows.length,
          1,
        );
      },
    );
    await t.test(
      "event identity conflicts preserve the original immutable evidence",
      async () => {
        await assert.rejects(
          receiveVerifiedCapture({ ...evidence, payment_id: "pay_conflict" }),
          /identity conflict/,
        );
        await assert.rejects(
          db.query("UPDATE payment_webhook_inbox SET amount=1 WHERE id=$1", [
            evidence.id,
          ]),
          /immutable/,
        );
        await assert.rejects(
          db.query("DELETE FROM payment_webhook_inbox WHERE id=$1", [
            evidence.id,
          ]),
          /retained/,
        );
      },
    );
    const concurrent = await order();
    const provider = `order_${randomUUID()}`,
      payment = `pay_${randomUUID()}`;
    await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
      provider,
      concurrent.id,
    ]);
    await t.test(
      "concurrent callback and webhook capture one payment and one stock commitment",
      async () => {
        const before = await stock();
        await Promise.all([
          receiveVerifiedCapture({
            id: `callback:${payment}`,
            provider_order_id: provider,
            payment_id: payment,
            amount: concurrent.total as number,
            currency: "INR",
            source: "callback",
          }),
          receiveVerifiedCapture({
            id: `webhook:${randomUUID()}`,
            provider_order_id: provider,
            payment_id: payment,
            amount: concurrent.total as number,
            currency: "INR",
            source: "webhook",
          }),
        ]);
        assert.equal((await stock()).stock, before.stock);
        assert.equal((await stock()).reserved, before.reserved - 1);
        assert.equal(
          (
            await db.query("SELECT * FROM payments WHERE order_id=$1", [
              concurrent.id,
            ])
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query(
              "SELECT * FROM order_status_events WHERE order_id=$1",
              [concurrent.id],
            )
          ).rows.length,
          2,
        );
      },
    );
    const expired = await order();
    const lateProvider = `order_${randomUUID()}`;
    await db.query(
      "UPDATE orders SET provider_id=$1,expires_at=now()-interval '1 minute' WHERE id=$2",
      [lateProvider, expired.id],
    );
    const late = {
      ...evidence,
      id: `webhook:${randomUUID()}`,
      provider_order_id: lateProvider,
      payment_id: `pay_${randomUUID()}`,
      amount: expired.total as number,
    };
    await t.test(
      "late capture becomes a durable exception without overselling or marking paid",
      async () => {
        const before = await stock();
        await assert.rejects(receiveVerifiedCapture(late), /reconciliation/);
        assert.equal((await stock()).stock, before.stock + 1);
        assert.equal(
          (await paymentInbox()).find((event) => event.id === late.id)!.status,
          "failed",
        );
        assert.equal(
          (
            await db.query<{ payment_state: string }>(
              "SELECT payment_state FROM orders WHERE id=$1",
              [expired.id],
            )
          ).rows[0].payment_state,
          "expired",
        );
      },
    );
    await t.test(
      "maintenance expires once, recovers abandoned processing leases, and caps retries",
      async () => {
        const pending = await order();
        await db.query(
          "UPDATE orders SET expires_at=now()-interval '1 hour' WHERE id=$1",
          [pending.id],
        );
        // Simulate a process dying after it claimed an event, before marking completion.
        await db.query(
          "UPDATE payment_webhook_inbox SET status='processing',lease_until=now()-interval '1 minute' WHERE id=$1",
          [evidence.id],
        );
        await db.query(
          "UPDATE payment_webhook_inbox SET attempts=10,next_attempt_at=now()-interval '1 hour' WHERE id=$1",
          [late.id],
        );
        const result = await runCommerceMaintenance();
        assert.equal(result.expired, 1);
        assert.equal(result.processed, 1);
        assert.equal((await runCommerceMaintenance()).expired, 0);
        const capped = (await paymentInbox()).find(
          (event) => event.id === late.id,
        )!;
        assert.equal(capped.attempts, 10);
      },
    );
    await t.test(
      "unprivileged database roles cannot read provider evidence",
      async () => {
        await db.exec(
          "CREATE ROLE payment_browser NOLOGIN; GRANT USAGE ON SCHEMA public TO payment_browser; GRANT SELECT ON payment_webhook_inbox TO payment_browser;",
        );
        await db.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE payment_browser");
          assert.equal(
            (await tx.query("SELECT * FROM payment_webhook_inbox")).rows.length,
            0,
          );
        });
      },
    );
  } finally {
    await db.close();
  }
});
