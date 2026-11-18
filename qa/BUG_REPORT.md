# Sky Petal defect register — 1 November 2026

**Current recovery:** [Fresh local implementation and retests](../Sky_Petal_Local_Recovery_Report.md) supersede the historical snapshot statements below for the specified scope. Thirteen defect repros close locally; SP-QA-013 remains open. The project is incomplete and real sales remain NO-GO.

Build: dirty `master` based on `2217a83c2f0aa81b09a3f310a5732fd858cbf76f`; exact source hashes in [source inventory](evidence/fresh/source-inventory.json). All findings use synthetic isolated local data. No product fixes were made; all defects remain OPEN. Owners below are suggested teams, not assigned individuals. P0: none observed; this is not proof that none exist.

## SP-QA-003 — completed COD payout evidence can be replaced

**P1 High; Q07/A12/O18, phases 2/9/11, gates 2/11/13.** Owner: backend/finance. Reproducible in the fresh QA-D03 run.

Preconditions: delivered synthetic COD order, verified collection, refund request, different authorized approver, completed manual payout evidence. Run `tsx qa/domain-probes.ts`. QA-D03 completes the payout with `QA-PAYOUT-ORIGINAL`, then executes `UPDATE refunds SET evidence_ref=$1 WHERE id=$2` using `QA-PAYOUT-REPLACED`. Expected: immutable completed evidence rejects the write or requires a separate audited corrective entry. Actual: ordinary SQL UPDATE succeeds; selected evidence is `QA-PAYOUT-REPLACED` (`rejected:false`).

[Exact DB result](evidence/fresh/domain-probes.json), QA-D03. `migrations/008_returns_refunds_jobs.sql` protects some refund identity/history but not this completed evidence field. Blast radius: financial reconciliation and historical payout proof. **Boundary:** requires a privileged DB/server writer; no customer-facing exploit or public refund-update API was demonstrated. Workaround: restrict DB writers and reconcile against independent append-only bank records; this does not repair the missing database guard. Retest: FAIL, fix pending.

## SP-QA-001 — homepage CMS saves fields that never render

**P2 Medium; F11, phase 4/12, gate 14.** Owner: storefront/CMS. Reproduced on desktop and mobile; historical audit gap freshly confirmed.

Log in as the disposable owner; GET `/api/home` and retain original content. POST `/api/admin/cms` with unique `eyebrow`, `description`, `story`, `storyBody` values. Reload `/`, inspect rendered `<main>`, then restore original CMS content. Expected: each supported editable field changes its displayed content. Actual: `storyBody:true`, other three fields false, despite successful save and persisted API response. No financial state changes.

[Desktop result](evidence/fresh/cms-desktop.json), [mobile result](evidence/fresh/cms-mobile.json), [browser failure details](evidence/fresh/browser-audit.txt). Automation: QA-B02 in `qa/browser-audit.spec.ts`. Workaround: update source-managed copy or stop exposing unsupported fields until wired. Retest: FAIL both projects.

## SP-QA-002 — catalog filter text fails AA contrast

**P2 Medium; Q19/C07, phases 5/14, gate 15.** Owner: frontend/accessibility. Reproduced in desktop QA-B01.

At 1440×1000, open `/shop`, use the default desktop filter sidebar, run axe WCAG AA tags. Expected: normal small label text reaches 4.5:1. Actual: axe serious `color-contrast`, including `#807269` on `#fff9f6`, ratio **4.44:1**, 10px text. Eighteen affected label nodes are recorded. This value applies to the reported node, not every label on every device.

[Selectors and failures](evidence/fresh/axe-desktop.json), [browser output](evidence/fresh/browser-audit.txt). DB unchanged. The independent 320px closed-filter scan passed; the mobile expanded filter panel was not audited here. Workaround: none accepted; fix foreground/background tokens and retest all filter states. Retest: FAIL desktop.

## SP-QA-004 — repeated tracking state creates duplicate notices

**P2 Medium; O07/O10/Q13, phases 9/10, gates 10/12.** Owner: fulfillment/notifications. Reproducible QA-D04.

Create a synthetic processing prepaid order and booking with AWB `QA-SEMANTIC-AWB`. Apply an IN TRANSIT event with the same AWB, provider order, state and timestamp twice, adding a historical scan only in the second envelope. Expected: retain extra scan evidence but notify the customer once for the same state/time. Actual: two `account_notifications` rows titled `Courier update`.

[Exact count](evidence/fresh/domain-probes.json), QA-D04; `src/lib/fulfillment.ts` uses `tracking:${eventId}` as the notification identity. Synthetic events only; actual Shiprocket redelivery was not exercised. Workaround: operators should not repeatedly replay semantically identical updates; permanent solution needs a defined notification deduplication identity. Retest: FAIL; no external messages sent.

## SP-QA-005 — worker reports success after losing its lease

