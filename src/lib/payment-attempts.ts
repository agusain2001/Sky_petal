import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import type { User } from "./types";

const providerOrderSchema = z.object({
  id: z.string().min(1).max(150),
  receipt: z.string(),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
});
export const paymentObservationSchema = z.object({
  id: z.string().min(1).max(150),
  order_id: z.string().min(1).max(150),
  amount: z.number().int().positive().max(2147483647),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["created", "authorized", "failed", "captured"]),
});
type ProviderOrder = z.infer<typeof providerOrderSchema>;
type ProviderPayment = z.infer<typeof paymentObservationSchema>;
export interface PaymentProvider {
  create(receipt: string, amount: number): Promise<ProviderOrder>;
  find(receipt: string): Promise<ProviderOrder[]>;
  payments(orderId: string): Promise<ProviderPayment[]>;
}
export type PaymentAttempt = {
  id: string;
  order_id: string;
  receipt: string;
  amount: number;
  currency: string;
  provider_order_id: string | null;
  state:
    | "creating"
    | "ready"
    | "unknown"
    | "authorized"
    | "failed"
    | "captured"
    | "expired"
    | "manual_review";
  checks: number;
  lease_token: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
export class PaymentPendingError extends Error {}

export async function recordPaymentClientEvent(userId: string, input: unknown) {
  const body = z
    .object({
      id: z.string().uuid(),
      order_id: z.string().min(1).max(150),
      kind: z.enum(["dismissed", "failed", "verification_pending"]),
    })
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const order = await tx.query(
      "SELECT id FROM orders WHERE id=$1 AND user_id=$2 AND payment_method='prepaid'",
      [body.order_id, userId],
    );
    if (!order.rows.length) throw new Error("Order not found");
    await tx.query(
      "INSERT INTO payment_client_events(id,order_id,user_id,kind) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [body.id, body.order_id, userId, body.kind],
    );
    const same = await tx.query(
      "SELECT id FROM payment_client_events WHERE id=$1 AND order_id=$2 AND user_id=$3 AND kind=$4",
      [body.id, body.order_id, userId, body.kind],
    );
    if (!same.rows.length)
      throw new Error("Payment client event identity conflict");
    await tx.query(
      "UPDATE payment_attempts SET next_check_at=now() WHERE order_id=$1 AND state NOT IN ('captured','manual_review')",
      [body.order_id],
    );
    return { recorded: true };
  });
}

