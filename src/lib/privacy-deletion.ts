import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import type { User } from "./types";
import type { QueryClient } from "./pricing";
export const retentionSchema = z.object({
  financial_days: z.number().int().min(0).max(36500),
  support_days: z.number().int().min(0).max(36500),
  approval_reference: z.string().trim().min(6).max(300),
  policy_version: z.string().trim().min(1).max(100),
});
type Policy = z.infer<typeof retentionSchema>;
type Request = {
  id: string;
  user_id: string;
  status: string;
  subject_email: string | null;
  retain_until: string;
  policy_snapshot: Policy;
  reviewed_by: string | null;
};
function authorize(actor: User) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to process privacy requests");
}
async function event(
  tx: QueryClient,
  id: string,
  actorId: string | null,
  status: string,
  detail: string,
) {
  await tx.query(
    "INSERT INTO privacy_events(id,request_id,actor_id,status,detail) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), id, actorId, status, detail],
  );
}
export async function retentionPolicy() {
  return (
    (
      await (
        await getDB()
      ).query<{ value: Policy }>(
        "SELECT value FROM site_settings WHERE key='retention'",
      )
    ).rows[0]?.value || null
  );
}
export async function saveRetentionPolicy(actor: User, input: unknown) {
  authorize(actor);
  const value = retentionSchema.parse(input);
  const db = await getDB();
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO site_settings VALUES('retention',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [JSON.stringify(value)],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'privacy.policy','retention',$3)",
      [randomUUID(), actor.id, JSON.stringify(value)],
    );
  });
  return value;
}
async function retentionDeadline(
  tx: QueryClient,
  userId: string,
  policy: Policy,
) {
  return (
    await tx.query<{ due: string }>(
      "SELECT GREATEST(GREATEST(COALESCE((SELECT max(GREATEST(created_at,delivered_at)) FROM orders WHERE user_id=$1),'-infinity'),COALESCE((SELECT max(f.updated_at) FROM refunds f JOIN orders o ON o.id=f.order_id WHERE o.user_id=$1),'-infinity'),COALESCE((SELECT max(l.created_at) FROM cod_ledger l JOIN orders o ON o.id=l.order_id WHERE o.user_id=$1),'-infinity'),COALESCE((SELECT max(d.issued_at) FROM invoice_documents d JOIN orders o ON o.id=d.order_id WHERE o.user_id=$1),'-infinity'))+($2::text||' days')::interval,GREATEST(COALESCE((SELECT max(created_at) FROM support_tickets WHERE user_id=$1),'-infinity'),COALESCE((SELECT max(m.created_at) FROM ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id WHERE t.user_id=$1),'-infinity'))+($3::text||' days')::interval,now()) due",
      [userId, policy.financial_days, policy.support_days],
    )
  ).rows[0].due;
}
export async function requestDeletion(actor: User) {
  if (actor.role !== "customer")
    throw new Error("Team accounts require the staff offboarding process");
  const db = await getDB();
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [actor.id]);
    const old = (
      await tx.query<{ id: string }>(
        "SELECT id FROM privacy_requests WHERE user_id=$1 AND kind='delete' AND status IN ('requested','retained','processing')",
        [actor.id],
      )
    ).rows[0];
    if (old)
      return {
        id: old.id,
        message: "Your existing deletion request is awaiting processing.",
      };
    const id = randomUUID();
    await tx.query(
      "INSERT INTO privacy_requests(id,user_id,kind,subject_email) VALUES($1,$2,'delete',$3)",
      [id, actor.id, actor.email],
    );
    await event(
      tx,
      id,
      actor.id,
      "requested",
      "Customer requested account deletion. No records have been erased yet.",
    );
    return {
      id,
      message:
        "Deletion requested. You can follow its status in Privacy; retained records need an approved retention decision.",
    };
  });
}
export async function deletionRequests(actor: User, staff = false) {
  if (staff) authorize(actor);
  return (
    await (
      await getDB()
    ).query(
      `SELECT p.id,p.user_id,p.status,p.created_at,p.retain_until,p.decision,p.completed_at,p.external_followup,p.policy_snapshot->>'policy_version' policy_version FROM privacy_requests p WHERE p.kind='delete' ${staff ? "" : "AND p.user_id=$1"} ORDER BY p.created_at DESC LIMIT 100`,
      staff ? [] : [actor.id],
    )
  ).rows;
}
export async function approveDeletion(actor: User, id: string) {
  authorize(actor);
  const policy = retentionSchema.parse(await retentionPolicy()),
    db = await getDB();
  await db.transaction(async (tx) => {
    const row = (
      await tx.query<Request>(
        "SELECT * FROM privacy_requests WHERE id=$1 AND kind='delete' FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new Error("Deletion request not found");
    if (row.status !== "requested") return;
    const user = (
      await tx.query<{ email: string; role: string }>(
        "SELECT email,role FROM users WHERE id=$1 FOR UPDATE",
        [row.user_id],
      )
    ).rows[0];
    if (user.role !== "customer")
      throw new Error("Team accounts cannot use customer erasure");
    const due = await retentionDeadline(tx, row.user_id, policy);
    await tx.query(
      "UPDATE privacy_requests SET status='retained',reviewed_by=$2,policy_snapshot=$3,retain_until=$4,subject_email=COALESCE(subject_email,$5),decision='Account closed; retained transaction/support records await policy expiry and open-obligation checks',external_followup=true WHERE id=$1",
      [id, actor.id, JSON.stringify(policy), due, user.email],
    );
    await tx.query(
      "UPDATE users SET email=$2,name='Deleted customer',password_hash=NULL,deleted_at=now() WHERE id=$1",
      [row.user_id, `deleted-${row.user_id}@privacy.invalid`],
    );
    await tx.query("DELETE FROM sessions WHERE user_id=$1", [row.user_id]);
    await tx.query("DELETE FROM addresses WHERE user_id=$1", [row.user_id]);
    await tx.query(
      "DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id=$1)",
      [row.user_id],
    );
    await tx.query("DELETE FROM wishlists WHERE user_id=$1", [row.user_id]);
    await tx.query("DELETE FROM reviews WHERE user_id=$1", [row.user_id]);
    await tx.query("DELETE FROM account_notifications WHERE user_id=$1", [
      row.user_id,
    ]);
    await tx.query(
      "UPDATE newsletter SET status='unsubscribed' WHERE email=$1",
      [user.email],
    );
    await event(
      tx,
      id,
      actor.id,
      "retained",
      "Account identifiers and optional account data removed; sessions revoked and marketing suppressed. Transaction/support erasure waits for the approved retention policy. External identity, provider copies and backups require separate follow-up.",
    );
  });
  return fulfillDeletion(id, actor);
}
async function obligations(tx: QueryClient, userId: string) {
  return (
    (
      await tx.query(
        "SELECT id FROM orders WHERE user_id=$1 AND (status IN ('pending_payment','paid','confirmed','processing','shipped') OR (payment_method='cod' AND status='delivered' AND payment_state<>'remitted')) UNION ALL SELECT r.id FROM returns r WHERE r.user_id=$1 AND r.status NOT IN ('rejected','completed') UNION ALL SELECT f.id FROM refunds f JOIN orders o ON o.id=f.order_id WHERE o.user_id=$1 AND f.status NOT IN ('failed','rejected','processed') UNION ALL SELECT a.id FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE o.user_id=$1 AND a.state IN ('creating','unknown','authorized','manual_review') UNION ALL SELECT id FROM support_tickets WHERE user_id=$1 AND status<>'resolved' UNION ALL SELECT id FROM commerce_jobs WHERE sky_privacy_job_owner(payload)=$1 AND status NOT IN ('succeeded','dead') LIMIT 1",
        [userId],
      )
    ).rows.length > 0
  );
}
export async function fulfillDeletion(id: string, actor?: User) {
  if (actor) authorize(actor);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const row = (
      await tx.query<Request & { due: boolean }>(
        "SELECT *,retain_until<=now() due FROM privacy_requests WHERE id=$1 AND kind='delete' FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new Error("Deletion request not found");
    if (row.status === "completed") return { status: "completed" };
    if (row.status !== "retained" || !row.reviewed_by)
      throw new Error("Review the deletion request first");
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      row.user_id,
    ]);
    await tx.query(
      "SELECT id FROM orders WHERE user_id=$1 ORDER BY id FOR UPDATE",
      [row.user_id],
    );
    const deadline = await retentionDeadline(
      tx,
      row.user_id,
      row.policy_snapshot,
    );
    const refreshed = (
      await tx.query<{ due: boolean }>(
        "UPDATE privacy_requests SET retain_until=GREATEST(retain_until,$2) WHERE id=$1 RETURNING retain_until<=now() due",
        [id, deadline],
      )
    ).rows[0];
    row.due = refreshed.due;
    if (!row.due || (await obligations(tx, row.user_id))) {
      await tx.query("UPDATE privacy_requests SET decision=$2 WHERE id=$1", [
        id,
        row.due
          ? "Open order, return, financial or support obligations prevent record erasure"
          : "Approved retention period has not expired",
      ]);
      return { status: "retained" };
    }
    // Serialize against new orders/returns. The account is already closed.
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      row.user_id,
    ]);
    await tx.query(
      "UPDATE privacy_requests SET status='processing' WHERE id=$1",
      [id],
    );
    await tx.query("SELECT set_config('sky.privacy_request',$1,true)", [id]);
    const uid = row.user_id,
      redacted = "Removed under approved retention policy";
    await tx.query(
      "UPDATE commerce_jobs SET payload='{\"privacy_erased\":true}',last_error=NULL WHERE sky_privacy_job_owner(payload)=$1 AND status IN ('succeeded','dead')",
      [uid],
    );
    await tx.query(
      "UPDATE orders SET address=$2,billing_address=$2 WHERE user_id=$1",
      [uid, JSON.stringify({ name: "Deleted customer" })],
    );
    await tx.query(
      "UPDATE checkout_quotes SET content=jsonb_set(jsonb_set(content,'{address}','{}'),'{billing_address}','{}') WHERE user_id=$1",
      [uid],
    );
    await tx.query(
      "UPDATE invoice_documents SET snapshot=jsonb_set(snapshot,'{buyer}','{}') WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)",
      [uid],
    );
    await tx.query(
      "UPDATE shipment_bookings SET request_snapshot='{}',label_url=NULL,manifest_url=NULL,last_error=NULL WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)",
      [uid],
    );
    await tx.query(
      "UPDATE shipment_tracking_events SET scans='[]',label=$2 WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE returns SET reason=$2,review_note=NULL,receipt_reference=NULL,policy_snapshot='{}' WHERE user_id=$1",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE return_events SET message=$2 WHERE return_id IN (SELECT id FROM returns WHERE user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE return_inspections SET condition_note=$2 WHERE return_item_id IN (SELECT i.id FROM return_items i JOIN returns r ON r.id=i.return_id WHERE r.user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE support_tickets SET subject=$2,body=$2 WHERE user_id=$1",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE ticket_messages SET body=$2 WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE refunds SET reason=$2,evidence_ref=NULL WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE refund_events SET evidence_ref=NULL WHERE refund_id IN (SELECT f.id FROM refunds f JOIN orders o ON o.id=f.order_id WHERE o.user_id=$1)",
      [uid],
    );
    await tx.query(
      "UPDATE refund_evidence_corrections SET reason=$2,independent_proof=$2,original_ref='REDACTED-ORIGINAL',previous_ref='REDACTED-PREVIOUS',corrected_ref='REDACTED-CORRECTION' WHERE refund_id IN (SELECT f.id FROM refunds f JOIN orders o ON o.id=f.order_id WHERE o.user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE refund_evidence_approvals SET reconciliation_ref=$2 WHERE correction_id IN (SELECT c.id FROM refund_evidence_corrections c JOIN refunds f ON f.id=c.refund_id JOIN orders o ON o.id=f.order_id WHERE o.user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE cod_ledger SET evidence=$2,reference='REDACTED-'||id WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)",
      [uid, redacted],
    );
    await tx.query(
      "UPDATE audit_logs SET details='{}' WHERE actor_id=$1 OR target_id IN (SELECT id FROM orders WHERE user_id=$1 UNION ALL SELECT id FROM returns WHERE user_id=$1 UNION ALL SELECT f.id FROM refunds f JOIN orders o ON o.id=f.order_id WHERE o.user_id=$1)",
      [uid],
    );
    if (row.subject_email) {
      const tombstone = `deleted-${uid}@privacy.invalid`;
      await tx.query(
        "INSERT INTO newsletter(email,status) SELECT $2,'unsubscribed' WHERE EXISTS(SELECT 1 FROM newsletter WHERE email=$1) ON CONFLICT DO NOTHING",
        [row.subject_email, tombstone],
      );
      await tx.query(
        "UPDATE newsletter_consent_events SET email=$2 WHERE email=$1",
        [row.subject_email, tombstone],
      );
      await tx.query("DELETE FROM newsletter WHERE email=$1", [
        row.subject_email,
      ]);
    }
    await tx.query(
      "UPDATE privacy_requests SET status='completed',subject_email=NULL,completed_at=now(),decision='Local account and enumerated personal-data fields erased. Pseudonymous ledger amounts, IDs and timestamps retained; provider, identity and backup copies need external follow-up' WHERE id=$1",
      [id],
    );
    await event(
      tx,
      id,
      actor?.id || null,
      "completed",
      "Local erasure completed under the recorded policy. External follow-up remains pending; this does not certify deletion from identity providers, payment/courier systems or backups.",
    );
    return { status: "completed", external_followup: true };
  });
}
export async function runPrivacyRetention() {
  const db = await getDB(),
    due = (
      await db.query<{ id: string }>(
        "SELECT id FROM privacy_requests WHERE status='retained' AND retain_until<=now() ORDER BY retain_until LIMIT 20",
      )
    ).rows;
  let completed = 0,
    retained = 0,
    failed = 0;
  for (const row of due) {
    try {
      const result = await fulfillDeletion(row.id);
      if (result.status === "completed") completed++;
      else retained++;
    } catch {
      failed++;
    }
  }
  return { completed, retained, failed };
}
