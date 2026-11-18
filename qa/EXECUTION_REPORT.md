# Independent QA execution — 1 November 2026 (Asia/Kolkata)

**Current recovery:** [Fresh local implementation and retests](../Sky_Petal_Local_Recovery_Report.md) supersede the historical snapshot statements below for the specified scope. Thirteen defect repros close locally; SP-QA-013 remains open. The project is incomplete and real sales remain NO-GO.

**Result: NO-GO for real orders.** Broad local regressions pass, but independent probes expose nine distinct behavior defects, plus an observed missing SEO capability. Essential provider/security/recovery gates remain unaccepted. This is fresh execution, not the October report's result.

## Environment and scope tested

- Dirty `master`, base commit `2217a83c2f0aa81b09a3f310a5732fd858cbf76f`. Existing uncommitted application work was preserved. [SHA-256 source inventory](evidence/fresh/source-inventory.json) identifies the working tree; [preservation comparison](evidence/preservation.json) proves application/original tests unchanged by this campaign.
- Windows; Node 24.16.0; installed Next 16.4.3, React 19.3.1, TypeScript 5.9.3, Playwright 1.64.1, axe 4.14.0, PGlite 0.3.16, pg 8.23.1. Exact installed versions differ from package range minimums.
- Disposable snapshot and databases described in [environment metadata](evidence/environment.json). Server `http://127.0.0.1:63172`, isolated PGlite, production build with local-only preview authentication. Generated role credentials remain in a temporary file, excluded from committed evidence. Server is stopped after collection; paths are retained for reproduction, not a promised running deployment.
- Fresh DB inventory: **45 tables, 164 constraints, 20 RLS policies, 92 indexes, 9 migrations, 47 trigger-event rows**. [Raw inventory](evidence/fresh/db-inventory.json). Presence alone is not acceptance of every constraint/policy. Clean initialize and existing retained-schema/checksum tests ran; managed migration/restore did not.
- No `.env` with real credentials was present/copied. The local server explicitly cleared managed DB, Razorpay, Supabase and Shiprocket variables. No production/shared-data mutation, charge/refund/payout, external message or courier booking occurred.
- Local browser projects use Edge/Chromium engine on desktop and iPhone viewport emulation. This is not physical iPhone/Safari, Firefox, WebKit or real-device certification.

## Execution scorecard

| Fresh layer | PASS | FAIL | SKIPPED | Scope / raw evidence |
|---|---:|---:|---:|---|
| Existing Node unit/domain/adapter tests | 97 | 0 | 2 | [tests.txt](evidence/fresh/tests.txt); 99 runner totals include parent tests. HTTP suites intentionally skip without TEST_BASE_URL. Provider contracts/signatures MOCKED |
| Existing HTTP customer/admin suites | 29 | 0 | 0 | [api.txt](evidence/fresh/api.txt); actual protected routes/server/DB; includes parent tests. Same suites run here rather than counted as passed in the skipped Node run |
| Additional HTTP role/security/business probes | 196 | 2 | 0 | [http-probes.json](evidence/fresh/http-probes.json), [raw output](evidence/fresh/http-probes.txt); 198 focused assertions, including 185 explicit role-route combinations |
| Additional DB/domain probes | 5 | 3 | 0 | [domain-probes.json](evidence/fresh/domain-probes.json), [raw output](evidence/fresh/domain.txt); final-SKU/refund/evidence/lease/RLS/restock |
| Entire existing browser suite | 26 | 0 | 0 | [browser.json](evidence/fresh/browser.json), [browser.txt](evidence/fresh/browser.txt), [HTML report](evidence/fresh/playwright-report/index.html); all seven spec files, desktop + mobile |
| Independent browser audit | 3 | 3 | 0 | [browser-audit.json](evidence/fresh/browser-audit.json), [raw output](evidence/fresh/browser-audit.txt); 3 failures represent 2 root defects (CMS twice, desktop contrast once) |
| Follow-up cart concurrency / keyboard focus | 0 | 2 | 0 | [cart-concurrency.json](evidence/fresh/cart-concurrency.json), [focus-check.json](evidence/fresh/focus-check.json); independently executed on this campaign's Edge/server |

