import assert from "node:assert/strict";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = process.cwd(),
  read = async (f) => readFile(path.join(root, f), "utf8");
const latest = JSON.parse(
  await read("qa/evidence/recovery/latest-run.json"),
).directory.replaceAll("\\", "/");
const json = async (f) => JSON.parse(await read(f));
const commands = await json(latest + "/commands.json");
assert.ok(
  commands.length >= 10 && commands.every((c) => c.exit_code === 0),
  "Latest complete recovery campaign must pass before recording closure",
);
const browser = await json(latest + "/browser.json"),
  audit = await json(latest + "/audit.json"),
  closure = await json(latest + "/closure.json");
for (const report of [browser, audit, closure])
  assert.equal(report.stats.unexpected, 0);
assert.equal(browser.stats.expected, 34);
assert.equal(audit.stats.expected, 6);
assert.equal(closure.stats.expected, 4);
const http = await json(latest + "/http-probes.json");
assert.equal(http.length, 198);
assert.ok(http.every((c) => c.status === "PASS"));
const domain = await json(
  "qa/evidence/recovery/final-domain/domain-probes.json",
);
assert.equal(domain.length, 9);
assert.ok(domain.every((c) => c.status === "PASS"));
const load = await json(latest + "/load.json"),
  history = load.rows.find((r) => r.id === "QA-P03");
assert.ok(history.local_budget_pass);
const directories = (
  await readdir("qa/evidence/recovery", { withFileTypes: true })
)
  .filter((e) => e.isDirectory() && e.name.startsWith("lighthouse-"))
  .map((e) => e.name)
  .sort()
  .reverse();
let lighthouse, lhPath;
for (const directory of directories) {
  try {
    const rows = await json(
      "qa/evidence/recovery/" + directory + "/summary.json",
    );
    if (rows.length === 4) {
      lighthouse = rows;
      lhPath = "qa/evidence/recovery/" + directory;
      break;
    }
  } catch {}
}
assert.ok(lighthouse);
const stamp = new Date().toISOString();
const marker = "<!-- LOCAL-RECOVERY-2026-11-01 -->";
async function append(file, body) {
  let content = await read(file);
  const index = content.indexOf(marker);
  if (index >= 0) content = content.slice(0, index).trimEnd();
  await writeFile(
    file,
    content.trimEnd() + "\n\n" + marker + "\n" + body + "\n",
    "utf8",
  );
}
const evidence = `[commands](${latest}/commands.json), [Node](${latest}/node-tests-final.txt), [HTTP](${latest}/api-tests.txt), [role probes](${latest}/http-probes.json), [browser](${latest}/browser.json), [QA browser](${latest}/audit.json), [correction/export closure](${latest}/closure.json)`;
const bugRows = [
  [
    "001",
    "CMS eyebrow, description and story render",
    "QA-B02 desktop/mobile; existing storyBody preserved",
  ],
  [
    "002",
    "Filter contrast",
    "Automated AA desktop plus expanded/closed mobile panel",
  ],
  [
    "003",
    "Completed COD evidence integrity",
    "QA-D03 rejects the original direct UPDATE; non-owner application writer denied; additive legacy migration, independent correction approvals and competing approvals tested",
  ],
  [
    "004",
    "Semantic tracking notices",
    "QA-D04: equivalent booking/status/normalized-time envelopes notify once; raw scan-event history retained",
  ],
  [
    "005",
    "Lost worker lease accounting",
    "QA-D05 plus success/failure/defer/expired-lease regressions; zero-row fenced writes contribute zero counters",
  ],
  [
    "006",
    "Consent refusal",
    "QA-H06 plus direct DB assertions: missing/false consent creates no row; version/source/time/event retained for explicit consent; tokenized unsubscribe works",
  ],
  [
    "007",
    "Filtered SKU price sort",
    "QA-H12 and ascending/descending XXL fixture B/A regression",
  ],
  [
    "008",
    "SEO documents and metadata",
    "HTTP text/plain robots and XML sitemap; product canonical/real SKU JSON-LD; direct production sitemap tests exclude private/unpublished content; default staging noindex",
  ],
  [
    "009",
    "Two-tab bag increment",
    "Browser request barrier: 1 + two Add-to-bag clicks = 3, both viewports; explicit set/remove and stock/cap negatives retained",
  ],
  [
    "010",
    "Search focus return",
    "Keyboard Escape restores Search products trigger, both viewports; native dialog focus stays inside application dialog controls",
  ],
  [
    "011",
    "Visible/accessibility label agreement",
    "Brand link uses visible text; motion controls have matching visible names; wcag21a included in recovery scan",
  ],
  [
    "012",
    "Support data in export",
    "HTTP persist/read/export test and domain customer-boundary test include owned support messages, exclude staff notes, other customers and credentials",
  ],
  [
    "014",
    "Long-order-history latency",
    `105-order API local p95 ${history.p95_ms} ms, zero errors; 105-order line/event/ownership regression passes; managed capacity is still unverified`,
  ],
];
const closureTable =
  "| Defect | Current local disposition | Evidence scope |\n|---|---|---|\n" +
  bugRows
    .map(
      ([id, title, proof]) =>
        `| SP-QA-${id}: ${title} | CLOSED after local retest | ${proof} |`,
    )
    .join("\n") +
  "\n| SP-QA-013: mobile LCP | OPEN | Latest simulated mobile LCP remains above 2500 ms. CLS is 0 in the latest four samples; this does not close LCP or certify target devices. |";
