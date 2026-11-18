/** Disposable test store only. Never points at the merchant's running database. */
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { reserveOrder, confirmCapturedPayment } from "../src/lib/commerce";
import { fulfillOrder } from "../src/lib/orders";
import {
  saveCommerceConfig,
  saveTaxClass,
  defaultCommerceConfig,
} from "../src/lib/commerce-config";
import { createCheckoutQuote } from "../src/lib/pricing";
import { saveAddress } from "../src/lib/addresses";

async function main() {
  const directory = path.resolve(process.env.DATABASE_DIR || ".");
  const temporary = path.resolve(os.tmpdir()) + path.sep;
  const accessFile = process.env.TEST_OWNER_ACCESS_FILE;
  if (
    process.env.DATABASE_URL ||
    !directory.startsWith(temporary) ||
    !path.basename(directory).startsWith("sky-petal-acceptance-") ||
    !accessFile ||
    !path.resolve(accessFile).startsWith(temporary)
  )
    throw new Error(
      "Acceptance setup requires an explicit sky-petal-acceptance-* database and credential file inside the OS temporary directory.",
    );
  const db = await getDB();
  try {
    const email = `acceptance-owner-${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    const ownerId = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,'Acceptance owner',$3,'owner')",
      [ownerId, email, hashPassword(password)],
    );
    const cart = randomUUID();
    await db.query("INSERT INTO carts VALUES($1,$2)", [cart, ownerId]);
    const variant = (await getProducts())[0].variants.find(
      (variant) => variant.stock > 3,
    )!;
    const address = {
      name: "Acceptance shopper",
      phone: "9876543210",
      line1: "123 Synthetic Test Street",
      city: "Mumbai",
      state: "Maharashtra",
      postal: "400001",
    };
    await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
      cart,
      variant.id,
    ]);
    const delivered = await reserveOrder(
      ownerId,
      cart,
      address,
      "",
      randomUUID(),
    );
    const provider = `synthetic_order_${randomUUID()}`;
    await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
      provider,
      delivered.id,
    ]);
    // Explicit synthetic payment fixture; never a Razorpay sandbox/live transaction.
    await confirmCapturedPayment(
      provider,
      `synthetic_pay_${randomUUID()}`,
      delivered.total as number,
      "INR",
      `synthetic_event_${randomUUID()}`,
    );
    const actor = {
      id: ownerId,
      email,
      name: "Acceptance owner",
      role: "owner",
    };
    for (const status of ["processing", "shipped", "delivered"] as const)
      await fulfillOrder(actor, {
        id: delivered.id as string,
        status,
        carrier: "Synthetic test courier",
        tracking: "QA-AWB-ONLY",
      });
    await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
      cart,
      variant.id,
    ]);
    const pendingOrderIds: Record<string, unknown> = {};
    for (const project of ["desktop", "mobile"]) {
      const pending = await reserveOrder(
        ownerId,
        cart,
        address,
        "",
        randomUUID(),
      );
      pendingOrderIds[project] = pending.id;
    }
    const commerceFixtures: Record<string, unknown> = {};
    const returnFixtures: Record<string, unknown> = {};
    const completionFixtures: Record<string, unknown> = {};
    if (process.env.TEST_COMMERCE_FIXTURES === "true") {
      await saveCommerceConfig(actor, {
        ...defaultCommerceConfig,
        checkout_enabled: true,
        origin_pincode: "400001",
        origin_state: "Maharashtra",
        packaging_grams: 50,
        shipping_tax_bps: 1800,
        cod_enabled: true,
        cod_fee_paise: 2500,
        cod_tax_bps: 1800,
        cod_max_total_paise: 2_000_000,
        cod_max_open_orders: 1,
        cod_allowed_pincodes: ["400001"],
      });
      const tax = await saveTaxClass(actor, {
        name: "Synthetic acceptance tax",
        hsn: "9999",
        rate_bps: 1250,
        valid_from: "2020-01-01T00:00:00Z",
      });
      await db.query("UPDATE products SET tax_class_id=$1 WHERE id=$2", [
        tax.id,
        variant.product_id,
      ]);
      await db.query(
        "UPDATE product_variants SET weight_grams=250 WHERE id=$1",
        [variant.id],
      );
      for (const project of ["desktop", "mobile"]) {
        const teamId = randomUUID(),
          teamEmail = `mfa-${project}-${randomUUID()}@example.test`,
          teamPassword = randomBytes(24).toString("base64url");
        await db.query(
          "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,'Completion security QA',$3,'administrator')",
          [teamId, teamEmail, hashPassword(teamPassword)],
        );
        const shopperId = randomUUID(),
          shopperEmail = `invoice-${project}-${randomUUID()}@example.test`,
          shopperPassword = randomBytes(24).toString("base64url"),
          shopperCart = randomUUID();
        await db.query(
          "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'Completion invoice QA',$3)",
          [shopperId, shopperEmail, hashPassword(shopperPassword)],
        );
        await db.query("INSERT INTO carts VALUES($1,$2)", [
          shopperCart,
          shopperId,
        ]);
        await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
          shopperCart,
          variant.id,
        ]);
        const documentQuote = await createCheckoutQuote(
          shopperId,
          shopperCart,
          { address, payment_method: "prepaid" },
          async () => [
            {
              courier_id: 1001,
              courier_name: "Synthetic document courier",
              destination_state: "Maharashtra",
              destination_city: "Mumbai",
              destination_postcode: "400001",
              rate_paise: 12345,
              cod: false,
              estimated_delivery: null,
            },
          ],
        );
        const documentOrder = await reserveOrder(
            shopperId,
            shopperCart,
            address,
            "",
            randomUUID(),
            address,
            documentQuote.id,
            "prepaid",
          ),
          documentProvider = "synthetic_document_" + randomUUID();
        await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
          documentProvider,
          documentOrder.id,
        ]);
        await confirmCapturedPayment(
          documentProvider,
          "synthetic_document_payment_" + randomUUID(),
          Number(documentOrder.total),
          "INR",
          randomUUID(),
        );
        completionFixtures[project] = {
          team: { email: teamEmail, password: teamPassword },
          shopper: { email: shopperEmail, password: shopperPassword },
          order_id: documentOrder.id,
        };
        const id = randomUUID(),
          email = `cod-${project}-${randomUUID()}@example.test`,
          password = randomBytes(24).toString("base64url"),
          cart = randomUUID();
        await db.query(
          "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'COD acceptance shopper',$3)",
          [id, email, hashPassword(password)],
        );
        await db.query("INSERT INTO carts VALUES($1,$2)", [cart, id]);
        await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [
          cart,
          variant.id,
        ]);
        const saved = await saveAddress(id, { ...address, label: "Home" });
        const quote = await createCheckoutQuote(
          id,
          cart,
          { address: saved.content, payment_method: "cod" },
          async () => [
            {
              courier_id: 1001,
              courier_name: "Synthetic acceptance courier",
              destination_state: "Maharashtra",
              destination_city: "Mumbai",
              destination_postcode: "400001",
              rate_paise: 12345,
              cod: true,
              estimated_delivery: "Synthetic estimate",
            },
          ],
        );
        // Synthetic pre-issued quote for long CI/browser runs. Public quote
        // creation still uses five minutes; this helper is restricted to tmp DBs.
        const browserQuote = {
          ...quote,
          id: randomUUID(),
          expires_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        };
        await db.query(
          "INSERT INTO checkout_quotes(id,user_id,cart_id,payment_method,request_fingerprint,config_fingerprint,content,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            browserQuote.id,
            id,
            cart,
            browserQuote.payment_method,
            browserQuote.request_fingerprint,
            browserQuote.config_fingerprint,
            JSON.stringify(browserQuote.content),
            browserQuote.expires_at,
          ],
        );
        commerceFixtures[project] = {
          email,
          password,
          address: saved.content,
          quote: browserQuote,
        };
        const rmaUser = randomUUID(),
          rmaCart = randomUUID(),
          rmaEmail = `rma-${project}-${randomUUID()}@example.test`,
          rmaPassword = randomBytes(24).toString("base64url");
        await db.query(
          "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'RMA acceptance shopper',$3)",
          [rmaUser, rmaEmail, hashPassword(rmaPassword)],
        );
        await db.query("INSERT INTO carts VALUES($1,$2)", [rmaCart, rmaUser]);
        await db.query("INSERT INTO cart_items VALUES($1,$2,2)", [
          rmaCart,
          variant.id,
        ]);
        const rmaOrder = await reserveOrder(
          rmaUser,
          rmaCart,
          address,
          "",
          randomUUID(),
        );
        const provider = `order_${randomUUID()}`;
        await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
          provider,
          rmaOrder.id,
        ]);
        await confirmCapturedPayment(
          provider,
          `pay_${randomUUID()}`,
          Number(rmaOrder.total),
          "INR",
          randomUUID(),
        );
        for (const status of ["processing", "shipped", "delivered"] as const)
          await fulfillOrder(actor, {
            id: String(rmaOrder.id),
            status,
            carrier: "Synthetic RMA courier",
            tracking: `QA-RMA-${project}`,
          });
        returnFixtures[project] = {
          email: rmaEmail,
          password: rmaPassword,
          order_id: rmaOrder.id,
        };
      }
    }
    await writeFile(
      accessFile,
      JSON.stringify({
        email,
        password,
        deliveredOrderId: delivered.id,
        pendingOrderIds,
        commerceFixtures,
        returnFixtures,
        completionFixtures,
      }),
    );
    console.log(
      "Disposable acceptance store prepared. Credentials retained in the designated temporary file.",
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
