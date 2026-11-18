import {
  randomUUID,
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { getDB } from "./db";
import { notifyAccount } from "./jobs";
import { addressSchema } from "./addresses";
import { validateCheckoutQuote, type QueryClient } from "./pricing";
export function signatureValid(
  body: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function expireReservations(db: PGlite) {
  return db.transaction(async (tx) => {
    await tx.query(
      "SELECT set_config('sky.event_source','reservation_expiry',true)",
    );
    const expired = await tx.query<{ id: string }>(
      "UPDATE orders SET status='expired' WHERE status='pending_payment' AND expires_at<now() RETURNING id",
    );
    for (const order of expired.rows) {
      const items = await tx.query<{ variant_id: string; quantity: number }>(
        "SELECT variant_id,quantity FROM order_items WHERE order_id=$1 ORDER BY variant_id",
        [order.id],
      );
      for (const item of items.rows)
        await tx.query(
          "UPDATE product_variants SET stock=stock+$1,reserved=reserved-$1 WHERE id=$2",
          [item.quantity, item.variant_id],
        );
    }
    return expired.rows.length;
  });
}
export async function reserveOrder(
  userId: string,
  cartId: string,
  address: Record<string, string>,
  coupon: string,
  idempotency: string,
  billingAddress?: Record<string, string>,
  quoteId?: string,
  expectedMethod?: "prepaid" | "cod",
) {
  const db = await getDB();
  await expireReservations(db);
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE", [
      userId,
    ]);
    await tx.query(
      "SELECT set_config('sky.actor_id',$1,true),set_config('sky.event_source','checkout',true)",
      [userId],
    );
    const ownedCart = await tx.query(
      "SELECT id FROM carts WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [cartId, userId],
    );
    if (!ownedCart.rows.length)
      throw new Error("Your shopping bag could not be verified");
    const prior = await tx.query<Record<string, unknown>>(
      "SELECT * FROM orders WHERE user_id=$1 AND idempotency_key=$2",
      [userId, idempotency],
    );
    if (prior.rows[0] && quoteId && prior.rows[0].quote_id !== quoteId)
      throw new Error(
        "Checkout details changed. Cancel your previous unpaid order before starting a new checkout.",
      );
    if (
      prior.rows[0] &&
      expectedMethod &&
      prior.rows[0].payment_method !== expectedMethod
    )
      throw new Error("Payment method does not match your quote");
    if (prior.rows[0] && prior.rows[0].status !== "pending_payment")
      return prior.rows[0];
    const cart = await tx.query<{
      variant_id: string;
      quantity: number;
      price: number;
      stock: number;
      title: string;
      color: string;
      size: string;
      sku: string;
    }>(
      `SELECT ci.*,v.price,v.stock,v.color,v.size,v.sku,p.title FROM cart_items ci JOIN product_variants v ON ci.variant_id=v.id JOIN products p ON v.product_id=p.id WHERE cart_id=$1 AND p.published=true ORDER BY v.id`,
      [cartId],
    );
    const shippingSnapshot = addressSchema.parse(address);
    const billingSnapshot = addressSchema.parse(billingAddress || address);
    if (!cart.rows.length) throw new Error("Your bag is empty");
    const allItems = await tx.query<{ count: string }>(
      "SELECT count(*) FROM cart_items WHERE cart_id=$1",
      [cartId],
    );
    if (Number(allItems.rows[0].count) !== cart.rows.length)
      throw new Error(
        "Some products are no longer available. Please review your bag.",
      );
    const subtotal = cart.rows.reduce((s, x) => s + x.price * x.quantity, 0);
    let discount = 0;
    if (coupon) {
      const c = await tx.query<{ percent: number }>(
        "SELECT percent FROM coupons WHERE code=$1 AND active=true",
        [coupon.toUpperCase()],
      );
      if (!c.rows[0]) throw new Error("This offer code is not valid");
      discount = Math.floor((subtotal * c.rows[0].percent) / 100);
    }
    const quote = quoteId
      ? await validateCheckoutQuote(
          tx,
          userId,
          cartId,
          quoteId,
          shippingSnapshot,
          billingSnapshot,
          coupon.toUpperCase(),
        )
      : null;
    if (quote && expectedMethod && quote.payment_method !== expectedMethod)
      throw new Error("Payment method does not match your quote");
    if (
      quote &&
      (quote.content.subtotal !== subtotal ||
        quote.content.discount !== discount ||
        JSON.stringify(
          cart.rows.map((item) => [item.variant_id, item.quantity, item.price]),
        ) !==
          JSON.stringify(
            quote.content.lines.map((item) => [
              item.variant_id,
              item.quantity,
              item.price,
            ]),
          ))
    )
      throw new Error(
        "Your bag changed while checkout was starting. Check delivery again.",
      );
    const shipping = quote
      ? quote.content.shipping
      : subtotal - discount >= 299000
        ? 0
        : 9900;
    const fingerprint =
      quote?.request_fingerprint ||
      createHash("sha256")
        .update(
          JSON.stringify({
            address: shippingSnapshot,
            billing: billingSnapshot,
            coupon: coupon.toUpperCase(),
            items: cart.rows.map((item) => [
              item.variant_id,
              item.quantity,
              item.price,
            ]),
            pricing: [subtotal, discount, shipping],
          }),
        )
        .digest("hex");
    if (prior.rows[0]) {
      if (
        prior.rows[0].status === "pending_payment" &&
        prior.rows[0].request_fingerprint !== fingerprint
      )
        throw new Error(
          "Checkout details changed. Cancel your previous unpaid order in your account before starting a new checkout.",
        );
      return prior.rows[0];
    }
    const uncertain = await tx.query(
      "SELECT a.id FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE o.user_id=$1 AND a.state IN ('creating','unknown','authorized','manual_review') LIMIT 1",
      [userId],
    );
    if (uncertain.rows.length)
      throw new Error(
        "An earlier payment needs reconciliation. Check your existing order before starting another checkout.",
      );
    const id = randomUUID();
    const result = await tx.query<Record<string, unknown>>(
      "INSERT INTO orders(id,user_id,subtotal,shipping,discount,total,address,idempotency_key,billing_address,request_fingerprint,quote_id,tax_snapshot,shipping_snapshot,payment_method,cod_fee) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *",
      [
        id,
        userId,
        subtotal,
        shipping,
        discount,
        quote?.content.total ?? subtotal - discount + shipping,
        JSON.stringify(shippingSnapshot),
        idempotency,
        JSON.stringify(billingSnapshot),
        fingerprint,
        quote?.id || null,
        quote ? JSON.stringify(quote.content.tax) : null,
        quote
          ? JSON.stringify({
              ...quote.content.shipping_option,
              weight_grams: quote.content.weight_grams,
              origin_state: quote.content.origin_state,
              destination_state: quote.content.destination_state,
            })
          : null,
        quote?.payment_method || "prepaid",
        quote?.content.cod_fee || 0,
      ],
    );
    for (const item of cart.rows) {
      const updated = await tx.query(
        "UPDATE product_variants SET stock=stock-$1,reserved=reserved+$1 WHERE id=$2 AND stock>=$1 RETURNING id",
        [item.quantity, item.variant_id],
      );
      if (!updated.rows.length)
        throw new Error(`${item.title} no longer has enough stock`);
      await tx.query(
        "INSERT INTO order_items(id,order_id,variant_id,title,color,size,quantity,price,sku,pricing_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          randomUUID(),
          id,
          item.variant_id,
          item.title,
          item.color,
          item.size,
          item.quantity,
          item.price,
          item.sku,
          quote
            ? JSON.stringify(
                quote.content.lines.find(
                  (line) => line.variant_id === item.variant_id,
                ),
              )
            : null,
        ],
      );
    }
    if (quote?.payment_method === "cod") {
      await tx.query("UPDATE orders SET status='confirmed' WHERE id=$1", [id]);
      await commitOrderInventory(tx, id, userId);
      return (
        await tx.query<Record<string, unknown>>(
          "SELECT * FROM orders WHERE id=$1",
          [id],
        )
      ).rows[0];
    }
    return result.rows[0];
  });
}
export async function confirmCapturedPayment(
  providerOrder: string,
  paymentId: string,
  amount: number,
  currency: string,
  eventId: string,
) {
  const db = await getDB();
  await expireReservations(db);
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('sky.event_source','razorpay',true)");
    const o = await tx.query<{
      id: string;
      status: string;
      total: number;
      user_id: string;
      payment_id: string | null;
      payment_method: string;
    }>("SELECT * FROM orders WHERE provider_id=$1 FOR UPDATE", [providerOrder]);
    const order = o.rows[0];
    if (
      !order ||
      order.payment_method !== "prepaid" ||
      amount !== order.total ||
      currency !== "INR"
    )
      throw new Error("Payment amount or currency does not match");
    const seen = await tx.query<{
      content: { providerOrder: string; paymentId: string };
    }>("SELECT content FROM payment_events WHERE id=$1", [eventId]);
    if (seen.rows.length) {
      if (
        seen.rows[0].content.providerOrder !== providerOrder ||
        seen.rows[0].content.paymentId !== paymentId
      )
        throw new Error(
          "Payment event identity conflict; reconciliation required",
        );
      return { duplicate: true };
    }
    const paidStates = [
      "paid",
      "processing",
      "shipped",
      "delivered",
      "refunded",
    ];
    const cancelledAfterCapture =
      order.status === "cancelled" && order.payment_id !== null;
    if (
      order.status !== "pending_payment" &&
      !paidStates.includes(order.status) &&
      !cancelledAfterCapture
    )
      throw new Error(
        "Order reservation has expired; payment needs reconciliation",
      );
    if (
      (paidStates.includes(order.status) || cancelledAfterCapture) &&
      order.payment_id !== paymentId
    )
      throw new Error(
        "Additional payment on an already paid order; reconciliation required",
      );
    await tx.query("INSERT INTO payment_events(id,content) VALUES($1,$2)", [
      eventId,
      JSON.stringify({ providerOrder, paymentId, amount }),
    ]);
    if (paidStates.includes(order.status) || cancelledAfterCapture) {
      await tx.query(
        "UPDATE payment_attempts SET state='captured',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=now() WHERE order_id=$1",
        [order.id],
      );
      return { duplicate: true };
    }
    await tx.query(
      "INSERT INTO payments VALUES($1,$2,'razorpay',$3,'captured')",
      [paymentId, order.id, amount],
    );
    await tx.query(
      "UPDATE orders SET status='paid',payment_id=$1 WHERE id=$2",
      [paymentId, order.id],
    );
    await commitOrderInventory(tx, order.id, order.user_id);
    await tx.query(
      "UPDATE payment_attempts SET state='captured',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=now() WHERE order_id=$1",
      [order.id],
    );
    return { paid: true, order_id: order.id };
  });
}
export async function commitOrderInventory(
  tx: QueryClient,
  orderId: string,
  userId: string,
) {
  const method = (
    await tx.query<{ payment_method: string }>(
      "SELECT payment_method FROM orders WHERE id=$1",
      [orderId],
    )
  ).rows[0].payment_method;
  await notifyAccount(
    tx,
    userId,
    `order:${orderId}:confirmed`,
    "Order confirmed",
    method === "cod"
      ? "Your order is confirmed. Payment is due on delivery."
      : "Your payment was verified and your order is confirmed.",
    orderId,
  );
  const items = await tx.query<{ variant_id: string; quantity: number }>(
    "SELECT variant_id,quantity FROM order_items WHERE order_id=$1",
    [orderId],
  );
  for (const i of items.rows) {
    await tx.query(
      "UPDATE product_variants SET reserved=reserved-$1 WHERE id=$2",
      [i.quantity, i.variant_id],
    );
    await tx.query(
      "INSERT INTO inventory_movements VALUES($1,$2,$3,$4,now())",
      [randomUUID(), i.variant_id, -i.quantity, `Order ${orderId}`],
    );
    await tx.query(
      "UPDATE products SET sales=sales+$1 WHERE id=(SELECT product_id FROM product_variants WHERE id=$2)",
      [i.quantity, i.variant_id],
    );
  }
  const cart = await tx.query<{ id: string }>(
    "SELECT id FROM carts WHERE user_id=$1",
    [userId],
  );
  if (cart.rows[0])
    for (const i of items.rows) {
      await tx.query(
        "DELETE FROM cart_items WHERE cart_id=$1 AND variant_id=$2 AND quantity<=$3",
        [cart.rows[0].id, i.variant_id, i.quantity],
      );
      await tx.query(
        "UPDATE cart_items SET quantity=quantity-$1 WHERE cart_id=$2 AND variant_id=$3",
        [i.quantity, cart.rows[0].id, i.variant_id],
      );
    }
}
