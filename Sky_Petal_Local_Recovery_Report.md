# Local implementation recovery — updated 10 November 2026

**Scope: local implementation and synthetic verification only. Provider and
managed staging environments are unavailable, as confirmed by the user. Real
customer orders remain NO-GO. This update does not claim every roadmap issue is
resolved.**

## Additional local completion — 10 November 2026

The requested invoice, exchange, staff-MFA and privacy-deletion implementation
gaps now have working local workflows. This is not external/provider acceptance
or an all-issues launch sign-off. See the
[implementation and operations contract](docs/COMPLETION_OPERATIONS.md).

- **Invoices:** configured issuer/approval reference, immutable order/tax/buyer
  snapshots, atomic India-financial-year numbering, customer-owned PDF/JSON and
  separate completed-refund credit notes. Partial/mixed-tax credits use original
  item/charge allocations and cumulative paise rounding; unscoped partial credits
  require explicit finance allocation. Duplicate/concurrent issuance and ordinary
  document mutation are guarded. Actual merchant configuration has not been
  fabricated; the approved repository file still needs to be identified.
- **Exchanges:** link one owned new replacement order to an inspected/completed
  RMA. Exact size/colour, payment and stock reservation use ordinary checkout;
  linking does not move stock again. Original refunds remain independently
  approved/bounded and are not withheld for an unavailable or failed replacement.
  The customer sees replacement charges, original refund and net cost. This uses
  full replacement checkout plus original refund, not direct net-difference
  payment collection. Real reverse pickup/refund settlement remains unverified.
- **Staff MFA:** encrypted TOTP enrollment, RFC vectors, replay rejection,
  per-account attempt limits, ten single-use hashed recovery codes, session-bound
  proofs and recent verification for financial/privacy/configuration/replay
  actions. Production mandates staff enrollment. Local-password enrollment needs
  the current password; provider-only enrollment needs a fresh primary proof
  bound to that exact store session. Actual Supabase/key-recovery acceptance is
  still unavailable.
- **Deletion:** owned request/status and reviewed retention-policy snapshot;
  account minimization, session revocation and marketing suppression; holds on
  open obligations; maintenance/staff processing after expiry; narrowly scoped
  personal-field erasure without changing money/state/stock identities. Support,
  consent, invoice buyer, courier and completed/dead job payloads are covered.
  Late courier replay cannot restore erased location data. External identity,
  provider and backup deletion is explicitly pending.
- **Readiness:** protected Studio/CLI configuration checks identify missing
  prerequisites and unenrolled staff. All twelve external campaigns stay
  UNVERIFIED; configured keys never imply provider success or GO.
- **Performance:** prepared responsive photography avoids on-demand optimization
  for known assets, and production inline CSS removes a stylesheet round trip.
  The latter is a documented experimental Next option with repeated-CSS/cache
  tradeoffs. Brand font swap behavior is retained. Mobile LCP still has not met
  the 2500 ms target; earlier and new experiments remain recorded.

Migrations 014–021 are additive; existing applied migrations were not replaced.
Testing uses new OS-temp stores and synthetic rates, identities and provider
responses. No actual customer deletion, external payout or deployment was run.

## Latest verification — 10 November, 22:22 IST

The final full run completed at 2026-11-10T16:52:26.468Z with **exit code 0**.
All 13 recorded commands passed against a new isolated production server/store.
Provider settings were disabled. Credentials remained in OS temporary storage.

| Layer | Result | Evidence |
|---|---|---|
| Domain/Node suite | 126 PASS, 2 HTTP entry tests SKIPPED in this layer, 0 FAIL; includes parent rows | [Node results](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/node-tests-final.txt) |
| Typecheck, responsive assets and production build | PASS | [Command manifest](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/commands.json) |
| HTTP customer/admin suite | 29 PASS | [HTTP results](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/api-tests.txt) |
| Role/ownership/negative HTTP probes | 274 PASS; expanded invoice/privacy/readiness/exchange permissions | [Probes](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/http-probes.json) |
| Desktop/mobile browser flows | 38 PASS, 0 flaky; includes MFA enrollment/recovery/new-session denial, private PDF access and local deletion | [Browser results](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/browser.json) |
| Focused accessibility/CMS/fallback checks | 6 PASS | [QA results](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/audit.json) |
| Existing finance correction/privacy export closure | 4 PASS | [Closure results](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/closure.json) |
| Bounded HTTP latency | Zero errors; owned long-order history p95 153 ms | [Samples](qa/evidence/recovery/run-2026-11-10T16-45-07-212Z/load.json) |

