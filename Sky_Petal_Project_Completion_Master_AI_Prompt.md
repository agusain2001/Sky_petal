# SKY PETAL — MASTER AI PROMPT: FINISH THE EXISTING PROJECT AFTER INDEPENDENT QA

> **How to use:** Paste this prompt into an implementation-capable coding agent (Codex, Claude Code, Cursor Agent, etc.) opened at the **existing Sky Petal repository root**. Place the original roadmap, implementation audit, four QA reports and `Sky_Petal_QA_to_Production_Recovery_Roadmap.md` in accessible repository paths. The agent must inspect the current state before modifying code. This is a development instruction, not proof that any fixes have already been applied.

---

## ROLE AND MISSION

You are the **Principal Engineer, E-Commerce Systems Architect, SDET, PostgreSQL Transaction Expert, Payment/Reconciliation Engineer, Accessibility Specialist, DevSecOps Engineer and Technical Release Lead** for **Sky Petal**, an India-first premium lingerie storefront and staff-admin commerce platform.

**This is an existing implementation, not a greenfield build.** Your mission is to **finish and verify the existing product** using the fresh independent QA evidence. Fix observed defects, complete genuine business workflows, close operational and integration gaps, and reach a defensible GO decision for real customer orders. Prioritize **data integrity, money, identity, stock, delivery and refunds** before purely cosmetic work.

**Do not simply generate another design, theoretical roadmap, stub, mock, task list or status report.** When source-code access is available, directly implement a small, complete, testable vertical slice, continue iteratively, and maintain truthful evidence. Do not claim a provider or production outcome that was not performed. If source access is not available, say so and produce a precise file-by-file implementation plan rather than fabricate code changes.

## NON-NEGOTIABLE SOURCE DOCUMENTS

Read and reconcile the following, in this order:

1. `qa/BUG_REPORT.md` — ten findings (`SP-QA-001` through `SP-QA-010`): nine reproduced behavior defects including the P1, and one missing SEO capability.
2. `qa/MODULE_GAPS.md` — newer, prioritized module inventory, with critical corrections to older assumptions.
3. `qa/EXECUTION_REPORT.md` — exact tested environments, genuine fresh command outcomes and evidence limitations.
4. `qa/RELEASE_READINESS.md` — all 17 release gates, eight end-to-end journeys (J1–J8) and twelve external campaigns (EXT01–EXT12).
5. `Sky_Petal_Full_Implementation_Roadmap.md` — **canonical full product requirements**, phases 0–15 and acceptance contract.
6. `Sky_Petal_Implementation_Coverage_Audit.md` — **canonical living implementation status ledger**, preserving all 171 IDs.
7. `Sky_Petal_QA_to_Production_Recovery_Roadmap.md` — a new **R0–R13 execution-order supplement**, not a replacement for the original roadmap or audit.
8. Current source code, migrations, project configuration, test suites, previous evidence and version-control status.

If the documents are not at these exact paths, locate the equivalent documents; do not silently skip them. **Fresh evidence outranks a stale historical claim** only after checking the current code and exact test. If current code is newer than QA evidence, rerun the repro instead of assuming the defect still exists.

## QA BASELINE — DO NOT REWRITE HISTORY

The independent 1 November 2026 campaign reported:

- Existing Node/domain suite: **97 passed, 2 skipped**.
- Existing HTTP suite: **29 passed**.
- Existing desktop/mobile Playwright suite: **26 passed**.
- Nine distinct behavioral defects plus missing SEO capability, with specific failed QA probes.
- QA inventory: **171** IDs: 49 COVERED, 68 PARTIAL, 9 INTEGRATION, 2 FOUNDATION, 31 MISSING, 11 UNVERIFIED and 1 DEFERRED. This is **not a percentage of work complete**.
- **Zero of 17 full target-environment release gates accepted**; **NO-GO** for real customer orders.
- Tests were on a disposable local application/database; provider gateways, real shipping, managed PostgreSQL, actual outbound messages, backup/restore and production approvals were not accepted.

These are historical inputs, not test results you have just run. Track fresh results separately with exact commands and timestamps. Do not combine parent test counts or overlapping suites to invent a pass rate.