**P2 Medium; P17/Q13/A13, phase 9/14, gates 10/16.** Owner: backend/platform. Reproducible QA-D05.

Enqueue one isolated job. Inside the handler, simulate another worker taking ownership by changing its lease token to `new-owner`. Let the original worker complete. Expected: its fenced update affects zero rows and `succeeded` remains 0. Actual: `runJobs` returns `{succeeded:1,failed:0,deferred:0}` while the persistent row remains `running` with `new-owner`.

[Exact state/summary](evidence/fresh/domain-probes.json), QA-D05; `src/lib/jobs.ts`. The row fence **does protect persistent state** in this test; duplicate provider execution was not demonstrated. Blast radius: misleading maintenance success/reporting. Workaround: inspect persistent job status rather than success count. Retest: FAIL.

## SP-QA-006 — newsletter API accepts explicit refusal of consent

**P2 Medium; M06/M07/U12, phases 6/12/13, gate 1/14.** Owner: backend/privacy/marketing. Fresh reproduction of historical gap.

As a guest POST `/api/newsletter` with unique synthetic `email` and `consent:false`. Expected: reject the request and create no subscription. Actual: HTTP 200 with subscription confirmation. Schema/source records only email/time; server neither requires nor retains consent/version. The successful HTTP result alone does not certify provider delivery; no provider exists in this run.

[Response](evidence/fresh/http-probes.json), QA-H06. Automation: `qa/http-probes.ts`. Workaround: keep marketing disabled and do not use this table as evidence of consent. Retest: FAIL. Actual DB insertion is supported by the inspected handler; no post-response direct DB query was performed for this probe.

## SP-QA-007 — price sort ignores the selected variant

**P2 Medium; C10/C07, phase 5, gate 4.** Owner: catalog/backend. Fresh reproduction of historical audit concern.

Owner creates product A (XS=100 paise, XXL=10000) and B (XS=500, XXL=5000), both in color `QA sort color`, stock 5. GET `/api/catalog?size=XXL&color=QA%20sort%20color&sort=price-asc`. Expected: B then A. Actual: A then B; sorting uses each product's cheapest variant across all sizes. Persistent fixture SKU prices were created through the real protected API. No checkout money calculation failure was observed.

[Expected/actual IDs](evidence/fresh/http-probes.json), QA-H12. Automation: `qa/http-probes.ts`. Workaround: do not rely on filtered price sort; manually inspect selected SKU prices. Cleanup: fixtures confined to temporary store. Retest: FAIL.

## SP-QA-008 — expected SEO documents/data absent

**P2 Medium; Q22, phases 5/14.** Owner: frontend/SEO. Source and read-only HTTP observation; not counted in the automated assertion scorecard.

GET `/robots.txt` and `/sitemap.xml`: both return **200 `text/html`**, not valid robots text/sitemap XML. No corresponding metadata routes exist. Inspect `/products/the-petal-bralette`: canonical link and Product JSON-LD are absent. Expected: suitable crawl directives, sitemap, canonical and truthful structured product data.

[Raw observations](evidence/fresh/http-observations.json), [source inventory](evidence/fresh/source-inventory.json). Note: a Next.js streamed page can include not-found boundary markup even for a valid PDP; this report uses document content type/source absence, not that substring, as evidence. Workaround: none accepted. No DB changes. Retest: NOT RUN after fix; implementation absent.

## SP-QA-009 — two-tab Add to bag loses an increment

**P2 Medium; U17/U18/U19, phase 7.** Owner: storefront/cart. Independently rerun against this campaign's isolated server in Edge after discovering a newer workspace probe.

Set one guest cart/SKU to quantity 1, with at least three units available. Open the PDP in two tabs sharing the cookie and select the same M/Petal Rose SKU. Click Add to bag once in each tab, using a request barrier to submit both POSTs together. Expected final quantity: 3. Actual: **2**; both clients send absolute quantity 2 derived from stale client state. API re-read confirms the lost increment. This is a bag consistency failure, not demonstrated overselling or a charge error.

[Exact result](evidence/fresh/cart-concurrency.json), [raw Edge run](evidence/fresh/cart-concurrency-edge.txt). Automation: `qa/cart-concurrency.cjs`, executed snapshot copy with `channel:'msedge'`; pinned source in `evidence/fresh/executed-sources/`. Cleanup: guest cookie/data confined to temporary store. Workaround: refresh the bag and verify quantity when shopping across tabs. Retest: FAIL. A plain bundled-Chromium launch was initially blocked by a missing browser executable; Edge reached and reproduced the product failure.

## SP-QA-010 — keyboard search dialog does not restore trigger focus

**P2 Medium; F09/Q19, phases 4/14, gate 15.** Owner: frontend/accessibility.

