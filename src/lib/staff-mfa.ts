import {
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDB } from "./db";
import { checkPassword } from "./auth";
import type { User } from "./types";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Uint8Array) {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function unbase32(secret: string) {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const char of secret) {
    const n = alphabet.indexOf(char);
    if (n < 0) throw new Error("Invalid authenticator key");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
/** RFC 6238 SHA-1, 30-second steps; digits=8 supports published test vectors. */
export function totp(secret: string, milliseconds = Date.now(), digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(milliseconds / 30000)));
  const digest = createHmac("sha1", unbase32(secret)).update(counter).digest();
  const offset = digest[19] & 15;
  return String(
    (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, "0");
}
async function encryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32)
      throw new Error("MFA encryption key must be 32 bytes encoded as base64");
    return key;
  }
  if (process.env.DEPLOYMENT_ENV === "production" || process.env.DATABASE_URL)
    throw new Error("Configure MFA_ENCRYPTION_KEY before staff enrollment");
  const dir =
    process.env.DATABASE_DIR || path.join(process.cwd(), "data", "sky-petal");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, ".staff-mfa-key");
  try {
    await writeFile(file, randomBytes(32), { flag: "wx", mode: 0o600 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const key = await readFile(file);
  if (key.length !== 32) throw new Error("Local MFA key is invalid");
  return key;
}
async function seal(secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", await encryptionKey(), iv);
  const bytes = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
async function open(encrypted: string) {
  const bytes = Buffer.from(encrypted, "base64"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      await encryptionKey(),
      bytes.subarray(0, 12),
    );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
function staff(actor: User) {
  if (actor.role === "customer")
    throw new Error("You do not have permission to manage staff security");
}
async function session(actor: User, tokenHash: string) {
  if (
    !(
      await (
        await getDB()
      ).query(
        "SELECT token_hash FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()",
        [tokenHash, actor.id],
      )
    ).rows.length
  )
    throw new Error("Sign in to continue");
}
export async function mfaStatus(actor: User, tokenHash: string) {
  staff(actor);
  await session(actor, tokenHash);
  const db = await getDB();
  const row = (
    await db.query<{ enabled: boolean }>(
      "SELECT enabled FROM staff_mfa WHERE user_id=$1",
      [actor.id],
    )
  ).rows[0];
  const proof = (
    await db.query<{ recent: boolean }>(
      "SELECT verified_at>now()-interval '10 minutes' recent FROM staff_session_factors WHERE token_hash=$1 AND verified_at>now()-interval '12 hours'",
      [tokenHash],
    )
  ).rows[0];
  const primary = (
    await db.query<{ password_required: boolean; fresh_provider: boolean }>(
      "SELECT password_hash IS NOT NULL password_required,EXISTS(SELECT 1 FROM session_primary_proofs WHERE token_hash=$2 AND provider='supabase' AND verified_at>now()-interval '5 minutes') fresh_provider FROM users WHERE id=$1",
      [actor.id, tokenHash],
    )
  ).rows[0];
  return {
    enabled: !!row?.enabled,
    required:
      process.env.STAFF_MFA_REQUIRED === "true" ||
      process.env.DEPLOYMENT_ENV === "production" ||
      !!row?.enabled,
    verified: !!proof,
    recent: !!proof?.recent,
    password_required: primary.password_required,
    needs_primary_reauth: !primary.password_required && !primary.fresh_provider,
  };
}
export async function requireStaffFactor(
  actor: User,
  tokenHash: string,
  stepUp = false,
) {
  if (actor.role === "customer") return;
  const state = await mfaStatus(actor, tokenHash);
  if (state.required && (!state.verified || (stepUp && !state.recent)))
    throw new Error(
      state.enabled
        ? "Staff MFA permission required: verify an authenticator or recovery code"
        : "Staff MFA permission required: enroll an authenticator",
    );
}
export async function beginMfa(
  actor: User,
  tokenHash: string,
  password: string,
) {
  staff(actor);
  await session(actor, tokenHash);
  const db = await getDB();
  const user = (
    await db.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [actor.id],
    )
  ).rows[0];
  if (user?.password_hash && !checkPassword(password, user.password_hash))
    throw new Error(
      "Verify your current password before enrolling an authenticator",
    );
  if (
    !user?.password_hash &&
    !(
      await db.query(
        "SELECT token_hash FROM session_primary_proofs WHERE token_hash=$1 AND provider='supabase' AND verified_at>now()-interval '5 minutes'",
        [tokenHash],
      )
    ).rows.length
  )
    throw new Error(
      "Sign in again with your identity provider before enrolling an authenticator",
    );
  const secret = base32(randomBytes(20)),
    encrypted = await seal(secret);
  const saved = await db.query(
    "INSERT INTO staff_mfa(user_id,secret,pending_until) VALUES($1,$2,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,pending_until=excluded.pending_until WHERE NOT staff_mfa.enabled RETURNING user_id",
    [actor.id, encrypted],
  );
  if (!saved.rows.length)
    throw new Error(
      "An authenticator is already enrolled; use a recovery code if needed",
    );
  return {
    secret,
    uri: `otpauth://totp/${encodeURIComponent("Sky Petal:" + actor.email)}?secret=${secret}&issuer=Sky%20Petal&algorithm=SHA1&digits=6&period=30`,
  };
}
export async function verifyMfa(
  actor: User,
  tokenHash: string,
  code: string,
  enroll = false,
) {
  staff(actor);
  await session(actor, tokenHash);
  if (typeof code !== "string" || code.length > 100)
    throw new Error("Enter an authenticator or recovery code");
  const db = await getDB();
  const limit = (
    await db.query<{ attempts: number }>(
      "INSERT INTO staff_mfa_limits VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(user_id) DO UPDATE SET attempts=CASE WHEN staff_mfa_limits.reset_at<now() THEN 1 ELSE staff_mfa_limits.attempts+1 END,reset_at=CASE WHEN staff_mfa_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE staff_mfa_limits.reset_at END RETURNING attempts",
      [actor.id],
    )
  ).rows[0];
  if (limit.attempts > 10)
    throw new Error("Too many MFA attempts. Try again in 15 minutes.");
  return db.transaction(async (tx) => {
    const row = (
      await tx.query<{
        secret: string;
        enabled: boolean;
        valid: boolean;
        last_counter: string;
        recovery_hashes: string[];
      }>(
        "SELECT *,pending_until>now() valid FROM staff_mfa WHERE user_id=$1 FOR UPDATE",
        [actor.id],
      )
    ).rows[0];
    if (!row || (enroll ? row.enabled || !row.valid : !row.enabled))
      throw new Error("Authenticator enrollment is unavailable or expired");
    const secret = await open(row.secret),
      now = Math.floor(Date.now() / 30000);
    let counter = -1;
    for (const step of [now - 1, now, now + 1]) {
      const expected = totp(secret, step * 30000);
      if (
        /^\d{6}$/.test(code) &&
        timingSafeEqual(Buffer.from(code), Buffer.from(expected)) &&
        step > Number(row.last_counter)
      )
        counter = step;
    }
    const index = enroll ? -1 : row.recovery_hashes.indexOf(hash(code));
    if (counter < 0 && index < 0)
      throw new Error("Invalid or already used authenticator code");
    const recovery = enroll
      ? Array.from({ length: 10 }, () => randomBytes(16).toString("hex"))
      : undefined;
    const hashes = recovery
      ? recovery.map(hash)
      : row.recovery_hashes.filter((_, i) => i !== index);
    await tx.query(
      "UPDATE staff_mfa SET enabled=true,last_counter=$2,recovery_hashes=$3 WHERE user_id=$1",
      [
        actor.id,
        counter < 0 ? row.last_counter : counter,
        JSON.stringify(hashes),
      ],
    );
    await tx.query(
      "INSERT INTO staff_session_factors(token_hash,user_id) VALUES($1,$2) ON CONFLICT(token_hash) DO UPDATE SET verified_at=now()",
      [tokenHash, actor.id],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$2,'{}')",
      [
        randomUUID(),
        actor.id,
        enroll
          ? "staff.mfa.enrolled"
          : index >= 0
            ? "staff.mfa.recovery"
            : "staff.mfa.verified",
      ],
    );
    return { verified: true, recovery_codes: recovery };
  });
}