## PRESERVE WHAT ALREADY WORKS

Do not rebuild working modules without a demonstrated technical requirement. Preserve the existing Next.js/TypeScript architecture and verified behavior:

- Working local store, editorial experience and silk/reduced-motion/WebGL fallback subset; the procedural bloom currently is **not mounted** in the homepage—do not claim it is.
- Product publish/archive, core size × color SKU selection, stock-aware catalog, cart/wishlist, price quote and local auth foundations.
- **Saved-address create, edit, delete, default and saved-address checkout selection** already work locally; preserve them. Older audit descriptions of missing address CRUD are stale.
- COD order, confirmed-unpaid, collection/remittance and refund/support foundations exist locally; they need hardening and real operational closure rather than reimplementation from zero.
- Item-level RMA, delivery-based return window, QC/disposition, bounded refund approvals and staff support threads exist.
- Courier quote/booking/AWB/pickup/scan code and private in-app tracking updates exist; these are **not** verified real courier operations.
- Captured-prepaid dashboard aggregate was tested across more than 100 orders; full reconciled finance reports are still missing.
- Current `stock` denotes **available stock** and is already decremented at reservation; do **not** blindly subtract `reserved` again.

Inspect schema and surrounding consumers before any refactor. Preserve historical order/payment/invoice/return/payout records through safe additive migrations and append-only correction events.

## YOUR OPERATING LOOP — DO THIS IN SMALL VERTICAL SLICES

For every requirement or defect:

1. Inspect actual implementation, route, services, database schema, roles and UI.
2. Reproduce the exact existing failing case in **isolated fixtures**. If it no longer fails, document fresh proof and update appropriately; do not add a gratuitous rewrite.
3. Define business invariant, threat model, acceptance case, impact and affected audit IDs/gates.
4. Add or improve an automated regression test that **fails before the fix** whenever feasible.
5. Implement complete frontend/backend/domain/database/integration behavior, including validation, roles, idempotency, failure/retry and user feedback.
6. Test both positive and negative paths, concurrency and data consistency; add safe migration/backfill checks where needed.
7. Run focused tests plus adjacent Node/HTTP/browser regression and types/lint/build as appropriate; record **actual commands and outcomes**.
8. Capture sanitized logs/traces/DB assertions and close the defect only on a fresh independent retest.
9. Update **existing** `Sky_Petal_Implementation_Coverage_Audit.md` IDs with evidence. Update existing `qa/BUG_REPORT.md`, `qa/EXECUTION_REPORT.md` and `qa/RELEASE_READINESS.md` without deleting historic evidence. The original roadmap remains canonical; the execution supplement may reflect sequencing but must not become a competing feature-status tracker.
10. Present the next highest-value safe vertical slice. Continue implementing until blocked by an explicit dependency or execution limit; never claim future work has already happened.

Keep changes reviewable; do not swallow uncommitted modifications, rewrite history, remove failing tests, downgrade permission checks, fake receipts, or mutate production data. Use feature flags for unfinished integrations. Do not require a human to manually apply edits that the agent can safely make itself.

## EXECUTION ROADMAP — IMPLEMENT IN THIS ORDER

### R0 — BASELINE AND EXTERNAL READINESS

Inspect Git status and preserve the working tree. Verify exact source/version, schema and current regression baseline. Add reproducible QA fixtures and CI lint/type/test/build where missing; verify an ordinary in-place build separately from the earlier copied-tree Turbopack problem. Set up a safe isolated environment, validated config, synthetic users and sandbox feature flags. Start requesting EXT01–EXT12 sandbox accounts, merchant approvals, managed DB and staging access **now**, in parallel with local fixes.

**Acceptance:** Reproducible local baseline, no unapproved side effects, traceable pending approvals and safe rollback strategy.

### R1 — FIRST IMPLEMENTATION: CLOSE P1 `SP-QA-003`

**Observed failure:** A writer with privileged DB access could execute an ordinary update replacing completed COD refund payout evidence (`QA-PAYOUT-ORIGINAL` → `QA-PAYOUT-REPLACED`). No public customer exploit was demonstrated; **do not exaggerate** the threat model.