async function providerRequest(route: string, body?: unknown) {
  const key = process.env.RAZORPAY_KEY_ID,
    secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error("Payment provider is not configured");
  const response = await fetch(`https://api.razorpay.com/v1/${route}`, {
    method: body ? "POST" : "GET",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(
      "Payment provider response is uncertain; reconciliation is required",
    );
  return response.json();
}
export const razorpayPaymentProvider: PaymentProvider = {
  async create(receipt, amount) {
    return providerOrderSchema.parse(
      await providerRequest("orders", { receipt, amount, currency: "INR" }),
    );
  },
  async find(receipt) {
    const result = z
      .object({ items: z.array(providerOrderSchema) })
      .parse(
        await providerRequest(
          `orders?receipt=${encodeURIComponent(receipt)}&count=100`,
        ),
      );
    if (result.items.length >= 100)
      throw new Error("Payment order lookup requires manual review");
    return result.items.filter((order) => order.receipt === receipt);
  },
  async payments(orderId) {
    const items: ProviderPayment[] = [];
    for (let skip = 0; skip < 1000; skip += 100) {
      const result = z
        .object({ items: z.array(paymentObservationSchema) })
        .parse(
          await providerRequest(
            `orders/${encodeURIComponent(orderId)}/payments?count=100&skip=${skip}`,
          ),
        );
      items.push(...result.items);
      if (result.items.length < 100) return items;
    }
    throw new Error("Payment lookup limit reached; manual review is required");
  },
};

async function bindProviderOrder(
  attempt: PaymentAttempt,
  token: string,
  input: unknown,
) {
  const evidence = providerOrderSchema.parse(input);
  if (
    evidence.receipt !== attempt.receipt ||
    evidence.amount !== attempt.amount ||
    evidence.currency !== attempt.currency
  )
    throw new Error("Provider order does not match the checkout");
  const db = await getDB();
  return db.transaction(async (tx) => {
    // All operations acquire the order before its attempt to avoid lock inversion.
    const order = (
      await tx.query<{ status: string; provider_id: string | null }>(
        "SELECT status,provider_id FROM orders WHERE id=$1 FOR UPDATE",
        [attempt.order_id],
      )
    ).rows[0];
    if (order.provider_id && order.provider_id !== evidence.id)
      throw new Error(
        "Provider order conflicts with retained checkout evidence",
      );
    const owned = await tx.query(
      "SELECT id FROM payment_attempts WHERE id=$1 AND lease_token=$2 AND lease_until>now() FOR UPDATE",
      [attempt.id, token],
    );
    if (!owned.rows.length)
      throw new PaymentPendingError(
        "Payment reconciliation is already in progress",
      );
    await tx.query(
      "UPDATE orders SET provider_id=$1 WHERE id=$2 AND (provider_id IS NULL OR provider_id=$1)",
      [evidence.id, attempt.order_id],
    );
    const state = order.status === "pending_payment" ? "ready" : "expired";
    await tx.query(
      "UPDATE payment_attempts SET provider_order_id=$2,state=$3,lease_token=NULL,lease_until=NULL,last_error=NULL,next_check_at=now(),updated_at=now() WHERE id=$1",
      [attempt.id, evidence.id, state],
    );
    return evidence.id;
  });
}

/** Commits one intent before any network mutation, then reuses or reconciles it. */
export async function ensurePaymentOrder(
  userId: string,
  orderId: string,
  provider: PaymentProvider = razorpayPaymentProvider,
) {
  const db = await getDB(),
    token = randomUUID();
  const claim = await db.transaction(async (tx) => {
    const order = (
      await tx.query<{
        provider_id: string | null;
        total: number;
        valid: boolean;
      }>(
        "SELECT provider_id,total,(status='pending_payment' AND expires_at>now()) AS valid FROM orders WHERE id=$1 AND user_id=$2 AND payment_method='prepaid' FOR UPDATE",
        [orderId, userId],
      )
    ).rows[0];
    if (!order?.valid)
      throw new Error(
        "Your checkout has closed. Review your bag before paying.",
      );
    const inserted = await tx.query<PaymentAttempt>(
      "INSERT INTO payment_attempts(id,order_id,receipt,amount,currency,provider_order_id,state,lease_token,lease_until) VALUES($1,$2,$2,$3,'INR',$4,$5,$6,now()+interval '1 minute') ON CONFLICT(order_id) DO NOTHING RETURNING *",
      [
        randomUUID(),
        orderId,
        order.total,
        order.provider_id,
        order.provider_id ? "ready" : "creating",
        token,
      ],
    );
    if (order.provider_id) return { existing: order.provider_id };
    if (inserted.rows[0]) return { attempt: inserted.rows[0], create: true };
    const attempt = (
      await tx.query<PaymentAttempt & { active: boolean }>(
        "SELECT *,lease_until>now() AS active FROM payment_attempts WHERE order_id=$1 FOR UPDATE",
        [orderId],
      )
    ).rows[0];
    if (attempt.active || attempt.state === "manual_review")
      throw new PaymentPendingError(
        "Payment setup is being reconciled. Your bag is saved; check your order before trying again.",
      );
    await tx.query(
      "UPDATE payment_attempts SET state='unknown',lease_token=$2,lease_until=now()+interval '1 minute',updated_at=now() WHERE id=$1",
      [attempt.id, token],
    );
    return { attempt, create: false };
  });
  if (claim.existing) return claim.existing;
  const attempt = claim.attempt!;
  try {
    const matches = claim.create
      ? [await provider.create(attempt.receipt, attempt.amount)]
      : await provider.find(attempt.receipt);
    if (matches.length !== 1)
      throw new PaymentPendingError(
        matches.length
          ? "Multiple provider orders require manual review"
          : "Payment setup outcome is unknown. Reconciliation will check the existing receipt; no new charge has been requested.",
      );
    return await bindProviderOrder(attempt, token, matches[0]);
  } catch (error) {
    await db.query(
      "UPDATE payment_attempts SET state='unknown',lease_token=NULL,lease_until=NULL,last_error=$3,next_check_at=now()+interval '1 minute',updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now()",
      [
        attempt.id,
        token,
        error instanceof PaymentPendingError
          ? error.message
          : "Provider order outcome is unknown; reconcile the existing receipt before retrying",
      ],
    );
    throw new PaymentPendingError(
      "Payment setup is pending reconciliation. Your bag is saved. Check your order before trying again.",
    );
  }
}

/** Only signed webhooks or server-to-provider reads may call this function. */
export async function recordPaymentObservation(
  input: unknown,
  eventId: string,
  source: "webhook" | "poll" | "callback",
) {
  const evidence = paymentObservationSchema.parse(input);
  if (!eventId || eventId.length > 250)
    throw new Error("Invalid payment event identity");
  const db = await getDB();
  return db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO payment_observations(id,provider_order_id,payment_id,amount,currency,state,source) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
      [
        eventId,
        evidence.order_id,
        evidence.id,
        evidence.amount,
        evidence.currency,
        evidence.status,
        source,
      ],
    );
    const original = (
      await tx.query<{
        provider_order_id: string;
        payment_id: string;
        amount: number;
        currency: string;
        state: string;
        source: string;
      }>("SELECT * FROM payment_observations WHERE id=$1", [eventId])
    ).rows[0];
    if (
      original.provider_order_id !== evidence.order_id ||
      original.payment_id !== evidence.id ||
      original.amount !== evidence.amount ||
      original.currency !== evidence.currency ||
      original.state !== evidence.status ||
      original.source !== source
    )
      throw new Error("Payment event identity conflict");
    if (evidence.status === "authorized" || evidence.status === "failed")
      await tx.query(
        "UPDATE payment_attempts SET state=$2,updated_at=now(),next_check_at=now() WHERE provider_order_id=$1 AND amount=$3 AND currency=$4 AND state NOT IN ('captured','manual_review') AND NOT(state='authorized' AND $2='failed')",
        [
          evidence.order_id,
          evidence.status,
          evidence.amount,
          evidence.currency,
        ],
      );
    return evidence;
  });
}

