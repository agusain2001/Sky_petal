import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import { mutateCart } from "../src/lib/cart";
import {
  subscribeNewsletter,
  unsubscribeNewsletter,
  newsletterConsentVersion,
} from "../src/lib/newsletter";
import { enqueueJob, runJobs, DeferredJobError } from "../src/lib/jobs";
import { createTicket, replyToTicket } from "../src/lib/support";
import { exportCustomerData } from "../src/lib/privacy";
import { reserveOrder, confirmCapturedPayment } from "../src/lib/commerce";
import { customerOrders } from "../src/lib/orders";
import {
  publicSiteOrigin,
  indexingEnabled,
  productStructuredData,
  safeJsonLd,
} from "../src/lib/seo";
import { filterCatalog } from "../src/lib/catalog";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

test("recovery regressions on a disposable store", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-recovery-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  const customer = {
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    name: "Recovery QA",
    role: "customer",
  };
  const other = {
    ...customer,
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
  };
  const staff = {
    ...customer,
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    role: "support",
  };
  for (const u of [customer, other, staff])
    await db.query(
      "INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5)",
      [u.id, u.email, u.name, u.role, "MUST-NOT-EXPORT"],
    );
  const cart = randomUUID();
  await db.query("INSERT INTO carts VALUES($1,$2)", [cart, customer.id]);
  const product = (await getProducts()).find((p) => p.variants.length > 2)!,
    variant = product.variants[0];
  try {
    await t.test(
      "refusal/missing consent never persists; legacy email suppressed; opt-out is authenticated and idempotent",
      async () => {
        const email = customer.email;
        await assert.rejects(subscribeNewsletter({ email, consent: false }));
        await assert.rejects(subscribeNewsletter({ email }));
        assert.equal(
          (await db.query("SELECT * FROM newsletter WHERE email=$1", [email]))
            .rows.length,
          0,
        );
        await db.query("INSERT INTO newsletter(email) VALUES($1)", [
          other.email,
        ]);
        assert.equal(
          (await db.query("SELECT * FROM marketing_eligible_subscribers")).rows
            .length,
          0,
        );
        const result = await subscribeNewsletter({
          email: email.toUpperCase(),
          consent: true,
        });
        const active = (
          await db.query<{
            consent_version: string;
            consent_source: string;
            consent_at: string;
            unsubscribe_hash: string;
          }>("SELECT * FROM newsletter WHERE email=$1", [email])
        ).rows[0];
        assert.equal(active.consent_version, newsletterConsentVersion);
        assert.equal(active.consent_source, "storefront_newsletter");
        assert.ok(active.consent_at);
        assert.notEqual(active.unsubscribe_hash, result.unsubscribe_token);
        await unsubscribeNewsletter({ token: "0".repeat(64) });
        assert.equal(
          (await db.query("SELECT * FROM marketing_eligible_subscribers")).rows
            .length,
          1,
        );
        await unsubscribeNewsletter({ token: result.unsubscribe_token });
        await unsubscribeNewsletter({ token: result.unsubscribe_token });
        assert.equal(
          (await db.query("SELECT * FROM marketing_eligible_subscribers")).rows
            .length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "SELECT * FROM newsletter_consent_events WHERE email=$1",
              [email],
            )
          ).rows.length,
          2,
        );
        await assert.rejects(
          db.query("DELETE FROM newsletter_consent_events WHERE email=$1", [
            email,
          ]),
          /append-only/,
        );
      },
    );
    await t.test(
      "two independent adds preserve both increments, and stock/cap failures are atomic",
      async () => {
        await db.query("UPDATE product_variants SET stock=3 WHERE id=$1", [
          variant.id,
        ]);
        await mutateCart(cart, {
          operation: "set",
          variant_id: variant.id,
          quantity: 1,
        });
        await Promise.all(
          [1, 2].map(() =>
            mutateCart(cart, {
              operation: "increment",
              variant_id: variant.id,
              quantity: 1,
            }),
          ),
        );
        const quantity = async () =>
          Number(
            (
              await db.query<{ quantity: number }>(
                "SELECT quantity FROM cart_items WHERE cart_id=$1 AND variant_id=$2",
                [cart, variant.id],
              )
            ).rows[0]?.quantity || 0,
          );
        assert.equal(await quantity(), 3);
        await assert.rejects(
          mutateCart(cart, {
            operation: "increment",
            variant_id: variant.id,
            quantity: 1,
          }),
          /not currently available/,
        );
        assert.equal(await quantity(), 3);
        await mutateCart(cart, {
          operation: "set",
          variant_id: variant.id,
          quantity: 1,
        });
        assert.equal(await quantity(), 1);
        await mutateCart(cart, {
          operation: "set",
          variant_id: variant.id,
          quantity: 0,
        });
        assert.equal(await quantity(), 0);
        await assert.rejects(
          mutateCart(cart, {
            operation: "increment",
            variant_id: variant.id,
            quantity: 0,
          }),
        );
        await db.query("UPDATE product_variants SET stock=100 WHERE id=$1", [
          variant.id,
        ]);
      },
    );
    await t.test(
      "lease loss fences success, failure and deferred accounting",
      async () => {
        for (const outcome of ["success", "failure", "defer", "expired"]) {
          const key = "recovery.lease." + outcome;
          await enqueueJob(db, key, key, {});
          const result = await runJobs(
            {
              [key]: async () => {
                if (outcome === "expired")
                  await db.query(
                    "UPDATE commerce_jobs SET lease_until=now()-interval '1 second' WHERE dedup_key=$1",
                    [key],
                  );
                else
                  await db.query(
                    "UPDATE commerce_jobs SET lease_token='new-owner' WHERE dedup_key=$1",
                    [key],
                  );
                if (outcome === "failure")
                  throw Error("Synthetic handler failure");
                if (outcome === "defer")
                  throw new DeferredJobError("Synthetic pending");
              },
            },
            1,
          );
          assert.deepEqual(result, { succeeded: 0, failed: 0, deferred: 0 });
          assert.equal(
            (
              await db.query<{ status: string }>(
                "SELECT status FROM commerce_jobs WHERE dedup_key=$1",
                [key],
              )
            ).rows[0].status,
            "running",
          );
        }
      },
    );
    await t.test(
      "privacy export includes owned support data, orders and consent, without other customers or staff secrets",
      async () => {
        const input = {
          subject: "Private recovery ticket",
          body: "Customer-owned private support evidence",
          idempotency_key: randomUUID(),
        };
        const ticket = await createTicket(customer, input),
          foreign = await createTicket(other, {
            ...input,
            idempotency_key: randomUUID(),
          });
        await replyToTicket(
          staff,
          ticket.id,
          { body: "STAFF-INTERNAL-SECRET", visibility: "internal" },
          true,
        );
        await replyToTicket(
          staff,
          ticket.id,
          { body: "Customer-visible reply", visibility: "public" },
          true,
        );
        const result = await exportCustomerData(customer.id);
        const json = JSON.stringify(result);
        assert.ok(json.includes(ticket.id));
        assert.ok(json.includes("Customer-visible reply"));
        assert.ok(!json.includes(foreign.id));
        assert.ok(!json.includes("STAFF-INTERNAL-SECRET"));
        assert.ok(!json.includes("MUST-NOT-EXPORT"));
        assert.ok(!json.includes("unsubscribe_hash"));
        assert.equal((result.consent_events as unknown[]).length, 2);
        assert.equal((result.support_messages as unknown[]).length, 2);
      },
    );
    await t.test(
      "105-order history preserves line/event ownership and boundaries with batched assembly",
      async () => {
        await db.query("UPDATE product_variants SET stock=120 WHERE id=$1", [
          variant.id,
        ]);
        const address = {
          name: "Recovery QA",
          phone: "9876543210",
          line1: "123 Synthetic Street",
          city: "Mumbai",
          state: "Maharashtra",
          postal: "400001",
        };
        const created = [];
        for (let i = 0; i < 105; i++) {
          await mutateCart(cart, {
            operation: "set",
            variant_id: variant.id,
            quantity: 1,
          });
          const o = await reserveOrder(
            customer.id,
            cart,
            address,
            "",
            randomUUID(),
          );
          const provider = "synthetic_" + randomUUID();
          await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
            provider,
            o.id,
          ]);
          await confirmCapturedPayment(
            provider,
            "pay_" + randomUUID(),
            Number(o.total),
            "INR",
            randomUUID(),
          );
          created.push(o);
        }
        const orders = await customerOrders(customer.id);
        assert.equal(orders.length, 105);
        for (const order of orders) {
          assert.equal(order.items.length, 1);
          assert.equal(order.items[0].title, product.title);
          assert.equal(order.events?.length, 2);
          assert.equal(order.courier_managed, false);
        }
        assert.deepEqual(await customerOrders(other.id), []);
        assert.deepEqual(
          await customerOrders(other.id, String(created[0].id)),
          [],
        );
        assert.equal(
          (await customerOrders(customer.id, String(created[0].id))).length,
          1,
        );
      },
    );
    await t.test(
      "SEO is staged safely and structured offers match real SKU prices/stock, without fabricated reviews",
      async () => {
        delete process.env.SITE_INDEXING_ENABLED;
        process.env.NEXT_PUBLIC_SITE_URL = "https://store.example.test";
        process.env.DEPLOYMENT_ENV = "staging";
        assert.equal(indexingEnabled(), false);
        assert.deepEqual(await sitemap(), []);
        assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
        process.env.SITE_INDEXING_ENABLED = "true";
        assert.equal(indexingEnabled(), false);
        process.env.DEPLOYMENT_ENV = "production";
        assert.equal(indexingEnabled(), true);
        assert.equal(publicSiteOrigin(), "https://store.example.test");
        const published = await sitemap();
        assert.ok(
          published.some((entry) =>
            entry.url.endsWith("/products/" + product.slug),
          ),
        );
        assert.ok(
          published.every(
            (entry) =>
              ![
                "/account",
                "/admin",
                "/api/",
                "/cart",
                "/checkout",
                "/wishlist",
              ].some((privatePath) => entry.url.includes(privatePath)),
          ),
        );
        await db.query("UPDATE products SET published=false WHERE id=$1", [
          product.id,
        ]);
        assert.ok(
          !(await sitemap()).some((entry) =>
            entry.url.endsWith("/products/" + product.slug),
          ),
        );
        await db.query("UPDATE products SET published=true WHERE id=$1", [
          product.id,
        ]);
        const data = productStructuredData(product);
        assert.equal(data.offers[0].price, (variant.price / 100).toFixed(2));
        assert.equal(data.offers.length, product.variants.length);
        assert.ok(!("aggregateRating" in data));
        assert.ok(
          !safeJsonLd({ name: "</script><script>bad</script>" }).includes("<"),
        );
        assert.equal(
          JSON.parse(safeJsonLd({ name: "</script>" })).name,
          "</script>",
        );
      },
    );
    await t.test(
      "selected-SKU ascending and descending price order ignores unrelated cheap variants",
      () => {
        const a = {
          ...product,
          id: "A",
          variants: [
            { ...variant, id: "a-xs", size: "XS", color: "QA", price: 100 },
            { ...variant, id: "a-xxl", size: "XXL", color: "QA", price: 10000 },
          ],
        };
        const b = {
          ...product,
          id: "B",
          variants: [
            { ...variant, id: "b-xs", size: "XS", color: "QA", price: 500 },
            { ...variant, id: "b-xxl", size: "XXL", color: "QA", price: 5000 },
          ],
        };
        assert.deepEqual(
          filterCatalog(
            [a, b],
            new URLSearchParams("size=XXL&color=QA&sort=price-asc"),
          ).map((p) => p.id),
          ["B", "A"],
        );
        assert.deepEqual(
          filterCatalog(
            [a, b],
            new URLSearchParams("size=XXL&color=QA&sort=price-desc"),
          ).map((p) => p.id),
          ["A", "B"],
        );
        assert.deepEqual(
          filterCatalog([a, b], new URLSearchParams("size=XXL&color=missing")),
          [],
        );
      },
    );
  } finally {
    await db.close();
  }
});
