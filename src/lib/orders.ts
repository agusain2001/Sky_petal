import { randomUUID } from "node:crypto";
import { getDB } from "./db";
import type { Order, User } from "./types";
import { notifyAccount } from "./jobs";

export async function customerOrders(userId: string, orderId?: string) {
  const db = await getDB();
  const orders = (
    await db.query<Order>(
      `SELECT o.*,a.state AS payment_attempt_state FROM orders o LEFT JOIN payment_attempts a ON a.order_id=o.id WHERE o.user_id=$1 ${orderId ? "AND o.id=$2" : ""} ORDER BY o.created_at DESC,o.id`,
      orderId ? [userId, orderId] : [userId],
    )
  ).rows;
  if (!orders.length) return orders;
  const ids = orders.map((o) => o.id);
  // Fixed query count: fetching a long history used to issue five extra queries
  // per order. Only fetch children of orders already scoped to this customer.
  const [items, events, shipments, tracking, bookings] = await Promise.all([
    db.query<Order["items"][number] & { order_id: string }>(
      "SELECT * FROM order_items WHERE order_id=ANY($1::text[]) ORDER BY id",
      [ids],
    ),
    db.query<NonNullable<Order["events"]>[number] & { order_id: string }>(
      "SELECT order_id,id,order_state,payment_state,fulfillment_state,refund_state,source,created_at FROM order_status_events WHERE order_id=ANY($1::text[]) ORDER BY created_at,id",
      [ids],
    ),
    db.query<NonNullable<Order["shipment"]> & { order_id: string }>(
      "SELECT order_id,carrier,tracking,created_at FROM shipments WHERE order_id=ANY($1::text[])",
      [ids],
    ),
    db.query<
      NonNullable<Order["tracking_events"]>[number] & { order_id: string }
    >(
      "SELECT order_id,id,status_code,label,occurred_at,scans FROM shipment_tracking_events WHERE order_id=ANY($1::text[]) ORDER BY occurred_at,id",
      [ids],
    ),
    db.query<{ order_id: string }>(
      "SELECT order_id FROM shipment_bookings WHERE order_id=ANY($1::text[])",
      [ids],
    ),
  ]);
  function group<T extends { order_id: string }>(rows: T[]) {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.order_id) || [];
      list.push(row);
      map.set(row.order_id, list);
    }
    return map;
  }
  const itemMap = group(items.rows),
    eventMap = group(events.rows),
    shipmentMap = group(shipments.rows),
    trackingMap = group(tracking.rows);
  const managed = new Set(bookings.rows.map((b) => b.order_id));
  for (const order of orders) {
    order.items = itemMap.get(order.id) || [];
    order.events = (eventMap.get(order.id) || []).map(
      ({ order_id, ...event }) => event,
    );
    const shipment = shipmentMap.get(order.id)?.[0];
    order.shipment = shipment
      ? {
          carrier: shipment.carrier,
          tracking: shipment.tracking,
          created_at: shipment.created_at,
        }
      : null;
    order.tracking_events = (trackingMap.get(order.id) || []).map(
      ({ order_id, ...event }) => event,
    );
    order.courier_managed = managed.has(order.id);
  }
  return orders;
}

