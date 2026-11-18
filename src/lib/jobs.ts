import { randomUUID } from "node:crypto";
import { getDB } from "./db";
import type { QueryClient } from "./pricing";
import type { User } from "./types";
export type CommerceJob = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  lease_token: string;
  last_error: string | null;
  created_at: string;
};
export async function enqueueJob(
  tx: QueryClient,
  kind: string,
  key: string,
  payload: Record<string, unknown>,
) {
  await tx.query(
    "INSERT INTO commerce_jobs(id,kind,dedup_key,payload) VALUES($1,$2,$3,$4) ON CONFLICT(dedup_key) DO NOTHING",
    [randomUUID(), kind, key, JSON.stringify(payload)],
  );
  const same = await tx.query(
    "SELECT id FROM commerce_jobs WHERE dedup_key=$1 AND kind=$2 AND payload=$3::jsonb",
    [key, kind, JSON.stringify(payload)],
  );
  if (!same.rows.length)
    throw new Error(
      "Background event identity conflicts with retained evidence",
    );
}
export async function notifyAccount(
  tx: QueryClient,
  userId: string,
  key: string,
  title: string,
  message: string,
  orderId?: string,
) {
  await tx.query(
    "INSERT INTO account_notifications(id,user_id,event_key,title,message,order_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING",
    [randomUUID(), userId, key, title, message, orderId || null],
  );
}
export async function jobList() {
  const db = await getDB();
  return (
    await db.query<Omit<CommerceJob, "payload" | "lease_token">>(
      "SELECT id,kind,status,attempts,last_error,created_at,next_run_at FROM commerce_jobs ORDER BY created_at DESC LIMIT 100",
    )
  ).rows;
}
export async function retryJob(actor: User, id: string) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to retry background work");
  const db = await getDB();
  await db.transaction(async (tx) => {
    const result = await tx.query(
      "UPDATE commerce_jobs SET status='pending',attempts=0,next_run_at=now(),last_error=NULL WHERE id=$1 AND status IN ('failed','dead') AND NOT(payload @> '{\"privacy_erased\":true}') RETURNING id",
      [id],
    );
    if (!result.rows.length) throw new Error("Job is not eligible for retry");
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'job.retry',$3,'{}')",
      [randomUUID(), actor.id, id],
    );
  });
}
export type JobHandlers = Record<
  string,
  (payload: Record<string, unknown>) => Promise<unknown>
>;
export class DeferredJobError extends Error {
  constructor(
    message: string,
    public delaySeconds = 900,
  ) {
    super(message);
  }
}
export async function runJobs(handlers: JobHandlers, limit = 20) {
  const db = await getDB();
  await db.query(
    "UPDATE commerce_jobs SET status='dead',last_error=COALESCE(last_error,'Worker lease expired after the retry budget was exhausted'),lease_until=NULL WHERE status='running' AND lease_until<now() AND attempts>=10",
  );
  let succeeded = 0,
    failed = 0,
    deferred = 0;
  for (let index = 0; index < Math.min(limit, 50); index++) {
    const lease = randomUUID();
    const job = (
      await db.query<CommerceJob>(
        `UPDATE commerce_jobs SET status='running',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '5 minutes'
      WHERE id=(SELECT id FROM commerce_jobs WHERE ((status IN ('pending','failed') AND next_run_at<=now()) OR (status='running' AND lease_until<now())) AND attempts<10 ORDER BY next_run_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
        [lease],
      )
    ).rows[0];
    if (!job) break;
    try {
      const handler = handlers[job.kind];
      if (!handler)
        throw new Error("No handler is configured for this job type");
      await handler(job.payload);
      const completed = await db.query(
        "UPDATE commerce_jobs SET status='succeeded',last_error=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now() RETURNING id",
        [job.id, lease],
      );
      succeeded += completed.rows.length;
    } catch (error) {
      if (error instanceof DeferredJobError) {
        const updated = await db.query(
          "UPDATE commerce_jobs SET status='pending',attempts=GREATEST(0,attempts-1),last_error=$3,lease_until=NULL,next_run_at=now()+($4::integer*interval '1 second') WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now() RETURNING id",
          [
            job.id,
            lease,
            error.message.slice(0, 500),
            Math.max(60, Math.min(error.delaySeconds, 86400)),
          ],
        );
        deferred += updated.rows.length;
      } else {
        const updated = await db.query(
          "UPDATE commerce_jobs SET status=CASE WHEN attempts>=10 THEN 'dead' ELSE 'failed' END,last_error=$3,lease_until=NULL,next_run_at=now()+interval '5 minutes' WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now() RETURNING id",
          [
            job.id,
            lease,
            (error instanceof Error
              ? error.message
              : "Background operation failed"
            ).slice(0, 500),
          ],
        );
        failed += updated.rows.length;
      }
    }
  }
  return { succeeded, failed, deferred };
}
