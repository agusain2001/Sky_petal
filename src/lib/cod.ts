import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import type { User, Order } from "./types";

export const codEntrySchema = z
  .object({
    order_id: z.string().min(1).max(150),
    kind: z.enum(["collection", "remittance"]),
    amount: z.number().int().positive().max(2147483647),
    fees: z.number().int().min(0).default(0),
    reference: z.string().trim().min(6).max(200),
    evidence: z.string().trim().min(10).max(1000),
    occurred_at: z.iso.datetime({ offset: true }),
    verified: z.literal(true),
  })
  .refine(
    (v) => v.fees <= v.amount && (v.kind === "remittance" || v.fees === 0),
    "Fees apply only to remittances and cannot exceed the gross amount",
  );
export async function recordCodEntry(actor: User, body: unknown) {
  if (!["owner", "administrator", "finance"].includes(actor.role))
    throw new Error("You do not have permission to reconcile COD");
  const input = codEntrySchema.parse(body);
  if (Date.parse(input.occurred_at) > Date.now() + 60_000)
    throw new Error(
      "Collection/remittance evidence cannot be dated in the future",
    );
  const db = await getDB();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query<Order & { payment_method: string }>(
        "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
        [input.order_id],
      )
    ).rows[0];
    if (
      !order ||
      order.payment_method !== "cod" ||
      order.fulfillment_state !== "delivered"
    )
      throw new Error("Only delivered COD orders can be reconciled");
    if (Date.parse(input.occurred_at) < new Date(order.created_at).getTime())
      throw new Error("COD evidence cannot predate the order");
    const previous = (
      await tx.query<{
        amount: number;
        fees: number;
        evidence: string;
        occurred_at: string;
      }>(
        "SELECT * FROM cod_ledger WHERE order_id=$1 AND kind=$2 AND reference=$3",
        [order.id, input.kind, input.reference],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.amount !== input.amount ||
        previous.fees !== input.fees ||
        previous.evidence !== input.evidence ||
        new Date(previous.occurred_at).getTime() !==
          Date.parse(input.occurred_at)
      )
        throw new Error(
          "This COD reference already records different evidence",
        );
      return { duplicate: true };
    }
    const sums = (
      await tx.query<{ collected: string; remitted: string }>(
        "SELECT COALESCE(sum(amount) FILTER(WHERE kind='collection'),0) AS collected,COALESCE(sum(amount) FILTER(WHERE kind='remittance'),0) AS remitted FROM cod_ledger WHERE order_id=$1",
        [order.id],
      )
    ).rows[0];
    const collected = Number(sums.collected),
      remitted = Number(sums.remitted);
    if (input.kind === "collection" && collected + input.amount > order.total)
      throw new Error("Collection cannot exceed the amount due");
    if (input.kind === "remittance" && remitted + input.amount > collected)
      throw new Error("Remittance cannot exceed verified collections");
    if (input.kind === "remittance") {
      const eligible = (
        await tx.query<{ total: string }>(
          "SELECT COALESCE(sum(amount),0) AS total FROM cod_ledger WHERE order_id=$1 AND kind='collection' AND occurred_at<=$2",
          [order.id, input.occurred_at],
        )
      ).rows[0];
      if (remitted + input.amount > Number(eligible.total))
        throw new Error("Remittance cannot predate its verified collections");
    }
    await tx.query(
      "SELECT set_config('sky.actor_id',$1,true),set_config('sky.event_source','cod_reconciliation',true)",
      [actor.id],
    );
    const id = randomUUID();
    await tx.query(
      "INSERT INTO cod_ledger(id,order_id,kind,amount,fees,reference,actor_id,evidence,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        order.id,
        input.kind,
        input.amount,
        input.fees,
        input.reference,
        actor.id,
        input.evidence,
        input.occurred_at,
      ],
    );
    if (input.kind === "collection" && collected + input.amount === order.total)
      await tx.query(
        "UPDATE orders SET payment_state='collected' WHERE id=$1",
        [order.id],
      );
    if (input.kind === "remittance" && remitted + input.amount === order.total)
      await tx.query("UPDATE orders SET payment_state='remitted' WHERE id=$1", [
        order.id,
      ]);
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        actor.id,
        `cod.${input.kind}`,
        order.id,
        JSON.stringify({
          entry_id: id,
          amount: input.amount,
          fees: input.fees,
          reference: input.reference,
        }),
      ],
    );
    return { recorded: true };
  });
}
export async function codFinance() {
  const db = await getDB();
  const orders = (
    await db.query(`SELECT o.id,o.total,o.status,o.payment_state,o.fulfillment_state,o.created_at,
    COALESCE(sum(l.amount) FILTER(WHERE l.kind='collection'),0)::bigint AS collected,
    COALESCE(sum(l.amount) FILTER(WHERE l.kind='remittance'),0)::bigint AS remitted,
    COALESCE(sum(l.fees) FILTER(WHERE l.kind='remittance'),0)::bigint AS fees
    FROM orders o LEFT JOIN cod_ledger l ON l.order_id=o.id WHERE o.payment_method='cod'
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100`)
  ).rows;
  const ledger = (
    await db.query(
      "SELECT id,order_id,kind,amount,fees,reference,evidence,occurred_at FROM cod_ledger ORDER BY created_at DESC LIMIT 100",
    )
  ).rows;
  return { orders, ledger };
}
