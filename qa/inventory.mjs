import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const source = await fs.readFile(path.join(root, 'src/app/api/[...path]/route.ts'), 'utf8');
async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const name = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await walk(name)); else out.push(name);
  }
  return out;
}
const files = await walk('src');
const groups = [['GET', source.slice(source.indexOf('async function get('), source.indexOf('async function post('))], ['POST', source.slice(source.indexOf('async function post('), source.indexOf('export async function GET('))]];
const operations = [...new Map(groups.flatMap(([method, text]) => [...text.matchAll(/path === "([^"]+)"/g)].map(m => ({ method, path: `/api/${m[1]}` }))).map(op => [`${op.method} ${op.path}`, op])).values()];
const dynamic = source.split('\n').map((line, i) => ({ line: i + 1, source: line.trim() })).filter(r => /\.test\(path\)|path\.startsWith\(|path\.match\(/.test(r.source));
const hashes = {};
for (const file of [...files, ...await walk('migrations'), ...await walk('tests'), ...await walk('e2e')]) hashes[file] = createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
const result = {
  at: new Date().toISOString(),
  pages: files.filter(f => /\/(page|route)\.tsx?$/.test(f)),
  static_api_operations: operations,
  dynamic_dispatch_evidence: dynamic,
  address_operations: ['PATCH /api/addresses/:id', 'DELETE /api/addresses/:id'],
  tests: [...await walk('tests'), ...await walk('e2e')],
  installed_versions: Object.fromEntries(await Promise.all(['next', 'react', 'typescript', '@playwright/test', '@axe-core/playwright', '@electric-sql/pglite', 'pg'].map(async n => [n, JSON.parse(await fs.readFile(path.join(root, 'node_modules', n, 'package.json'), 'utf8')).version]))),
  configuration_files: (await fs.readdir(root)).filter(f => f.startsWith('.env')),
  hashes,
};
await fs.mkdir(path.join(root, 'qa/evidence/fresh'), { recursive: true });
await fs.writeFile(path.join(root, 'qa/evidence/fresh/source-inventory.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ pages_and_route_handlers: result.pages.length, static_api_operations: operations.length, dynamic_dispatches: dynamic.length, original_tests: result.tests.length }));