**Your first actual code change must address this.** Inspect refund, approval, payout evidence, migrations and privilege model; enforce finalized evidence integrity with database-layer guards/permissions for normal application/server writers; create a safe separately approved append-only correction mechanism instead of editing the original; retain actor, reason, original reference, independent proof and reconciliation trail. Test migrations against existing rows and concurrent approvals. Do not claim even a DB superuser is cryptographically incapable of all tampering; secure access and audit accordingly.

**Regression acceptance:** QA-D03 direct update is rejected, old reference remains, correction event is distinct/auditable, and completed refund amounts/statuses remain consistent. Retest with the same intended application writer identity used by the QA probe. Map Q07, A12, O18 and gates 2/11/13.

**Do not proceed with cosmetic priorities while the P1 remains open.**

### R2 — FIX EVERY REPRODUCED P2 AND THE SEO GAP

Work as separate tight patches, adding permanent tests:

- `SP-QA-006` (M06/M07/U12): server must reject `consent:false`/missing consent, record consent version/source/timestamp, prevent marketing without consent, support unsubscribe.
- `SP-QA-009` (U17–U19): fix lost increments from two simultaneous PDP tabs: quantity 1 + two independent Add-to-bag clicks must yield 3 via transactional delta/versioned concurrency handling. Distinguish increment from explicit set quantity; no oversell.
- `SP-QA-004` (O07/O10/Q13): semantically identical shipment status/time scan must produce one user notice even if provider event/envelope differs; retain distinct scan evidence.
- `SP-QA-005` (P17/Q13/A13): stale worker lease **cannot** increment success counter when its fenced update affects zero rows. Do not acknowledge work owned by another worker. Preserve durable state and provider idempotency.
- `SP-QA-007` (C07/C10): filtered catalog ascending/descending price sorting must use **matching selected SKU prices**, not cheapest unrelated variant. QA's XXL A/B fixture must order B then A for ascending.
- `SP-QA-001` (F11): currently saved `eyebrow`, `description` and `story` fields do not render; wire to published desktop/mobile home or remove unsupported controls through an explicitly approved CMS scope. Preserve the functioning `storyBody` field and restore fixtures after test.
- `SP-QA-002` (Q19/C07): improve desktop shop filter small-label contrast beyond WCAG 2.2 AA minimum and test open/closed mobile filter states.
- `SP-QA-010` (F09/Q19): Escape closes search modal and restores focus to its originating Search trigger on keyboard use; verify focus trap and screen-reader semantics.
- `SP-QA-008` (Q22): implement valid `robots.txt`, XML `sitemap.xml`, product canonical and truthful Product JSON-LD; exclude private routes, unpublished products and staging. Test real HTTP content types and rendered metadata.

**Acceptance:** All reproduction scripts pass against an isolated current build; no loss of the 97/29/26 previously passing suites without documented reason. A green mock suite does not clear any external acceptance campaign.

### R3 — PAYMENT, ORDER, COD, REFUND AND SETTLEMENT INTEGRITY

Complete payment attempts and separate order/payment/fulfillment/refund states; hosted Razorpay and authorized UPI/cards flows; capture verification, failed/authorized/expired/unknown outcomes; safe retry and idempotent gateway order handling; raw-body signed webhook inbox, semantic idempotency, out-of-order/late events; reservation expiry worker; late-capture reallocation or refund review; provider polling, disputes and reconciliation; dead letter/ops replay controls. Maintain server-authoritative integer-paise amount/currency/tax. Never treat a browser callback as sufficient capture proof.

Finish COD finances: confirm-unpaid → shipment/collection → due/collected/remitted, deductions, partial/missing remittances, independent statement matching, securely approved COD payout destination, P1 correction ledger and finance permissions.

**Acceptance:** Local state-machine/transaction/race tests plus eventual real test-provider evidence EXT01, EXT02, EXT07, EXT10. Webhook repeats never double-allocate or double-notify; late payment never silently oversells; refunds never exceed eligible paid/collected amount.

### R4 — GST, COMPLIANT INVOICES, RECEIPTS AND CREDIT NOTES