Do not combine overlapping layers/parent tests into a requirement pass rate. These 10 failing focused assertions represent nine unique behavior defects. SP-QA-008 SEO is an additional source/HTTP finding, outside those asserted test totals. The full requirement-acceptance ledger deliberately remains **117 NOT RUN, 53 BLOCKED, 1 SKIPPED**; passing subsets do not accept the full 171 requirements. External campaign cases are listed individually in [RELEASE_READINESS.md](RELEASE_READINESS.md).

Additional QA scripts/results appeared elsewhere in `qa/evidence/` during execution. They are preserved and excluded from this campaign's totals; cross-browser/Lighthouse/other reports were not silently merged. The cart finding was independently rerun with Edge and reproduced. A separate keyboard focus assertion also reproduced failure. The initial plain Chromium follow-up launch was blocked because that browser executable was absent; Edge reruns reached the application. Exact executed QA script copies/hashes are pinned under `evidence/fresh/executed-sources/` because the root domain probe gained another case after this campaign had executed its eight-case version.

| Preflight/inspection | Actual result |
|---|---|
| Initial `npm.cmd run typecheck` | FAIL: existing QA `products` array implicit-any declaration; [original output](evidence/fresh/typecheck.txt) |
| Final `npm.cmd run typecheck` | PASS after QA-only type correction; [final output](evidence/fresh/typecheck-final.txt) |
| Default `npm.cmd run build` in copied tree | BLOCKED by Turbopack external node_modules junction/root resolution; [raw failure](evidence/fresh/build.txt). Normal in-place default build was not executed |
| `npm.cmd run build -- --webpack` | PASS, optimized production app plus type validation; [raw output](evidence/fresh/build-webpack.txt). This successful output served the HTTP/browser campaign |
| Lint | NOT RUN / FEATURE ABSENT: no lint script/config/CI lint gate. Typecheck does not substitute for lint |
| Fresh schema inventory | PASS after correcting the QA script's migration-column assumption; [final output](evidence/fresh/schema-retest.txt). Initial QA-script failure retained in schema.txt |
| Original source/test preservation | PASS, zero changed application/original test files; [comparison](evidence/preservation.json) |
| Remote CI/deployments | UNVERIFIED. Workflow source was inspected; no exact-revision remote success or branch enforcement retrieved |

## Fresh coverage by module

| Module | Fresh local proof | Remaining acceptance |
|---|---|---|
| Catalog/cart/auth | Existing HTTP + 8 store browser checks; exact SKU, bag/login gate, URL state, scoped accessibility | Selected-SKU sort FAIL; provider auth/concurrency/advanced discovery/scale open |
| Cart concurrency follow-up | Two-tab request barrier against actual guest cart API | FAIL: expected quantity 3, actual 2; both stale requests set quantity 2 |
| Addresses/order access | 4 commerce browser checks + address/domain/HTTP ownership/default/snapshot tests | Real geography/provider validation and target environment open |
| Permissions/privacy | 185 role-route checks PASS; guest/IDOR/origin/role forging/logout/session checks PASS | Consent:false FAIL; full managed/suspended/MFA/positive-mutation matrix open |
| Pricing/payment/inventory | Existing synthetic DB suites; QA-D01 final-SKU PASS; signature/replay/expiry/refund cap tests | Actual provider transactions, late-capture resolution, managed pooled races and invoices open |
| COD | 2 quoted COD browser checks PASS; verified-staff ledger limits | Completed payout evidence FAIL; actual courier/bank/secure destination workflows open |
| RMA/refunds/support | 2 RMA + 2 support browser checks PASS; domain caps/receipt/restock/privacy | Reverse pickup/exchange/upload/provider settlement/outbound communications open |
| Courier/jobs/notices | Mocked adapters/ingress/tracking safety pass | Duplicate semantic notice and stale-worker success summary FAIL; real courier/hosted recovery open |
| Homepage/CMS/motion | 4 editorial + 4 motion browser checks PASS; fallback also independently PASS | Three saved CMS fields FAIL rendering; flower dormant; fuller CMS absent |
| Reporting | QA-H09 all-record captured aggregate PASS with >100 historical orders | Refund/COD/net/settlement/cost/funnel/date reporting missing |
| Quality/operations | Source/schema/migration checks, limited axe/reflow and local timing | Contrast FAIL; no full manual WCAG/CWV/load/restore/target operations acceptance |

