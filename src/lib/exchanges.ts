import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import { notifyAccount } from "./jobs";
import type { User } from "./types";
export type ExchangeCase = {
  id: string;
  return_id: string;
  replacement_order_id: string;
  user_id: string;
  original_value: number;
  replacement_total: number;
  replacement_status: string;
  replacement_payment_state: string;
  replacement_fulfillment_state: string;
  original_order_id: string;
  return_status: string;
  refunded: number;
  net_cost_after_original_refund: number;
  created_at: string;
};
export async function linkExchange(actor: User, input: unknown) {
  const data = z
      .object({
        return_id: z.string().min(1).max(150),
        replacement_order_id: z.string().min(1).max(150),
      })
      .parse(input),
    db = await getDB();
  return db.transaction(async (tx) => {
    const rma = (
      await tx.query<{
        id: string;
        user_id: string;
        order_id: string;
        resolution: string;
        status: string;
        created_at: string;
      }>("SELECT * FROM returns WHERE id=$1 AND user_id=$2 FOR UPDATE", [
        data.return_id,
        actor.id,
      ])
    ).rows[0];
    if (!rma) throw new Error("Return not found");
    const old = (
      await tx.query<{ replacement_order_id: string }>(
        "SELECT * FROM exchange_cases WHERE return_id=$1",
        [rma.id],
      )
    ).rows[0];
    if (old) {
      if (old.replacement_order_id !== data.replacement_order_id)
        throw new Error(
          "An exchange is already linked to a different replacement",
        );
      return old;
    }
    if (
      rma.resolution !== "exchange" ||
      !["inspected", "completed"].includes(rma.status)
    )
      throw new Error(
        "An approved, received and inspected exchange return is required",
      );
    const replacement = (
      await tx.query<{
        id: string;
        total: number;
        created_at: string;
        status: string;
      }>(
        "SELECT id,total,created_at,status FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [data.replacement_order_id, actor.id],
      )
    ).rows[0];
    if (
      !replacement ||
      replacement.id === rma.order_id ||
      new Date(replacement.created_at) < new Date(rma.created_at) ||
      ["cancelled", "expired", "refunded"].includes(replacement.status)
    )
      throw new Error(
        "Choose your own new replacement order, created after this return request",
      );
    const original = Number(
      (
        await tx.query<{ cap: string }>(
          "SELECT COALESCE(sum(refund_cap),0) cap FROM return_items WHERE return_id=$1",
          [rma.id],
        )
      ).rows[0].cap,
    );
    const row = (
      await tx.query(
        "INSERT INTO exchange_cases(id,return_id,replacement_order_id,user_id,original_value,replacement_total) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          randomUUID(),
          rma.id,
          replacement.id,
          actor.id,
          original,
          replacement.total,
        ],
      )
    ).rows[0];
    await tx.query(
      "INSERT INTO return_events(id,return_id,status,actor_id,message) VALUES($1,$2,'replacement_linked',$3,$4)",
      [
        randomUUID(),
        rma.id,
        actor.id,
        `Replacement order ${replacement.id} linked. Its payment and shipment remain separate from the original refund.`,
      ],
    );
    await notifyAccount(
      tx,
      actor.id,
      `exchange:${rma.id}:linked`,
      "Exchange replacement linked",
      "Your replacement follows its own checkout and delivery. The original refund remains subject to financial approval.",
      rma.order_id,
    );
    return row;
  });
}
export async function listExchanges(actor: User, staff = false) {
  if (
    staff &&
    !["owner", "administrator", "finance", "fulfillment", "support"].includes(
      actor.role,
    )
  )
    throw new Error("You do not have permission to inspect exchanges");
  return (
    await (
      await getDB()
    ).query<ExchangeCase>(
      `SELECT e.*,o.status replacement_status,o.payment_state replacement_payment_state,o.fulfillment_state replacement_fulfillment_state,r.order_id original_order_id,r.status return_status,COALESCE((SELECT sum(amount) FROM refunds f WHERE f.return_id=r.id AND f.status='processed'),0)::int refunded, e.replacement_total-e.original_value AS net_cost_after_original_refund FROM exchange_cases e JOIN returns r ON r.id=e.return_id JOIN orders o ON o.id=e.replacement_order_id WHERE ${staff ? "true" : "e.user_id=$1"} ORDER BY e.created_at DESC LIMIT 100`,
      staff ? [] : [actor.id],
    )
  ).rows;
}