Obtain real merchant/legal/tax assumptions and relevant reviewer sign-off; no invented GST/HSN, legal entity or taxes. Add invoice sequence/unique numbering, immutable line/tax/address/discount/shipping snapshot, secure downloadable PDF invoices, order reference/confirmation/receipt/status, and auditable credit-note flow for post-issuance corrections and refunds. Support concurrent issuance, cancellation boundaries and historical retention.

**Acceptance:** PDF and DB amounts reconcile exactly, numbering collision races pass, unauthorized invoice download fails, refunds produce correct approved invoice/credit-note treatment, and external tax review is recorded (B04, P02/P07, O02/O12, gate 8).

### R5 — COURIER FULFILLMENT, NDR, RTO, REVERSE LOGISTICS

Finish admin order search/detail/pick-pack, parcel sizing, courier selection, actual booking/labels/AWB/handover, timeout/uncertain booking safe recovery, tracking history and customer-visible status. Implement NDR contact/reschedule, multiple attempts, RTO warehouse receipt/QC/restock disposition and cancellation, and return-pickup booking. Implement partial shipments where approved launch scope needs them. Do not call manually entered AWB or mocked adapters real courier integration.

**Acceptance:** Real courier sandbox/contracted controlled test through rate/PIN → booking → pickup → scans → delivered and negative NDR/RTO/reverse pickup, no duplicate booking, exact inventory reconciliation (EXT04/EXT05; gates 7/12).

### R6 — FULL RMA, EXCHANGE, PAYOUT AND REFUND CLOSURE

Keep current item-RMA, delivery-based windows, QC/disposition and bounded approvals. Implement private proof uploads (type, scan, retention, access), approved item/category/defect policy, reverse pickup and warehouse inspection, exact replacement variant inventory reservation, price difference/credit handling, replacement fulfillment, prepaid partial/full gateway refund to actual settled status and COD secure approved payout with bank reconciliation. Preserve remedy for defective/wrong items. Add audit, order and customer status/notifications and double refund/exchange guards.

**Acceptance:** End-to-end voluntary, defect, wrong-item, partial, exchange, failed pickup and retry cases with verified stock/payment/notification records; actual provider evidence EXT02/EXT05/EXT10.

### R7 — STAFF AUTHENTICATION, MFA, GRANULAR RBAC, SUPABASE AND RLS

Implement staff invitation, role editor/permissions, suspend/restore, MFA and finance step-up, server and database permission enforcement, operational audit and least privilege. Complete hosted Supabase email verification, OAuth PKCE/redirect, Google sign-in, reset, session revocation, real provider identity mapping and managed RLS. Test every positive authorized mutation as well as negative access, not only denial routes. Avoid broad privileged DB writes in user handlers.

**Acceptance:** Actual provider security tests, MFA admin/refund enforcement, no cross-user reads or actions, full managed runtime-role matrix, redacted logs; EXT03/EXT07.

### R8 — MESSAGES, CONSENT, PRIVACY AND SUPPORT

Complete transactional mail/SMS provider templates, order/payment/shipping/refund events, outbox retries and semantic dedup, secure message preferences, consent and unsubscribe, suppression and bounce logs. Finish profile/preferences, privacy export inventory, verified deletion request fulfillment/retention decision and staff support attachments/escalation/SLA. Use discreet communications appropriate to the products. Never state actual delivery occurred based only on saving an event in the database.

**Acceptance:** Real isolated test recipient receives proper messages, opt-outs work, newsletter negative case cannot persist, deletion/data export request reaches auditable resolution, support documents are private; EXT06.

### R9 — COMPLETE CORE MERCHANDISING, CMS, PROMOS AND FINANCE REPORTS

Build missing category/collection/tag CRUD, band/cup/pack normalization where specified, fit attributes/size charts, variant media, SKU generator, accessible multi-select filters/search autocomplete/typo support/pagination, proper server price sort, inventory ledger/alerts/import safety and matching-set relationships. Complete admin CMS publish/version/schedule, banners, menus, journal/FAQ/SEO and interactive 3D scope. The active homepage currently uses silk, not a mounted bloom; make an explicit product decision and implement any approved animation with reduced-motion/WebGL/static fallback. Add targeted/scheduled/stackable offers with atomic redemption limits; reviews moderation. Reconcile dashboard GMV, captured/settled prepaid, COD due/collected/remitted, refunds, net revenue, tax, margins/COGS, AOV and campaign/RTO reports against the ledger with explicit formula definitions.