export async function reconcilePaymentAttempt(
  attemptId: string,
  provider: PaymentProvider = razorpayPaymentProvider,
) {
  const db = await getDB(),
    token = randomUUID();
  const attempt = (
    await db.query<PaymentAttempt>(
      "UPDATE payment_attempts SET lease_token=$2,lease_until=now()+interval '1 minute',checks=checks+1,updated_at=now() WHERE id=$1 AND state NOT IN ('captured','manual_review') AND (lease_until IS NULL OR lease_until<now()) RETURNING *",
      [attemptId, token],
    )
  ).rows[0];
  if (!attempt) return { lost: true };
  try {
    let providerId = attempt.provider_order_id;
    if (!providerId) {
      const matches = await provider.find(attempt.receipt);
      if (matches.length !== 1)
        throw new Error("Provider receipt is absent or ambiguous");
      providerId = await bindProviderOrder(attempt, token, matches[0]);
      // Binding releases its lease; another poll can safely read this order.
      return { bound: true, provider_order_id: providerId };
    }
    const payments = await provider.payments(providerId);
    for (const input of payments) {
      const payment = paymentObservationSchema.parse(input);
      if (
        payment.order_id !== providerId ||
        payment.amount !== attempt.amount ||
        payment.currency !== attempt.currency
      )
        throw new Error("Payment evidence does not match the checkout");
      await recordPaymentObservation(
        payment,
        `poll:${payment.id}:${payment.status}`,
        "poll",
      );
      if (payment.status === "captured") {
        const { receiveVerifiedCapture } = await import("./payment-inbox");
        await receiveVerifiedCapture({
          id: `poll:${payment.id}:captured`,
          provider_order_id: providerId,
          payment_id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          source: "poll",
        });
      }
    }
    // Polling and a webhook may finish concurrently. Never overwrite a verified capture.
    const order = (
      await db.query<{ status: string }>(
        "SELECT status FROM orders WHERE id=$1",
        [attempt.order_id],
      )
    ).rows[0];
    const state = payments.some((p) => p.status === "authorized")
      ? "authorized"
      : order.status === "expired" || order.status === "cancelled"
        ? "expired"
        : payments.some((p) => p.status === "failed")
          ? "failed"
          : "ready";
    const result = await db.query(
      "UPDATE payment_attempts SET state=CASE WHEN state='authorized' THEN 'authorized' ELSE $3 END,lease_token=NULL,lease_until=NULL,last_error=NULL,next_check_at=now()+interval '5 minutes',updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now() AND state NOT IN ('captured','manual_review') RETURNING id",
      [attempt.id, token, state],
    );
    return { checked: true, acknowledged: result.rows.length > 0 };
  } catch {
    await db.query(
      "UPDATE payment_attempts SET state=CASE WHEN checks>=10 THEN 'manual_review' WHEN state='authorized' THEN 'authorized' ELSE 'unknown' END,lease_token=NULL,lease_until=NULL,last_error='Payment outcome requires reconciliation; inventory and money have not been overridden',next_check_at=now()+interval '5 minutes',updated_at=now() WHERE id=$1 AND lease_token=$2 AND lease_until>now() AND state NOT IN ('captured','manual_review')",
      [attempt.id, token],
    );
    throw new Error("Payment outcome requires reconciliation");
  }
}