const lhTable =
  "| Navigation | Score | LCP ms | CLS | TBT ms |\n|---|---:|---:|---:|---:|\n" +
  lighthouse
    .map(
      (r) =>
        `| ${r.name} | ${Math.round(r.score * 100)} | ${Math.round(r.lcp_ms)} | ${r.cls.toFixed(4)} | ${Math.round(r.tbt_ms)} |`,
    )
    .join("\n");
const report = `# Local implementation recovery — 1 November 2026\n\nRecorded ${stamp}; user-facing date Asia/Kolkata. **The project is not 100% complete; real orders remain NO-GO.** The user explicitly selected continued local implementation because staging access is not ready. This increment closes 13 of the 14 recorded defect repros locally; SP-QA-013 remains open. Broad roadmap implementation and external acceptance are still incomplete.\n\n## Implementation\n\n- R1; original phases 2/9/11; Q07/A12/O18: migration 010 freezes completed refunds and adds immutable correction requests plus separate approvals, database role/separation checks and stale-approval fencing. Finance API and Studio Refunds UI expose the complete request/review trail without sending another payout or overwriting the original.\n- R2; original phases 4–7/9/10/12/14: explicit server consent, consent version/source/time/events, legacy suppression and unsubscribe (U12/M06/M07); transactional cart deltas (U17–U19); semantic scan notice identity (O07/O10/Q13); fenced worker counters (P17/A13); matching-SKU sort (C07/C10); CMS publication (F11); contrast/focus/labels (F09/Q19); robots/sitemap/canonical/escaped truthful Product data (Q22).\n- R8 local privacy subset: explicit customer export inventory covers support, orders/items/events/payments, returns/refunds, saved addresses, cart/wishlist/reviews, notifications, requests and newsletter consent. Internal notes, secrets and bank references are excluded; cross-customer assertions pass (U13/O21/Q12). Deletion fulfillment and formal retention operations remain unfinished.\n- R10 performance subset: batched order assembly, server-rendered catalog, responsive image delivery, metric-adjusted local fonts and removal of the opaque initial loader. Silk/reduced-motion/WebGL fallback regression stays green. Mobile LCP remains open (O01/Q20/Q21).\n\n## Fresh proof\n\n${evidence}\n\n| Layer | Latest result |\n|---|---|\n| Node/domain suite | 105 PASS, 2 SKIPPED HTTP entry tests (no server in this layer); includes parent test rows |\n| Existing HTTP suite against isolated production build | 29 PASS |\n| Role/ownership/negative HTTP probes | 198 PASS |\n| Original + new desktop/mobile browser suite | 34 PASS |\n| Focused independent QA browser suite | 6 PASS |\n| Correction approval + privacy export closure | 4 PASS |\n| Specific domain probes | 9 PASS; before fix 6 PASS / 3 FAIL, including payout UPDATE |\n| Typecheck / in-place default Turbopack production build | PASS |\n\nCounts are reported separately; parent rows and overlapping suites are not combined into a feature pass rate. Commands and timestamps are in the manifest. All data and recipients are synthetic; provider credentials were cleared. The runner stops only its own server and restores pre-existing screenshot files. Historical failure evidence is retained.\n\n${closureTable}\n\n## Performance limits\n\n${lhTable}\n\n[Lighthouse raw reports/commands](${lhPath}/summary.json), [bounded HTTP samples](${latest}/load.json). Each Lighthouse row is one simulated navigation on this Windows workstation, with explicit CPU-calibration warnings retained in reports where present. Mobile LCP is still over budget. These samples are not field p75/INP, physical-device or managed staging acceptance. Historical p95 2197 ms versus current ${history.p95_ms} ms is a local observation, not a universal speedup guarantee.\n\n## Data preservation and release impact\n\nMigrations 010/011 are additive and checksummed. Existing completed/legacy refunds, orders, addresses and consent-less emails survive migration tests; old newsletter emails are suppressed rather than assigned invented consent. Ordinary writer edits, correction deletion, self-approval, competing stale approvals and customer finance access are rejected. A schema owner/superuser can alter guards; least-privilege managed runtime grants and bank reconciliation remain EXT07/EXT10.\n\nNo full launch gate is accepted. Gates 4/5/10/11/13/14/15 lose the listed local repro failures, but their full discovery/merge/managed-race/finance/returns/CMS/manual-device requirements remain. Gate 16 operations/restore and all merchant/provider gates remain unaccepted. There are still 0 of 17 target-environment gates signed off.\n\nEXT01/02 Razorpay, EXT03 hosted identity, EXT04/05 actual courier/reverse logistics, EXT06 delivered messages, EXT07 managed PostgreSQL/RLS, EXT08 managed restore, EXT09 remote CI/staging, EXT10 merchant/tax/COD bank approval, EXT11 target load/devices/field metrics and EXT12 separately approved live smoke remain BLOCKED or UNVERIFIED. No external success is inferred from mocks.\n\nNext local vertical slice: R3 payment-attempt lifecycle and reconciliation for authorized/failed/expired/unknown outcomes, preserving existing capture/reservation behavior, before invoice/credit-note and reverse-logistics closure. These are remaining implementation tasks, not merely credential blockers. No production deployment or live charge/refund/message/dispatch was attempted.\n\nOperational details: [recovery operations](docs/RECOVERY_OPERATIONS.md). Existing requirement IDs remain in the [171-row audit](Sky_Petal_Implementation_Coverage_Audit.md); the original roadmap stays canonical.\n`;
await writeFile(
  "Sky_Petal_Local_Recovery_Report.md",
  report +
    "\n[Implementation file map](docs/RECOVERY_CHANGESET.md). The CI source now checks domain probes and runs the built production server; remote CI execution remains unverified. The failed mobile filter scan during a reduced-motion opacity transition was retained; dialogs now render immediately under reduced motion and the expanded panel is checked after reaching full opacity.\n\n[Final 9-probe domain retest](qa/evidence/recovery/final-domain/domain-probes.json), [exact command and timestamps](qa/evidence/recovery/final-domain/execution.json), [68 original artifact hashes preserved](qa/evidence/recovery/artifact-preservation.json).\n",
);
let ledger = await read("Sky_Petal_Implementation_Coverage_Audit.md");
const updates = {
  F09: [
    "COVERED",
    "Navigation and search dialogs operate locally; Escape now restores the originating trigger. Recovery browser checks pass on desktop/mobile. Full manual accessibility acceptance remains Q19.",
  ],
  F11: [
    "PARTIAL",
    "Supported editable eyebrow, description, story and storyBody now render on desktop/mobile; QA-B02 passes. Broader homepage block/banner/version/3D publication remains unfinished.",
  ],
  C10: [
    "PARTIAL",
    "Price sorting now uses only same-SKU matches for active size/color/price/stock/sale filters; ascending/descending regression and QA-H12 pass. Newest still uses a boolean; scalable/advanced sorting remains.",
  ],
  U12: [
    "PARTIAL",
    "Explicit newsletter consent now records version/source/time and immutable decisions, with tokenized unsubscribe and legacy suppression. Full account notification/privacy preferences and real message delivery remain unfinished.",
  ],
  U13: [
    "COVERED",
    "Customer export now includes an explicit owned-data inventory, including persisted support tickets/public messages and consent events, excluding other customers, internal notes, credentials and bank evidence. Direct HTTP and domain regressions pass; retention/deletion operations remain Q12/U14.",
  ],
  U19: [
    "PARTIAL",
    "Add to bag uses a transactional server delta; two concurrent PDP tabs now yield quantity 3 from 1. Explicit set/remove and stock/cap tests pass. Wider concurrent login-merge and managed-pool recovery acceptance remain.",
  ],
  P17: [
    "PARTIAL",
    "Durable capture/refund/courier inbox/jobs and bounded retry/replay remain. Outcome counters now require a successful unexpired lease-fenced row update; stale success/failure/defer checks pass. Hosted scheduling, alerts and complete provider/reconciliation coverage remain unverified.",
  ],
  O01: [
    "COVERED",
    "Private historical order lines/events are assembled in batches with customer-scoped child IDs. A 105-order correctness/ownership regression passes and the bounded local history latency target passes; managed load remains Q20.",
  ],
  O07: [
    "PARTIAL",
    "Owned booked carrier/AWB and retained scan history remain; equivalent booking/status/normalized-time notices are deduplicated. Actual courier, polling and exception acceptance remain.",
  ],
  O10: [
    "INTEGRATION",
    "Authenticated ingress retains distinct scan evidence; semantic customer notices deduplicate independently of envelopes. QA-D04 passes; provider webhook/polling/alert/recovery campaigns remain unverified.",
  ],
  O18: [
    "PARTIAL",
    "Completed COD refunds/evidence are database-protected; separate append-only correction requests need independent approval and reconciliation proof. Self/stale/concurrent approval and finance UI/API regressions pass. Secure payout destination and real bank/provider reconciliation remain.",
  ],
  A12: [
    "PARTIAL",
    "Completed refunds are now protected against ordinary application-writer updates; immutable correction and approval records preserve originals and actor/proof trails. Legacy migration and concurrency regressions pass. Full invoice/credit-note and managed access acceptance remain.",
  ],
  A13: [
    "PARTIAL",
    "Worker outcome counters now require a successful unexpired lease-fenced RETURNING row; stale success/failure/defer reports remain zero. Operational retry consoles remain; full access-log browser/alerts/hosted monitoring are unfinished.",
  ],
  M06: [
    "COVERED",
    "Newsletter form/server require explicit consent, provide feedback and support immediate tokenized unsubscribe. Domain and browser negative/positive checks pass; no external delivery claimed.",
  ],
  M07: [
    "PARTIAL",
    "Server consent/version/source/time, immutable events, legacy suppression and hashed-token unsubscribe now exist. Outbound marketing provider/templates, sender/delivery/bounce acceptance and broader preferences remain missing.",
  ],
  Q07: [
    "PARTIAL",
    "Completed refund evidence is immutable to ordinary DML; corrections and independent approvals are append-only and auditable. Legacy/history/refund bounds stay green. Invoice/credit-note accounting and managed runtime-role verification remain.",
  ],
  Q12: [
    "PARTIAL",
    "Owned export inventory now includes persisted support and consent data while excluding staff notes/secrets/other users. Formal PII access logs, retention decisions and deletion fulfillment remain unfinished.",
  ],
  Q13: [
    "PARTIAL",
    "Semantic courier notice dedup and unexpired lease-fenced outcome accounting now pass QA-D04/05 and regressions. Durable jobs/provider identities remain; outbound outbox, hosted workers and real provider acceptance are unverified.",
  ],
  Q19: [
    "PARTIAL",
    "Reported filter contrast, visible-label mismatch and Search Escape focus-return now pass automated desktop/mobile recovery checks, including open mobile filters. Full manual screen-reader/zoom/touch/physical-device WCAG acceptance remains unverified.",
  ],
  Q20: [
    "UNVERIFIED",
    `Batched 105-order local history now passes p95 <500ms (${history.p95_ms}ms, zero errors). Responsive images/fonts/SSR improve subsets, but mobile Lighthouse LCP remains above 2500ms; latest CLS is zero. Reports are lab samples with retained warnings, not field/target-device/staging certification.`,
  ],
  Q21: [
    "PARTIAL",
    "Responsive local Next Image delivery, metric-adjusted fonts, server-rendered catalog and batched history are implemented and regression-tested. Public API remains no-store; catalog filtering is in memory; full CDN/cache/scale acceptance remains.",
  ],
  Q22: [
    "COVERED",
    "Valid robots.txt/XML sitemap, published-product canonical and escaped truthful SKU Product JSON-LD are implemented. Default/staging indexing is denied; explicit approved HTTPS production opt-in is required. HTTP and production/unpublished/private-route regressions pass locally.",
  ],
};
for (const [id, [status, body]] of Object.entries(updates)) {
  const regex = new RegExp(`^\\| ${id} \\|([^|]+)\\|[^|]+\\|.*$`, "m");
  assert.ok(regex.test(ledger), "Missing audit ID " + id);
  ledger = ledger.replace(
    regex,
    `| ${id} |$1| ${status} | ${body} [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |`,
  );
}
const ids = [
  ...ledger.matchAll(
    /^\| ([A-Z]\d{2}) \|[^|]+\| (COVERED|PARTIAL|INTEGRATION|FOUNDATION|MISSING|UNVERIFIED|DEFERRED) \|/gm,
  ),
];
assert.equal(ids.length, 171);
assert.equal(new Set(ids.map((m) => m[1])).size, 171);
const counts = {};
for (const row of ids) counts[row[2]] = (counts[row[2]] || 0) + 1;
for (const [status, count] of Object.entries(counts))
  ledger = ledger.replace(
    new RegExp(`^\\| ${status} \\| \\d+ \\|$`, "m"),
    `| ${status} | ${count} |`,
  );
