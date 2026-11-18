import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { getDB } from "./db";
import type { User } from "./types";
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get("sp_session")?.value;
  if (!token) return null;
  const db = await getDB();
  const r = await db.query<User>(
    "SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND expires_at>now() AND u.suspended_at IS NULL AND u.deleted_at IS NULL",
    [hashToken(token)],
  );
  return r.rows[0] || null;
}
export async function createSession(
  userId: string,
  provider: "local" | "supabase" = "local",
) {
  const token = randomBytes(32).toString("hex");
  const db = await getDB();
  if (
    !(
      await db.query(
        "SELECT id FROM users WHERE id=$1 AND suspended_at IS NULL AND deleted_at IS NULL",
        [userId],
      )
    ).rows.length
  )
    throw new Error("Sign in is unavailable for this account");
  await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [
    hashToken(token),
    userId,
  ]);
  await db.query(
    "INSERT INTO session_primary_proofs(token_hash,provider) VALUES($1,$2)",
    [hashToken(token), provider],
  );
  (await cookies()).set("sp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 604800,
  });
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Sign in to continue");
  return user;
}
export async function requireRole(roles: string[]) {
  const u = await requireUser();
  if (!roles.includes(u.role))
    throw new Error("You do not have permission for this action");
  const { requireStaffFactor } = await import("./staff-mfa");
  await requireStaffFactor(
    u,
    hashToken((await cookies()).get("sp_session")?.value || ""),
  );
  return u;
}
