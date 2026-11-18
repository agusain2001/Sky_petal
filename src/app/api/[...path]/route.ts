import { NextRequest, NextResponse } from "next/server";
import { releaseReadiness } from "@/lib/release-readiness";
import {
  requestDeletion,
  deletionRequests,
  retentionPolicy,
  saveRetentionPolicy,
  approveDeletion,
  fulfillDeletion,
} from "@/lib/privacy-deletion";
import { linkExchange, listExchanges } from "@/lib/exchanges";
import {
  invoiceConfig,
  saveInvoiceConfig,
  issueInvoice,
  issueCreditNote,
  listDocuments,
  readDocument,
  documentPdf,
} from "@/lib/invoices";
import {
  beginMfa,
  verifyMfa,
  mfaStatus,
  requireStaffFactor,
} from "@/lib/staff-mfa";
import { cookies } from "next/headers";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDB, getProducts } from "@/lib/db";
import { mutateCart } from "@/lib/cart";
import { filterCatalog } from "@/lib/catalog";
import { exportCustomerData } from "@/lib/privacy";
import {
  ensurePaymentOrder,
  PaymentPendingError,
  paymentAttempts,
  retryPaymentReconciliation,
  recordPaymentObservation,
  recordPaymentClientEvent,
} from "@/lib/payment-attempts";
import { subscribeNewsletter, unsubscribeNewsletter } from "@/lib/newsletter";
import {
  currentUser,
  requireUser,
  requireRole,
  hashPassword,
  checkPassword,
  createSession,
  hashToken,
} from "@/lib/auth";
import { hasSupabase, supabase } from "@/lib/supabase";
import {
  reserveOrder,
  signatureValid,
  expireReservations,
} from "@/lib/commerce";
import type { CartItem, Order, User, Variant } from "@/lib/types";
import {
  addressSchema,
  checkoutAddress,
  listAddresses,
  saveAddress,
  deleteAddress,
} from "@/lib/addresses";
import { customerOrders, cancelPendingOrder, fulfillOrder } from "@/lib/orders";
import {
  getCommerceConfig,
  saveCommerceConfig,
  saveTaxClass,
} from "@/lib/commerce-config";
import { createCheckoutQuote } from "@/lib/pricing";
import { codFinance, recordCodEntry } from "@/lib/cod";
import {
  requestReturn,
  listReturns,
  updateReturn,
  saveReturnPolicy,
} from "@/lib/returns";
import {
  requestRefund,
  reviewRefund,
  refundList,
  confirmManualRefund,
  receiveRefundEvent,
  requestEvidenceCorrection,
  approveEvidenceCorrection,
} from "@/lib/refunds";
import { jobList, retryJob } from "@/lib/jobs";
import {
  requestShipment,
  shipmentList,
  receiveTracking,
} from "@/lib/fulfillment";
import {
  createTicket,
  listTickets,
  ticketDetail,
  replyToTicket,
  updateTicket,
} from "@/lib/support";
import {
  receiveVerifiedCapture,
  paymentInbox,
  processCapture,
  runCommerceMaintenance,
} from "@/lib/payment-inbox";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const id = z.string().min(1).max(150);
const siteOrigin = (req: NextRequest) =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  `${req.nextUrl.protocol}//${req.headers.get("host")}`;
async function cartId() {
  const db = await getDB();
  const u = await currentUser();
  if (u) {
    const r = await db.query<{ id: string }>(
      "SELECT id FROM carts WHERE user_id=$1",
      [u.id],
    );
    if (r.rows[0]) return r.rows[0].id;
    const cid = randomUUID();
    await db.query("INSERT INTO carts VALUES($1,$2)", [cid, u.id]);
    return cid;
  }
  const store = await cookies();
  let cid = store.get("sp_cart")?.value;
  if (!cid || !/^[a-f0-9]{64}$/.test(cid)) {
    cid = randomBytes(32).toString("hex");
    store.set("sp_cart", cid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 2592000,
    });
  }
  await db.query("INSERT INTO carts VALUES($1,NULL) ON CONFLICT DO NOTHING", [
    cid,
  ]);
  return cid;
}
async function mergeCart(userId: string) {
  const db = await getDB();
  const guest = (await cookies()).get("sp_cart")?.value;
  if (!guest) return;
  await db.transaction(async (tx) => {
    const r = await tx.query<{ id: string }>(
      "SELECT id FROM carts WHERE user_id=$1",
      [userId],
    );
    const cid = r.rows[0]?.id || randomUUID();
    await tx.query("INSERT INTO carts VALUES($1,$2) ON CONFLICT DO NOTHING", [
      cid,
      userId,
    ]);
    await tx.query(
      "INSERT INTO cart_items(cart_id,variant_id,quantity) SELECT $1,ci.variant_id,LEAST(ci.quantity,v.stock,20) FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id WHERE ci.cart_id=$2 AND v.stock>0 ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=LEAST(cart_items.quantity+excluded.quantity,20,(SELECT stock FROM product_variants WHERE id=excluded.variant_id))",
      [cid, guest],
    );
    await tx.query("DELETE FROM carts WHERE id=$1 AND user_id IS NULL", [
      guest,
    ]);
  });
  (await cookies()).delete("sp_cart");
}
async function limited(key: string, max = 15) {
  const db = await getDB();
  const r = await db.query<{ count: number }>(
    "INSERT INTO rate_limits VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE rate_limits.reset_at END RETURNING count",
    [key],
  );
  if (r.rows[0].count > max)
    throw new Error("Too many attempts. Please try again in 15 minutes.");
}
async function audit(
  actor: string,
  action: string,
  target: string,
  details: unknown = {},
) {
  const db = await getDB();
  await db.query(
    "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), actor, action, target, JSON.stringify(details)],
  );
}
async function get(req: NextRequest, path: string) {
  const db = await getDB();
  if (path === "admin/readiness") {
    await requireRole(["owner", "administrator"]);
    return json(await releaseReadiness());
  }
  if (path === "internal/readiness") {
    const secret = process.env.COMMERCE_MAINTENANCE_SECRET || "",
      supplied = req.headers.get("authorization") || "",
      expected = `Bearer ${secret}`;
    if (secret.length < 32)
      return json({ error: "Maintenance access is not configured" }, 503);
    if (
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      return json({ error: "Unauthorized" }, 401);
    return json(await releaseReadiness());
  }
  if (path === "privacy/requests")
    return json(await deletionRequests(await requireUser()));
  if (path === "admin/privacy") {
    const actor = await requireUser();
    return json({
      requests: await deletionRequests(actor, true),
      policy: await retentionPolicy(),
    });
  }
  if (path === "exchanges" || path === "admin/exchanges")
    return json(
      await listExchanges(await requireUser(), path.startsWith("admin/")),
    );
  if (path === "admin/invoices") {
    const actor = await requireRole(["owner", "administrator", "finance"]);
    return json({
      documents: await listDocuments(actor),
      config: await invoiceConfig(),
    });
  }
  if (/^orders\/[^/]+\/documents$/.test(path))
    return json(await listDocuments(await requireUser(), path.split("/")[1]));
  if (/^documents\/[^/]+\.(pdf|json)$/.test(path)) {
    const actor = await requireUser();
    await requireStaffFactor(
      actor,
      hashToken((await cookies()).get("sp_session")?.value || ""),
    );
    const document = await readDocument(
      actor,
      path.split("/")[1].replace(/\.(pdf|json)$/, ""),
    );
    if (path.endsWith(".json")) return json(document);
    return new NextResponse(new Uint8Array(await documentPdf(document)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.number.replace(/\//g, "-")}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  if (path === "security/mfa")
    return json(
      await mfaStatus(
        await requireUser(),
        hashToken((await cookies()).get("sp_session")?.value || ""),
      ),
    );
  if (path === "catalog") {
    await expireReservations(db);
    const products = filterCatalog(
      await getProducts(),
      req.nextUrl.searchParams,
    );
    return json({ products, total: products.length });
  }
  if (path === "home") {
    const r = await db.query<{ content: unknown }>(
      "SELECT content FROM cms_content WHERE key='home'",
    );
    return json(r.rows[0]?.content || {});
  }
  if (path === "me")
    return json({
      user: await currentUser(),
      authProvider: hasSupabase() ? "supabase" : "local-development",
      paymentsConfigured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      ),
      commerce: await getCommerceConfig().then((config) => ({
        checkout_enabled: config.checkout_enabled,
        prepaid_enabled: config.prepaid_enabled,
        cod_enabled: config.cod_enabled,
      })),
    });
  if (path === "auth/google") {
    if (!hasSupabase())
      return NextResponse.redirect(
        new URL(
          "/account?error=Google+sign-in+needs+Supabase+configuration",
          req.url,
        ),
      );
    const sb = await supabase();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteOrigin(req)}/auth/callback` },
    });
    if (error || !data.url)
      throw new Error("Google sign-in is currently unavailable");
    return NextResponse.redirect(data.url);
  }
  if (path === "cart") {
    const cid = await cartId();
    const r = await db.query<CartItem>(
      "SELECT ci.*,p.title,p.image,v.color,v.size,v.price,v.stock FROM cart_items ci JOIN product_variants v ON ci.variant_id=v.id JOIN products p ON v.product_id=p.id WHERE ci.cart_id=$1",
      [cid],
    );
    return json({ items: r.rows });
  }
  if (path === "wishlist") {
    const u = await requireUser();
    const r = await db.query<{ product_id: string }>(
      "SELECT product_id FROM wishlists WHERE user_id=$1",
      [u.id],
    );
    return json(r.rows.map((x) => x.product_id));
  }
  if (path === "orders" || /^orders\/[^/]+$/.test(path)) {
    const u = await requireUser();
    await expireReservations(db);
    const orders = await customerOrders(
      u.id,
      path === "orders" ? undefined : path.split("/")[1],
    );
    if (path !== "orders" && !orders[0])
      return json({ error: "Order not found" }, 404);
    return json(path === "orders" ? orders : orders[0]);
  }
  if (path === "addresses") {
    const u = await requireUser();
    return json(await listAddresses(u.id));
  }
  if (path === "returns" || path === "admin/returns")
    return json(
      await listReturns(
        await requireUser(),
        path.startsWith("admin/"),
        req.nextUrl.searchParams.get("order") || undefined,
      ),
    );
  if (path === "refunds" || path === "admin/refunds")
    return json(
      await refundList(
        await requireUser(),
        path.startsWith("admin/"),
        req.nextUrl.searchParams.get("order") || undefined,
      ),
    );
  if (path === "admin/jobs") {
    await requireRole(["owner", "administrator"]);
    return json(await jobList());
  }
  if (path === "admin/shipments")
    return json(await shipmentList(await requireUser()));
  if (path === "notifications") {
    const user = await requireUser();
    return json(
      (
        await db.query(
          "SELECT id,order_id,title,message,read_at,created_at FROM account_notifications WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 100",
          [user.id],
        )
      ).rows,
    );
  }
  if (path === "reviews") {
    const product = req.nextUrl.searchParams.get("product");
    return json(
      (
        await db.query(
          "SELECT r.id,r.rating,r.body,r.created_at,u.name FROM reviews r JOIN users u ON r.user_id=u.id WHERE product_id=$1 ORDER BY r.created_at DESC",
          [product],
        )
      ).rows,
    );
  }
  if (path === "support/tickets" || path === "admin/support")
    return json(
      await listTickets(
        await requireUser(),
        path === "admin/support",
        req.nextUrl.searchParams.get("status") || undefined,
      ),
    );
  if (/^(support\/tickets|admin\/support)\/[^/]+$/.test(path))
    return json(
      await ticketDetail(
        await requireUser(),
        path.split("/")[2],
        path.startsWith("admin/"),
      ),
    );
  if (path === "admin/payments") {
    await requireRole(["owner", "administrator"]);
    return json(await paymentInbox());
  }
  if (path === "admin/payment-attempts")
    return json(await paymentAttempts(await requireUser()));
  if (path === "admin/commerce") {
    await requireRole(["owner", "administrator", "catalog_editor"]);
    return json({
      config: await getCommerceConfig(),
      tax_classes: (
        await db.query("SELECT * FROM tax_classes ORDER BY name,id")
      ).rows,
    });
  }
  if (path === "admin/cod") {
    await requireRole(["owner", "administrator", "finance"]);
    return json(await codFinance());
  }
  if (path === "admin") {
    const staff = await requireRole([
      "owner",
      "administrator",
      "catalog_editor",
      "fulfillment",
      "support",
      "finance",
      "marketing",
    ]);
    const products = await getProducts(true);
    const canSeeOrders = [
      "owner",
      "administrator",
      "fulfillment",
      "support",
    ].includes(staff.role);
    const orders = canSeeOrders
      ? (
          await db.query<Order>(
            "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
          )
        ).rows
      : [];
    const revenue = canSeeOrders
      ? Number(
          (
            await db.query<{ total: string }>(
              "SELECT COALESCE(sum(amount),0) AS total FROM payments WHERE provider='razorpay' AND status='captured'",
            )
          ).rows[0].total,
        )
      : 0;
    return json({
      products,
      orders,
      revenue,
      customers: (
        await db.query<{ count: string }>(
          "SELECT count(*) FROM users WHERE role='customer'",
        )
      ).rows[0].count,
      home: (
        await db.query<{ content: unknown }>(
          "SELECT content FROM cms_content WHERE key='home'",
        )
      ).rows[0]?.content,
    });
  }
  throw new Error("Page not found");
}
async function post(req: NextRequest, path: string) {
  const db = await getDB();
  if (path === "shipping/events") {
    const secret = process.env.COURIER_WEBHOOK_TOKEN || "",
      supplied = req.headers.get("x-api-key") || "";
    if (secret.length < 32)
      return json({ error: "Courier events are not configured" }, 503);
    if (
      Buffer.byteLength(supplied) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))
    )
      return json({ error: "Unauthorized" }, 401);
    return json(await receiveTracking(await req.json()));
  }
  if (path === "internal/maintenance") {
    const secret = process.env.COMMERCE_MAINTENANCE_SECRET || "";
    if (secret.length < 32)
      return json({ error: "Maintenance access is not configured" }, 503);
    const supplied = req.headers.get("authorization") || "";
    const expected = `Bearer ${secret}`;
    if (
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      return json({ error: "Unauthorized" }, 401);
    return json(await runCommerceMaintenance());
  }
  if (path === "payments/webhook") {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return json({ error: "Payments are not configured" }, 503);
    const raw = await req.text();
    if (
      !signatureValid(
        raw,
        req.headers.get("x-razorpay-signature") || "",
        secret,
      )
    )
      return json({ error: "Invalid signature" }, 401);
    const event = JSON.parse(raw);
    if (
      ["refund.created", "refund.processed", "refund.failed"].includes(
        event.event,
      )
    )
      return json(
        await receiveRefundEvent(
          event.payload?.refund?.entity,
          id.parse(
            req.headers.get("x-razorpay-event-id") ||
              `${event.payload?.refund?.entity?.id}:${event.event}`,
          ),
        ),
      );
    if (["payment.authorized", "payment.failed"].includes(event.event)) {
      const payment = event.payload?.payment?.entity;
      if (payment?.status !== event.event.slice("payment.".length))
        return json({ error: "Payment event state does not match" }, 400);
      await recordPaymentObservation(
        payment,
        `webhook:${id.parse(req.headers.get("x-razorpay-event-id") || `${payment.id}:${event.event}`)}`,
        "webhook",
      );
      return json({ received: true });
    }
    if (event.event !== "payment.captured") return json({ received: true });
    const payment = event.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || payment.status !== "captured")
      return json({ error: "Invalid payload" }, 400);
    const evidence = {
      id: `webhook:${id.parse(req.headers.get("x-razorpay-event-id") || payment.id)}`,
      provider_order_id: id.parse(payment.order_id),
      payment_id: id.parse(payment.id),
      amount: z.number().int().positive().parse(payment.amount),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .parse(payment.currency),
      source: "webhook" as const,
    };
    try {
      return json(await receiveVerifiedCapture(evidence));
    } catch {
      return json(
        { error: "Payment processing failed; retry is required" },
        503,
      );
    }
  }
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return json({ error: "Request origin not allowed" }, 403);
  if (path === "admin/media") {
    const u = await requireRole(["owner", "administrator", "catalog_editor"]);
    if (Number(req.headers.get("content-length")) > 5_500_000)
      throw new Error("Choose an image smaller than 5 MB");
    const form = await req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 5_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error("Upload a JPEG, PNG or WebP smaller than 5 MB");
    const { default: sharp } = await import("sharp");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const filename = `product-${randomUUID()}.webp`;
    const dir = join(process.cwd(), "public", "images");
    await mkdir(dir, { recursive: true });
    const output = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
    })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    await writeFile(join(dir, filename), output);
    await audit(u.id, "media.upload", filename);
    return json({ url: "/images/" + filename });
  }
  const body = await req.json();
  if (path === "admin/privacy/policy")
    return json(
      await saveRetentionPolicy(
        await requireRole(["owner", "administrator"]),
        body,
      ),
    );
  if (path === "admin/privacy/approve")
    return json(
      await approveDeletion(
        await requireRole(["owner", "administrator"]),
        id.parse(body.id),
      ),
    );
  if (path === "admin/privacy/process") {
    const actor = await requireRole(["owner", "administrator"]);
    return json(await fulfillDeletion(id.parse(body.id), actor));
  }
  if (path === "exchanges")
    return json(await linkExchange(await requireUser(), body));
  if (path === "admin/invoices/config")
    return json(
      await saveInvoiceConfig(
        await requireRole(["owner", "administrator"]),
        body,
      ),
    );
  if (path === "admin/invoices/issue")
    return json(
      await issueInvoice(
        await requireRole(["owner", "administrator", "finance"]),
        id.parse(body.order_id),
      ),
    );
  if (path === "admin/invoices/credit")
    return json(
      await issueCreditNote(
        await requireRole(["owner", "administrator", "finance"]),
        id.parse(body.refund_id),
        body.allocations,
      ),
    );
  if (path === "security/mfa/enroll" || path === "security/mfa/verify") {
    const actor = await requireUser();
    await limited("mfa:" + actor.id, 10);
    const tokenHash = hashToken(
      (await cookies()).get("sp_session")?.value || "",
    );
    return json(
      path.endsWith("enroll")
        ? await beginMfa(
            actor,
            tokenHash,
            z.string().max(128).default("").parse(body.password),
          )
        : await verifyMfa(
            actor,
            tokenHash,
            z.string().min(6).max(100).parse(body.code),
            body.enroll === true,
          ),
    );
  }
  if (path === "support/tickets") {
    const user = await requireUser();
    await limited(`support-create:${user.id}`, 15);
    return json(await createTicket(user, body), 201);
  }
  if (/^(support\/tickets|admin\/support)\/[^/]+\/reply$/.test(path)) {
    const user = await requireUser();
    await limited(`support-reply:${user.id}`, 40);
    await replyToTicket(
      user,
      path.split("/")[2],
      body,
      path.startsWith("admin/"),
    );
    return json({ ok: true });
  }
  if (/^admin\/support\/[^/]+$/.test(path)) {
    await updateTicket(await requireUser(), path.split("/")[2], body);
    return json({ ok: true });
  }
  if (path === "admin/commerce") {
    const actor = await requireRole(["owner", "administrator"]);
    return json(await saveCommerceConfig(actor, body));
  }
  if (path === "admin/tax-class") {
    const actor = await requireRole(["owner", "administrator"]);
    return json(await saveTaxClass(actor, body));
  }
  if (path === "admin/product-tax") {
    const actor = await requireRole([
      "owner",
      "administrator",
      "catalog_editor",
    ]);
    const input = z
      .object({ product_id: id, tax_class_id: id.nullable() })
      .parse(body);
    await db.transaction(async (tx) => {
      const result = await tx.query(
        "UPDATE products SET tax_class_id=$1 WHERE id=$2 RETURNING id",
        [input.tax_class_id, input.product_id],
      );
      if (!result.rows.length) throw new Error("Product not found");
      await tx.query(
        "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'product.tax',$3,$4)",
        [randomUUID(), actor.id, input.product_id, JSON.stringify(input)],
      );
    });
    return json({ ok: true });
  }
  if (path === "admin/cod") {
    const actor = await requireRole(["owner", "administrator", "finance"]);
    return json(await recordCodEntry(actor, body));
  }
  if (path === "checkout/quote") {
    const user = await requireUser();
    const input = z
      .object({
        address: addressSchema.optional(),
        address_id: id.optional(),
        billing_address: addressSchema.optional(),
        billing_address_id: id.optional(),
        coupon: z.string().max(40).default(""),
        payment_method: z.enum(["prepaid", "cod"]).default("prepaid"),
        courier_id: z.number().int().positive().optional(),
      })
      .refine(
        (v) => Boolean(v.address) !== Boolean(v.address_id),
        "Choose a saved address or enter a new address",
      )
      .refine(
        (v) => !(v.billing_address && v.billing_address_id),
        "Choose one billing address",
      )
      .parse(body);
    await limited(`shipping-quote:${user.id}`, 40);
    const address = input.address_id
      ? await checkoutAddress(user.id, input.address_id, "shipping")
      : input.address!;
    const billing = input.billing_address_id
      ? await checkoutAddress(user.id, input.billing_address_id, "billing")
      : input.billing_address || address;
    return json(
      await createCheckoutQuote(user.id, await cartId(), {
        address,
        billing_address: billing,
        coupon: input.coupon,
        payment_method: input.payment_method,
        courier_id: input.courier_id,
      }),
    );
  }
  if (path === "admin/payments/retry") {
    const user = await requireRole(["owner", "administrator"]);
    const eventId = z.string().min(1).max(200).parse(body.id);
    await audit(user.id, "payment.retry", eventId);
    return json(await processCapture(eventId));
  }
  if (path === "admin/payment-attempts/reconcile")
    return json(
      await retryPaymentReconciliation(await requireUser(), id.parse(body.id)),
    );
  if (path === "auth") {
    const input = z
      .object({
        action: z.enum(["login", "register", "reset"]),
        email: z.email().max(200),
        password: z.string().min(8).max(128).optional(),
        name: z.string().min(2).max(100).optional(),
      })
      .parse(body);
    await limited(`auth:${input.email.toLowerCase()}`);
    if (hasSupabase()) {
      const sb = await supabase();
      if (input.action === "reset") {
        await sb.auth.resetPasswordForEmail(input.email, {
          redirectTo: `${siteOrigin(req)}/auth/callback?next=%2Faccount%3Fview%3DPassword`,
        });
        return json({
          message: "If an account exists, a reset email is on its way.",
        });
      }
      if (!input.password) throw new Error("Enter your password");
      if (input.action === "register") {
        const { error } = await sb.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: { full_name: input.name },
            emailRedirectTo: `${siteOrigin(req)}/auth/callback`,
          },
        });
        if (error) throw new Error(error.message);
        return json({
          message: "Check your email to verify your account, then sign in.",
        });
      }
      const { data, error } = await sb.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error || !data.user)
        throw new Error("Email or password is incorrect");
      if (!data.user.email_confirmed_at)
        throw new Error(
          "Verify your email with the identity provider before signing in",
        );
      if (
        (
          await db.query(
            "SELECT id FROM users WHERE id=$1 AND (deleted_at IS NOT NULL OR suspended_at IS NOT NULL)",
            [data.user.id],
          )
        ).rows.length
      )
        return json({ error: "This account is unavailable" }, 403);
      await db.query(
        "INSERT INTO users(id,email,name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING",
        [
          data.user.id,
          data.user.email,
          data.user.user_metadata.full_name || input.email.split("@")[0],
        ],
      );
      const u = (
        await db.query<User>(
          "SELECT id,email,name,role FROM users WHERE email=$1",
          [input.email],
        )
      ).rows[0];
      await createSession(u.id, "supabase");
      await mergeCart(u.id);
      return json({ user: u });
    }
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_AUTH !== "true"
    )
      return json(
        {
          error:
            "Configure Supabase authentication before accepting registrations",
        },
        503,
      );
    if (input.action === "reset")
      return json(
        {
          error:
            "Email delivery needs Supabase configuration. Local development accounts do not send email.",
        },
        503,
      );
    if (!input.password) throw new Error("Enter your password");
    let u: User;
    if (input.action === "register") {
      const uid = randomUUID();
      await db.query(
        "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
        [
          uid,
          input.email.toLowerCase(),
          input.name || input.email.split("@")[0],
          hashPassword(input.password),
        ],
      );
      u = (
        await db.query<User>(
          "SELECT id,email,name,role FROM users WHERE id=$1",
          [uid],
        )
      ).rows[0];
    } else {
      const r = await db.query<User & { password_hash: string }>(
        "SELECT * FROM users WHERE email=$1",
        [input.email.toLowerCase()],
      );
      if (
        !r.rows[0]?.password_hash ||
        !checkPassword(input.password, r.rows[0].password_hash)
      )
        throw new Error("Email or password is incorrect");
      const { password_hash: _, ...found } = r.rows[0];
      u = found;
    }
    await createSession(u.id);
    await mergeCart(u.id);
    return json({ user: u });
  }
  if (path === "logout") {
    const s = (await cookies()).get("sp_session")?.value;
    if (s)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hashToken(s),
      ]);
    (await cookies()).delete("sp_session");
    if (hasSupabase()) await (await supabase()).auth.signOut();
    return json({ ok: true });
  }
  if (path === "cart") {
    const cid = await cartId();
    return json(
      await mutateCart(cid, { ...body, operation: body.operation ?? "set" }),
    );
  }
  if (path === "quote") {
    const coupon = z
      .string()
      .max(40)
      .parse(body.coupon || "")
      .toUpperCase();
    const cid = await cartId();
    const items = await db.query<{ quantity: number; price: number }>(
      "SELECT ci.quantity,v.price FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id WHERE cart_id=$1 AND p.published=true",
      [cid],
    );
    const subtotal = items.rows.reduce((s, x) => s + x.quantity * x.price, 0);
    let percent = 0;
    if (coupon) {
      const c = await db.query<{ percent: number }>(
        "SELECT percent FROM coupons WHERE code=$1 AND active=true",
        [coupon],
      );
      if (!c.rows[0]) throw new Error("This offer code is not valid");
      percent = c.rows[0].percent;
    }
    const discount = Math.floor((subtotal * percent) / 100);
    const shipping = subtotal - discount >= 299000 ? 0 : 9900;
    return json({
      subtotal,
      discount,
      shipping,
      total: subtotal - discount + shipping,
      coupon,
    });
  }
  if (path === "newsletter") {
    const { email } = z
      .object({ email: z.email().max(200), consent: z.literal(true) })
      .parse(body);
    await limited(`newsletter:${email}`, 3);
    return json(await subscribeNewsletter(body));
  }
  if (path === "newsletter/unsubscribe")
    return json(await unsubscribeNewsletter(body));
  if (path === "wishlist") {
    const u = await requireUser();
    const pid = id.parse(body.product_id);
    const existing = await db.query(
      "DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2 RETURNING product_id",
      [u.id, pid],
    );
    if (!existing.rows.length)
      await db.query("INSERT INTO wishlists VALUES($1,$2)", [u.id, pid]);
    return json({ saved: !existing.rows.length });
  }
  if (path === "profile") {
    const u = await requireUser();
    const name = z.string().min(2).max(100).parse(body.name);
    await db.query("UPDATE users SET name=$1 WHERE id=$2", [name, u.id]);
    return json({ ok: true });
  }
  if (path === "password") {
    const u = await requireUser();
    await limited("password:" + u.id, 5);
    const input = z
      .object({
        password: z.string().min(12).max(128),
        current_password: z.string().max(128).optional(),
      })
      .parse(body);
    if (hasSupabase()) {
      const sb = await supabase();
      const verified = await sb.auth.getUser();
      if (
        verified.error ||
        verified.data.user?.email?.toLowerCase() !== u.email.toLowerCase()
      )
        throw new Error(
          "Use the password reset email to verify your account first",
        );
      const { error } = await sb.auth.updateUser({ password: input.password });
      if (error) throw new Error(error.message);
    } else {
      const stored = (
        await db.query<{ password_hash: string }>(
          "SELECT password_hash FROM users WHERE id=$1",
          [u.id],
        )
      ).rows[0];
      if (
        !input.current_password ||
        !checkPassword(input.current_password, stored.password_hash)
      )
        throw new Error("Your current password is incorrect");
      await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hashPassword(input.password),
        u.id,
      ]);
    }
    const token = (await cookies()).get("sp_session")?.value;
    await db.query("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", [
      u.id,
      hashToken(token || ""),
    ]);
    return json({
      message:
        "Your password has been updated. Other store sessions have been signed out.",
    });
  }
  if (path === "addresses") {
    const u = await requireUser();
    return json(await saveAddress(u.id, body), 201);
  }
  if (/^orders\/[^/]+\/cancel$/.test(path)) {
    const u = await requireUser();
    return json(await cancelPendingOrder(u.id, id.parse(path.split("/")[1])));
  }
  if (path === "privacy") {
    const u = await requireUser();
    const kind = z.enum(["delete", "export"]).parse(body.kind);
    if (kind === "export") {
      return json(await exportCustomerData(u.id));
    }
    return json(await requestDeletion(u));
  }
  if (path === "returns") {
    const user = await requireUser();
    await limited("return:" + user.id, 20);
    return json({
      ...(await requestReturn(user, body)),
      message: "Return request recorded for review.",
    });
  }
  if (path === "admin/returns")
    return json(await updateReturn(await requireUser(), body));
  if (path === "admin/shipments")
    return json(await requestShipment(await requireUser(), body));
  if (path === "admin/return-policy") {
    await saveReturnPolicy(await requireUser(), body);
    return json({ saved: true });
  }
  if (path === "admin/refunds")
    return json(await requestRefund(await requireUser(), body));
  if (path === "admin/refunds/review")
    return json(await reviewRefund(await requireUser(), body));
  if (path === "admin/refunds/manual-confirm")
    return json(await confirmManualRefund(await requireUser(), body));
  if (path === "admin/refunds/evidence-corrections")
    return json(await requestEvidenceCorrection(await requireUser(), body));
  if (path === "admin/refunds/evidence-corrections/approve")
    return json(await approveEvidenceCorrection(await requireUser(), body));
  if (path === "admin/jobs/retry") {
    await retryJob(await requireUser(), id.parse(body.id));
    return json({ queued: true });
  }
  if (path === "admin/jobs/run") {
    await requireRole(["owner", "administrator"]);
    return json(await runCommerceMaintenance());
  }
  if (path === "notifications/read") {
    const user = await requireUser();
    await db.query(
      "UPDATE account_notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND id=$2",
      [user.id, id.parse(body.id)],
    );
    return json({ read: true });
  }
  if (path === "reviews") {
    const u = await requireUser();
    const input = z
      .object({
        product_id: id,
        rating: z.number().int().min(1).max(5),
        body: z.string().min(10).max(2000),
      })
      .parse(body);
    const eligible = await db.query<{ order_id: string }>(
      "SELECT oi.order_id FROM order_items oi JOIN orders o ON oi.order_id=o.id JOIN product_variants v ON v.id=oi.variant_id WHERE o.user_id=$1 AND o.status='delivered' AND v.product_id=$2 LIMIT 1",
      [u.id, input.product_id],
    );
    if (!eligible.rows[0])
      throw new Error(
        "Only customers with a delivered purchase can review this product",
      );
    await db.query(
      "INSERT INTO reviews(id,user_id,product_id,order_id,rating,body) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        u.id,
        input.product_id,
        eligible.rows[0].order_id,
        input.rating,
        input.body,
      ],
    );
    return json({ ok: true });
  }
  if (path === "checkout") {
    const u = await requireUser();
    if (
      body.payment_method !== "cod" &&
      (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    )
      return json(
        {
          error:
            "Payments are not enabled yet. Your bag is saved; please return when checkout opens.",
        },
        503,
      );
    const input = z
      .object({
        address: addressSchema.optional(),
        address_id: id.optional(),
        billing_address: addressSchema.optional(),
        billing_address_id: id.optional(),
        coupon: z.string().max(40).default(""),
        idempotency: id,
        quote_id: id,
        payment_method: z.enum(["prepaid", "cod"]).default("prepaid"),
      })
      .refine(
        (input) => Boolean(input.address) !== Boolean(input.address_id),
        "Choose a saved address or enter a new address",
      )
      .refine(
        (input) => !(input.billing_address && input.billing_address_id),
        "Choose one billing address",
      )
      .parse(body);
    const shippingAddress = input.address_id
      ? await checkoutAddress(u.id, input.address_id, "shipping")
      : input.address!;
    const billingAddress = input.billing_address_id
      ? await checkoutAddress(u.id, input.billing_address_id, "billing")
      : input.billing_address || shippingAddress;
    const order = await reserveOrder(
      u.id,
      await cartId(),
      shippingAddress,
      input.coupon,
      input.idempotency,
      billingAddress,
      input.quote_id,
      input.payment_method,
    );
    if (order.payment_method !== input.payment_method)
      throw new Error("Payment method does not match your quote");
    if (order.payment_method === "cod")
      return json({
        local_order_id: order.id,
        payment_method: "cod",
        payment_state: order.payment_state,
        amount: order.total,
      });
    if (order.status !== "pending_payment")
      return json(
        {
          error:
            "Your previous checkout has closed. Review your bag and try again.",
          code: "CHECKOUT_CLOSED",
        },
        409,
      );
    let providerId: string;
    try {
      providerId = await ensurePaymentOrder(u.id, String(order.id));
    } catch (error) {
      if (error instanceof PaymentPendingError)
        return json(
          {
            error: error.message,
            code: "PAYMENT_PENDING",
            local_order_id: order.id,
          },
          409,
        );
      throw error;
    }
    return json({
      order_id: providerId,
      local_order_id: order.id,
      amount: order.total,
      key: process.env.RAZORPAY_KEY_ID,
    });
  }
  if (path === "payments/verify") {
    const u = await requireUser();
    const input = z
      .object({
        razorpay_order_id: id,
        razorpay_payment_id: id,
        razorpay_signature: z.string().length(64),
      })
      .parse(body);
    const order = await db.query(
      "SELECT id FROM orders WHERE provider_id=$1 AND user_id=$2",
      [input.razorpay_order_id, u.id],
    );
    if (!order.rows.length) throw new Error("Order not found");
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (
      !secret ||
      !signatureValid(
        `${input.razorpay_order_id}|${input.razorpay_payment_id}`,
        input.razorpay_signature,
        secret,
      )
    )
      throw new Error("Payment verification failed");
    const r = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.razorpay_payment_id)}`,
      {
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${secret}`).toString("base64")}`,
        },
      },
    );
    if (!r.ok) throw new Error("Payment verification is pending");
    const p = await r.json();
    if (p.order_id !== input.razorpay_order_id)
      throw new Error("Payment does not match this order");
    if (p.status !== "captured") {
      if (["created", "authorized", "failed"].includes(p.status))
        await recordPaymentObservation(
          p,
          `callback:${p.id}:${p.status}`,
          "callback",
        );
      throw new Error(
        "Payment capture is pending. Check your account for updates.",
      );
    }
    return json(
      await receiveVerifiedCapture({
        id: `callback:${p.id}`,
        provider_order_id: p.order_id,
        payment_id: p.id,
        amount: p.amount,
        currency: p.currency,
        source: "callback",
      }),
    );
  }
  if (path === "payments/client-event") {
    const user = await requireUser();
    await limited("payment-client:" + user.id, 60);
    return json(await recordPaymentClientEvent(user.id, body));
  }
  if (path === "admin/product") {
    const u = await requireRole(["owner", "administrator", "catalog_editor"]);
    const input = z
      .object({
        id: id.optional(),
        slug: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(100),
        title: z.string().min(2).max(200),
        description: z.string().min(10).max(10000),
        category: id,
        material: z.string().min(2).max(200),
        care: z.string().min(2).max(2000),
        image: z
          .string()
          .regex(/^(\/images\/[a-zA-Z0-9._-]+|https:\/\/[^\s]+)$/)
          .max(500),
        images: z
          .array(
            z
              .string()
              .regex(/^(\/images\/[a-zA-Z0-9._-]+|https:\/\/[^\s]+)$/)
              .max(500),
          )
          .max(12)
          .optional(),
        featured: z.boolean(),
        is_new: z.boolean(),
        published: z.boolean(),
      })
      .parse(body);
    const pid = input.id || randomUUID();
    await db.query(
      "INSERT INTO products(id,slug,title,description,category,material,care,image,images,featured,is_new,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,category=excluded.category,material=excluded.material,care=excluded.care,image=excluded.image,images=excluded.images,featured=excluded.featured,is_new=excluded.is_new,published=excluded.published",
      [
        pid,
        input.slug,
        input.title,
        input.description,
        input.category,
        input.material,
        input.care,
        input.image,
        JSON.stringify([...new Set([input.image, ...(input.images || [])])]),
        input.featured,
        input.is_new,
        input.published,
      ],
    );
    await audit(u.id, "product.save", pid);
    return json({ id: pid });
  }
  if (path === "admin/variant") {
    const u = await requireRole(["owner", "administrator", "catalog_editor"]);
    const input = z
      .object({
        id: id.optional(),
        product_id: id,
        sku: id,
        color: z.string().min(1).max(100),
        color_hex: z.string().regex(/^#[a-fA-F0-9]{6}$/),
        size: z.string().min(1).max(30),
        price: z.number().int().min(100),
        compare_price: z.number().int().nullable().default(null),
        stock: z.number().int().min(0).max(100000),
        weight_grams: z.number().int().min(1).max(100000).nullable().optional(),
      })
      .parse(body);
    await db.transaction(async (tx) => {
      const old = await tx.query<Variant>(
        "SELECT * FROM product_variants WHERE id=$1 FOR UPDATE",
        [input.id || ""],
      );
      const vid = input.id || randomUUID();
      await tx.query(
        "INSERT INTO product_variants(id,product_id,sku,color,color_hex,size,price,compare_price,stock) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,color=excluded.color,color_hex=excluded.color_hex,size=excluded.size,price=excluded.price,compare_price=excluded.compare_price,stock=excluded.stock",
        [
          vid,
          input.product_id,
          input.sku,
          input.color,
          input.color_hex,
          input.size,
          input.price,
          input.compare_price,
          input.stock,
        ],
      );
      if (input.weight_grams !== undefined)
        await tx.query(
          "UPDATE product_variants SET weight_grams=$1 WHERE id=$2",
          [input.weight_grams, vid],
        );
      await tx.query(
        "INSERT INTO inventory_movements VALUES($1,$2,$3,$4,now())",
        [
          randomUUID(),
          vid,
          input.stock - (old.rows[0]?.stock || 0),
          "Admin stock adjustment",
        ],
      );
    });
    await audit(u.id, "variant.save", input.product_id);
    return json({ ok: true });
  }
  if (path === "admin/order") {
    if (body.status === "shipped" && !body.tracking)
      throw new Error("Add a tracking reference");
    const u = await requireRole(["owner", "administrator", "fulfillment"]);
    const input = z
      .object({
        id: id,
        status: z.enum(["processing", "shipped", "delivered"]),
        tracking: z.string().max(200).default(""),
        carrier: z.string().max(100).default(""),
      })
      .parse(body);
    await fulfillOrder(u, input);
    return json({ ok: true });
  }
  if (path === "admin/cms") {
    const u = await requireRole(["owner", "administrator", "catalog_editor"]);
    const content = z.record(z.string(), z.string().max(10000)).parse(body);
    await db.query(
      "INSERT INTO cms_content VALUES('home',$1) ON CONFLICT(key) DO UPDATE SET content=excluded.content",
      [JSON.stringify(content)],
    );
    await audit(u.id, "cms.save", "home");
    return json({ ok: true });
  }
  if (path === "admin/coupon") {
    const u = await requireRole(["owner", "administrator"]);
    const input = z
      .object({
        code: z.string().regex(/^[A-Z0-9]{3,30}$/),
        percent: z.number().int().min(1).max(50),
        active: z.boolean(),
      })
      .parse(body);
    await db.query(
      "INSERT INTO coupons VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,active=excluded.active",
      [input.code, input.percent, input.active],
    );
    await audit(u.id, "coupon.save", input.code);
    return json({ ok: true });
  }
  throw new Error("Action not found");
}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/");
    if (path === "admin" || path.startsWith("admin/"))
      await requireStaffFactor(
        await requireUser(),
        hashToken((await cookies()).get("sp_session")?.value || ""),
      );
    return await get(req, path);
  } catch (e) {
    return handleError(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/");
    if (path === "admin" || path.startsWith("admin/"))
      await requireStaffFactor(
        await requireUser(),
        hashToken((await cookies()).get("sp_session")?.value || ""),
        /refund|cod|invoice|privacy|staff|commerce|tax|payment|jobs/.test(path),
      );
    return await post(req, path);
  } catch (e) {
    return handleError(e);
  }
}
async function mutateAddress(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
  remove: boolean,
) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return json({ error: "Request origin not allowed" }, 403);
    const path = (await params).path;
    if (path.length !== 2 || path[0] !== "addresses")
      return json({ error: "Action not found" }, 404);
    const user = await requireUser();
    const addressId = id.parse(path[1]);
    if (remove) {
      await deleteAddress(user.id, addressId);
      return json({ ok: true });
    }
    return json(await saveAddress(user.id, await req.json(), addressId));
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return mutateAddress(req, params, false);
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return mutateAddress(req, params, true);
}
function handleError(e: unknown) {
  const message = e instanceof Error ? e.message : "Something went wrong";
  if (e instanceof z.ZodError)
    return json(
      { error: e.issues[0]?.message || "Please check your details" },
      400,
    );
  if (message.includes("duplicate key"))
    return json(
      {
        error:
          "This record already exists. Please sign in or use a different value.",
      },
      409,
    );
  if (message.includes("permission")) return json({ error: message }, 403);
  if (
    message === "Address not found" ||
    message === "Order not found" ||
    message === "Support ticket not found" ||
    message === "Document not found"
  )
    return json({ error: message }, 404);
  if (message.includes("Sign in")) return json({ error: message }, 401);
  console.error("[Sky Petal]", message);
  return json(
    {
      error: message.includes("violates")
        ? "Please check your details and try again."
        : message,
    },
    400,
  );
}