Counts are separate test layers, not a feature-completion percentage. The runner
restored pre-existing screenshots and stopped its own server. The ordinary app
also returned 200 for `/`, `/shop`, `/api/me` and `/api/catalog` on port 4317 after
the latest migrations were reloaded. No real customer data was reset.

The new domain cases cover exact RFC vectors, encrypted seeds, single-use
recovery, per-session/provider-login proofs, stale financial verification,
concurrent document issuance, wrong-customer PDF access, mixed-tax partial
credits, exchange ownership/idempotency/stock invariants, retention holds and
scoped erasure including courier/job replay. These are local contract results;
actual provider outcomes remain unverified.

### Latest mobile performance — target still unmet

The final measurement uses the same simulated Lighthouse protocol and production
build as the completed workflows. No easier throttling profile was substituted.

| Navigation | Score | LCP ms | CLS | TBT ms |
|---|---:|---:|---:|---:|
| home-mobile | 77 | 4043 | 0.0000 | 390 |
| shop-mobile | 82 | 3814 | 0.0025 | 302 |
| pdp-mobile | 80 | 3946 | 0.0002 | 338 |
| home-desktop | 100 | 800 | 0.0003 | 6 |

[Final raw reports and commands](qa/evidence/recovery/lighthouse-2026-11-10T16-53-49-945Z/summary.json).
Each row is one navigation; home/shop CPU-calibration warnings are retained.
Earlier experiments vary substantially, so these samples do not establish a
causal speedup or field p75/INP. **SP-QA-013 remains OPEN:** all three mobile
samples exceed 2500 ms. Configuration/readiness checks likewise do not complete
provider or staging acceptance while those environments are unavailable.

## Earlier recovery changes — 10 November

- **R3 payment-attempt lifecycle:** migrations 012/013 retain one immutable
  checkout intent before the provider request, its original receipt, bounded
  reconciliation checks and advisory browser events. Lost create responses use
  receipt lookup instead of issuing another create request. Provider identity,
  amount and currency must match. Network requests run outside database
  transactions.
- **Payment evidence:** signed authorization/failure observations cannot mark an
  order paid. Empty/failed-only reads and transient errors retain an earlier
  verified authorization. Capture callbacks, webhooks and polling use the same
  replay-safe inbox; stale leases cannot acknowledge another worker's work.
  Capture after stock release remains a visible financial exception and never
  consumes released stock or invents a completed refund.
- **Recovery experience:** Studio Payments lists attempts and allows audited
  owner/administrator reconciliation requests. Customer orders explain uncertain
  outcomes. Owned exports include explicitly projected attempts, observations
  and browser reports. Unresolved financial attempts conservatively block new
  checkout for that customer; ordinary unpaid expiry can stop polling without a
  permanent financial hold.
- **Maintenance:** a non-overlapping HTTP worker invokes the running app's
  maintenance endpoint without opening a second PGlite process. It has bounded
  polling, timeout, HTTPS/loopback restrictions and redacted logs. Hosted uptime,
  supervision and actual provider outcomes remain unverified. See the
  [payment recovery contract](docs/PAYMENT_RECOVERY.md).
- **Initial rendering:** removed the root loading boundary and catalog suspense
  dependency that hid shopping content until JavaScript ran. Home, catalog and
  product detail now have regression coverage with JavaScript disabled. Critical
  imagery is preloaded/eager; secondary images have responsive dimensions.
  Initial storefront code no longer loads Motion for reveal wrappers, dialogs
  or product cards. Optional GSAP loads after leaving the hero; the silk canvas,
  pause control and reduced-motion/WebGL fallbacks remain.
