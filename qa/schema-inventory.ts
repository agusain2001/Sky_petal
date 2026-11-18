import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getDB } from '../src/lib/db';

async function main() {
  delete process.env.DATABASE_URL;
  process.env.DATABASE_DIR = await mkdtemp(path.join(os.tmpdir(), 'sky-petal-qa-schema-'));
  const db = await getDB();
  try {
    const tables = (await db.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const constraints = (await db.query("SELECT c.conrelid::regclass::text AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON c.connamespace=n.oid WHERE n.nspname='public' ORDER BY 1,2")).rows;
    const policies = (await db.query("SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows;
    const indexes = (await db.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
    const migrations = (await db.query('SELECT * FROM schema_migrations')).rows;
    const triggers = (await db.query("SELECT event_object_table,trigger_name,event_manipulation,action_statement FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY 1,2,3")).rows;
    const directory = process.env.QA_EVIDENCE_DIR || 'qa/evidence/fresh';
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'db-inventory.json'), JSON.stringify({ mode: 'fresh isolated PGlite, not managed PostgreSQL', tables, constraints, policies, indexes, migrations, triggers }, null, 2));
    console.log(JSON.stringify({ tables: tables.length, constraints: constraints.length, policies: policies.length, indexes: indexes.length, migrations: migrations.length, trigger_events: triggers.length }));
  } finally { await db.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
