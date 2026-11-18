import { getDB } from "../src/lib/db";
process.env.DATABASE_AUTO_MIGRATE = "true";
async function main() {
  const db = await getDB();
  console.log("Schema, RLS and reproducible sample catalog are ready.");
  await db.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
