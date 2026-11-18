import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { getDB } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
async function main() {
  if (process.env.DATABASE_URL)
    throw new Error("This helper is only for the local preview database.");
  const db = await getDB();
  const existing = await db.query("SELECT id FROM users WHERE role='owner'");
  if (existing.rows.length) {
    console.log(
      "A store owner already exists. Existing credentials were preserved.",
    );
    await db.close();
    return;
  }
  const email = "owner@skypetal.local";
  const password = randomBytes(18).toString("base64url");
  await db.query(
    "INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,'Sky Petal Owner',$3,'owner')",
    [randomUUID(), email, hashPassword(password)],
  );
  await mkdir("data", { recursive: true });
  await writeFile(
    "data/local-access.json",
    JSON.stringify(
      {
        note: "Local preview only. Keep this file private. This file is ignored by version control.",
        email,
        password,
      },
      null,
      2,
    ),
  );
  console.log(
    "Local owner ready. Private sign-in details are saved in data/local-access.json.",
  );
  await db.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