- **Fonts:** the same brand families use variable local normal fonts and the
  existing italic face. Mobile loading is still over budget; font/image changes
  are not treated as closure of SP-QA-013.
- **Production media regression:** newly uploaded images were returning 404
  because they did not exist when the production server started. An allowlisted
  WebP handler preserves existing `/images/product-<uuid>.webp` URLs and serves
  runtime-created files with explicit content type. The HTTP test fetches and
  reads the uploaded response immediately and rejects invalid filenames.

## Earlier verification — 10 November, 15:29 UTC

`npm.cmd run test:recovery` finished with **exit code 0** at
2026-11-10T15:29:00.109Z. It built and exercised a new isolated production server
and synthetic PGlite store, with provider credentials disabled.

| Layer | Result | Evidence |
|---|---|---|
| Node/domain tests | 116 PASS, 2 SKIPPED HTTP entry tests; 0 FAIL, includes parent rows | [Node results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/node-tests-final.txt) |
| Typecheck and production build | PASS | [Command manifest](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/commands.json) |
| HTTP customer/admin tests | 29 PASS, including runtime media fetch and payment-operation roles | [HTTP results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/api-tests.txt) |
| HTTP role/ownership/negative probes | 198 PASS | [Probe results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/http-probes.json) |
| Desktop/mobile browser suite | 36 PASS, including initial HTML without JavaScript, URL filters, silk/pause/reduced motion and WebGL fallback | [Browser results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/browser.json) |
| Focused accessibility/CMS/fallback browser checks | 6 PASS | [QA results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/audit.json) |
| Finance correction/privacy export closure | 4 PASS | [Closure results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/closure.json) |
| Bounded local HTTP samples | Zero errors; orders p95 147 ms, 20 requests/concurrency 2 | [Latency results](qa/evidence/recovery/run-2026-11-10T15-22-24-722Z/load.json) |

These are separate, overlapping test layers, not a feature completion rate. The
runner restored pre-existing screenshots and stopped its own isolated server.
The development frontend and backend remain reachable on port 4317; `/`, `/shop`,
`/api/me` and `/api/catalog` returned 200 in the local availability check.

Earlier failures remain recorded: the
[first rendering run](qa/evidence/recovery/run-2026-11-10T14-58-26-069Z/commands.json)
exposed the JavaScript-dependent loading boundary; a
[later HTTP run](qa/evidence/recovery/run-2026-11-10T15-15-31-390Z/api-tests.txt)
exposed the runtime media 404. The final successful run includes their fixes and
retains the assertions.

### SP-QA-013 — still OPEN

Earlier Lighthouse samples, before the additional completion increment:

| Navigation | Score | LCP ms | CLS | TBT ms |
|---|---:|---:|---:|---:|
| home-mobile | 71 | 4400 | 0.0000 | 496 |
| shop-mobile | 81 | 3874 | 0.0000 | 325 |
| pdp-mobile | 73 | 3602 | 0.0000 | 700 |
| home-desktop | 99 | 842 | 0.0003 | 81 |

[Raw Lighthouse reports and commands](qa/evidence/recovery/lighthouse-2026-11-10T15-11-08-067Z/summary.json).
Each row is one simulated navigation. CPU-calibration warnings are retained;
workstation variation prevents a causal speedup claim. All three mobile samples
exceed the 2500 ms target. These are not field p75, INP, physical-device or managed
capacity acceptance. The subsequent final code changes addressed payment-state
fencing and runtime product media; they do not constitute new Lighthouse proof.

## Remaining work: distinguish implementation from external verification

The 13 previously closed named defects retain their historical evidence below.
SP-QA-013 is **OPEN**. The larger roadmap was not already complete: these are
remaining implementation tasks as well as external acceptance dependencies.