/** Only unpaid, unfulfilled reservations can be cancelled without a refund workflow. */
export async function cancelPendingOrder(userId: string, orderId: string) {
  const db = await getDB();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query<Order>(
        "SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [orderId, userId],
      )
    ).rows[0];
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") return { cancelled: true };
    const cod =
      order.payment_method === "cod" &&
      order.status === "confirmed" &&
      order.payment_state === "due";
    const prepaid =
      order.status === "paid" &&
      order.payment_state === "captured" &&
      order.fulfillment_state === "unfulfilled";
    if (
      !cod &&
      !prepaid &&
      (order.status !== "pending_payment" || order.payment_state !== "pending")
    )
      throw new Error(
        "This order cannot be cancelled automatically. Please contact customer care.",
      );
    await tx.query(
      "SELECT set_config('sky.actor_id',$1,true),set_config('sky.event_source','customer',true),set_config('sky.event_reason','Customer cancelled an unpaid reservation',true)",
      [userId],
    );
    if (prepaid) {
      const active = await tx.query(
        "SELECT id FROM refunds WHERE order_id=$1 AND status NOT IN ('failed','rejected')",
        [orderId],
      );
      if (active.rows.length)
        throw new Error(
          "A refund is already under review; contact customer care about cancellation",
        );
      const payment = (
        await tx.query<{ id: string }>(
          "SELECT id FROM payments WHERE order_id=$1 AND status='captured' AND provider='razorpay' AND amount=$2",
          [orderId, order.total],
        )
      ).rows[0];
      if (!payment)
        throw new Error(
          "Captured payment evidence is unavailable; contact customer care",
        );
      const refundId = randomUUID();
      await tx.query(
        "INSERT INTO refunds(id,order_id,payment_id,method,amount,status,reason,request_key,requested_by) VALUES($1,$2,$3,'razorpay',$4,'requested','Customer cancellation before packing',$5,$6)",
        [
          refundId,
          orderId,
          payment.id,
          order.total,
          `cancel:${orderId}`,
          userId,
        ],
      );
      await tx.query(
        "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'refund.request',$3,$4)",
        [
          randomUUID(),
          userId,
          refundId,
          JSON.stringify({
            source: "paid_cancellation",
            order_id: orderId,
            amount: order.total,
          }),
        ],
      );
      await notifyAccount(
        tx,
        userId,
        `refund:${refundId}:requested`,
        "Cancellation refund under review",
        "Your order was cancelled before packing. Its refund is awaiting finance approval.",
        orderId,
      );
    }
    await tx.query(
      `UPDATE orders SET status='cancelled'${prepaid ? ",refund_state='pending'" : ""} WHERE id=$1`,
      [orderId],
    );
    const items = (
      await tx.query<{ variant_id: string; quantity: number }>(
        "SELECT variant_id,quantity FROM order_items WHERE order_id=$1 ORDER BY variant_id",
        [orderId],
      )
    ).rows;
    for (const item of items) {
      await tx.query(
        `UPDATE product_variants SET stock=stock+$1${cod || prepaid ? "" : ",reserved=reserved-$1"} WHERE id=$2`,
        [item.quantity, item.variant_id],
      );
      if (cod || prepaid) {
        await tx.query(
          "INSERT INTO inventory_movements(id,variant_id,change,reason) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            item.variant_id,
            item.quantity,
            `Cancelled ${cod ? "COD" : "prepaid"} order ${orderId}`,
          ],
        );
        await tx.query(
          "UPDATE products SET sales=GREATEST(0,sales-$1) WHERE id=(SELECT product_id FROM product_variants WHERE id=$2)",
          [item.quantity, item.variant_id],
        );
      }
    }
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'order.cancel',$3,$4)",
      [
        randomUUID(),
        userId,
        orderId,
        JSON.stringify({ reservation_released: true }),
      ],
    );
    return { cancelled: true, refund_requested: prepaid };
  });
}

export async function fulfillOrder(
  actor: User,
  input: {
    id: string;
    status: "processing" | "shipped" | "delivered";
    tracking: string;
    carrier: string;
  },
) {
  if (!["owner", "administrator", "fulfillment"].includes(actor.role))
    throw new Error("You do not have permission to fulfill orders");
  if (
    input.status === "shipped" &&
    (!input.tracking.trim() || !input.carrier.trim())
  )
    throw new Error("Add the carrier and tracking reference");
  const db = await getDB();
  await db.transaction(async (tx) => {
    const providerBooking = await tx.query(
      "SELECT id FROM shipment_bookings WHERE order_id=$1",
      [input.id],
    );
    if (providerBooking.rows.length && input.status !== "processing")
      throw new Error(
        "Courier scans update booked shipments. Inspect the courier tracking and resolve discrepancies through operations.",
      );
    if (input.status !== "delivered") {
      const order = (
        await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
          input.id,
        ])
      ).rows[0];
      if (order?.refund_state !== "none")
        throw new Error(
          "Resolve refund requests before dispatching this order",
        );
    }
    await tx.query(
      "SELECT set_config('sky.actor_id',$1,true),set_config('sky.event_source','staff',true)",
      [actor.id],
    );
    const transitions = {
      processing: ["paid", "confirmed"],
      shipped: ["processing"],
      delivered: ["shipped"],
    };
    const result = await tx.query(
      "UPDATE orders SET status=$1 WHERE id=$2 AND status=ANY($3::text[]) RETURNING id",
      [input.status, input.id, transitions[input.status]],
    );
    if (!result.rows.length)
      throw new Error("This order cannot move to that status");
    if (input.status === "shipped")
      await tx.query(
        "INSERT INTO shipments(id,order_id,carrier,tracking) VALUES($1,$2,$3,$4)",
        [randomUUID(), input.id, input.carrier.trim(), input.tracking.trim()],
      );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        actor.id,
        `order.${input.status}`,
        input.id,
        JSON.stringify({ status: input.status }),
      ],
    );
  });
}