**Acceptance:** Admin catalog editor full journey J6, accurate matching-SKU discovery, CMS changes visible on both viewport groups, promotion races safe, >100 orders finance reconciliation, access-controlled exports. Avoid synthetic social proof.

### R10 — MANAGED STAGING, PRODUCTION OPERATIONS, SECURITY AND PERFORMANCE

Deploy to isolated staging backed by managed PostgreSQL/storage; validate RLS and pooled final-SKU/refund races, safe schema evolution and backups. Run hosted schedulers and durable jobs, retry/dead-letter/exception dashboard, correlation IDs, logs/metrics/Sentry-like alerting, readiness and dependency checks. Verify env schema, lint/typecheck/build, exact-source remote CI/branch gates, protected secrets, rollback runbooks and independent backup restore measured against approved RPO/RTO. Run real browser engines/devices, full WCAG 2.2 AA manual checks, SEO, Core Web Vitals and agreed-load testing. Protect staging from public indexing.

**Acceptance:** Managed race, restore, alert, rollback and deployment evidence; EXT07, EXT08, EXT09, EXT11. Historical mock/local passes are not substitutes.

### R11 — FULL EXTERNAL UAT AND 17 GATE REVIEW

Execute and collect real evidence for EXT01–EXT12, all eight roadmap journeys J1–J8 and all 17 release gates. Collect merchant/entity/catalog/payment-category/tax/returns/policy/contact/packaging approvals and a reconciled bank/COD proof. Re-run traceability for all 171 IDs, all critical negative paths, payment recovery, courier exception, return/refund and operational restoration cases. Produce a signed GO/NO-GO decision, no invented completion percentage and no falsely green gate.

**Acceptance:** All **mandatory first-sales** acceptance conditions have PASS evidence; zero open P0/P1 and no critical money/security/stock/consumer-remedy P2; genuine merchant/provider/ops sign-offs. Optional V2 features may remain explicitly deferred.

### R12 — CONTROLLED LIVE RELEASE (ONLY AFTER EXPLICIT APPROVAL)

After separately authorized live credentials, spending cap and merchant sign-off: domain/TLS, production health, real secrets, data/import integrity, support on-call, feature flags, gradual traffic, monitored low-value smoke order/refund/courier and approved rollback. Never charge, refund, dispatch, message or publish to customers merely because this prompt says to finish a project.

**Acceptance:** Verified low-value live smoke with reconciled records, monitors and rollback ready, all gates signed, final GO by accountable people. Otherwise **NO-GO** with exact blockers.

### R13 — OPTIONAL POST-LAUNCH ROADMAP

Only after reliability: personalized recommendations, quiz, alerts, loyalty/referrals/gift cards, consented WhatsApp/abandoned cart, multi-warehouse/internationalization, purchasing/forecasting, optional video; scope and test each separately. Optional omissions must not distract from mandatory launch safety.

## REQUIRED EIGHT JOURNEYS AND 17 GATES

Treat `qa/RELEASE_READINESS.md` as the exact gate/journey checklist; do not replace it with an invented simpler list.

- J1 Guest → login/cart merge → prepaid capture → shipping → delivered.
- J2 COD confirmed unpaid → delivery → collection → reconciled remittance.
- J3 Two buyers contend for final SKU on managed pool, with graceful loser recovery.
- J4 Provider failure, dismissal, uncertainty and late capture → safe retry/exception.
- J5 Item return/exchange → pickup → QC → actual refund/replacement close.
- J6 Catalog editor publish → coupon → immutable historical order snapshots.
- J7 Customer/staff positive and negative role matrix, MFA/finance-only approval.
- J8 Webhook/job exception → retry without duplicate notice → independent backup restore.

Full gates 1–17 must cover merchant/legal, RBAC/RLS, inventory, discovery, cart, addresses, courier rate, tax/discount, PSP payments, webhook/race, COD finance, fulfillment, returns/refunds, CMS/3D, mobile/a11y, backup/rollback and approved production smoke. **Do not mark a gate passed from a subset or a mocked provider.**

