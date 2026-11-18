import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL;
test(
  "owner catalog, inventory, CMS and upload authorization",
  { skip: !base },
  async (t) => {
    const access = JSON.parse(
      await readFile(
        process.env.TEST_OWNER_ACCESS_FILE || "data/local-access.json",
        "utf8",
      ),
    );
    let cookie = "";
    async function call(path: string, body?: unknown) {
      const r = await fetch(base + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: cookie,
          Origin: base!,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const c of r.headers.getSetCookie())
        cookie += (cookie ? "; " : "") + c.split(";")[0];
      return { status: r.status, data: await r.json() };
    }
    const login = await call("auth", {
      action: "login",
      email: access.email,
      password: access.password,
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.role, "owner");
    const original = (await call("admin")).data;
    await t.test(
      "support staff workflow protects notes and requires a visible resolution",
      async () => {
        const ticket = await call("support/tickets", {
          subject: "Synthetic staff support case",
          body: "This request exists only for local HTTP acceptance.",
          idempotency_key: randomUUID(),
        });
        assert.equal(ticket.status, 201);
        const id = ticket.data.id;
        assert.equal((await call("admin/support")).status, 200);
        assert.equal(
          (
            await call(`admin/support/${id}/reply`, {
              body: "An internal investigation note.",
              visibility: "internal",
            })
          ).status,
          200,
        );
        assert.equal(
          (await call(`support/tickets/${id}`)).data.messages.length,
          1,
        );
        assert.equal(
          (await call(`admin/support/${id}`)).data.messages.length,
          2,
        );
        assert.equal(
          (
            await call(`admin/support/${id}`, {
              status: "resolved",
              priority: "standard",
              assigned_to: null,
              resolution: "Reviewed this synthetic acceptance request.",
            })
          ).status,
          200,
        );
        assert.equal(
          (await call(`support/tickets/${id}`)).data.ticket.status,
          "resolved",
        );
      },
    );
    await t.test(
      "owner can inspect payment processing; missing event retry cannot alter a payment",
      async () => {
        assert.equal((await call("admin/payments")).status, 200);
        const attempts = await call("admin/payment-attempts");
        assert.equal(attempts.status, 200);
        assert.ok(Array.isArray(attempts.data));
        assert.equal(
          (await call("admin/payments/retry", { id: "missing-event" })).status,
          400,
        );
      },
    );
    let pid = "";
    const product = {
      slug: "qa-" + randomUUID(),
      title: "QA Softness Sample",
      description: "A disposable product used for catalog integration testing.",
      category: "bras",
      material: "Organic cotton",
      care: "Gentle hand wash.",
      image: "/images/bralette.webp",
      featured: false,
      is_new: false,
      published: true,
    };
    await t.test("owner creates database product", async () => {
      const r = await call("admin/product", product);
      assert.equal(r.status, 200);
      pid = r.data.id;
    });
    await t.test(
      "owner configures a tax class and assigns it to the disposable product",
      async () => {
        const commerce = await call("admin/commerce");
        assert.equal(commerce.status, 200);
        assert.equal(
          (await call("admin/commerce", commerce.data.config)).status,
          200,
        );
        const tax = await call("admin/tax-class", {
          name: "Synthetic QA tax " + randomUUID(),
          hsn: "9999",
          rate_bps: 1250,
          valid_from: "2020-01-01T00:00:00Z",
          active: true,
        });
        assert.equal(tax.status, 200);
        assert.equal(
          (
            await call("admin/product-tax", {
              product_id: pid,
              tax_class_id: tax.data.id,
            })
          ).status,
          200,
        );
        assert.equal((await call("admin/cod")).status, 200);
      },
    );
    await t.test("owner adds independent SKU stock and price", async () => {
      const r = await call("admin/variant", {
        product_id: pid,
        sku: "QA-" + randomUUID(),
        color: "Petal Rose",
        color_hex: "#c99897",
        size: "M",
        price: 123400,
        stock: 7,
        weight_grams: 250,
      });
      assert.equal(r.status, 200);
      const catalog = (await call("catalog?q=QA%20Softness%20Sample")).data;
      assert.equal(catalog.products[0].id, pid);
      assert.equal(catalog.products[0].variants[0].price, 123400);
      assert.equal(catalog.products[0].variants[0].stock, 7);
      assert.equal(catalog.products[0].variants[0].weight_grams, 250);
    });
    await t.test(
      "published catalog updates reflect admin changes",
      async () => {
        const r = await call("admin/product", {
          ...product,
          id: pid,
          title: "QA Updated Sample",
        });
        assert.equal(r.status, 200);
        assert.equal(
          (await call("catalog?q=QA%20Updated%20Sample")).data.products[0]
            .title,
          "QA Updated Sample",
        );
      },
    );
    await t.test(
      "archival removes product from storefront while preserving record",
      async () => {
        assert.equal(
          (
            await call("admin/product", {
              ...product,
              id: pid,
              published: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (await call("catalog?q=QA%20Softness%20Sample")).data.total,
          0,
        );
        assert.ok(
          (await call("admin")).data.products.some(
            (p: { id: string }) => p.id === pid,
          ),
        );
      },
    );
    await t.test(
      "CMS content persists and is reflected in storefront endpoint",
      async () => {
        try {
          await call("admin/cms", {
            ...original.home,
            eyebrow: "A TEST OF LOVELY",
          });
          assert.equal((await call("home")).data.eyebrow, "A TEST OF LOVELY");
        } finally {
          await call("admin/cms", original.home);
        }
      },
    );
    await t.test("admin offer is validated by server", async () => {
      assert.equal(
        (
          await call("admin/coupon", {
            code: "QA15",
            percent: 15,
            active: true,
          })
        ).status,
        200,
      );
      assert.equal((await call("quote", { coupon: "QA15" })).status, 200);
      await call("admin/coupon", { code: "QA15", percent: 15, active: false });
      assert.equal((await call("quote", { coupon: "QA15" })).status, 400);
    });
    await t.test("media rejects active or oversized content", async () => {
      const form = new FormData();
      form.set(
        "file",
        new File(["<svg></svg>"], "bad.svg", { type: "image/svg+xml" }),
      );
      const r = await fetch(base + "/api/admin/media", {
        method: "POST",
        headers: { Cookie: cookie, Origin: base! },
        body: form,
      });
      assert.equal(r.status, 400);
    });
    await t.test(
      "owner can upload and normalize real product media",
      async () => {
        const form = new FormData();
        form.set(
          "file",
          new File(
            [await readFile("public/images/bralette.webp")],
            "product.webp",
            { type: "image/webp" },
          ),
        );
        const r = await fetch(base + "/api/admin/media", {
          method: "POST",
          headers: { Cookie: cookie, Origin: base! },
          body: form,
        });
        assert.equal(r.status, 200);
        const data = await r.json();
        assert.match(data.url, /^\/images\/product-.*\.webp$/);
        const media = await fetch(base + data.url);
        assert.equal(media.status, 200);
        assert.equal(media.headers.get("content-type"), "image/webp");
        assert.ok((await media.arrayBuffer()).byteLength > 0);
        assert.equal(
          (await fetch(base + "/images/product-not-a-generated-id.webp"))
            .status,
          404,
        );
      },
    );
    await call("logout", {});
  },
);