ledger = ledger.replace(
  /\*\*\d+ rows describe covered local capabilities; \d+ describe incomplete implementation\/integration\/foundation work;/,
  `**${counts.COVERED} rows describe covered local capabilities; ${counts.PARTIAL + counts.INTEGRATION + counts.FOUNDATION + counts.MISSING} describe incomplete implementation/integration/foundation work;`,
);
await writeFile("Sky_Petal_Implementation_Coverage_Audit.md", ledger);
await append(
  "Sky_Petal_Implementation_Coverage_Audit.md",
  `## Local recovery supplement\n\n${stamp}: 171 IDs retained, with ${Object.entries(
    counts,
  )
    .map(([k, v]) => `${v} ${k}`)
    .join(
      ", ",
    )}. These are capability classifications, not a completion percentage. Historical QA supplements above describe their original snapshots. The current changed rows link to [fresh recovery evidence](Sky_Petal_Local_Recovery_Report.md). Full release remains NO-GO, 0/17 target gates accepted.`,
);
await append(
  "qa/BUG_REPORT.md",
  `## Local recovery retest — current dispositions\n\nRecorded ${stamp}. Original descriptions and FAIL evidence above remain historical. The table below supersedes their OPEN statements only for the tested local scope. No production/provider acceptance is inferred.\n\n${closureTable}\n\n[Complete recovery report](../Sky_Petal_Local_Recovery_Report.md), [exact commands](../${latest}/commands.json), [before domain repro](evidence/recovery/before/domain-probes.json), [after domain retest](evidence/recovery/after/domain-probes.json). Mobile LCP is still OPEN; all 17 full release gates remain unaccepted.`,
);
await append(
  "qa/EXECUTION_REPORT.md",
  `## Local implementation recovery campaign\n\n${stamp}. Application changes were authorized after the earlier QA-only campaign. [Report](../Sky_Petal_Local_Recovery_Report.md) and [exact command/timestamp manifest](../${latest}/commands.json) retain fresh evidence separately. Node 105 PASS/2 SKIPPED; existing HTTP 29 PASS; role/negative HTTP probes 198 PASS; desktop/mobile browser 34 PASS; QA browser 6 PASS; correction/export closure 4 PASS; domain probes 9 PASS. Typecheck/default in-place Turbopack build PASS. Do not add these overlapping/parent counts into a feature percentage.\n\n105-order history p95 ${history.p95_ms}ms, zero errors in the bounded local campaign. Latest Lighthouse mobile LCP still fails the 2500ms budget; four current CLS values are zero. [Reports and retained warnings](../${lhPath}/summary.json). Initial migration-count and fixture-path harness failures and reused-owner login-rate failure remain in recovery evidence; the app rate limit was preserved and the final fresh-fixture campaign passed. A first Lighthouse launcher connection failure was resolved using a Playwright-launched local CDP session; the failure remains retained. No actual staging/provider/live operation occurred.\n\nThirteen recorded defects close locally; SP-QA-013 stays open. Full product implementation is incomplete and real sales remain NO-GO.`,
);
await append(
  "qa/RELEASE_READINESS.md",
  `## Current local recovery delta — NO-GO retained\n\n${stamp}. The historical tables above retain their snapshot evidence. [Recovery retests](../Sky_Petal_Local_Recovery_Report.md) close SP-QA-001–012 and SP-QA-014 locally; SP-QA-013 remains OPEN.\n\n- Gates 4/5: selected-SKU sorting and two-tab delta adds now pass; broader discovery/login-merge/target acceptance remains incomplete.\n- Gates 2/10/11/13: completed refund evidence is database-protected with independently approved corrections; duplicate notices and stale-worker statistics now pass. Managed roles/races, bank reconciliation, payout destinations, full returns/exchanges and actual PSP settlement remain unaccepted.\n- Gates 14/15: exposed CMS field propagation and reported automated contrast/focus/label failures now pass both viewports. Broad CMS/3D publishing, complete manual WCAG/device acceptance and mobile LCP remain unfinished.\n- Privacy support export and long-order local API latency now pass; formal retention/deletion and managed performance remain unaccepted. Gate 16 still needs managed restore/incident/rollback acceptance.\n\n**0 of 17 full target-environment gates are signed off.** J1/J2/J3/J4/J5/J7 remain BLOCKED for full target acceptance; J6 is still not accepted as a combined full journey. J8's local dedup/lease subset now passes, while managed/provider recovery remains BLOCKED.\n\nEXT01/02/03/04/05/06/07/08/09/10/12 remain BLOCKED; EXT11 target acceptance remains UNVERIFIED, with a failing local mobile LCP budget. User selected local continuation because staging is not ready. No live authority is implied. Next local work remains R3 payment lifecycle/reconciliation, followed by missing first-sale invoice/reverse/exchange/security/message/operations implementation.`,
);
await append(
  "qa/MODULE_GAPS.md",
  `## Local recovery update\n\n${stamp}. This planning index's earlier defect descriptions are historical. [Fresh recovery](../Sky_Petal_Local_Recovery_Report.md) resolves payout immutability/corrections, explicit consent/unsubscribe, cart increment loss, semantic notice duplication, worker accounting, matching-SKU sort, exposed CMS field rendering, contrast/focus/label findings, missing SEO documents and persisted-support export. Batched history meets the local latency target; mobile LCP remains open.\n\nCurrent 171-ID classifications are ${Object.entries(
    counts,
  )
    .map(([k, v]) => `${v} ${k}`)
    .join(
      ", ",
    )} in the canonical audit. Essential local payment-attempt/reconciliation, invoice/credit-note, reverse/exchange, staff/MFA, outbound messaging and operations work still remains; staging absence is not the only remaining gap. Real provider/merchant/managed acceptance stays blocked.`,
);
await append(
  "qa/REQUIREMENTS_TRACEABILITY_MATRIX.md",
  `## Local recovery traceability supplement\n\n${stamp}: the original matrix is retained as the independent QA snapshot. Current local changes, defect retests, exact commands and ID mappings are in [the recovery report](../Sky_Petal_Local_Recovery_Report.md) and the existing [171-ID implementation audit](../Sky_Petal_Implementation_Coverage_Audit.md). Closed narrow repros do not imply that every broad requirement or release gate in the historical matrix now passes. SP-QA-013 and the first-sales implementation/provider gaps remain open.`,
);
await append(
  "Sky_Petal_QA_to_Production_Recovery_Roadmap.md",
  `## Execution evidence supplement\n\n${stamp}: R1 and the listed R2 defect fixes now have local retest evidence in [the recovery report](Sky_Petal_Local_Recovery_Report.md). Privacy/order-history and performance prerequisites were also implemented; SP-QA-013 mobile LCP stays open. This note records execution sequencing, not a replacement feature-status ledger. All 171 IDs stay in the implementation audit. Next local slice is R3 payment-attempt lifecycle/reconciliation. Full first-sales implementation and EXT01–EXT12/17-gate acceptance are unfinished; NO-GO remains.`,
);
for (const file of [
  "qa/BUG_REPORT.md",
  "qa/EXECUTION_REPORT.md",
  "qa/RELEASE_READINESS.md",
  "qa/MODULE_GAPS.md",
]) {
  const text = await read(file);
  const note =
    "**Current recovery:** [Fresh local implementation and retests](../Sky_Petal_Local_Recovery_Report.md) supersede the historical snapshot statements below for the specified scope. Thirteen defect repros close locally; SP-QA-013 remains open. The project is incomplete and real sales remain NO-GO.\n";
  if (!text.includes("**Current recovery:**")) {
    const index = text.indexOf("\n");
    await writeFile(
      file,
      text.slice(0, index + 1) + "\n" + note + text.slice(index + 1),
    );
  }
}
const manifest = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await walk(file);
    else
      manifest.push({
        file: file.replaceAll("\\", "/"),
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
      });
  }
}
for (const directory of ["src", "migrations", "tests", "e2e"])
  await walk(directory);
for (const file of [
  "package.json",
  "next.config.ts",
  ".github/workflows/ci.yml",
  ".env.example",
  "scripts/verify-recovery.mjs",
  "scripts/measure-web-performance.mjs",
  "qa/record-recovery.mjs",
  "qa/recovery.config.ts",
  "qa/recovery-audit.config.ts",
  "qa/recovery-closure.config.ts",
  "qa/recovery-closure.spec.ts",
])
  manifest.push({
    file,
    sha256: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  });
await mkdir("qa/evidence/recovery", { recursive: true });
await writeFile(
  "qa/evidence/recovery/source-inventory.json",
  JSON.stringify(
    {
      at: stamp,
      base_commit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      source_scope:
        "Current dirty worktree, including pre-existing user changes; no commit created",
      files: manifest,
      counts,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    report: "Sky_Petal_Local_Recovery_Report.md",
    counts,
    local_defects_closed: 13,
    open: ["SP-QA-013"],
    release: "NO-GO",
    evidence: latest,
  }),
);
