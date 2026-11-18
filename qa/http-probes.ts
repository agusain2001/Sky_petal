import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { assert, probe, saveResults } from "./probe";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4321";
type Session = {
  call: (
    route: string,
    body?: unknown,
    method?: string,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; data: any; headers: Headers }>;
};
function session(): Session {
  let jar = "";
  return {
    async call(route, body, method, extra) {
      const r = await fetch(`${base}/api/${route}`, {
        method: method || (body === undefined ? "GET" : "POST"),
        headers: {
          Cookie: jar,
          Origin: base,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
      const cookies = r.headers.getSetCookie();
      if (cookies.length) {
        const map = new Map(
          jar
            .split("; ")
            .filter(Boolean)
            .map((v) => v.split(/=(.*)/s).slice(0, 2) as [string, string]),
        );
        for (const value of cookies) {
          const first = value.split(";")[0],
            index = first.indexOf("=");
          map.set(first.slice(0, index), first.slice(index + 1));
        }
        jar = [...map].map(([k, v]) => `${k}=${v}`).join("; ");
      }
      const text = await r.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { text: text.slice(0, 200) };
      }
      return { status: r.status, data, headers: r.headers };
    },
  };
}
async function main() {
  const data = JSON.parse(
    await readFile(process.env.TEST_OWNER_ACCESS_FILE!, "utf8"),
  );
  const clients: Record<string, Session> = {};
  for (const [role, access] of Object.entries({
    owner: data,
    ...data.roles,
  }) as [string, any][]) {
    const client = session();
    const r = await client.call("auth", {
      action: "login",
      email: access.email,
      password: access.password,
    });
    assert.equal(r.status, 200, `Fixture login failed for ${role}`);
    clients[role] = client;
  }
  const readRules: Record<string, string[]> = {
    "admin/invoices": ["owner", "administrator", "finance"],
    "admin/privacy": ["owner", "administrator"],
    "admin/readiness": ["owner", "administrator"],
    "admin/exchanges": [
      "owner",
      "administrator",
      "finance",
      "fulfillment",
      "support",
    ],
    "admin/commerce": ["owner", "administrator", "catalog_editor"],
    "admin/cod": ["owner", "administrator", "finance"],
    "admin/refunds": ["owner", "administrator", "finance"],
    "admin/returns": ["owner", "administrator", "support", "fulfillment"],
    "admin/shipments": ["owner", "administrator", "fulfillment"],
    "admin/support": ["owner", "administrator", "support"],
    "admin/payments": ["owner", "administrator"],
    "admin/jobs": ["owner", "administrator"],
  };
  let index = 0;
  for (const [route, allowed] of Object.entries(readRules))
    for (const [role, client] of Object.entries(clients)) {
      await probe(
        `QA-H-RBAC-${++index}`,
        ["A01", "A02", "Q06"],
        `${role}: GET ${route}`,
        allowed.includes(role)
          ? "HTTP 200 for explicitly authorized role."
          : "HTTP 403; no private data returned.",
        async (record) => {
          const r = await client.call(route);
          record({ status: r.status, role, route });
          assert.equal(r.status, allowed.includes(role) ? 200 : 403);
        },
      );
    }
  const writeRules: Record<string, string[]> = {
    "admin/invoices/config": ["owner", "administrator"],
    "admin/invoices/issue": ["owner", "administrator", "finance"],
    "admin/invoices/credit": ["owner", "administrator", "finance"],
    "admin/privacy/policy": ["owner", "administrator"],
    "admin/privacy/approve": ["owner", "administrator"],
    "admin/privacy/process": ["owner", "administrator"],
    "admin/product": ["owner", "administrator", "catalog_editor"],
    "admin/variant": ["owner", "administrator", "catalog_editor"],
    "admin/cms": ["owner", "administrator", "catalog_editor"],
    "admin/coupon": ["owner", "administrator"],
    "admin/order": ["owner", "administrator", "fulfillment"],
    "admin/commerce": ["owner", "administrator"],
    "admin/tax-class": ["owner", "administrator"],
    "admin/product-tax": ["owner", "administrator", "catalog_editor"],
    "admin/return-policy": ["owner", "administrator", "catalog_editor"],
    "admin/cod": ["owner", "administrator", "finance"],
    "admin/refunds": ["owner", "administrator", "finance"],
    "admin/refunds/review": ["owner", "administrator", "finance"],
    "admin/refunds/manual-confirm": ["owner", "administrator", "finance"],
    "admin/returns": ["owner", "administrator", "support", "fulfillment"],
    "admin/shipments": ["owner", "administrator", "fulfillment"],
    "admin/jobs/retry": ["owner", "administrator"],
    "admin/jobs/run": ["owner", "administrator"],
    "admin/payments/retry": ["owner", "administrator"],
  };
  for (const [route, allowed] of Object.entries(writeRules))
    for (const [role, client] of Object.entries(clients))
      if (!allowed.includes(role)) {
        await probe(
          `QA-H-WRITE-${++index}`,
          ["A01", "A02", "Q06"],
          `${role}: POST ${route}`,
          "HTTP 403 before any mutation.",
          async (record) => {
            const r = await client.call(
              route,
              route === "admin/jobs/retry"
                ? { id: "qa-nonexistent-schema-valid-job" }
                : {},
            );
            record({ status: r.status, role, route });
            assert.equal(r.status, 403);
          },
        );
      }
  const a = clients.customer,
    b = clients.customer_b,
    guest = session();
  await probe(
    "QA-H01",
    ["U06", "U09", "Q06"],
    "Cross-customer address mutations and order reads",
    "Other customer records are neither readable nor editable/deletable.",
    async (record) => {
      const foreign = data.qa.other_address;
      const edit = await a.call(
        "addresses/" + foreign,
        {
          label: "Hijacked",
          name: "QA",
          phone: "9876543210",
          line1: "123 Road",
          city: "Mumbai",
          state: "Maharashtra",
          postal: "400001",
        },
        "PATCH",
      );
      const del = await a.call("addresses/" + foreign, undefined, "DELETE");
      const order = await b.call("orders/" + data.qa.volume_orders[0]);
      record({ edit: edit.status, delete: del.status, order: order.status });
      assert.ok([403, 404].includes(edit.status));
      assert.ok([403, 404].includes(del.status));
      assert.equal(order.status, 404);
      const own = await b.call("addresses");
      assert.equal(own.data[0].label, "Private B");
    },
  );
  await probe(
    "QA-H02",
    ["U20", "P21"],
    "Wishlist isolation and stock neutrality",
    "Each wishlist is owned and toggling it leaves public SKU stock unchanged.",
    async (record) => {
      const before = await a.call("catalog");
      const stock = before.data.products
        .flatMap((p: any) => p.variants)
        .find((v: any) => v.id === data.qa.variant_id).stock;
      assert.equal(
        (await a.call("wishlist", { product_id: data.qa.product_id })).status,
        200,
      );
      assert.ok((await a.call("wishlist")).data.includes(data.qa.product_id));
      assert.ok(!(await b.call("wishlist")).data.includes(data.qa.product_id));
      const after = await a.call("catalog");
      assert.equal(
        after.data.products
          .flatMap((p: any) => p.variants)
          .find((v: any) => v.id === data.qa.variant_id).stock,
        stock,
      );
      record({ stock_unchanged: true, other_customer_excluded: true });
    },
  );
  await probe(
    "QA-H03",
    ["Q08", "Q10"],
    "Cross-origin request is rejected",
    "A forged cross-origin profile update receives HTTP 403.",
    async (record) => {
      const r = await a.call("profile", { name: "Forged rename" }, undefined, {
        Origin: "https://attacker.invalid",
      });
      record({ status: r.status });
      assert.equal(r.status, 403);
    },
  );
  await probe(
    "QA-H04",
    ["U01", "A01", "Q08"],
    "Client-supplied role and identity cannot elevate customer",
    "Ignored role/admin/other-user fields leave requester customer and other profile untouched.",
    async (record) => {
      const before = (await b.call("me")).data.user;
      await a.call("profile", {
        name: "QA own name",
        id: data.roles.customer_b.id,
        user_id: data.roles.customer_b.id,
        role: "owner",
      });
      const self = (await a.call("me")).data.user,
        other = (await b.call("me")).data.user;
      record({
        self_role: self.role,
        other_unchanged: other.name === before.name,
      });
      assert.equal(self.role, "customer");
      assert.equal(other.name, before.name);
      assert.equal((await a.call("admin")).status, 403);
    },
  );
  await probe(
    "QA-H05",
    ["U02", "U05"],
    "Password change revokes another authenticated session",
    "Other session receives no user after password change.",
    async (record) => {
      const c = session(),
        access = data.roles.customer_b;
      assert.equal(
        (
          await c.call("auth", {
            action: "login",
            email: access.email,
            password: access.password,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await b.call("password", {
            current_password: access.password,
            password: "QA-New-Password-123456!",
          })
        ).status,
        200,
      );
      const result = (await c.call("me")).data.user;
      record({ other_session_user: result });
      assert.equal(result, null);
    },
  );
  await probe(
    "QA-H06",
    ["M06", "M07", "U12"],
    "Newsletter rejects absent or explicit false consent",
    "HTTP 4xx and no subscription created when consent is absent or false.",
    async (record) => {
      const r = await guest.call("newsletter", {
        email: `qa-no-consent-${randomUUID()}@example.test`,
        consent: false,
      });
      record({ status: r.status, body: r.data });
      assert.ok(r.status >= 400);
    },
    "SP-QA-006",
  );
  await probe(
    "QA-H07",
    ["U15", "P01", "P08"],
    "Guests cannot begin authoritative checkout",
    "Quote/start require authentication even with forged totals.",
    async (record) => {
      const quote = await guest.call("checkout/quote", {
        address_id: data.qa.customer_address,
        payment_method: "cod",
        total: 1,
      });
      const start = await guest.call("checkout", {
        total: 1,
        quote_id: "fake",
        payment_method: "cod",
      });
      record({ quote: quote.status, start: start.status });
      assert.equal(quote.status, 401);
      assert.equal(start.status, 401);
    },
  );
  await probe(
    "QA-H08",
    ["Q08", "C13"],
    "SQL-like search input is literal and does not leak private rows",
    "Encoded injection produces an empty public result with HTTP 200.",
    async (record) => {
      const r = await guest.call(
        "catalog?q=" + encodeURIComponent("' OR 1=1; DROP TABLE users; --"),
      );
      record({ status: r.status, total: r.data.total });
      assert.equal(r.status, 200);
      assert.equal(r.data.total, 0);
    },
  );
  await probe(
    "QA-H09",
    ["M01", "M02"],
    "Captured-prepaid aggregate includes more than 100 orders",
    "Revenue equals whole-database verified captured sum, while recent list is capped at 100.",
    async (record) => {
      const r = await clients.owner.call("admin");
      record({
        status: r.status,
        revenue: r.data.revenue,
        expected: data.qa.expected_captured_paise,
        recent_orders: r.data.orders?.length,
      });
      assert.equal(r.status, 200);
      assert.equal(Number(r.data.revenue), data.qa.expected_captured_paise);
      assert.equal(r.data.orders.length, 100);
    },
  );
  await probe(
    "QA-H10",
    ["Q10", "Q21"],
    "Private API responses prevent shared cache and advertise security headers",
    "Cache-Control no-store, nosniff and frame denial exist.",
    async (record) => {
      const r = await a.call("addresses");
      const headers = Object.fromEntries(
        ["cache-control", "x-content-type-options", "x-frame-options"].map(
          (h) => [h, r.headers.get(h)],
        ),
      );
      record(headers);
      assert.match(headers["cache-control"]!, /no-store/);
      assert.equal(headers["x-content-type-options"], "nosniff");
      assert.equal(headers["x-frame-options"], "DENY");
    },
  );
  await probe(
    "QA-H11",
    ["A01", "Q09"],
    "Anonymous operational and finance endpoints require sign-in",
    "All protected reads and job execution deny anonymous requests.",
    async (record) => {
      const statuses = [];
      for (const route of Object.keys(readRules)) {
        const r = await guest.call(route);
        statuses.push({ route, status: r.status });
        assert.equal(r.status, 401);
      }
      assert.equal((await guest.call("admin/jobs/run", {})).status, 401);
      record(statuses);
    },
  );
  await probe(
    "QA-H12",
    ["C10", "C07"],
    "Price sorting uses the selected sellable variant",
    "With size filter, result ordering follows prices of that size rather than unrelated variants.",
    async (record) => {
      const baseProduct = {
        description: "QA price-sort fixture",
        category: "bras",
        material: "QA material",
        care: "QA care",
        image: "/images/bralette.webp",
        images: ["/images/bralette.webp"],
        published: true,
        featured: false,
        is_new: false,
      };
      const products: string[] = [];
      for (const [label, prices] of [
        ["A", [100, 10000]],
        ["B", [500, 5000]],
      ] as const) {
        const slug = "qa-sort-" + label.toLowerCase() + "-" + randomUUID();
        const created = await clients.owner.call("admin/product", {
          ...baseProduct,
          slug,
          title: "QA sort " + label,
        });
        assert.equal(created.status, 200);
        const list = (await clients.owner.call("admin")).data.products;
        const product = list.find((p: any) => p.slug === slug);
        assert.ok(product);
        products.push(product.id);
        for (const [size, price] of [
          ["XS", prices[0]],
          ["XXL", prices[1]],
        ] as const)
          assert.equal(
            (
              await clients.owner.call("admin/variant", {
                product_id: product.id,
                sku: slug + "-" + size,
                size,
                color: "QA sort color",
                color_hex: "#000000",
                price,
                stock: 5,
                compare_price: null,
              })
            ).status,
            200,
          );
      }
      const r = await guest.call(
        "catalog?size=XXL&color=QA%20sort%20color&sort=price-asc",
      );
      const ids = r.data.products
        .filter((p: any) => products.includes(p.id))
        .map((p: any) => p.id);
      record({
        observed_order: ids,
        expected_order: [products[1], products[0]],
      });
      assert.deepEqual(ids, [products[1], products[0]]);
    },
    "SP-QA-007",
  );
  await probe(
    "QA-H13",
    ["U02"],
    "Logout invalidates server access",
    "Same cookie jar cannot read owned orders after logout.",
    async (record) => {
      assert.equal((await a.call("logout", {})).status, 200);
      const r = await a.call("orders");
      record({ status: r.status });
      assert.equal(r.status, 401);
    },
  );
  await saveResults("http-probes");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