| Workstream | Local work still unfinished | External acceptance unavailable |
|---|---|---|
| R3 finance | Resolution of late-capture exceptions and complete settlement/refund comparison | Razorpay test outcomes, actual settlement/bank reconciliation, managed races |
| R4 invoices | Local issuer configuration, immutable issuance/credit allocation and private PDFs are implemented; merchant validation and multilingual font expansion if required remain | Identify/configure the approved seller/tax/policy source; actual accountant acceptance |
| R5 shipping | Complete NDR/RTO/reverse and operational exception workflows | Contracted courier rate/booking/AWB/pickup/negative-path tests |
| R6 returns/exchanges | Local replacement checkout/linking and independent bounded original refunds are implemented; proof uploads, direct net-difference checkout and remaining broader return operations are unfinished | Actual reverse pickup, settled provider refund, merchant exchange policy and COD payout evidence |
| R7 identity | Local MFA/recovery/session step-up is implemented; broader staff invitation/suspension administration remains | Supabase journeys, managed key recovery and least-privilege runtime/RLS acceptance |
| R8 privacy/customer care | Local reviewed retention/erasure is implemented; broader access-log and delivery/bounce workflows remain | Identify/configure approved retention/contact policy; external identity/provider/backup erasure and delivered messages |
| R9 catalog/CMS/reporting | Remaining category/collection/fit tooling, draft/scheduled publishing, promotion and reconciled reporting scope | Merchant scope/definitions and complete editor acceptance |
| R10 operations/performance | Mobile LCP target; remaining hardening and operational instrumentation | Hosted scheduler, remote CI, restore/rollback drill, managed load and target-device evidence |

EXT01–EXT12 and the 17 release gates retain their prior disposition. No live
charge, refund, outbound message, courier dispatch or deployment was performed.
Local image storage still needs durable managed storage/backup acceptance.

## Historical evidence — 1 November 2026

Recorded 2026-11-01T15:08:44.621Z; user-facing date Asia/Kolkata. **The project is not 100% complete; real orders remain NO-GO.** The user explicitly selected continued local implementation because staging access is not ready. This increment closes 13 of the 14 recorded defect repros locally; SP-QA-013 remains open. Broad roadmap implementation and external acceptance are still incomplete.

## Implementation

- R1; original phases 2/9/11; Q07/A12/O18: migration 010 freezes completed refunds and adds immutable correction requests plus separate approvals, database role/separation checks and stale-approval fencing. Finance API and Studio Refunds UI expose the complete request/review trail without sending another payout or overwriting the original.
- R2; original phases 4–7/9/10/12/14: explicit server consent, consent version/source/time/events, legacy suppression and unsubscribe (U12/M06/M07); transactional cart deltas (U17–U19); semantic scan notice identity (O07/O10/Q13); fenced worker counters (P17/A13); matching-SKU sort (C07/C10); CMS publication (F11); contrast/focus/labels (F09/Q19); robots/sitemap/canonical/escaped truthful Product data (Q22).
- R8 local privacy subset: explicit customer export inventory covers support, orders/items/events/payments, returns/refunds, saved addresses, cart/wishlist/reviews, notifications, requests and newsletter consent. Internal notes, secrets and bank references are excluded; cross-customer assertions pass (U13/O21/Q12). Deletion fulfillment and formal retention operations remain unfinished.
- R10 performance subset: batched order assembly, server-rendered catalog, responsive image delivery, metric-adjusted local fonts and removal of the opaque initial loader. Silk/reduced-motion/WebGL fallback regression stays green. Mobile LCP remains open (O01/Q20/Q21).

## Fresh proof

[commands](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/commands.json), [Node](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/node-tests-final.txt), [HTTP](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/api-tests.txt), [role probes](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/http-probes.json), [browser](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/browser.json), [QA browser](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/audit.json), [correction/export closure](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/closure.json)

