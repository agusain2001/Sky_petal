import { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../src/lib/migrations";
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL for managed PostgreSQL migrations.");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "require"
        ? { rejectUnauthorized: true }
        : undefined,
  });
  const client = await pool.connect();
  try {
    await applyMigrations({
      exec: (sql: string) => client.query(sql),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        await client.query("BEGIN");
        try {
          const result = await fn({
            query: client.query.bind(client),
            exec: (sql: string) => client.query(sql),
          });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      },
    } as unknown as PGlite);
    console.log("Versioned PostgreSQL migrations complete.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