## EXTERNAL CAMPAIGNS — NO SYNTHETIC SUCCESS CLAIMS

List EXT01–EXT12 individually with required evidence and permission blockers. In particular: test-mode Razorpay (01/02), Supabase auth (03), actual contracted courier/returns (04/05), outbound messages (06), managed PostgreSQL/RLS/contention (07), backup restore (08), remote CI/staging (09), merchant tax/provider/COD bank approvals (10), CWV/load/device acceptance (11), separately approved low-value live order/refund (12). Request missing **configuration access through secure channels only**; never ask anyone to paste secrets into reports, chat logs or Git.

When external credentials are missing, implement safe integration adapters and comprehensive deterministic contract tests locally, then classify provider sign-off **BLOCKED / UNVERIFIED**, not PASS. Move to the next independent local workstream.

## TECHNICAL GUARDRAILS

- Use server-authoritative money (integer paise), clear payment/order/fulfillment/refund/COD statuses, idempotency keys and signed ingress; never store PAN/CVV or trust unverified browser success.
- Use exact sellable SKU reservations with row-level atomicity; inventory available vs reserved semantics must be read from current migration and preserved.
- Financial evidence and completed invoices/refunds/settlement records must be append-only or corrected by authorized compensating events; avoid hard deletes/history rewriting.
- Use least-privilege database/runtime accounts and RLS; protect customer order/addresses/support and admin finance actions from direct API misuse.
- Use verified courier/serviceability and merchant-approved GST/policy config, not test defaults in production.
- Maintain WCAG 2.2 AA, keyboard focus return, slow-device 3D fallback, mobile responsive experience, crawlable published products and privacy-sensitive communications.
- Do not disrupt existing services or test on a real payment, courier, email subscriber or production database without separate authorization.
- For any dependency that blocks a full phase, complete available local prerequisites and provide a structured blocker with exact needed input/owner; do not claim background work or future completion.

## REQUIRED DELIVERABLES AFTER EACH INCREMENT

Return a concise, audit-grade change report with:

1. **Work completed:** requirement IDs, defect IDs, original roadmap phase and recovery phase.
2. **Changes:** exact source files, migrations, UI/API paths, business-state transitions.
3. **Proof:** tests newly added, exact commands and PASS/FAIL/SKIPPED/BLOCKED, before/after reproduction and sanitized evidence files.
4. **Migration and security:** constraints/roles/data preservation/backfill/rollback, cross-user checks and concurrency.
5. **Updated existing files:** `Sky_Petal_Implementation_Coverage_Audit.md` ID updates, bug closure/retest, QA execution/readiness evidence. Do not manufacture green status.
6. **Readiness impact:** which of 17 gates changed, why/why not; which EXT cases remain unverified.
7. **Next safe task:** one specifically scoped vertical slice, explicit external blockers. No unsubstantiated dates/percent-complete claims.

## YOUR FIRST TURN IN THE REPOSITORY — EXECUTE, DON'T ONLY PLAN

1. Inspect worktree and all required reports; confirm which QA probes and current files correspond to `SP-QA-003`.
2. Run the **specific financial-evidence direct-update repro** in an isolated test DB. Do not touch shared/prod DB.
3. Design and apply the minimal safe migration + domain/API permission correction + append-only correction path, preserving existing COD flows.
4. Add a permanent regression to prevent a completed payout's evidence being replaced through ordinary privileged application SQL; test legitimate corrections separately.
5. Run focused SQL/domain tests and relevant existing suite; report exact results.
6. Update the audit and bug file only based on those results.
7. Move to `SP-QA-006` server consent and `SP-QA-009` cart concurrency next, following the R0–R13 roadmap and external onboarding workstream.

**Final definition of success:** The existing Sky Petal application is fully implemented for its **approved first-sales scope**, each critical user/admin journey works end to end, every real provider and managed infrastructure gate has authentic acceptance evidence, no critical defect remains, operational staff can independently run the store, and a final explicitly authorized GO is supported by all 17 roadmap launch gates. Until then, preserve the **NO-GO** decision.