## Critical defects and requirement gaps

See [BUG_REPORT.md](BUG_REPORT.md) for severity, exact reproduction, DB/API observations and limits. P1: **SP-QA-003 completed COD payout evidence mutable through privileged SQL**. P2: CMS propagation, desktop catalog contrast, duplicate tracking notices, inaccurate worker success after lease loss, server newsletter consent, filtered price ordering, lost cart increments, failed keyboard focus return, and missing SEO capability. No P0 was observed; broad provider/target security coverage is incomplete.

All 171 audit IDs have requirement-specific acceptance specifications and source/API/table-family mappings in [REQUIREMENTS_TRACEABILITY_MATRIX.md](REQUIREMENTS_TRACEABILITY_MATRIX.md) and [MASTER_TEST_CASES.json](MASTER_TEST_CASES.json). These are an acceptance inventory plus focused executable probes, **not a claim that all action/boundary/device permutations have been automated**. All roadmap phase DoDs are preserved. Full direct API schemas, positive mutation role matrix and several manual/recovery cases remain test backlog.

The practical unfinished-module list is [MODULE_GAPS.md](MODULE_GAPS.md). Saved-address CRUD, COD ledgers, support and RMA/refund/courier code are now present. Old notes treating them as wholly missing are stale. Conversely, `F02` was corrected COVERED → PARTIAL: current home mounts only silk; procedural flower code and historical images do not prove a mounted feature. No other implementation row was promoted from test counts. The source roadmap is unchanged.

## Eight journeys and 17 gates

[RELEASE_READINESS.md](RELEASE_READINESS.md) records every journey/gate. J1/J2/J3/J4/J5/J7 are BLOCKED as complete target journeys despite passing local subsets; J6 combined catalog-editor/coupon/history journey is NOT RUN; J8 has a failing local subset and a blocked restore. None is claimed complete from mocked provider success. All 17 full target gates remain unaccepted; specific observed failures are identified separately.

## Security, accessibility, performance and SEO

Authorization evidence includes selected RLS checks, no browser mutation grants, private addresses/orders/wishlists/support, direct role denials and anonymous operations denial. Same-origin rejection, forged profile identity/role, password/session revocation and literal SQL-like search pass. No disruptive scanner or third-party exploit was used. Missing MFA, complete grants/permissions/abuse/upload/OAuth/privacy lifecycle acceptance remain explicit.

Independent axe scans covered `/`, `/shop`, `/products/the-petal-bralette`, `/cart`, `/account`, `/checkout`, `/contact` at 1440px and 320px with reduced motion. **Desktop `/shop` has one serious contrast rule affecting 18 label nodes**, one reported ratio 4.44:1 versus required 4.5:1. Other scanned routes/states had no serious/critical violations. This includes anonymous checkout/login-gate state, not authenticated filled checkout certification. No horizontal overflow was measured in these 14 page/viewport observations. Closed mobile filters do not certify the opened panel. [Desktop findings](evidence/fresh/axe-desktop.json), [320px findings](evidence/fresh/axe-mobile.json). Full manual WCAG 2.2 AA/screen-reader/zoom review remains NOT RUN.

The subsequent keyboard-specific assertion also FAILS: after Enter opens search and Escape removes the dialog, the trigger stays inactive for 3 seconds and focus is BODY. [focus-check.json](evidence/fresh/focus-check.json). A preliminary native Tab diagnostic showed no background application control receiving focus; BODY during tab traversal alone was not labeled a focus-trap defect.

The final local sequential `/api/catalog` timing sample had 30 measured requests after 3 warmups, concurrency 1; exact p50/p95 and all samples are in [http-observations.json](evidence/fresh/http-observations.json). Earlier observations varied with concurrent browser work. **This is not an agreed-load p95, field p75 LCP/INP/CLS, GPU/frame-rate, soak/load or 99.9% availability result.** Those targets remain UNVERIFIED.

