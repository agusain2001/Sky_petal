import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getDB } from "./db";
import { confirmCapturedPayment, expireReservations } from "./commerce";

const captureSchema = z.object({
  id: z.string().min(1).max(200),
  provider_order_id: z.string().min(1).max(150),
  payment_id: z.string().min(1).max(150),
  amount: z.number().int().positive().max(2147483647),
  currency: z.string().regex(/^[A-Z]{3}$/),
  source: z.enum(["webhook", "callback", "poll"]),
});
export type CaptureEvidence = z.infer<typeof captureSchema>;
export type InboxRecord = CaptureEvidence & {
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
  next_attempt_at: string;
};

/** Called only after raw-body signature or signed callback + provider lookup verification. */
export async function receiveVerifiedCapture(body: CaptureEvidence) {
  const input = captureSchema.parse(body);
  const db = await getDB();
  await db.query(
    `INSERT INTO payment_webhook_inbox(id,provider_order_id,payment_id,amount,currency,source)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,
    [
      input.id,
      input.provider_order_id,
      input.payment_id,
      input.amount,
      input.currency,
      input.source,
    ],
  );
  const existing = (
    await db.query<InboxRecord>(
      "SELECT * FROM payment_webhook_inbox WHERE id=$1",
      [input.id],
    )
  ).rows[0];
  if (
    existing.provider_order_id !== input.provider_order_id ||
    existing.payment_id !== input.payment_id ||
    existing.amount !== input.amount ||
    existing.currency !== input.currency ||
    existing.source !== input.source
  )
    throw new Error("Payment event identity conflict; reconciliation required");
  return processCapture(input.id);
}

export async function processCapture(id: string) {
  const db = await getDB();
  const lease = randomUUID();
  const claimed = (
    await db.query<InboxRecord>(
      `UPDATE payment_webhook_inbox SET status='processing',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '5 minutes'
    WHERE id=$1 AND status<>'processed' AND (status<>'processing' OR lease_until<now()) RETURNING *`,
      [id, lease],
    )
  ).rows[0];
  if (!claimed) {
    const existing = (
      await db.query<{ status: string }>(
        "SELECT status FROM payment_webhook_inbox WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (existing?.status === "processed") return { duplicate: true };
    throw new Error(
      existing
        ? "Payment processing is in progress; retry shortly"
        : "Payment event not found",
    );
  }
  try {
    const result = await confirmCapturedPayment(
      claimed.provider_order_id,
      claimed.payment_id,
      claimed.amount,
      claimed.currency,
      claimed.id,
    );
    const acknowledged = await db.query(
      "UPDATE payment_webhook_inbox SET status='processed',last_error=NULL,lease_until=NULL,lease_token=NULL,processed_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now() RETURNING id",
      [id, lease],
    );
    return acknowledged.rows.length ? result : { lost: true, duplicate: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payment processing failed";
    await db.query(
      "UPDATE payment_webhook_inbox SET status='failed',last_error=$2,lease_until=NULL,lease_token=NULL,next_attempt_at=now()+interval '5 minutes' WHERE id=$1 AND lease_token=$3 AND lease_until>now()",
      [id, message.slice(0, 500), lease],
    );
    if (
      /reservation has expired|Additional payment|amount or currency/.test(
        message,
      )
    )
      await db.query(
        "UPDATE payment_attempts SET state='manual_review',last_error='Verified capture requires financial review; do not fulfill or collect again',updated_at=now() WHERE provider_order_id=$1 AND state<>'captured'",
        [claimed.provider_order_id],
      );
    throw error;
  }
}

export async function paymentInbox() {
  const db = await getDB();
  return (
    await db.query<InboxRecord>(`SELECT id,provider_order_id,payment_id,amount,currency,source,status,attempts,last_error,created_at,processed_at,next_attempt_at
    FROM payment_webhook_inbox ORDER BY created_at DESC,id LIMIT 100`)
  ).rows;
}

export async function runCommerceMaintenance() {
  const db = await getDB();
  const expired = await expireReservations(db);
  const due = (
    await db.query<{ id: string }>(`SELECT id FROM payment_webhook_inbox WHERE
    ((status IN ('received','failed') AND next_attempt_at<=now() AND attempts<10) OR (status='processing' AND lease_until<now() AND attempts<10))
    ORDER BY created_at,id LIMIT 20`)
  ).rows;
  let processed = 0,
    failed = 0;
  for (const event of due) {
    try {
      const result = await processCapture(event.id);
      if (!("lost" in result)) processed++;
    } catch {
      failed++;
    }
  }
  const { runJobs } = await import("./jobs");
  const { runPaymentReconciliation } = await import("./payment-attempts");
  const payments = await runPaymentReconciliation();
  const { runPrivacyRetention } = await import("./privacy-deletion");
  const privacy = await runPrivacyRetention();
  const { executeRefund, applyRefundEvidence } = await import("./refunds");
  const { executeShipment, applyTracking } = await import("./fulfillment");
  const jobs = await runJobs({
    "shipping.book": async (payload) =>
      executeShipment(String(payload.booking_id)),
    "shipping.tracking": async (payload) =>
      applyTracking(payload.event, String(payload.event_id)),
    "refund.submit": async (payload) =>
      executeRefund(String(payload.refund_id)),
    "refund.event": async (payload) =>
      applyRefundEvidence(payload.evidence, String(payload.event_id)),
  });
  return { expired, processed, failed, payments, privacy, jobs };
}
