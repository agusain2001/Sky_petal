import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
export const newsletterConsentVersion = "newsletter-2026-11-01";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function subscribeNewsletter(input: unknown) {
  const data = z
    .object({
      email: z
        .email()
        .max(200)
        .transform((s) => s.toLowerCase()),
      consent: z.literal(true),
    })
    .parse(input);
  const db = await getDB();
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO newsletter(email,status,consent_version,consent_source,consent_at,unsubscribe_hash)
      VALUES($1,'subscribed',$2,'storefront_newsletter',now(),$3) ON CONFLICT(email) DO UPDATE SET
      status='subscribed',consent_version=excluded.consent_version,consent_source=excluded.consent_source,consent_at=excluded.consent_at,unsubscribe_hash=excluded.unsubscribe_hash`,
      [data.email, newsletterConsentVersion, hash(token)],
    );
    await tx.query(
      "INSERT INTO newsletter_consent_events(id,email,decision,version,source) VALUES($1,$2,true,$3,'storefront_newsletter')",
      [randomUUID(), data.email, newsletterConsentVersion],
    );
  });
  return {
    message: "You’re on the list. Your newsletter preference is saved.",
    unsubscribe_token: token,
  };
}
export async function unsubscribeNewsletter(input: unknown) {
  const { token } = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .parse(input);
  const db = await getDB();
  await db.transaction(async (tx) => {
    const row = (
      await tx.query<{ email: string; consent_version: string }>(
        "UPDATE newsletter SET status='unsubscribed' WHERE unsubscribe_hash=$1 AND status='subscribed' RETURNING email,consent_version",
        [hash(token)],
      )
    ).rows[0];
    if (row)
      await tx.query(
        "INSERT INTO newsletter_consent_events(id,email,decision,version,source) VALUES($1,$2,false,$3,'unsubscribe')",
        [randomUUID(), row.email, row.consent_version],
      );
  });
  return {
    message:
      "Newsletter subscription removed. You will receive no marketing from this subscription.",
  };
}
