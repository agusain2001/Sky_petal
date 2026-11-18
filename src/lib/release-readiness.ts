import { getDB } from "./db";
import { invoiceConfig, invoiceConfigSchema } from "./invoices";
import { retentionPolicy, retentionSchema } from "./privacy-deletion";
/** Configuration and local DB checks only. Provider outcomes require genuine
 * target-environment evidence and are deliberately never inferred here. */
export async function releaseReadiness() {
  const db = await getDB(),
    role = (
      await db.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0],
    staff = Number(
      (
        await db.query<{ count: string }>(
          "SELECT count(*) count FROM users u LEFT JOIN staff_mfa m ON m.user_id=u.id AND m.enabled WHERE u.role<>'customer' AND u.suspended_at IS NULL AND u.deleted_at IS NULL AND m.user_id IS NULL",
        )
      ).rows[0].count,
    );
  const checks = [
    ["managed_database_configured", !!process.env.DATABASE_URL],
    [
      "runtime_role_not_superuser_or_bypass",
      !role.rolsuper && !role.rolbypassrls,
    ],
    [
      "hosted_identity_configured",
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ],
    ["local_auth_disabled", process.env.ALLOW_LOCAL_AUTH !== "true"],
    [
      "mfa_encryption_key_configured",
      Buffer.from(process.env.MFA_ENCRYPTION_KEY || "", "base64").length === 32,
    ],
    ["all_active_staff_enrolled", staff === 0],
    [
      "razorpay_keys_and_webhook_configured",
      !!process.env.RAZORPAY_KEY_ID &&
        !!process.env.RAZORPAY_KEY_SECRET &&
        !!process.env.RAZORPAY_WEBHOOK_SECRET,
    ],
    [
      "courier_and_webhook_configured",
      !!(
        process.env.SHIPROCKET_TOKEN ||
        (process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD)
      ) && !!process.env.COURIER_WEBHOOK_TOKEN,
    ],
    [
      "maintenance_access_configured",
      (process.env.COMMERCE_MAINTENANCE_SECRET || "").length >= 32,
    ],
    [
      "invoice_settings_configured",
      invoiceConfigSchema.safeParse(await invoiceConfig()).success,
    ],
    [
      "retention_settings_configured",
      retentionSchema.safeParse(await retentionPolicy()).success,
    ],
  ] as const;
  return {
    checked_at: new Date().toISOString(),
    release_decision: "NO-GO",
    scope:
      "Read-only configuration/local DB checks; not provider, staging or merchant acceptance",
    checks: checks.map(([name, passed]) => ({
      name,
      status: passed ? "configured" : "missing_or_unsuitable",
    })),
    unenrolled_active_staff: staff,
    external_campaigns: Array.from({ length: 12 }, (_, i) => ({
      id: `EXT${String(i + 1).padStart(2, "0")}`,
      status: "UNVERIFIED",
      evidence:
        "Real target-environment outcome has not been verified by this check",
    })),
  };
}