On `/shop`, keyboard-focus Search products, press Enter, confirm dialog visible, press Escape, and wait for the dialog to disappear. Expected: focus returns to the Search products trigger. Actual: the trigger remains inactive for the full 3-second assertion; `document.activeElement` is BODY. This is distinct from a tab-loop focus escape: the preliminary tab diagnostic did not demonstrate focus on background application controls.

[Assertion and actual focus](evidence/fresh/focus-check.json), [raw output](evidence/fresh/focus-check.txt). Automation: `qa/focus-check.cjs`, Edge. DB unchanged. Workaround: keyboard users must relocate the trigger; this is not accepted accessibility closure. Retest: FAIL.

## Test infrastructure issues, separate from product defects

- Initial `npm run typecheck` failed in pre-existing `qa/http-probes.ts` because `products` was implicitly `any[]`. Added `string[]`; final typecheck passed. Application code unchanged.
- Default copied-tree build failed resolving the external node_modules junction under Turbopack. `npm run build -- --webpack` passed. Normal in-place default build remains unverified by this run.
- QA schema inventory initially assumed `schema_migrations.version`; actual column is `name`. Removed that assumption; 45-table inventory passed. No application migration defect.
- Initial port 4321 was occupied; a free loopback port was allocated. No existing server was stopped or mutated.
- Unauthorized job-retry probes now use a schema-valid nonexistent ID, so the 403 assertion actually reaches the role guard. This strengthens the test; malformed empty JSON alone cannot distinguish schema validation from authorization.
## Independent local verification supplement

The prior ten findings remain open. Primary-run independent evidence corroborates SP-QA-001/002/003/004/005/006/007/009/010. No application fixes or closed retests are claimed. The following additional findings use new IDs.

### SP-QA-011 - visible labels do not match accessible names

**P2 Medium; storefront/accessibility; F09/Q19; local production snapshot, Chromium/WebKit six configurations.** Reproduce by opening each of /, /shop, PDP, /cart, /account, checkout entry, /wishlist and /contact, then run axe with WCAG A/AA including wcag21a tags. Expected visible text included in the computed accessible name. Actual serious label-content-name-mismatch on brand links and the motion control; for example visible Pause page motion differs from accessible Pause ambient motion. [Decoded all-engine node evidence](evidence/axe-all-engines.json), [raw assertions/screenshots](evidence/cross-browser.json); QA-B02 in six configurations. DB unchanged. Impact: voice-control/assistive navigation mismatch. No accepted workaround; update labels in a later authorized fix. **Retest: FAIL/open; no product change.** This is separate from SP-QA-002 contrast.

### SP-QA-012 - privacy export omits a persisted support ticket

**P2 Medium; privacy/support; U13/O21/Q12; restored disposable production snapshot.** Register a synthetic customer, POST a private support ticket, GET it successfully, then POST /api/privacy with kind export. Expected export includes the owned stored support data (or a complete documented export route). Actual 200 export has only profile/addresses/orders and excludes the just-reread ticket ID. [QA-O06 actual backend results](evidence/restored-http.json), automation qa/restored-auth.ts. Impact: incomplete personal-data inventory/export; no legal compliance certification asserted. Workaround: manual controlled compilation pending implementation. **Retest: FAIL/open.** No data leak to another user was demonstrated.

### SP-QA-013 - local Lighthouse LCP/CLS budgets are missed

**P2 Medium; performance; Q20; Windows local production snapshot, Lighthouse simulated mobile/desktop.** Run Lighthouse performance navigation for home/shop/PDP mobile and home desktop using a fresh browser profile/default simulated mobile and desktop preset. Expected investigative LCP <=2500ms and CLS <=0.1. Actual mobile LCP 6135/7781/4488ms; homepage CLS 0.1054 mobile and 0.2599 desktop. [Summary/environment](evidence/lighthouse-summary.json); full per-page JSON adjacent. Impact: slow/unstable browsing in this lab. No data mutation. No production p75, real-device INP or repeatability beyond these samples is claimed; confirm on agreed staging devices/load. **Local budget retest: FAIL/open; target-environment acceptance BLOCKED.**

### SP-QA-014 - 105-order history exceeds local API latency target

**P2 Medium; account/backend performance; O01/Q20/Q21; loopback production snapshot/PGlite.** Seed 105 immutable synthetic captured orders for one customer; sign in; warm up, then request /api/orders 20 times at concurrency two. Expected investigative p95 <500ms with zero errors. Actual p50 1021ms, p95 2197ms, maximum 2600ms, zero HTTP errors, mean response 206431 bytes. [QA-P03 samples](evidence/load.json), qa/performance.ts. Same-run public catalog/search/admin p95 52/53/199ms. Source order assembly performs per-order lookups; this is an investigation lead, not an isolated causal benchmark. Impact: slow private history as orders accumulate. No incorrect totals or loss shown. Workaround: none accepted; investigate query batching/pagination under separately authorized implementation. **Local retest: FAIL/open; managed-stage capacity acceptance BLOCKED.**

