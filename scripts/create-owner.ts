import { getDB } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { randomUUID, randomBytes } from "node:crypto";
const email = process.env.OWNER_EMAIL;
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error(
    "Set OWNER_EMAIL to your team email before running this script.",
  );
const password =
  process.env.OWNER_PASSWORD || randomBytes(18).toString("base64url");
if (password.length < 12)
  throw new Error("Use an owner password with at least 12 characters.");
async function main() {
  const db = await getDB();
  await db.query(
    "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,'Store owner',$3,'owner') ON CONFLICT(email) DO UPDATE SET role='owner',password_hash=excluded.password_hash",
    [randomUUID(), email!.toLowerCase(), hashPassword(password)],
  );
  console.log("Store owner provisioned:", email);
  if (!process.env.OWNER_PASSWORD)
    console.log("One-time generated password (save privately):", password);
  await db.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
