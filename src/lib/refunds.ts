import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import { enqueueJob, notifyAccount, DeferredJobError } from "./jobs";
import type { QueryClient } from "./pricing";
import type { Order, User } from "./types";
const identifier = z.string().min(1).max(150);
const financeRoles = ["owner", "administrator", "finance"];
function authorize(actor: User) {
  if (!financeRoles.includes(actor.role))
    throw new Error("You do not have permission to manage refunds");
}
export type Refund = {
  id: string;
  order_id: string;
  return_id: string | null;
  payment_id: string | null;
  provider_id: string | null;
  amount: number;
  status: string;
  method: "razorpay" | "manual_cod";
  reason: string;
  request_key: string;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  evidence_ref: string | null;
  created_at: string;
  corrections?: RefundEvidenceCorrection[];
};
export type RefundEvidenceCorrection = {
  id: string;
  refund_id: string;
  original_ref: string;
  previous_ref: string;
  corrected_ref: string;
  reason: string;
  independent_proof: string;
  requested_by: string;
  approved_by: string | null;
  reconciliation_ref: string | null;
  sequence: string | null;
};
export async function requestEvidenceCorrection(actor: User, input: unknown) {
  authorize(actor);
  const data = z
    .object({
      refund_id: identifier,
      request_key: z.string().uuid(),
      previous_ref: identifier,
      corrected_ref: z.string().trim().min(6).max(150),
      reason: z.string().trim().min(10).max(2000),
      independent_proof: z.string().trim().min(10).max(2000),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const row = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1 FOR UPDATE", [
        data.refund_id,
      ])
    ).rows[0];
    if (
      !row ||
      row.status !== "processed" ||
      row.method !== "manual_cod" ||
      !row.evidence_ref
    )
      throw new Error("Completed COD payout evidence is required");
    const old = (
      await tx.query<RefundEvidenceCorrection>(
        "SELECT * FROM refund_evidence_corrections WHERE request_key=$1",
        [data.request_key],
      )
    ).rows[0];
    if (old) {
      if (
        Object.entries(data).some(
          ([key, value]) =>
            key !== "request_key" &&
            old[key as keyof RefundEvidenceCorrection] !== value,
        ) ||
        old.requested_by !== actor.id
      )
        throw new Error("Correction key already records different details");
      return old;
    }
    const correction = (
      await tx.query<RefundEvidenceCorrection>(
        "INSERT INTO refund_evidence_corrections(id,refund_id,request_key,original_ref,previous_ref,corrected_ref,reason,independent_proof,requested_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [
          randomUUID(),
          row.id,
          data.request_key,
          row.evidence_ref,
          data.previous_ref,
          data.corrected_ref,
          data.reason,
          data.independent_proof,
          actor.id,
        ],
      )
    ).rows[0];
    await audit(tx, actor.id, "refund.evidence_correction_requested", row.id, {
      correction_id: correction.id,
    });
    return correction;
  });
}
export async function approveEvidenceCorrection(actor: User, input: unknown) {
  authorize(actor);
  const data = z
    .object({
      id: identifier,
      reconciliation_ref: z.string().trim().min(6).max(150),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const correction = (
      await tx.query<RefundEvidenceCorrection>(
        "SELECT * FROM refund_evidence_corrections WHERE id=$1",
        [data.id],
      )
    ).rows[0];
    if (!correction) throw new Error("Correction not found");
    await tx.query("SELECT id FROM refunds WHERE id=$1 FOR UPDATE", [
      correction.refund_id,
    ]);
    const old = (
      await tx.query<{ approved_by: string; reconciliation_ref: string }>(
        "SELECT * FROM refund_evidence_approvals WHERE correction_id=$1",
        [data.id],
      )
    ).rows[0];
    if (old) {
      if (
        old.approved_by !== actor.id ||
        old.reconciliation_ref !== data.reconciliation_ref
      )
        throw new Error("Correction already has different approval evidence");
      return { approved: true };
    }
    await tx.query(
      "INSERT INTO refund_evidence_approvals(correction_id,approved_by,reconciliation_ref) VALUES($1,$2,$3)",
      [data.id, actor.id, data.reconciliation_ref],
    );
    await audit(
      tx,
      actor.id,
      "refund.evidence_correction_approved",
      correction.refund_id,
      { correction_id: data.id, reconciliation_ref: data.reconciliation_ref },
    );
    return { approved: true };
  });
}
export const refundEvidenceSchema = z.object({
  id: identifier,
  payment_id: identifier,
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
  status: z.enum(["pending", "processed", "failed"]),
  receipt: z.string().nullable().optional(),
});
export type RefundEvidence = z.infer<typeof refundEvidenceSchema>;
async function audit(
  tx: QueryClient,
  actor: string,
  action: string,
  target: string,
  details: unknown = {},
) {
  await tx.query(
    "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), actor, action, target, JSON.stringify(details)],
  );
}
async function funds(tx: QueryClient, order: Order) {
  if (order.payment_method === "cod")
    return Number(
      (
        await tx.query<{ amount: string }>(
          "SELECT COALESCE(sum(amount),0) amount FROM cod_ledger WHERE order_id=$1 AND kind='collection'",
          [order.id],
        )
      ).rows[0].amount,
    );
  return Number(
    (
      await tx.query<{ amount: string }>(
        "SELECT COALESCE(sum(amount),0) amount FROM payments WHERE order_id=$1 AND status='captured' AND provider='razorpay'",
        [order.id],
      )
    ).rows[0].amount,
  );
}
async function sync(tx: QueryClient, order: Order, actor?: string) {
  await tx.query(
    "SELECT set_config('sky.actor_id',$1,true),set_config('sky.event_source','refund_ledger',true)",
    [actor || ""],
  );
  await tx.query(
    `UPDATE orders SET refund_state=(SELECT CASE WHEN COALESCE(sum(amount) FILTER(WHERE status='processed'),0)=orders.total THEN 'refunded' WHEN COALESCE(sum(amount) FILTER(WHERE status='processed'),0)>0 THEN 'partially_refunded' WHEN count(*) FILTER(WHERE status IN ('requested','approved','processing','pending'))>0 THEN 'pending' ELSE 'none' END FROM refunds WHERE order_id=orders.id) WHERE id=$1`,
    [order.id],
  );
}
export async function requestRefund(actor: User, input: unknown) {
  authorize(actor);
  const data = z
    .object({
      order_id: identifier,
      return_id: identifier.optional(),
      amount: z.number().int().positive().max(2147483647),
      reason: z.string().trim().min(10).max(2000),
      request_key: z.string().uuid(),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        data.order_id,
      ])
    ).rows[0];
    if (!order) throw new Error("Order not found");
    if (
      order.status === "processing" &&
      (
        await tx.query("SELECT id FROM shipment_bookings WHERE order_id=$1", [
          order.id,
        ])
      ).rows.length
    )
      throw new Error(
        "Resolve active courier handover before requesting a refund for this packed order",
      );
    const old = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE request_key=$1", [
        data.request_key,
      ])
    ).rows[0];
    if (old) {
      if (
        old.order_id !== data.order_id ||
        old.amount !== data.amount ||
        old.reason !== data.reason ||
        old.return_id !== (data.return_id || null)
      )
        throw new Error("Refund key already records different details");
      return old;
    }
    if (order.payment_method === "prepaid" && data.amount < 100)
      throw new Error("Online refunds must be at least 100 paise");
    const captured = await funds(tx, order);
    const reserved = Number(
      (
        await tx.query<{ amount: string }>(
          "SELECT COALESCE(sum(amount),0) amount FROM refunds WHERE order_id=$1 AND status NOT IN ('failed','rejected')",
          [order.id],
        )
      ).rows[0].amount,
    );
    if (data.amount + reserved > Math.min(order.total, captured))
      throw new Error(
        "Refund exceeds verified funds remaining after other refund requests",
      );
    if (data.return_id) {
      const r = (
        await tx.query<{
          order_id: string;
          status: string;
          resolution: string;
        }>("SELECT * FROM returns WHERE id=$1", [data.return_id])
      ).rows[0];
      if (
        !r ||
        r.order_id !== order.id ||
        r.status !== "inspected" ||
        !["refund", "exchange"].includes(r.resolution)
      )
        throw new Error("An inspected refund RMA for this order is required");
      // Inspection and original verified funds govern the original refund.
      // A cancelled/unpaid replacement must not withhold that separate refund.
      const cap = Number(
        (
          await tx.query<{ cap: string }>(
            "SELECT COALESCE(sum(refund_cap),0) cap FROM return_items WHERE return_id=$1",
            [data.return_id],
          )
        ).rows[0].cap,
      );
      const prior = Number(
        (
          await tx.query<{ amount: string }>(
            "SELECT COALESCE(sum(amount),0) amount FROM refunds WHERE return_id=$1 AND status NOT IN ('failed','rejected')",
            [data.return_id],
          )
        ).rows[0].amount,
      );
      if (data.amount + prior > cap)
        throw new Error(
          "Refund exceeds the copied net item value. Delivery and COD charges require a separate reviewed adjustment.",
        );
    }
    const payment =
      order.payment_method === "prepaid"
        ? (
            await tx.query<{ id: string }>(
              "SELECT id FROM payments WHERE order_id=$1 AND status='captured' AND provider='razorpay' ORDER BY id LIMIT 1",
              [order.id],
            )
          ).rows[0]
        : null;
    const row = (
      await tx.query<Refund>(
        "INSERT INTO refunds(id,order_id,return_id,payment_id,method,amount,status,reason,request_key,requested_by) VALUES($1,$2,$3,$4,$5,$6,'requested',$7,$8,$9) RETURNING *",
        [
          randomUUID(),
          order.id,
          data.return_id || null,
          payment?.id || null,
          order.payment_method === "cod" ? "manual_cod" : "razorpay",
          data.amount,
          data.reason,
          data.request_key,
          actor.id,
        ],
      )
    ).rows[0];
    await audit(tx, actor.id, "refund.request", row.id, {
      order_id: order.id,
      amount: row.amount,
    });
    await sync(tx, order, actor.id);
    await notifyAccount(
      tx,
      order.user_id,
      `refund:${row.id}:requested`,
      "Refund under review",
      "A refund request is under review. No payout has been confirmed.",
      order.id,
    );
    return row;
  });
}
export async function reviewRefund(actor: User, input: unknown) {
  authorize(actor);
  const data = z.object({ id: identifier, approve: z.boolean() }).parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const identity = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1", [data.id])
    ).rows[0];
    if (!identity) throw new Error("Refund not found");
    const order = (
      await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        identity.order_id,
      ])
    ).rows[0];
    const row = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1 FOR UPDATE", [
        data.id,
      ])
    ).rows[0];
    const status = data.approve ? "approved" : "rejected";
    if (row.status === status) return { status };
    if (row.status !== "requested")
      throw new Error("Only a requested refund can be approved or rejected");
    if (
      data.approve &&
      row.method === "manual_cod" &&
      row.requested_by === actor.id
    )
      throw new Error(
        "A second finance or owner account must approve a manual COD payout",
      );
    await tx.query(
      "UPDATE refunds SET status=$1,approved_by=$2,approved_at=now() WHERE id=$3",
      [status, actor.id, row.id],
    );
    if (data.approve && row.method === "razorpay")
      await enqueueJob(tx, "refund.submit", `refund.submit:${row.id}`, {
        refund_id: row.id,
      });
    await audit(tx, actor.id, `refund.${status}`, row.id);
    await sync(tx, order, actor.id);
    return { status };
  });
}
export async function refundList(actor: User, staff = false, orderId?: string) {
  if (staff) authorize(actor);
  const db = await getDB();
  const rows = (
    await db.query<Refund>(
      `SELECT r.id,r.order_id,r.return_id,r.payment_id,r.provider_id,r.method,r.amount,r.status,r.created_at${staff ? ",r.reason,r.requested_by,r.approved_by,r.evidence_ref" : ""} FROM refunds r JOIN orders o ON o.id=r.order_id WHERE ${staff ? "true" : "o.user_id=$1"} ${orderId ? `AND r.order_id=$${staff ? 1 : 2}` : ""} ORDER BY r.created_at DESC,r.id LIMIT 100`,
      [...(!staff ? [actor.id] : []), ...(orderId ? [orderId] : [])],
    )
  ).rows;
  if (staff && rows.length) {
    const corrections = (
      await db.query<RefundEvidenceCorrection>(
        "SELECT c.*,a.approved_by,a.reconciliation_ref,a.sequence FROM refund_evidence_corrections c LEFT JOIN refund_evidence_approvals a ON a.correction_id=c.id WHERE c.refund_id=ANY($1::text[]) ORDER BY a.sequence DESC NULLS LAST,c.created_at DESC,c.id",
        [rows.map((row) => row.id)],
      )
    ).rows;
    for (const row of rows)
      row.corrections = corrections.filter((c) => c.refund_id === row.id);
  }
  return rows;
}
export interface RefundProvider {
  fetch(id: string): Promise<RefundEvidence>;
  find(paymentId: string, receipt: string): Promise<RefundEvidence | null>;
  create(
    paymentId: string,
    receipt: string,
    amount: number,
  ): Promise<RefundEvidence>;
}
async function providerRequest(path: string, body?: unknown, key?: string) {
  const id = process.env.RAZORPAY_KEY_ID,
    secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Refund provider is not configured");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(key ? { "X-Refund-Idempotency": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `Refund provider returned HTTP ${response.status}; reconcile before retrying`,
    );
  return response.json();
}
export const razorpayRefundProvider: RefundProvider = {
  async fetch(id) {
    return refundEvidenceSchema.parse(
      await providerRequest(`refunds/${encodeURIComponent(id)}`),
    );
  },
  async find(paymentId, receipt) {
    for (let skip = 0; skip < 1000; skip += 100) {
      const result = z
        .object({ items: z.array(refundEvidenceSchema) })
        .parse(
          await providerRequest(
            `payments/${encodeURIComponent(paymentId)}/refunds?count=100&skip=${skip}`,
          ),
        );
      const row = result.items.find((i) => i.receipt === receipt);
      if (row) return row;
      if (result.items.length < 100) return null;
    }
    throw new Error("Refund lookup limit reached; reconciliation is required");
  },
  async create(paymentId, receipt, amount) {
    return refundEvidenceSchema.parse(
      await providerRequest(
        `payments/${encodeURIComponent(paymentId)}/refund`,
        { amount, speed: "normal", receipt },
        receipt,
      ),
    );
  },
};
export async function applyRefundEvidence(input: unknown, eventId: string) {
  const evidence = refundEvidenceSchema.parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const identity = (
      await tx.query<Refund>(
        "SELECT * FROM refunds WHERE provider_id=$1 OR (id=$2 AND payment_id=$3)",
        [evidence.id, evidence.receipt || "", evidence.payment_id],
      )
    ).rows[0];
    if (!identity)
      throw new Error("No local refund matches this provider evidence");
    const order = (
      await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        identity.order_id,
      ])
    ).rows[0];
    const row = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1 FOR UPDATE", [
        identity.id,
      ])
    ).rows[0];
    if (
      row.method !== "razorpay" ||
      row.payment_id !== evidence.payment_id ||
      row.amount !== evidence.amount ||
      (Boolean(evidence.receipt) && evidence.receipt !== row.id) ||
      (row.provider_id && row.provider_id !== evidence.id) ||
      !row.approved_by
    )
      throw new Error("Refund evidence does not match the approved request");
    const duplicate = (
      await tx.query<{ refund_id: string; status: string; amount: number }>(
        "SELECT * FROM refund_events WHERE id=$1",
        [eventId],
      )
    ).rows[0];
    if (duplicate) {
      if (
        duplicate.refund_id !== row.id ||
        duplicate.amount !== evidence.amount ||
        duplicate.status !== evidence.status
      )
        throw new Error("Refund event identity conflict");
      return { duplicate: true };
    }
    if (row.status === "requested" || row.status === "rejected")
      throw new Error("Refund was not approved for execution");
    if (evidence.status === "processed") {
      const other = Number(
        (
          await tx.query<{ amount: string }>(
            "SELECT COALESCE(sum(amount),0) amount FROM refunds WHERE order_id=$1 AND id<>$2 AND status NOT IN ('failed','rejected')",
            [order.id, row.id],
          )
        ).rows[0].amount,
      );
      if (other + row.amount > Math.min(order.total, await funds(tx, order)))
        throw new Error(
          "Refund completion conflicts with available funds; investigate the provider ledger",
        );
    }
    await tx.query(
      "INSERT INTO refund_events(id,refund_id,status,amount,currency,payment_id,provider_id,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        eventId,
        row.id,
        evidence.status,
        evidence.amount,
        evidence.currency,
        evidence.payment_id,
        evidence.id,
        "razorpay_verified",
      ],
    );
    if (row.status === "processed") return { duplicate: true };
    if (row.status === "failed" && evidence.status === "pending")
      return { ignored: true };
    await tx.query("UPDATE refunds SET provider_id=$1,status=$2 WHERE id=$3", [
      evidence.id,
      evidence.status,
      row.id,
    ]);
    await sync(tx, order);
    if (evidence.status === "processed") {
      if (row.return_id) {
        const completed = await tx.query(
          "UPDATE returns SET status='completed' WHERE id=$1 AND status='inspected' AND (SELECT COALESCE(sum(amount),0) FROM refunds WHERE return_id=returns.id AND status='processed') >= (SELECT COALESCE(sum(refund_cap),0) FROM return_items WHERE return_id=returns.id) RETURNING id",
          [row.return_id],
        );
        if (completed.rows.length)
          await tx.query(
            "INSERT INTO return_events(id,return_id,status,message) VALUES($1,$2,'completed','Verified refund processing completed')",
            [randomUUID(), row.return_id],
          );
      }
      await notifyAccount(
        tx,
        order.user_id,
        `refund:${row.id}:processed`,
        "Refund processed",
        "The payment provider confirmed refund processing. Bank posting time depends on your payment method.",
        order.id,
      );
    }
    return { status: evidence.status };
  });
}
export async function executeRefund(
  refundId: string,
  provider: RefundProvider = razorpayRefundProvider,
) {
  const db = await getDB();
  const row = await db.transaction(async (tx) => {
    const existing = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1 FOR UPDATE", [
        refundId,
      ])
    ).rows[0];
    if (!existing) throw new Error("Refund not found");
    if (existing.status === "processed" || existing.status === "failed")
      return existing;
    if (
      !existing.approved_by ||
      !["approved", "processing", "pending"].includes(existing.status) ||
      existing.method !== "razorpay" ||
      !existing.payment_id
    )
      throw new Error("Refund is not approved for provider execution");
    await tx.query("UPDATE refunds SET status='processing' WHERE id=$1", [
      existing.id,
    ]);
    return existing;
  });
  if (row.status === "processed" || row.status === "failed") return;
  const evidence = row.provider_id
    ? await provider.fetch(row.provider_id)
    : (await provider.find(row.payment_id!, row.id)) ||
      (await provider.create(row.payment_id!, row.id, row.amount));
  if (evidence.receipt && evidence.receipt !== row.id)
    throw new Error("Provider returned a different refund receipt");
  await applyRefundEvidence(
    { ...evidence, receipt: row.id },
    `lookup:${evidence.id}:${evidence.status}`,
  );
  if (evidence.status === "pending")
    throw new DeferredJobError(
      "Refund is pending at the provider; a later lookup will reconcile it",
    );
}
export async function receiveRefundEvent(input: unknown, eventId: string) {
  const evidence = refundEvidenceSchema.parse(input);
  const db = await getDB();
  await enqueueJob(db, "refund.event", `refund.event:${eventId}`, {
    evidence,
    event_id: eventId,
  });
  return { received: true };
}
export async function confirmManualRefund(actor: User, input: unknown) {
  authorize(actor);
  const data = z
    .object({
      id: identifier,
      reference: z.string().trim().min(6).max(150),
      evidence: z.string().trim().min(10).max(1000),
      occurred_at: z.iso.datetime({ offset: true }),
      verified: z.literal(true),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const found = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1", [data.id])
    ).rows[0];
    if (!found) throw new Error("Refund not found");
    const order = (
      await tx.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        found.order_id,
      ])
    ).rows[0];
    const row = (
      await tx.query<Refund>("SELECT * FROM refunds WHERE id=$1 FOR UPDATE", [
        data.id,
      ])
    ).rows[0];
    if (row.status === "processed") {
      if (row.evidence_ref !== data.reference)
        throw new Error("Refund already records different payout evidence");
      return { duplicate: true };
    }
    if (
      row.method !== "manual_cod" ||
      row.status !== "approved" ||
      !row.approved_by ||
      row.approved_by === row.requested_by
    )
      throw new Error(
        "An independently approved manual COD refund is required",
      );
    if (
      !row.approved_at ||
      Date.parse(data.occurred_at) < new Date(row.approved_at).getTime() ||
      Date.parse(data.occurred_at) > Date.now() + 60000
    )
      throw new Error("Payout evidence date is invalid");
    const reused = await tx.query(
      "SELECT id FROM refund_events WHERE evidence_ref=$1",
      [data.reference],
    );
    if (reused.rows.length)
      throw new Error("Payout reference is already recorded");
    await tx.query(
      "INSERT INTO refund_events(id,refund_id,status,amount,currency,source,evidence_ref) VALUES($1,$2,'processed',$3,'INR','manual_cod_verified',$4)",
      [randomUUID(), row.id, row.amount, data.reference],
    );
    await tx.query(
      "UPDATE refunds SET status='processed',evidence_ref=$1 WHERE id=$2",
      [data.reference, row.id],
    );
    await audit(tx, actor.id, "refund.manual_confirm", row.id, {
      reference: data.reference,
      evidence: data.evidence,
      occurred_at: data.occurred_at,
    });
    await sync(tx, order, actor.id);
    if (row.return_id) {
      const completed = await tx.query(
        "UPDATE returns SET status='completed' WHERE id=$1 AND status='inspected' AND (SELECT COALESCE(sum(amount),0) FROM refunds WHERE return_id=returns.id AND status='processed') >= (SELECT COALESCE(sum(refund_cap),0) FROM return_items WHERE return_id=returns.id) RETURNING id",
        [row.return_id],
      );
      if (completed.rows.length)
        await tx.query(
          "INSERT INTO return_events(id,return_id,status,actor_id,message) VALUES($1,$2,'completed',$3,'Finance recorded verified COD refund payout evidence')",
          [randomUUID(), row.return_id, actor.id],
        );
    }
    await notifyAccount(
      tx,
      order.user_id,
      `refund:${row.id}:processed`,
      "Refund payout recorded",
      "Our finance team recorded verified payout evidence. Contact customer care if the funds have not arrived.",
      order.id,
    );
    return { status: "processed" };
  });
}