export async function runPaymentReconciliation(
  provider: PaymentProvider = razorpayPaymentProvider,
) {
  if (
    provider === razorpayPaymentProvider &&
    (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
  )
    return { checked: 0, failed: 0 };
  const db = await getDB();
  await db.query(
    "UPDATE payment_attempts SET state=CASE WHEN state='expired' THEN 'expired' ELSE 'manual_review' END,last_error=CASE WHEN state='expired' THEN 'Reservation expired; no captured or authorized payment observed at the last check' ELSE 'Automatic reconciliation budget exhausted' END,next_check_at='infinity',lease_token=NULL,lease_until=NULL WHERE checks>=10 AND state NOT IN ('captured','manual_review') AND next_check_at<>'infinity' AND (lease_until IS NULL OR lease_until<now())",
  );
  const due = (
    await db.query<{ id: string }>(
      "SELECT id FROM payment_attempts WHERE state NOT IN ('captured','manual_review') AND next_check_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_check_at,id LIMIT 20",
    )
  ).rows;
  let checked = 0,
    failed = 0;
  for (const row of due) {
    try {
      const result = await reconcilePaymentAttempt(row.id, provider);
      if (!("lost" in result)) checked++;
    } catch {
      failed++;
    }
  }
  return { checked, failed };
}

export async function paymentAttempts(actor: User) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to access payment recovery");
  return (
    await (
      await getDB()
    ).query<PaymentAttempt>(
      "SELECT id,order_id,receipt,amount,currency,provider_order_id,state,checks,last_error,created_at,updated_at FROM payment_attempts ORDER BY created_at DESC,id LIMIT 100",
    )
  ).rows;
}

export async function retryPaymentReconciliation(
  actor: User,
  attemptId: string,
) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to access payment recovery");
  const db = await getDB();
  await db.transaction(async (tx) => {
    const row = await tx.query(
      "UPDATE payment_attempts SET state=CASE WHEN state='authorized' OR EXISTS(SELECT 1 FROM payment_observations o WHERE o.provider_order_id=payment_attempts.provider_order_id AND o.state='authorized') THEN 'authorized' ELSE 'unknown' END,checks=0,next_check_at=now(),last_error=NULL WHERE id=$1 AND state<>'captured' AND (lease_until IS NULL OR lease_until<now()) RETURNING id",
      [attemptId],
    );
    if (!row.rows.length)
      throw new Error("Payment attempt is not eligible for reconciliation");
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'payment.reconcile',$3,'{}')",
      [randomUUID(), actor.id, attemptId],
    );
  });
  return { queued: true };
}
