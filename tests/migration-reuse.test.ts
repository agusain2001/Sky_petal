import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { getDB, schema } from "../src/lib/db";
import { readdir } from "node:fs/promises";

test("a retained development connection is upgraded without opening another PGlite process", async () => {
  delete process.env.DATABASE_URL;
  const retained = new PGlite();
  await retained.exec(schema);
  const globalDB = globalThis as unknown as { skyPetalDB?: Promise<PGlite> };
  globalDB.skyPetalDB = Promise.resolve(retained);
  try {
    const db = await getDB();
    assert.equal(db, retained);
    assert.equal(
      (await db.query("SELECT * FROM schema_migrations")).rows.length,
      (await readdir("migrations")).filter((name) => /^\d+_.+\.sql$/.test(name))
        .length,
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT order_state,payment_state,fulfillment_state FROM orders",
        )
      ).rows,
      [],
    );
    assert.deepEqual(
      (await db.query("SELECT * FROM payment_webhook_inbox")).rows,
      [],
    );
  } finally {
    await retained.close();
  }
});