Robots/sitemap requests return HTML, not appropriate documents; canonical and Product JSON-LD are absent on inspected PDP. Streamed Next pages include fallback boundary text even when a valid product renders; that substring is explicitly not used as a route verdict. SEO metadata/robots/source observations are recorded independently of status 200.

Visual inspection sampled the fresh mobile saved-address checkout and desktop reduced-motion/WebGL fallback captures. This is a limited review, not all-page design acceptance. Fresh screenshots live in `evidence/fresh/screenshots/` and `fallback-*.png`.

## Provider readiness

Razorpay: local synthetic captures/signatures and mocked refund contracts only; no sandbox receipt. Supabase: local auth tested, provider email/Google/reset blocked. Shiprocket: mocked serviceability/booking/tracking contracts and synthetic/manual browser evidence, no real booking. Messaging: in-app only, no outbound provider. Managed DB/storage, monitoring/hosted scheduler, remote CI, backups/restore and merchant/tax/legal onboarding are unverified. Required inputs/campaigns EXT01–EXT12 are in the release report; no secrets are requested in reports.

## Exact executed commands and evidence

Commands ran from the temporary application snapshot unless marked root. Each raw output is linked above. Environment values are recorded as paths/modes; secrets are never embedded.

```powershell
# Root: prepare snapshot and record hashes
node qa/harness.mjs prepare
# Snapshot: clear DATABASE_URL/TEST_BASE_URL for domain tests
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run build -- --webpack
npm.cmd run typecheck
node_modules/.bin/tsx.cmd scripts/prepare-acceptance.ts
node_modules/.bin/tsx.cmd qa/prepare-fixtures.ts
node_modules/.bin/tsx.cmd qa/domain-probes.ts
# Snapshot: explicit new temp DB/access file; local auth true; provider variables empty
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 63172
# Snapshot: TEST_BASE_URL points only at this server
node_modules/.bin/tsx.cmd qa/http-probes.ts
node_modules/.bin/tsx.cmd qa/normalize-baseline-fixture.ts
npm.cmd run test:api
node_modules/.bin/playwright.cmd test --reporter=list,json,html
node_modules/.bin/playwright.cmd test --config qa/playwright.config.ts --reporter=list,json
node_modules/.bin/tsx.cmd qa/schema-inventory.ts
npm.cmd run typecheck
node qa/cart-concurrency-edge.cjs
node qa/keyboard-probe-edge.cjs
node qa/focus-check.cjs
# Root: read-only observations and reports
node qa/http-observations.mjs
node qa/inventory.mjs
node qa/generate-traceability.mjs
node qa/harness.mjs verify
```

Preparation includes `DATABASE_DIR=<new OS-temp sky-petal-acceptance-* store>`, `TEST_OWNER_ACCESS_FILE=<temp access.json>`, `TEST_COMMERCE_FIXTURES=true`; server-only `ALLOW_LOCAL_AUTH=true`. JSON/HTML/evidence output variables point into the fresh campaign directory. An occupied initial port was avoided rather than terminating the existing service. The initial schema-inventory failure was a QA column-name assumption and was corrected/rerun; original raw failure is retained.

## Files created/changed and recommendation

Created strategy, execution/defect/release/module-gap reports, 171-row traceability, JSON acceptance/probe cases, actual route inventory, new browser/schema/observation/inventory/report scripts and fresh evidence. Corrected the existing QA HTTP probe's type and schema-valid unauthorized job-retry request; corrected fresh evidence link metadata without changing observations. Updated the existing implementation audit only with source/evidence-backed corrections and this campaign's evidence trail. Application features/original tests were preserved.

**NO-GO.** First repair P1 payout-evidence protection; finish essential invoice/payment/reverse-logistics/communications/security/recovery workflows; fix reproduced P2 regressions; execute provider sandbox, managed DB and restore campaigns; obtain merchant/operations approval. See the prioritized module index rather than rebuilding features that already pass locally.
## Independent local verification supplement

**Release recommendation: NO-GO.** This independent primary snapshot supplements the separate campaign above; their counts and environments are not silently merged. [Run summary](evidence/primary-run-summary.json), [primary environment](evidence/primary-environment.json), [case registry](MASTER_TEST_CASES.md), [source preservation](evidence/primary-preservation.json). All results below were executed during this QA session; they are not historical roadmap completion claims.

