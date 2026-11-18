import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.TEST_BASE_URL;
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local QA server only');
const observations = [];
for (const route of ['/robots.txt', '/sitemap.xml', '/products/the-petal-bralette']) {
  const response = await fetch(base + route);
  const text = await response.text();
  observations.push({ route, status: response.status, content_type: response.headers.get('content-type'), contains_not_found_boundary_not_route_verdict: text.includes('This petal has drifted away'), canonical: /rel=["']canonical["']/.test(text), product_json_ld: /application\/ld\+json/.test(text) && /Product/.test(text) });
}
const samples = [];
for (let i = 0; i < 33; i++) {
  const start = performance.now();
  const response = await fetch(base + '/api/catalog');
  if (!response.ok) throw Error('Catalog sample failed');
  await response.arrayBuffer();
  if (i >= 3) samples.push(performance.now() - start);
}
const sorted = [...samples].sort((a, b) => a - b);
const latency = { endpoint: '/api/catalog', sample_count: samples.length, warmup_excluded: 3, concurrency: 1, samples_ms: samples, p50_ms: sorted[Math.ceil(sorted.length * .5) - 1], p95_ms: sorted[Math.ceil(sorted.length * .95) - 1], limits: 'Local warm-cache sequential observation only; no agreed load, external providers, CWV, availability or production SLA certification.' };
const directory = process.env.QA_EVIDENCE_DIR || 'qa/evidence/fresh';
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'http-observations.json'), JSON.stringify({ at: new Date().toISOString(), observations, latency }, null, 2));
console.log(JSON.stringify({ observations, p95_ms: latency.p95_ms, sample_count: samples.length }));