### Independent test environment/oracle issues (not product defects)

- Original final-unit fixture sometimes chooses the one-variant wellness product and dereferences an absent second variant: first unchanged suite 95 PASS/2 FAIL/2 SKIPPED, rerun 97 PASS/2 SKIPPED. Explicit-SKU independent contention passes. Retain this test reliability issue; no fixture fix was made.
- First original HTTP run assumed 20 units exceeded stock, while volume fixtures had 895 available. Corrected disposable stock to 12 via owner API before unchanged 29-case rerun. No product overstock defect inferred.
- Seven retry authorization probes used malformed empty bodies and got valid 400 input errors. Schema-valid denied-role retest returns 403 in all seven; no authorization bypass proven.
- Firefox crashes opening a blank page despite installed binaries: BLOCKED environment, not application failure. WebKit HTTP ignores production Secure guest cookie; both cart cases PASS using local HTTPS. Raw failures retained.
- Six strict native-dialog Tab assertions count BODY as escaped application focus. The diagnostic finds zero background application controls; those six raw FAILs are not a proven trap defect. Explicitly focused input + Escape still reproduces SP-QA-010.
- Duplicate registration correctly returns 409. Initial test expected 400; evidence retained and strict implemented-409 assertion passes. This is an oracle correction, not a product fix.
- Initial default build failed resolving external dependency junction. Exact dependency copy inside snapshot permits the default Turbopack production build; source/config unchanged. Initial sandbox Lighthouse connection failed; approved retry completed four reports.

<!-- LOCAL-RECOVERY-2026-11-01 -->
## Local recovery retest — current dispositions

Recorded 2026-11-01T15:08:44.621Z. Original descriptions and FAIL evidence above remain historical. The table below supersedes their OPEN statements only for the tested local scope. No production/provider acceptance is inferred.

| Defect | Current local disposition | Evidence scope |
|---|---|---|
| SP-QA-001: CMS eyebrow, description and story render | CLOSED after local retest | QA-B02 desktop/mobile; existing storyBody preserved |
| SP-QA-002: Filter contrast | CLOSED after local retest | Automated AA desktop plus expanded/closed mobile panel |
| SP-QA-003: Completed COD evidence integrity | CLOSED after local retest | QA-D03 rejects the original direct UPDATE; non-owner application writer denied; additive legacy migration, independent correction approvals and competing approvals tested |
| SP-QA-004: Semantic tracking notices | CLOSED after local retest | QA-D04: equivalent booking/status/normalized-time envelopes notify once; raw scan-event history retained |
| SP-QA-005: Lost worker lease accounting | CLOSED after local retest | QA-D05 plus success/failure/defer/expired-lease regressions; zero-row fenced writes contribute zero counters |
| SP-QA-006: Consent refusal | CLOSED after local retest | QA-H06 plus direct DB assertions: missing/false consent creates no row; version/source/time/event retained for explicit consent; tokenized unsubscribe works |
| SP-QA-007: Filtered SKU price sort | CLOSED after local retest | QA-H12 and ascending/descending XXL fixture B/A regression |
| SP-QA-008: SEO documents and metadata | CLOSED after local retest | HTTP text/plain robots and XML sitemap; product canonical/real SKU JSON-LD; direct production sitemap tests exclude private/unpublished content; default staging noindex |
| SP-QA-009: Two-tab bag increment | CLOSED after local retest | Browser request barrier: 1 + two Add-to-bag clicks = 3, both viewports; explicit set/remove and stock/cap negatives retained |
| SP-QA-010: Search focus return | CLOSED after local retest | Keyboard Escape restores Search products trigger, both viewports; native dialog focus stays inside application dialog controls |
| SP-QA-011: Visible/accessibility label agreement | CLOSED after local retest | Brand link uses visible text; motion controls have matching visible names; wcag21a included in recovery scan |
| SP-QA-012: Support data in export | CLOSED after local retest | HTTP persist/read/export test and domain customer-boundary test include owned support messages, exclude staff notes, other customers and credentials |
| SP-QA-014: Long-order-history latency | CLOSED after local retest | 105-order API local p95 72 ms, zero errors; 105-order line/event/ownership regression passes; managed capacity is still unverified |
| SP-QA-013: mobile LCP | OPEN | Latest simulated mobile LCP remains above 2500 ms. CLS is 0 in the latest four samples; this does not close LCP or certify target devices. |

[Complete recovery report](../Sky_Petal_Local_Recovery_Report.md), [exact commands](../qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/commands.json), [before domain repro](evidence/recovery/before/domain-probes.json), [after domain retest](evidence/recovery/after/domain-probes.json). Mobile LCP is still OPEN; all 17 full release gates remain unaccepted.
