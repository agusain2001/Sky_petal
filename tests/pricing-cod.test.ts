import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getDB, getProducts } from "../src/lib/db";
import {
  createCheckoutQuote,
  allocateDiscount,
  includedTax,
} from "../src/lib/pricing";
import {
  saveCommerceConfig,
  saveTaxClass,
  defaultCommerceConfig,
} from "../src/lib/commerce-config";
import { reserveOrder, confirmCapturedPayment } from "../src/lib/commerce";
import {
  cancelPendingOrder,
  customerOrders,
  fulfillOrder,
} from "../src/lib/orders";
import { recordCodEntry, codFinance } from "../src/lib/cod";
import type { ShippingQuoteProvider } from "../src/lib/shipping";
import type { Order, User } from "../src/lib/types";

test("authoritative tax/shipping quotes and unpaid COD accounting", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-pricing-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  async function user(role = "customer") {
    const id = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,role) VALUES($1,$2,'Pricing QA',$3)",
      [id, `${id}@example.test`, role],
    );
    const cart = randomUUID();
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, id]);
    return { id, cart, email: `${id}@example.test`, name: "Pricing QA", role };
  }
  const owner = await user("owner"),
    customer = await user(),
    other = await user(),
    finance = await user("finance");
  const address = {
    name: "Pricing QA",
    phone: "9876543210",
    line1: "123 Synthetic Street",
    city: "Mumbai",
    state: "Maharashtra",
    postal: "400001",
  };
  const variant = (await getProducts())[0].variants.find((v) => v.stock > 8)!;
  const provider: ShippingQuoteProvider = async (request) => {
    assert.equal(request.origin, "400001");
    assert.equal(request.weight_grams, 300);
    return [
      {
        courier_id: 101,
        courier_name: "Synthetic courier",
        rate_paise: 12345,
        estimated_delivery: "Synthetic estimate",
        cod: true,
        destination_postcode: request.destination,
        destination_state:
          request.destination === "110001" ? "Delhi" : "Maharashtra",
        destination_city:
          request.destination === "110001" ? "New Delhi" : "Mumbai",
      },
    ];
  };
  const config = {
    ...defaultCommerceConfig,
    checkout_enabled: true,
    origin_pincode: "400001",
    origin_state: "Maharashtra",
    packaging_grams: 50,
    shipping_tax_bps: 1800,
    cod_enabled: true,
    cod_tax_bps: 1800,
    cod_fee_paise: 2500,
    cod_max_total_paise: 2_000_000,
    cod_max_open_orders: 1,
    cod_allowed_pincodes: ["400001"],
  };
  const putCart = async (user = customer) => {
    await db.query(
      "INSERT INTO cart_items VALUES($1,$2,1) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=1",
      [user.cart, variant.id],
    );
  };
  const quote = (method: "prepaid" | "cod" = "prepaid", user = customer) =>
    createCheckoutQuote(
      user.id,
      user.cart,
      { address, coupon: "SOFT10", payment_method: method },
      provider,
    );
  try {
    await putCart();
    await t.test(
      "checkout is closed by default and configuration mutations require permission",
      async () => {
        await assert.rejects(quote(), /not open/);
        await assert.rejects(
          saveCommerceConfig(customer, config),
          /permission/,
        );
        await assert.rejects(saveTaxClass(customer, {}), /permission/);
        await assert.rejects(
          saveCommerceConfig(owner, {
            ...defaultCommerceConfig,
            checkout_enabled: true,
          }),
          /Configure origin/,
        );
      },
    );
    await saveCommerceConfig(owner, config);
    await t.test(
      "missing SKU weight or effective tax class cannot produce a quote",
      async () => {
        await assert.rejects(quote(), /tax or parcel/);
        const tax = await saveTaxClass(owner, {
          name: "Synthetic tax class",
          hsn: "9999",
          rate_bps: 1250,
          valid_from: "2020-01-01T00:00:00Z",
        });
        await db.query("UPDATE products SET tax_class_id=$1 WHERE id=$2", [
          tax.id,
          variant.product_id,
        ]);
        await assert.rejects(quote(), /tax or parcel/);
        await db.query(
          "UPDATE product_variants SET weight_grams=250 WHERE id=$1",
          [variant.id],
        );
      },
    );
    await t.test(
      "paise discount allocation and tax extraction are exact",
      () => {
        assert.deepEqual(allocateDiscount([101, 101, 101], 2), [1, 1, 0]);
        assert.deepEqual(includedTax(11800, 1800, true), {
          taxable_paise: 10000,
          tax_paise: 1800,
          cgst_paise: 900,
          sgst_paise: 900,
          igst_paise: 0,
        });
        assert.equal(includedTax(11800, 1800, false).igst_paise, 1800);
      },
    );
    const prepaid = await quote();
    await t.test(
      "provider rates, inclusive tax and persisted quote total match the server catalog",
      async () => {
        const c = prepaid.content;
        assert.equal(c.shipping, 12345);
        assert.equal(c.subtotal, variant.price);
        assert.equal(c.discount, Math.floor(variant.price / 10));
        assert.equal(c.total, c.subtotal - c.discount + c.shipping);
        assert.equal(c.tax.taxable_paise + c.tax.tax_paise, c.total);
        assert.equal(c.tax.igst_paise, 0);
        await assert.rejects(
          db.query("UPDATE checkout_quotes SET content='{}' WHERE id=$1", [
            prepaid.id,
          ]),
          /append-only/,
        );
        await assert.rejects(
          createCheckoutQuote(
            other.id,
            customer.cart,
            { address, payment_method: "prepaid" },
            provider,
          ),
          /bag could not be verified/,
        );
        const interstate = await createCheckoutQuote(
          customer.id,
          customer.cart,
          {
            address: {
              ...address,
              state: "Delhi",
              city: "New Delhi",
              postal: "110001",
            },
            payment_method: "prepaid",
          },
          provider,
        );
        assert.equal(interstate.content.tax.cgst_paise, 0);
        assert.equal(interstate.content.tax.sgst_paise, 0);
        assert.equal(
          interstate.content.tax.igst_paise,
          interstate.content.tax.tax_paise,
        );
      },
    );
    await t.test(
      "changed bag, tax, discount, settings, expired or foreign quote fails before reservation",
      async () => {
        await putCart(other);
        await assert.rejects(
          reserveOrder(
            other.id,
            other.cart,
            address,
            "SOFT10",
            randomUUID(),
            undefined,
            prepaid.id,
          ),
          /expired/,
        );
        await db.query(
          "UPDATE product_variants SET price=price+1 WHERE id=$1",
          [variant.id],
        );
        await assert.rejects(
          reserveOrder(
            customer.id,
            customer.cart,
            address,
            "SOFT10",
            randomUUID(),
            undefined,
            prepaid.id,
          ),
          /details changed/,
        );
        await db.query(
          "UPDATE product_variants SET price=price-1 WHERE id=$1",
          [variant.id],
        );
        await db.query(
          "UPDATE tax_classes SET rate_bps=rate_bps+1 WHERE id=(SELECT tax_class_id FROM products WHERE id=$1)",
          [variant.product_id],
        );
        await assert.rejects(
          reserveOrder(
            customer.id,
            customer.cart,
            address,
            "SOFT10",
            randomUUID(),
            undefined,
            prepaid.id,
          ),
          /details changed/,
        );
        await db.query(
          "UPDATE tax_classes SET rate_bps=rate_bps-1 WHERE id=(SELECT tax_class_id FROM products WHERE id=$1)",
          [variant.product_id],
        );
        await saveCommerceConfig(owner, { ...config, packaging_grams: 51 });
        await assert.rejects(
          reserveOrder(
            customer.id,
            customer.cart,
            address,
            "SOFT10",
            randomUUID(),
            undefined,
            prepaid.id,
          ),
          /settings changed/,
        );
        await saveCommerceConfig(owner, config);
        await db.query("UPDATE coupons SET active=false WHERE code='SOFT10'");
        await assert.rejects(
          reserveOrder(
            customer.id,
            customer.cart,
            address,
            "SOFT10",
            randomUUID(),
            undefined,
            prepaid.id,
          ),
          /not valid/,
        );
        await db.query("UPDATE coupons SET active=true WHERE code='SOFT10'");
        const expired = {
          ...prepaid,
          id: randomUUID(),
          expires_at: "2020-01-01T00:00:00Z",
        };
        await db.query(
          "INSERT INTO checkout_quotes(id,user_id,cart_id,payment_method,request_fingerprint,config_fingerprint,content,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            expired.id,
            customer.id,
            customer.cart,
            expired.payment_method,
            expired.request_fingerprint,
            expired.config_fingerprint,
            JSON.stringify(expired.content),
            expired.expires_at,
          ],
        );
        await assert.rejects(
          reserveOrder(
            customer.id,
            customer.cart,
            address,
            "SOFT10",
            randomUUID(),
            undefined,
            expired.id,
          ),
          /expired/,
        );
      },
    );
    await t.test(
      "unserviceable or non-COD courier and COD amount/pincode policies fail closed",
      async () => {
        await assert.rejects(
          createCheckoutQuote(
            customer.id,
            customer.cart,
            { address, payment_method: "prepaid" },
            async () => [],
          ),
          /eligible courier/,
        );
        await assert.rejects(
          createCheckoutQuote(
            customer.id,
            customer.cart,
            { address, payment_method: "cod" },
            async () => [
              {
                courier_id: 1,
                courier_name: "Prepaid only",
                rate_paise: 100,
                cod: false,
                estimated_delivery: null,
              },
            ],
          ),
          /eligible courier/,
        );
        await assert.rejects(
          createCheckoutQuote(
            customer.id,
            customer.cart,
            {
              address: { ...address, postal: "110001" },
              payment_method: "cod",
            },
            provider,
          ),
          /not available/,
        );
        await saveCommerceConfig(owner, { ...config, cod_max_total_paise: 1 });
        await assert.rejects(quote("cod"), /not available/);
        await saveCommerceConfig(owner, config);
      },
    );
    await t.test(
      "courier-backed postcode, city and state must agree before selecting a tax jurisdiction",
      async () => {
        await assert.rejects(
          createCheckoutQuote(
            customer.id,
            customer.cart,
            {
              address: { ...address, state: "Delhi" },
              payment_method: "prepaid",
            },
            provider,
          ),
          /Review your address/,
        );
        await assert.rejects(
          createCheckoutQuote(
            customer.id,
            customer.cart,
            {
              address: { ...address, city: "Pune" },
              payment_method: "prepaid",
            },
            provider,
          ),
          /Review your address/,
        );
        await assert.rejects(
          createCheckoutQuote(
            customer.id,
            customer.cart,
            { address, payment_method: "prepaid" },
            async () => [
              {
                courier_id: 1,
                courier_name: "Unverified destination",
                rate_paise: 100,
                cod: false,
                estimated_delivery: null,
              },
            ],
          ),
          /could not verify/,
        );
      },
    );
    const codQuote = await quote("cod"),
      key = randomUUID();
    let cod: Order;
    await t.test(
      "COD confirms unpaid, commits stock once, and cannot be passed as prepaid",
      async () => {
        await assert.rejects(
          reserveOrder(
            customer.id,
            customer.cart,
            address,
            "SOFT10",
            key,
            undefined,
            codQuote.id,
            "prepaid",
          ),
          /method does not match/,
        );
        cod = (await reserveOrder(
          customer.id,
          customer.cart,
          address,
          "SOFT10",
          key,
          undefined,
          codQuote.id,
          "cod",
        )) as unknown as Order;
        assert.equal(cod.status, "confirmed");
        assert.equal(cod.payment_state, "due");
        assert.equal(cod.cod_fee, 2500);
        assert.equal(cod.total, codQuote.content.total);
        assert.equal(
          (await db.query("SELECT * FROM payments WHERE order_id=$1", [cod.id]))
            .rows.length,
          0,
        );
        const stock = (
          await db.query<{ stock: number; reserved: number }>(
            "SELECT stock,reserved FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0];
        assert.equal(stock.stock, variant.stock - 1);
        assert.equal(stock.reserved, 0);
        assert.equal(
          (
            await reserveOrder(
              customer.id,
              customer.cart,
              address,
              "SOFT10",
              key,
              undefined,
              codQuote.id,
              "cod",
            )
          ).id,
          cod.id,
        );
        await putCart();
        await assert.rejects(quote("cod"), /open Cash on Delivery/);
      },
    );
    await t.test(
      "COD cancellation restores committed stock once and is audited",
      async () => {
        await cancelPendingOrder(customer.id, cod.id);
        await cancelPendingOrder(customer.id, cod.id);
        const stock = (
          await db.query<{ stock: number; reserved: number }>(
            "SELECT stock,reserved FROM product_variants WHERE id=$1",
            [variant.id],
          )
        ).rows[0];
        assert.equal(stock.stock, variant.stock);
        assert.equal(stock.reserved, 0);
        assert.equal(
          (
            await db.query(
              "SELECT * FROM inventory_movements WHERE reason=$1",
              [`Cancelled COD order ${cod.id}`],
            )
          ).rows.length,
          1,
        );
      },
    );
    const nextQuote = await quote("cod");
    cod = (await reserveOrder(
      customer.id,
      customer.cart,
      address,
      "SOFT10",
      randomUUID(),
      undefined,
      nextQuote.id,
      "cod",
    )) as unknown as Order;
    const evidence = {
      order_id: cod.id,
      kind: "collection" as const,
      amount: cod.total,
      fees: 0,
      reference: "SYNTHETIC-COLLECTION-1",
      evidence: "Synthetic courier statement used only in tests",
      occurred_at: new Date().toISOString(),
      verified: true,
    };
    await t.test(
      "only delivered COD orders and finance-authorized evidence can be reconciled",
      async () => {
        await assert.rejects(recordCodEntry(customer, evidence), /permission/);
        await assert.rejects(
          recordCodEntry(finance, evidence),
          /delivered COD/,
        );
        for (const status of ["processing", "shipped", "delivered"] as const)
          await fulfillOrder(owner, {
            id: cod.id,
            status,
            carrier: "Synthetic courier",
            tracking: "SYNTHETIC-AWB",
          });
        assert.equal(
          (await customerOrders(customer.id, cod.id))[0].payment_state,
          "due",
        );
        await assert.rejects(
          db.query("UPDATE orders SET payment_state='collected' WHERE id=$1", [
            cod.id,
          ]),
          /evidence/,
        );
        await assert.rejects(
          recordCodEntry(finance, { ...evidence, amount: cod.total + 1 }),
          /exceed/,
        );
        await assert.rejects(
          recordCodEntry(finance, { ...evidence, verified: false }),
        );
      },
    );
    await t.test(
      "collection and remittance are bounded, immutable, audited and idempotent",
      async () => {
        await recordCodEntry(finance, evidence);
        assert.equal((await recordCodEntry(finance, evidence)).duplicate, true);
        assert.equal(
          (await customerOrders(customer.id, cod.id))[0].payment_state,
          "collected",
        );
        await assert.rejects(
          recordCodEntry(finance, { ...evidence, amount: 1 }),
          /different evidence/,
        );
        const remit = {
          ...evidence,
          kind: "remittance",
          reference: "SYNTHETIC-REMITTANCE-1",
          fees: 1234,
        };
        await Promise.all([
          recordCodEntry(finance, remit),
          recordCodEntry(finance, remit),
        ]);
        assert.equal(
          (await customerOrders(customer.id, cod.id))[0].payment_state,
          "remitted",
        );
        const financeData = await codFinance();
        assert.equal(financeData.ledger.length, 2);
        await assert.rejects(
          db.query("DELETE FROM cod_ledger WHERE order_id=$1", [cod.id]),
          /append-only/,
        );
        assert.equal(
          (
            await db.query(
              "SELECT * FROM audit_logs WHERE target_id=$1 AND action LIKE 'cod.%'",
              [cod.id],
            )
          ).rows.length,
          2,
        );
      },
    );
    await t.test(
      "COD ledger, quotes and tax configuration remain hidden from browser database roles",
      async () => {
        await db.exec(
          "CREATE ROLE pricing_browser NOLOGIN; GRANT USAGE ON SCHEMA public TO pricing_browser; GRANT SELECT ON checkout_quotes,tax_classes,cod_ledger TO pricing_browser;",
        );
        await db.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE pricing_browser");
          for (const table of ["checkout_quotes", "tax_classes", "cod_ledger"])
            assert.equal(
              (await tx.query(`SELECT * FROM ${table}`)).rows.length,
              0,
            );
        });
      },
    );
  } finally {
    await db.close();
  }
});