| Layer | Latest result |
|---|---|
| Node/domain suite | 105 PASS, 2 SKIPPED HTTP entry tests (no server in this layer); includes parent test rows |
| Existing HTTP suite against isolated production build | 29 PASS |
| Role/ownership/negative HTTP probes | 198 PASS |
| Original + new desktop/mobile browser suite | 34 PASS |
| Focused independent QA browser suite | 6 PASS |
| Correction approval + privacy export closure | 4 PASS |
| Specific domain probes | 9 PASS; before fix 6 PASS / 3 FAIL, including payout UPDATE |
| Typecheck / in-place default Turbopack production build | PASS |

Counts are reported separately; parent rows and overlapping suites are not combined into a feature pass rate. Commands and timestamps are in the manifest. All data and recipients are synthetic; provider credentials were cleared. The runner stops only its own server and restores pre-existing screenshot files. Historical failure evidence is retained.

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

## Performance limits

| Navigation | Score | LCP ms | CLS | TBT ms |
|---|---:|---:|---:|---:|
| home-mobile | 78 | 5125 | 0.0000 | 177 |
| shop-mobile | 85 | 4288 | 0.0000 | 105 |
| pdp-mobile | 56 | 4903 | 0.0000 | 1573 |
| home-desktop | 98 | 1064 | 0.0000 | 65 |

[Lighthouse raw reports/commands](qa/evidence/recovery/lighthouse-2026-11-01T14-48-07-427Z/summary.json), [bounded HTTP samples](qa/evidence/recovery/run-2026-11-01T15-00-14-839Z/load.json). Each Lighthouse row is one simulated navigation on this Windows workstation, with explicit CPU-calibration warnings retained in reports where present. Mobile LCP is still over budget. These samples are not field p75/INP, physical-device or managed staging acceptance. Historical p95 2197 ms versus current 72 ms is a local observation, not a universal speedup guarantee.

## Data preservation and release impact

Migrations 010/011 are additive and checksummed. Existing completed/legacy refunds, orders, addresses and consent-less emails survive migration tests; old newsletter emails are suppressed rather than assigned invented consent. Ordinary writer edits, correction deletion, self-approval, competing stale approvals and customer finance access are rejected. A schema owner/superuser can alter guards; least-privilege managed runtime grants and bank reconciliation remain EXT07/EXT10.

No full launch gate is accepted. Gates 4/5/10/11/13/14/15 lose the listed local repro failures, but their full discovery/merge/managed-race/finance/returns/CMS/manual-device requirements remain. Gate 16 operations/restore and all merchant/provider gates remain unaccepted. There are still 0 of 17 target-environment gates signed off.

EXT01/02 Razorpay, EXT03 hosted identity, EXT04/05 actual courier/reverse logistics, EXT06 delivered messages, EXT07 managed PostgreSQL/RLS, EXT08 managed restore, EXT09 remote CI/staging, EXT10 merchant/tax/COD bank approval, EXT11 target load/devices/field metrics and EXT12 separately approved live smoke remain BLOCKED or UNVERIFIED. No external success is inferred from mocks.

Next local vertical slice: R3 payment-attempt lifecycle and reconciliation for authorized/failed/expired/unknown outcomes, preserving existing capture/reservation behavior, before invoice/credit-note and reverse-logistics closure. These are remaining implementation tasks, not merely credential blockers. No production deployment or live charge/refund/message/dispatch was attempted.

Operational details: [recovery operations](docs/RECOVERY_OPERATIONS.md). Existing requirement IDs remain in the [171-row audit](Sky_Petal_Implementation_Coverage_Audit.md); the original roadmap stays canonical.

[Implementation file map](docs/RECOVERY_CHANGESET.md). The CI source now checks domain probes and runs the built production server; remote CI execution remains unverified. The failed mobile filter scan during a reduced-motion opacity transition was retained; dialogs now render immediately under reduced motion and the expanded panel is checked after reaching full opacity.

[Final 9-probe domain retest](qa/evidence/recovery/final-domain/domain-probes.json), [exact command and timestamps](qa/evidence/recovery/final-domain/execution.json), [68 original artifact hashes preserved](qa/evidence/recovery/artifact-preservation.json).
