import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { getDB } from "./db";
import { allocateDiscount, type QueryClient } from "./pricing";
import { notifyAccount } from "./jobs";
import type { Order, User } from "./types";
const identifier = z.string().min(1).max(150);
export const returnRequestSchema = z.object({
  order_id: identifier,
  request_key: z.string().uuid(),
  reason: z.string().trim().min(10).max(2000),
  reason_code: z.enum([
    "fit",
    "change_mind",
    "defect",
    "damaged",
    "not_as_described",
  ]),
  resolution: z.enum(["refund", "exchange"]).default("refund"),
  sealed: z.boolean().default(false),
  items: z
    .array(
      z.object({
        order_item_id: identifier,
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
});
type ReturnRow = {
  id: string;
  user_id: string;
  order_id: string;
  status: string;
  reason: string;
  resolution: string;
  created_at: string;
  review_note: string | null;
  receipt_reference: string | null;
  policy_snapshot: unknown;
  items: ReturnItem[];
  events: { id: string; status: string; message: string; created_at: string }[];
};
type ReturnItem = {
  id: string;
  order_item_id: string;
  quantity: number;
  refund_cap: number;
  title: string;
  size: string;
  color: string;
  variant_id: string;
  disposition?: string;
};
const roles = ["owner", "administrator", "support", "fulfillment"];
function authorize(actor: User) {
  if (!roles.includes(actor.role))
    throw new Error("You do not have permission to manage returns");
}
async function event(
  tx: QueryClient,
  row: ReturnRow,
  actor: string,
  status: string,
  message: string,
) {
  await tx.query(
    "INSERT INTO return_events(id,return_id,status,actor_id,message) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), row.id, status, actor, message],
  );
  await tx.query(
    "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'return.update',$3,$4)",
    [randomUUID(), actor, row.id, JSON.stringify({ status })],
  );
  await notifyAccount(
    tx,
    row.user_id,
    `return:${row.id}:${status}`,
    "Return request updated",
    message,
    row.order_id,
  );
}
export async function requestReturn(user: User, input: unknown) {
  const data = returnRequestSchema.parse(input);
  if (
    new Set(data.items.map((i) => i.order_item_id)).size !== data.items.length
  )
    throw new Error("Select each order item once");
  const db = await getDB();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query<Order>(
        "SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [data.order_id, user.id],
      )
    ).rows[0];
    if (!order) throw new Error("Order not found");
    const prior = (
      await tx.query<ReturnRow>(
        "SELECT * FROM returns WHERE user_id=$1 AND request_key=$2",
        [user.id, data.request_key],
      )
    ).rows[0];
    if (prior) {
      if (
        prior.order_id !== data.order_id ||
        !isDeepStrictEqual(prior.policy_snapshot, {
          ...data,
          items: [...data.items].sort((a, b) =>
            a.order_item_id.localeCompare(b.order_item_id),
          ),
        })
      )
        throw new Error(
          "Return request key was already used for different details",
        );
      return prior;
    }
    if (order.fulfillment_state !== "delivered")
      throw new Error(
        "Returns require a delivered order. Contact customer care for delivery problems.",
      );
    type Item = {
      id: string;
      variant_id: string;
      quantity: number;
      price: number;
      title: string;
      return_window_days: number | null;
      sealed_return_required: boolean;
      pricing_snapshot: {
        net_paise?: number;
        return_window_days?: number | null;
        sealed_return_required?: boolean;
      } | null;
    };
    const items = (
      await tx.query<Item>(
        "SELECT oi.*,p.return_window_days,p.sealed_return_required FROM order_items oi JOIN product_variants v ON v.id=oi.variant_id JOIN products p ON p.id=v.product_id WHERE oi.order_id=$1 ORDER BY oi.id",
        [order.id],
      )
    ).rows;
    const discounts = allocateDiscount(
      items.map((i) => i.price * i.quantity),
      order.discount,
    );
    const created = randomUUID();
    const snapshot = {
      ...data,
      items: [...data.items].sort((a, b) =>
        a.order_item_id.localeCompare(b.order_item_id),
      ),
    };
    await tx.query(
      "INSERT INTO returns(id,user_id,order_id,reason,request_key,reason_code,resolution,policy_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        created,
        user.id,
        order.id,
        data.reason,
        data.request_key,
        data.reason_code,
        data.resolution,
        JSON.stringify(snapshot),
      ],
    );
    for (const selection of data.items) {
      const index = items.findIndex((i) => i.id === selection.order_item_id),
        item = items[index];
      if (!item) throw new Error("Selected item does not belong to this order");
      const allocation = (
        await tx.query<{ quantity: string; cap: string }>(
          "SELECT COALESCE(sum(ri.quantity),0) quantity,COALESCE(sum(ri.refund_cap),0) cap FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE ri.order_item_id=$1 AND r.status<>'rejected'",
          [item.id],
        )
      ).rows[0];
      const used = Number(allocation.quantity);
      if (used + selection.quantity > item.quantity)
        throw new Error(
          "Requested quantity exceeds items still eligible for a return",
        );
      if (["fit", "change_mind"].includes(data.reason_code)) {
        const days = item.pricing_snapshot?.return_window_days;
        if (days === undefined || days === null || !order.delivered_at)
          throw new Error(
            "Voluntary return terms or delivery evidence are unavailable. Contact customer care.",
          );
        if (
          days === 0 ||
          Date.now() - new Date(order.delivered_at).getTime() > days * 86400000
        )
          throw new Error(
            "This item is outside its voluntary return window. Contact customer care about a defect or incorrect item.",
          );
        if (item.pricing_snapshot?.sealed_return_required && !data.sealed)
          throw new Error(
            "This item requires intact hygiene seals for a voluntary return",
          );
      }
      const net =
        item.pricing_snapshot?.net_paise ??
        item.price * item.quantity - discounts[index];
      const cap =
        used + selection.quantity === item.quantity
          ? net - Number(allocation.cap)
          : Number(
              (BigInt(net) * BigInt(selection.quantity)) /
                BigInt(item.quantity),
            );
      await tx.query(
        "INSERT INTO return_items(id,return_id,order_item_id,quantity,refund_cap) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), created, item.id, selection.quantity, cap],
      );
    }
    const row = {
      id: created,
      user_id: user.id,
      order_id: order.id,
    } as ReturnRow;
    await event(
      tx,
      row,
      user.id,
      "requested",
      "Your request is awaiting review. Refunds and replacements require approval and inspection.",
    );
    return { id: created, status: "requested" };
  });
}
export async function listReturns(
  actor: User,
  staff = false,
  orderId?: string,
) {
  if (staff) authorize(actor);
  const db = await getDB();
  const rows = (
    await db.query<ReturnRow>(
      `SELECT * FROM returns WHERE ${staff ? "true" : "user_id=$1"} ${orderId ? `AND order_id=$${staff ? 1 : 2}` : ""} ORDER BY created_at DESC,id LIMIT 100`,
      [...(!staff ? [actor.id] : []), ...(orderId ? [orderId] : [])],
    )
  ).rows;
  for (const row of rows) {
    row.items = (
      await db.query<ReturnItem>(
        "SELECT ri.*,oi.title,oi.size,oi.color,oi.variant_id,i.disposition FROM return_items ri JOIN order_items oi ON oi.id=ri.order_item_id LEFT JOIN return_inspections i ON i.return_item_id=ri.id WHERE ri.return_id=$1 ORDER BY ri.id",
        [row.id],
      )
    ).rows;
    row.events = (
      await db.query<ReturnRow["events"][number]>(
        "SELECT id,status,message,created_at FROM return_events WHERE return_id=$1 ORDER BY created_at,id",
        [row.id],
      )
    ).rows;
  }
  return rows;
}
export async function updateReturn(actor: User, input: unknown) {
  authorize(actor);
  const data = z
    .object({
      id: identifier,
      action: z.enum(["approve", "reject", "receive", "inspect"]),
      note: z.string().trim().min(5).max(2000),
      reference: z.string().trim().max(150).optional(),
      inspections: z
        .array(
          z.object({
            return_item_id: identifier,
            disposition: z.enum(["restock", "quarantine", "dispose"]),
            condition_note: z.string().trim().min(5).max(1000),
          }),
        )
        .max(50)
        .optional(),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const row = (
      await tx.query<ReturnRow>(
        "SELECT * FROM returns WHERE id=$1 FOR UPDATE",
        [data.id],
      )
    ).rows[0];
    if (!row) throw new Error("Return not found");
    const next = {
      approve: "approved",
      reject: "rejected",
      receive: "received",
      inspect: "inspected",
    }[data.action];
    if (row.status === next) return { status: next };
    if (
      (["approve", "reject"].includes(data.action) &&
        row.status !== "requested") ||
      (data.action === "receive" && row.status !== "approved") ||
      (data.action === "inspect" && row.status !== "received")
    )
      throw new Error("This return cannot move to that status");
    if (
      ["receive", "inspect"].includes(data.action) &&
      !["owner", "administrator", "fulfillment"].includes(actor.role)
    )
      throw new Error(
        "You do not have permission to receive or inspect returns",
      );
    if (
      data.action === "receive" &&
      (!data.reference || data.reference.length < 6)
    )
      throw new Error("Add the actual receipt or replacement order reference");
    if (data.action === "inspect") {
      const items = (
        await tx.query<ReturnItem>(
          "SELECT ri.*,oi.variant_id FROM return_items ri JOIN order_items oi ON oi.id=ri.order_item_id WHERE return_id=$1 ORDER BY oi.variant_id,ri.id",
          [row.id],
        )
      ).rows;
      if (
        !data.inspections ||
        data.inspections.length !== items.length ||
        new Set(data.inspections.map((i) => i.return_item_id)).size !==
          items.length
      )
        throw new Error("Inspect every return line exactly once");
      for (const item of items) {
        const inspection = data.inspections.find(
          (i) => i.return_item_id === item.id,
        );
        if (!inspection)
          throw new Error("Inspection item does not belong to this return");
        await tx.query(
          "INSERT INTO return_inspections(id,return_item_id,disposition,condition_note,actor_id) VALUES($1,$2,$3,$4,$5)",
          [
            randomUUID(),
            item.id,
            inspection.disposition,
            inspection.condition_note,
            actor.id,
          ],
        );
        if (inspection.disposition === "restock") {
          await tx.query(
            "UPDATE product_variants SET stock=stock+$1 WHERE id=$2",
            [item.quantity, item.variant_id],
          );
          await tx.query(
            "INSERT INTO inventory_movements(id,variant_id,change,reason) VALUES($1,$2,$3,$4)",
            [
              randomUUID(),
              item.variant_id,
              item.quantity,
              `RMA ${row.id} inspection ${item.id}`,
            ],
          );
        }
      }
    }
    await tx.query(
      "UPDATE returns SET status=$1,review_note=$2,receipt_reference=COALESCE($3,receipt_reference) WHERE id=$4",
      [next, data.note, data.reference || null, row.id],
    );
    await event(tx, row, actor.id, next, data.note);
    return { status: next };
  });
}
export async function saveReturnPolicy(actor: User, input: unknown) {
  if (!["owner", "administrator", "catalog_editor"].includes(actor.role))
    throw new Error("You do not have permission to edit return terms");
  const data = z
    .object({
      product_id: identifier,
      return_window_days: z.number().int().min(0).max(365).nullable(),
      sealed_return_required: z.boolean(),
    })
    .parse(input);
  const db = await getDB();
  await db.transaction(async (tx) => {
    const row = await tx.query(
      "UPDATE products SET return_window_days=$1,sealed_return_required=$2 WHERE id=$3 RETURNING id",
      [data.return_window_days, data.sealed_return_required, data.product_id],
    );
    if (!row.rows.length) throw new Error("Product not found");
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'product.return_policy',$3,$4)",
      [randomUUID(), actor.id, data.product_id, JSON.stringify(data)],
    );
  });
}