| Executed layer | Latest result | Evidence / scope |
|---|---|---|
| Original Node tests | 97 PASS, 2 SKIPPED | [rerun](evidence/baseline-unit-rerun.log), [per-case JSON](evidence/baseline-unit.json); includes parent tests. First unchanged run: 95 PASS, 2 FAIL, 2 SKIPPED from a random first-product fixture; [initial failure](evidence/baseline-unit.log) retained |
| Original HTTP tests | 29 PASS | [log](evidence/baseline-api.log); initial high-stock fixture invalidated the test's assumed 20-unit excess. Restored available stock 12 through owner API, then unchanged suite passed. [initial log](evidence/baseline-api-high-stock-initial.log) |
| All original browser specs | 26 PASS | [JSON](evidence/baseline-browser.json), [screenshots](evidence/primary-browser-screenshots/); desktop/mobile Chromium via Edge |
| Independent domain invariants | 6 PASS, 3 FAIL | [JSON](evidence/domain-probes.json); explicit last-SKU contention and post-purchase snapshot/archive pass; finance projection/semantic notice/lease statistics fail |
| Role/security/HTTP probes | 196 PASS, 2 FAIL /198 | [initial](evidence/http-probes.json), [valid-input role retest](evidence/http-role-retest.json). Seven initial job-retry cases returned 400 for malformed input; schema-valid ID now reaches guard and returns 403. No authorization bypass inferred |
| Chromium/WebKit, six viewport/engine configurations | Raw 11 PASS/15 FAIL; latest 13 PASS/13 FAIL | [raw JSON](evidence/cross-browser.json), [HTTPS WebKit retest 2 PASS](evidence/webkit-tls-retest.json). Six remaining failures are strict Tab/BODY-oracle limitations, not demonstrated background focus escapes. Six AA cases and one ignored CMS field genuinely fail |
| Two-tab cart / focused Escape | 2 FAIL | [cart](evidence/cart-concurrency.json), [keyboard](evidence/keyboard-diagnostic.json). Separate narrow no-background-control diagnostic PASS |
| Closed local backup/reopen | 1 PASS | [112 orders/108 payments/107 audit rows/9 migrations and captured-sum match](evidence/local-restore.json) |
| Restored application/session/privacy checks | 5 PASS, 1 FAIL | [JSON](evidence/restored-http.json): 105 orders readable; expired/forged/revoked cookies denied; requested owner role stays customer; duplicate registration 409; rate bound enforced; export omits persisted support ticket |
| Browser engine preflight | 2 PASS, 1 BLOCKED | [JSON](evidence/browser-preflight.json): Firefox crashes before any application page |
| Final TypeScript check | PASS | tsc --noEmit --incremental false, exit 0; [log](evidence/final-typecheck.log) |
| Default production build | PASS | [Turbopack build](evidence/build.log). Initial external-node_modules junction failed; copying exact installed dependencies inside the disposable snapshot resolved harness containment. Application/build config unchanged |

Independent registry: **408 latest case records: 379 PASS, 26 FAIL, 2 SKIPPED, 1 BLOCKED**. Totals include Node parent test rows, environment checks and six strict focus-oracle failures; they are not counts of independently completed features or unique bugs. Failed attempts remain preserved. Registration oracle initially expected 400, but the implementation correctly uses 409 Conflict; [initial JSON](evidence/restored-http-initial.json) retained, strict expected 409 retest passes. No application assertions were suppressed and no product fixes were made.

All 171 IDs have a separate full requirement disposition: **2 PASS, 46 FAIL, 17 BLOCKED, 105 NOT RUN, 1 SKIPPED**. The 46 include source-confirmed missing implementation and reproduced/budget failures; NOT RUN means full acceptance remains unexecuted even when local subset tests pass. Narrow B01/B06 document/build foundations are the two full PASS cases. Optional/V2 omissions are recorded without making them artificial first-sale blockers.

### Local performance observations

