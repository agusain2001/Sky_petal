import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import { shiprocketRequest, rupeesToPaise } from "./shipping";
import { enqueueJob, notifyAccount, DeferredJobError } from "./jobs";
import type { Order, User, Address } from "./types";
const roles = ["owner", "administrator", "fulfillment"];
function authorize(actor: User) {
  if (!roles.includes(actor.role))
    throw new Error("You do not have permission to manage shipments");
}
const providerId = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
type Booking = {
  id: string;
  order_id: string;
  stage: string;
  request_snapshot: Record<string, unknown>;
  courier_id: number;
  sr_order_id: number | null;
  sr_shipment_id: number | null;
  awb: string | null;
  carrier: string | null;
  label_url: string | null;
  manifest_url: string | null;
  pickup_reference: string | null;
  delivery_state: string;
  last_event_at: string | null;
  last_error: string | null;
};
export interface CourierProvider {
  find(
    orderId: string,
  ): Promise<{ order_id: number; shipment_id: number } | null>;
  create(
    body: Record<string, unknown>,
  ): Promise<{ order_id: number; shipment_id: number }>;
  inspect(
    orderId: number,
    shipmentId: number,
  ): Promise<{
    source_order_id: string;
    shipment_id: number;
    total_paise: number;
    currency: string;
    payment_method: string;
    postal: string;
    awb: string | null;
    carrier: string | null;
    courier_id: number | null;
    pickup_reference: string | null;
  }>;
  assign(
    shipmentId: number,
    courierId: number,
  ): Promise<{ awb: string; carrier: string; courier_id: number }>;
  pickup(shipmentId: number): Promise<string>;
  label(shipmentId: number): Promise<string>;
  manifest(shipmentId: number): Promise<string>;
}
function documentUrl(value: unknown) {
  const url = z.url().parse(value),
    parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("Courier returned an unsafe document URL");
  return url;
}
export const shiprocketProvider: CourierProvider = {
  async find(orderId) {
    const result = z
      .object({
        data: z.array(
          z.object({
            id: providerId,
            channel_order_id: z.string(),
            shipments: z.array(z.object({ id: providerId })),
          }),
        ),
      })
      .parse(
        await shiprocketRequest(
          `orders?search=${encodeURIComponent(orderId)}&per_page=100`,
        ),
      );
    const matches = result.data.filter((r) => r.channel_order_id === orderId);
    if (matches.length > 1)
      throw new Error(
        "Multiple courier orders match; operator reconciliation is required",
      );
    if (!matches.length) return null;
    if (matches[0].shipments.length !== 1)
      throw new Error("Courier order has an ambiguous shipment");
    return { order_id: matches[0].id, shipment_id: matches[0].shipments[0].id };
  },
  async create(body) {
    return z
      .object({ order_id: providerId, shipment_id: providerId })
      .parse(await shiprocketRequest("orders/create/adhoc", body));
  },
  async inspect(orderId, shipmentId) {
    const order = z
      .object({
        data: z.object({
          id: providerId,
          channel_order_id: z.string(),
          currency: z.string(),
          payment_method: z.string(),
          total: z.union([z.number(), z.string()]),
        }),
      })
      .parse(await shiprocketRequest(`orders/show/${orderId}`)).data;
    const shipment = z
      .object({
        data: z.object({
          id: providerId,
          order_id: providerId,
          awb: z.string().nullable(),
          courier: z.string().nullable(),
          sr_courier_id: z.coerce.number().int().nullable().optional(),
          pickup_generated_date: z.string().nullable().optional(),
          pickup_token_number: z
            .union([z.string(), z.number()])
            .nullable()
            .optional(),
          shipping_address: z.object({
            pincode: z.union([z.string(), z.number()]),
          }),
        }),
      })
      .parse(await shiprocketRequest(`shipments/${shipmentId}`)).data;
    if (
      order.id !== orderId ||
      shipment.id !== shipmentId ||
      shipment.order_id !== orderId
    )
      throw new Error("Courier returned a different shipment identity");
    return {
      source_order_id: order.channel_order_id,
      shipment_id: shipment.id,
      total_paise: rupeesToPaise(order.total),
      currency: order.currency,
      payment_method: order.payment_method,
      postal: String(shipment.shipping_address.pincode),
      awb: shipment.awb,
      carrier: shipment.courier,
      courier_id: shipment.sr_courier_id || null,
      pickup_reference: shipment.pickup_generated_date
        ? String(shipment.pickup_token_number || shipment.pickup_generated_date)
        : null,
    };
  },
  async assign(shipmentId, courierId) {
    const result = z
      .object({
        awb_assign_status: z.literal(1),
        response: z.object({
          data: z.object({
            shipment_id: providerId,
            courier_company_id: providerId,
            awb_code: z.string().min(1),
            courier_name: z.string().min(1),
          }),
        }),
      })
      .parse(
        await shiprocketRequest("courier/assign/awb", {
          shipment_id: shipmentId,
          courier_id: courierId,
        }),
      );
    if (result.response.data.shipment_id !== shipmentId)
      throw new Error("Courier AWB belongs to a different shipment");
    return {
      awb: result.response.data.awb_code,
      carrier: result.response.data.courier_name,
      courier_id: result.response.data.courier_company_id,
    };
  },
  async pickup(shipmentId) {
    const result = z
      .object({
        pickup_status: z.literal(1),
        response: z.object({
          pickup_token_number: z.union([z.string(), z.number()]),
        }),
      })
      .parse(
        await shiprocketRequest("courier/generate/pickup", {
          shipment_id: [shipmentId],
        }),
      );
    return String(result.response.pickup_token_number);
  },
  async label(shipmentId) {
    const result = z
      .object({ label_created: z.literal(1), label_url: z.string() })
      .parse(
        await shiprocketRequest("courier/generate/label", {
          shipment_id: [shipmentId],
        }),
      );
    return documentUrl(result.label_url);
  },
  async manifest(shipmentId) {
    const result = z.object({ manifest_url: z.string() }).parse(
      await shiprocketRequest("manifests/generate", {
        shipment_id: [shipmentId],
      }),
    );
    return documentUrl(result.manifest_url);
  },
};
export async function requestShipment(actor: User, input: unknown) {
  authorize(actor);
  const data = z
    .object({
      order_id: z.string().min(1).max(150),
      pickup_location: z.string().trim().min(1).max(100),
      length: z.number().min(0.51).max(500),
      breadth: z.number().min(0.51).max(500),
      height: z.number().min(0.51).max(500),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query<
        Order & {
          shipping_snapshot: {
            courier_id: number;
            weight_grams: number;
          } | null;
        }
      >("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [data.order_id])
    ).rows[0];
    if (!order) throw new Error("Order not found");
    const prior = (
      await tx.query<Booking>(
        "SELECT * FROM shipment_bookings WHERE order_id=$1",
        [order.id],
      )
    ).rows[0];
    if (prior) {
      if (
        ["pickup_location", "length", "breadth", "height"].some(
          (key) =>
            prior.request_snapshot[key] !== data[key as keyof typeof data],
        )
      )
        throw new Error(
          "Shipment request already records different parcel details",
        );
      return { id: prior.id, stage: prior.stage };
    }
    if (
      order.status !== "processing" ||
      order.refund_state !== "none" ||
      !order.shipping_snapshot
    )
      throw new Error(
        "Pack an eligible quoted order before booking its shipment",
      );
    const existing = await tx.query(
      "SELECT id FROM shipments WHERE order_id=$1",
      [order.id],
    );
    if (existing.rows.length)
      throw new Error("This order already has a shipment reference");
    const items = (
      await tx.query<{
        title: string;
        sku: string;
        quantity: number;
        price: number;
        pricing_snapshot: { rate_bps: number; hsn: string } | null;
      }>("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id", [order.id])
    ).rows;
    if (items.some((i) => !i.sku || !i.pricing_snapshot?.hsn))
      throw new Error(
        "Copied SKU and tax details are required for courier booking",
      );
    const email = (
      await tx.query<{ email: string }>("SELECT email FROM users WHERE id=$1", [
        order.user_id,
      ])
    ).rows[0].email;
    function address(prefix: string, address: Address) {
      const names = address.name.trim().split(/\s+/);
      return {
        [`${prefix}_customer_name`]: names[0],
        [`${prefix}_last_name`]: names.slice(1).join(" "),
        [`${prefix}_address`]: address.line1,
        [`${prefix}_address_2`]: [address.line2, address.landmark]
          .filter(Boolean)
          .join(", "),
        [`${prefix}_city`]: address.city,
        [`${prefix}_state`]: address.state,
        [`${prefix}_pincode`]: address.postal,
        [`${prefix}_country`]: "India",
        [`${prefix}_phone`]: address.phone,
        [`${prefix}_email`]: email,
      };
    }
    const snapshot = {
      order_id: order.id,
      order_date: new Date(order.created_at).toISOString().slice(0, 10),
      pickup_location: data.pickup_location,
      ...address(
        "billing",
        (order.billing_address || order.address) as Address,
      ),
      shipping_is_billing: false,
      ...address("shipping", order.address as Address),
      order_items: items.map((item) => ({
        name: item.title,
        sku: item.sku,
        units: item.quantity,
        selling_price: (item.price / 100).toFixed(2),
        tax: item.pricing_snapshot!.rate_bps / 100,
        hsn: item.pricing_snapshot!.hsn,
      })),
      payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
      shipping_charges: (order.shipping / 100).toFixed(2),
      transaction_charges: (order.cod_fee / 100).toFixed(2),
      total_discount: (order.discount / 100).toFixed(2),
      sub_total: (order.total / 100).toFixed(2),
      length: data.length,
      breadth: data.breadth,
      height: data.height,
      weight: order.shipping_snapshot.weight_grams / 1000,
    };
    const booking = randomUUID();
    await tx.query(
      "INSERT INTO shipment_bookings(id,order_id,request_snapshot,actor_id,courier_id) VALUES($1,$2,$3,$4,$5)",
      [
        booking,
        order.id,
        JSON.stringify(snapshot),
        actor.id,
        order.shipping_snapshot.courier_id,
      ],
    );
    await enqueueJob(tx, "shipping.book", `shipping.book:${booking}`, {
      booking_id: booking,
    });
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'shipment.request',$3,$4)",
      [randomUUID(), actor.id, booking, JSON.stringify(data)],
    );
    return { id: booking, stage: "queued" };
  });
}
export async function shipmentList(actor: User) {
  authorize(actor);
  const db = await getDB();
  return (
    await db.query<Omit<Booking, "request_snapshot">>(
      "SELECT id,order_id,stage,sr_order_id,sr_shipment_id,courier_id,awb,carrier,label_url,manifest_url,pickup_reference,delivery_state,last_event_at,last_error FROM shipment_bookings ORDER BY created_at DESC,id LIMIT 100",
    )
  ).rows;
}
export async function executeShipment(
  id: string,
  provider: CourierProvider = shiprocketProvider,
) {
  if (
    provider === shiprocketProvider &&
    !process.env.SHIPROCKET_TOKEN &&
    !(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD)
  )
    throw new Error("Courier service is not configured");
  const db = await getDB(),
    lease = randomUUID();
  let row = (
    await db.query<Booking>(
      "UPDATE shipment_bookings SET lease_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1 AND (lease_until IS NULL OR lease_until<now()) RETURNING *",
      [id, lease],
    )
  ).rows[0];
  if (!row)
    throw new DeferredJobError("Shipment is already being reconciled", 60);
  async function save(stage: string, values: Record<string, unknown> = {}) {
    const keys = Object.keys(values);
    const result = await db.query<Booking>(
      `UPDATE shipment_bookings SET stage=$3,last_error=NULL${keys.map((key, index) => `,${key}=$${index + 4}`).join("")} WHERE id=$1 AND lease_token=$2 AND lease_until>now() RETURNING *`,
      [id, lease, stage, ...Object.values(values)],
    );
    if (!result.rows.length)
      throw new Error("Shipment processing lease expired");
    row = result.rows[0];
  }
  try {
    if (row.stage === "ready") return;
    const order = (
      await db.query<Order>("SELECT * FROM orders WHERE id=$1", [row.order_id])
    ).rows[0];
    if (order.status !== "processing" || order.refund_state !== "none")
      throw new Error("Order is no longer eligible for courier booking");
    if (!row.sr_order_id) {
      const found = await provider.find(row.order_id);
      if (found)
        await save("created", {
          sr_order_id: found.order_id,
          sr_shipment_id: found.shipment_id,
        });
      else {
        if (row.stage !== "queued")
          throw new Error(
            "Courier create outcome is unknown. Reconcile the existing source order ID in the courier account; automatic recreation is blocked.",
          );
        await save("creating");
        try {
          const created = await provider.create(row.request_snapshot);
          await save("created", {
            sr_order_id: created.order_id,
            sr_shipment_id: created.shipment_id,
          });
        } catch (error) {
          await save("create_unknown");
          throw error;
        }
      }
    }
    const verified = await provider.inspect(
      Number(row.sr_order_id),
      Number(row.sr_shipment_id),
    );
    if (
      verified.source_order_id !== row.order_id ||
      verified.total_paise !== order.total ||
      verified.currency !== "INR" ||
      verified.payment_method.toLowerCase() !==
        (order.payment_method === "cod" ? "cod" : "prepaid") ||
      verified.postal !== order.address.postal
    )
      throw new Error(
        "Courier order identity, amount, method or destination does not match the immutable order",
      );
    if (
      row.awb &&
      (verified.awb !== row.awb || verified.courier_id !== row.courier_id)
    )
      throw new Error(
        "Provider shipment assignment changed; operator reconciliation is required",
      );
    if (!row.awb) {
      if (verified.awb) {
        if (verified.courier_id !== row.courier_id || !verified.carrier)
          throw new Error("Courier assignment differs from the approved quote");
        await save("awb_assigned", {
          awb: verified.awb,
          carrier: verified.carrier,
        });
      } else {
        if (["awb_assigning", "awb_unknown"].includes(row.stage))
          throw new Error(
            "AWB assignment outcome is unknown; reconcile before any reassignment",
          );
        await save("awb_assigning");
        try {
          const awb = await provider.assign(
            Number(row.sr_shipment_id),
            row.courier_id,
          );
          if (awb.courier_id !== row.courier_id)
            throw new Error("Assigned courier differs from the approved quote");
          await save("awb_assigned", { awb: awb.awb, carrier: awb.carrier });
        } catch (error) {
          await save("awb_unknown");
          throw error;
        }
      }
    }
    if (!row.pickup_reference) {
      if (verified.pickup_reference)
        await save("pickup_scheduled", {
          pickup_reference: verified.pickup_reference,
        });
      else {
        if (["pickup_scheduling", "pickup_unknown"].includes(row.stage))
          throw new Error(
            "Pickup outcome is unknown; reconcile the existing shipment before another pickup request",
          );
        await save("pickup_scheduling");
        try {
          await save("pickup_scheduled", {
            pickup_reference: await provider.pickup(Number(row.sr_shipment_id)),
          });
        } catch (error) {
          await save("pickup_unknown");
          throw error;
        }
      }
    }
    if (!row.label_url)
      await save("pickup_scheduled", {
        label_url: documentUrl(
          await provider.label(Number(row.sr_shipment_id)),
        ),
      });
    if (!row.manifest_url)
      await save("pickup_scheduled", {
        manifest_url: documentUrl(
          await provider.manifest(Number(row.sr_shipment_id)),
        ),
      });
    await db.transaction(async (tx) => {
      const locked = (
        await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
          row.order_id,
        ])
      ).rows[0];
      if (locked.status !== "processing" || locked.refund_state !== "none")
        throw new Error("Order requires review before shipment handover");
      await tx.query(
        "INSERT INTO shipments(id,order_id,carrier,tracking) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING",
        [randomUUID(), row.order_id, row.carrier, row.awb],
      );
      const existing = (
        await tx.query<{ tracking: string }>(
          "SELECT tracking FROM shipments WHERE order_id=$1",
          [row.order_id],
        )
      ).rows[0];
      if (existing.tracking !== row.awb)
        throw new Error("Order already has a different shipment reference");
      await tx.query(
        "UPDATE shipment_bookings SET stage='ready',last_error=NULL WHERE id=$1 AND lease_token=$2",
        [id, lease],
      );
      await notifyAccount(
        tx,
        order.user_id,
        `shipment:${id}:ready`,
        "Preparing for courier handover",
        "A courier reference is ready. Dispatch is confirmed after a courier movement scan.",
        order.id,
      );
    });
  } catch (error) {
    await db.query(
      "UPDATE shipment_bookings SET last_error=$3 WHERE id=$1 AND lease_token=$2",
      [
        id,
        lease,
        (error instanceof Error
          ? error.message
          : "Courier operation failed"
        ).slice(0, 500),
      ],
    );
    throw error;
  } finally {
    await db.query(
      "UPDATE shipment_bookings SET lease_until=NULL WHERE id=$1 AND lease_token=$2",
      [id, lease],
    );
  }
}
export function courierTime(value: string) {
  let text = value.trim();
  if (/^\d{2} \d{2} \d{4} \d{2}:\d{2}:\d{2}$/.test(text)) {
    const [d, m, y, time] = text.split(" ");
    text = `${y}-${m}-${d}T${time}+05:30`;
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text))
    text = text.replace(" ", "T") + "+05:30";
  if (
    !z.iso.datetime({ offset: true }).safeParse(text).success ||
    !Number.isFinite(Date.parse(text))
  )
    throw new Error("Courier event has an unsupported timestamp");
  return new Date(text).toISOString();
}
const trackingSchema = z.object({
  awb: z.string().min(1).max(150),
  sr_order_id: providerId,
  shipment_status_id: z.number().int().min(0),
  shipment_status: z.string().min(1).max(200),
  current_timestamp: z.string().max(50),
  scans: z
    .array(
      z.object({
        date: z.string().max(50),
        activity: z.string().max(500),
        location: z.string().max(200).optional(),
      }),
    )
    .max(500)
    .default([]),
});
export async function receiveTracking(input: unknown) {
  const data = trackingSchema.parse(input),
    eventId = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const db = await getDB();
  if (
    (
      await db.query(
        "SELECT p.id FROM shipment_bookings b JOIN orders o ON o.id=b.order_id JOIN privacy_requests p ON p.user_id=o.user_id AND p.kind='delete' AND p.status='completed' WHERE b.awb=$1",
        [data.awb],
      )
    ).rows.length
  )
    return { received: true, privacy_erased: true };
  await enqueueJob(db, "shipping.tracking", `shipping.tracking:${eventId}`, {
    event_id: eventId,
    event: data,
  });
  return { received: true };
}
export async function applyTracking(input: unknown, eventId: string) {
  const data = trackingSchema.parse(input),
    at = courierTime(data.current_timestamp);
  if (Date.parse(at) > Date.now() + 300000)
    throw new Error("Courier event is dated in the future");
  const db = await getDB();
  return db.transaction(async (tx) => {
    const booking = (
      await tx.query<Booking>(
        "SELECT * FROM shipment_bookings WHERE sr_order_id=$1 AND awb=$2",
        [data.sr_order_id, data.awb],
      )
    ).rows[0];
    if (!booking)
      throw new Error("Courier tracking does not match a recorded booking");
    const order = (
      await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        booking.order_id,
      ])
    ).rows[0];
    if (Date.parse(at) < new Date(order.created_at).getTime())
      throw new Error("Courier event predates the order");
    const current = (
      await tx.query<Booking>(
        "SELECT * FROM shipment_bookings WHERE id=$1 FOR UPDATE",
        [booking.id],
      )
    ).rows[0];
    const seen = await tx.query(
      "SELECT id FROM shipment_tracking_events WHERE id=$1",
      [eventId],
    );
    if (seen.rows.length) return { duplicate: true };
    await tx.query(
      "INSERT INTO shipment_tracking_events(id,booking_id,order_id,status_code,label,occurred_at,scans) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        eventId,
        booking.id,
        order.id,
        data.shipment_status_id,
        data.shipment_status,
        at,
        JSON.stringify(data.scans),
      ],
    );
    if (
      (current.last_event_at &&
        new Date(current.last_event_at).getTime() > Date.parse(at)) ||
      ["delivered", "rto_delivered"].includes(current.delivery_state)
    )
      return { retained: true };
    const code = data.shipment_status_id,
      delivered = code === 7 && !current.delivery_state.startsWith("rto_"),
      moving = [6, 17, 18, 38, 42, 51, 54].includes(code),
      rto = [9, 10, 14, 40, 41, 46].includes(code);
    let state = delivered
      ? "delivered"
      : code === 10
        ? "rto_delivered"
        : rto || current.delivery_state.startsWith("rto_")
          ? "rto_in_transit"
          : moving
            ? "in_transit"
            : current.delivery_state;
    await tx.query(
      "UPDATE shipment_bookings SET last_event_at=$1,delivery_state=$2 WHERE id=$3",
      [at, state, booking.id],
    );
    await tx.query(
      "SELECT set_config('sky.event_source','courier',true),set_config('sky.delivered_at',$1,true)",
      [at],
    );
    if ((moving || delivered) && order.status === "processing") {
      await tx.query("UPDATE orders SET status='shipped' WHERE id=$1", [
        order.id,
      ]);
      order.status = "shipped";
    }
    if (delivered && order.status === "shipped")
      await tx.query("UPDATE orders SET status='delivered' WHERE id=$1", [
        order.id,
      ]);
    if (delivered || moving || rto)
      await notifyAccount(
        tx,
        order.user_id,
        `tracking:${createHash("sha256")
          .update(JSON.stringify([booking.id, data.shipment_status_id, at]))
          .digest("hex")}`,
        "Courier update",
        data.shipment_status,
        order.id,
      );
    return { retained: true, state };
  });
}
