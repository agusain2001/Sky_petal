import { schema } from "../src/lib/db";
import { rls } from "../src/lib/rls";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
mkdirSync("migrations", { recursive: true });
if (existsSync("migrations/001_initial.sql")) {
  console.log(
    "Initial migration retained. Add a new numbered SQL migration for schema changes; applied migrations are immutable.",
  );
} else {
  writeFileSync("migrations/001_initial.sql", schema + "\n" + rls, {
    flag: "wx",
  });
  console.log("Exported initial PostgreSQL schema and RLS policies.");
}