| Lighthouse navigation | Performance score | LCP | CLS | TBT |
|---|---:|---:|---:|---:|
| Homepage mobile | 68 | 6135 ms | 0.1054 | 266 ms |
| Shop mobile | 54 | 7781 ms | 0.00094 | 920 ms |
| PDP mobile | 57 | 4488 ms | 0.00026 | 1674 ms |
| Homepage desktop | 81 | 1191 ms | 0.2599 | 78 ms |

[Full Lighthouse outputs and environment](evidence/lighthouse-summary.json). Single simulated lab navigations on a shared Windows workstation; these miss investigative LCP <=2500ms / CLS <=0.1 budgets, but cannot establish real-user p75 or INP. TBT is not INP. Initial sandbox browser-debug connectivity failed; approved retry completed all four measurements. No production metrics claimed.

Bounded read workload: 220 loopback requests, concurrency 2-4, no errors. p95 catalog **52ms**, filtered catalog **53ms**, 105-order private history **2197ms**, admin **199ms**. [Raw samples](evidence/load.json). The order-history query misses the local investigative <500ms target; this is not agreed managed/staging capacity acceptance.

No horizontal overflow was found across eight routes in six configurations. Automated AA failures include visible-label/name mismatch, 4.44:1 filter contrast, and Escape focus-return. Chromium/WebKit mobile modes are emulation, not Android/iOS hardware certification; manual screen-reader, touch, zoom and complete WCAG criteria remain NOT RUN/BLOCKED.

### Scope and untouched application

Only QA automation/evidence/reports and the coverage audit changed. No storefront/admin pages, domain services, endpoints, migrations, assets, dependency manifests, original tests or roadmap were modified by this QA work; source-hash verification is PASS. Owned local servers were stopped after collection; other existing processes were left alone. Synthetic stores and private credentials remain in temporary storage for retest.

Audit classification corrections: F02 previously downgraded to PARTIAL for dormant bloom; **F09 COVERED -> PARTIAL**, **A07 MISSING -> PARTIAL** (existing weight/parcel fields), **O09 INTEGRATION -> PARTIAL** (missing multiple-shipment allocation). Other changed audit rows qualify evidence without promoting full readiness. Current totals: {"COVERED":48,"PARTIAL":71,"UNVERIFIED":11,"MISSING":30,"DEFERRED":1,"FOUNDATION":2,"INTEGRATION":8}. Merchant/provider approvals, real Razorpay methods/refund settlement, Google/reset/verification, courier labels/tracking/reverse operations, messaging, managed PG contention/RLS, staff MFA, production backup/RPO/RTO, incident/rollback and real-device/field performance remain blocked or incomplete. Next work is defect triage and first-sale missing workflows, followed by approved sandbox/managed-stage acceptance; none was implemented under this QA-only instruction.

<!-- LOCAL-RECOVERY-2026-11-01 -->
## Local implementation recovery campaign

2026-11-01T15:08:44.621Z. Application changes were authorized after the earlier QA-only campaign. [Report](../Sky_Petal_Local_Recovery_Report.md) and [exact command/timestamp manifest](../qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/commands.json) retain fresh evidence separately. Node 105 PASS/2 SKIPPED; existing HTTP 29 PASS; role/negative HTTP probes 198 PASS; desktop/mobile browser 34 PASS; QA browser 6 PASS; correction/export closure 4 PASS; domain probes 9 PASS. Typecheck/default in-place Turbopack build PASS. Do not add these overlapping/parent counts into a feature percentage.

105-order history p95 72ms, zero errors in the bounded local campaign. Latest Lighthouse mobile LCP still fails the 2500ms budget; four current CLS values are zero. [Reports and retained warnings](../qa/evidence/recovery/lighthouse-2026-11-01T14-48-07-427Z/summary.json). Initial migration-count and fixture-path harness failures and reused-owner login-rate failure remain in recovery evidence; the app rate limit was preserved and the final fresh-fixture campaign passed. A first Lighthouse launcher connection failure was resolved using a Playwright-launched local CDP session; the failure remains retained. No actual staging/provider/live operation occurred.

Thirteen recorded defects close locally; SP-QA-013 stays open. Full product implementation is incomplete and real sales remain NO-GO.
