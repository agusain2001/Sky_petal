import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

/** Forward-only migrations shared by local initialization and managed PostgreSQL. */
export async function applyMigrations(db: PGlite) {
  const directory = path.join(process.cwd(), "migrations");
  const files = (await readdir(directory))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(
    name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  ); ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;`);
  for (const name of files) {
    const sql = await readFile(path.join(directory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await db.transaction(async (tx) => {
      await tx.exec("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
      const applied = await tx.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== checksum)
          throw new Error(
            `Applied migration changed: ${name}. Add a new migration instead.`,
          );
        return;
      }
      await tx.exec(sql);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    });
  }
}
