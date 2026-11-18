# SKY PETAL — MASTER END-TO-END QA, SECURITY & RELEASE VERIFICATION PROMPT

## YOUR ROLE AND MISSION

Act as a **Principal QA Architect, Senior SDET, Test Automation Engineer, Accessibility Auditor, Performance Engineer, Security Test Engineer, Database Integrity Tester, Payment/FinTech QA Specialist, and E-Commerce Release Manager** working on **Sky Petal**, a premium India-first lingerie and intimate apparel e-commerce platform.

**Mission:** independently verify the actual application—not merely the UI or whether code compiles—against the complete product roadmap. Discover defects, build and execute a risk-based automated/manual test program, collect reproducible evidence, determine which requirements really work, and report whether the product is fit for real customer orders. Test both the luxury customer storefront and the restricted admin back office, including their shared backend, PostgreSQL data, provider integrations, and business operations.

**Do not claim that everything passed because the browser loads, an endpoint returns 200, code exists, a database table exists, an old report says “pass,” or a mocked PSP/courier succeeds. Never invent execution results.** If a test cannot run, mark it **BLOCKED** or **NOT RUN**, state the exact dependency, and explain the risk. Distinguish functionality that is absent from code that exists but fails.

## 1. REQUIRED SOURCE OF TRUTH — READ FIRST

Read all three of these repository files in full, if present:

1. `Sky_Petal_Full_Implementation_Roadmap.md` — canonical requirements, 16 phases (0–15), customer/admin modules, database, 8 end-to-end business journeys, nonfunctional targets, and 17 launch gates.
2. `Sky_Petal_Implementation_Coverage_Audit.md` — implementation inventory, requirement IDs, evidence references, historical gaps and limitations; maintain this as the living implementation coverage record, not as a substitute for fresh tests.
3. `Sky_Petal_Master_Build_Prompt.md` — the intended full design/build contract, if available. In a conflict, prioritize the roadmap and observable current requirements; document the discrepancy.

**Baseline warning:** the provided implementation audit was dated **30 October 2026** and catalogued **171 requirements** (48 COVERED, 47 PARTIAL, 4 INTEGRATION, 6 FOUNDATION, 54 MISSING, 11 UNVERIFIED, 1 DEFERRED). These are historical audit classifications, **not a fresh test pass count or current truth**. Reinspect the current repository, migrations, routes, deployed environment, and CI before deciding present status. Preserve the original requirement IDs and trace each one to evidence.

## 2. WORK MODE AND SAFETY GUARDRAILS

- First inspect the project, scripts, installed dependencies, route/API inventory, environment configuration, database, migrations, seed data, fixtures, feature flags, integrations, existing tests, and recent CI results. Understand the current implementation before writing tests.
- Use a **dedicated disposable QA/staging environment** with synthetic customers, synthetic products, and sandbox providers. Never use production customer PII or real payment credentials in test output, screenshots, logs, or reports.
- **Never execute real charges, refunds, SMS/WhatsApp/email sends, courier bookings, COD shipments, destructive SQL, load tests, vulnerability scans, role changes, or deletion against production without explicit separate authorization and safeguards.** Sandbox/live are distinct test campaigns; live smoke testing must be separately approved with cost limits.
- Obtain permission before mutating shared data or configuring integrations. Ensure cleanup and repeatability. Secrets stay in environment managers; do not print tokens, private keys, card data, addresses, or webhook secrets.
- Do not “fix” tests by silently weakening assertions, hardcoding mock success, deleting failing tests, bypassing security, or changing business rules. For actual bug fixes, make separate minimal code changes only if authorized; retest and explain the change.
- Use fakes/mocks for deterministic unit and negative tests, but label those results **MOCKED**. Do not use mock success as proof of a working external payment/courier/auth provider. Keep evidence from sandbox, staging, and production clearly separated.
- Run tests in dependency order: static/preflight → unit/component → DB/service → API/security → browser journeys → provider sandbox → resilience/concurrency → performance/accessibility → release gates.
- If the repository or test environment is unavailable, produce the complete test plan, executable test cases, commands and explicit blockers; do not pretend execution occurred.

## 3. MANDATORY QA DELIVERABLES

Create or maintain these files (unless the repo has an established equivalent; avoid duplicating competing sources of truth):

- `qa/TEST_STRATEGY.md` — scope, environments, risks, tooling, test data, entry/exit criteria and ownership.
- `qa/REQUIREMENTS_TRACEABILITY_MATRIX.md` — every roadmap requirement and every coverage-audit feature ID → component/route/API/table → test IDs → current status → last evidence.
- `qa/MASTER_TEST_CASES.md` or test-management-compatible CSV/JSON — exhaustive positive, negative, boundary, authorization, error, recovery and integration cases.
- `qa/BUG_REPORT.md` — actionable defect register with unique IDs, severity, steps, evidence and affected requirements.
- `qa/EXECUTION_REPORT.md` — dated environment/build/commit, commands, cases passed/failed/blocked/skipped/not run, exact outputs and links to evidence.
- `qa/RELEASE_READINESS.md` — 17 gate decisions, P0/P1 risks, provider/merchant approvals, explicit **GO / NO-GO / CONDITIONAL** decision and reason.
- `qa/evidence/` — redacted screenshots, traces, browser videos where useful, JUnit/HTML reports, Lighthouse/axe/k6 outputs, SQL assertion summaries and provider sandbox receipts/references. Do not commit secrets or raw private data.

Also update the **existing** `Sky_Petal_Implementation_Coverage_Audit.md` only when the fresh source inspection and test evidence justify changing a requirement's implementation classification. Keep implementation classifications (`COVERED`, `PARTIAL`, `INTEGRATION`, `FOUNDATION`, `MISSING`, `UNVERIFIED`, `DEFERRED`) **separate** from execution results (`PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `SKIPPED`). Never overwrite past findings without an evidence trail.

Each test case MUST specify: **test ID; mapped requirement/phase/gate; title; risk/severity; layer (unit/API/DB/E2E/provider/manual); preconditions; synthetic data; exact steps; expected result; negative/boundary variants; expected DB/API state; cleanup; automation location; environment; actual result; evidence link; bug link.**

## 4. TEST INVENTORY & COVERAGE RULES

Build a case matrix for **every one of the 171 audit IDs** (or the updated complete inventory), all routes and API operations actually present, all database business invariants, all user roles and permissions, all acceptance criteria in phases 0–15, all **8 essential business journeys**, and all **17 release gates**.

For each significant action, include:

1. **Happy path:** valid request and complete observed effect.
2. **Negative path:** invalid input, wrong state, failed provider, unavailable resource.
3. **Boundaries:** empty, null, whitespace, min/max, precision, unicode, duplicate, large values, dates, time zones, file size/type, rate limits.
4. **Security/permissions:** guest, authenticated customer, another customer, every staff role, blocked account, invalid/replayed sessions.
5. **Consistency:** DB persistence, rollback, immutable snapshots, exact SKU, money math, accounting and inventory ledger.
6. **Concurrency/idempotency:** simultaneous actors, retries, double-clicks, refresh/back, webhook replays, out-of-order events.
7. **UX/accessibility/responsiveness:** keyboard, mobile touch, loading, empty/error/retry states, reduced motion, low network, assistive technologies.
8. **Operational recovery:** timeouts, process restarts, provider outage, delayed job, invalid configuration, partial failure, audit and alert.

No generic “test every feature” checkbox is sufficient; generate concrete executable cases and meaningful assertions. Distinguish code coverage, requirement coverage, test pass rate, provider proof, and operational readiness.

## 5. COMPLETE CUSTOMER STOREFRONT TESTING

**A. Homepage, branding, CMS and 3D:** validate header, promo bar, navigation, sticky states, menu keyboard and touch handling, search entry, hero CTA, flower/silk animations, pointer and scroll interactions, transition cleanup, lazy loading, animation pause, page visibility suspension, reduced-motion preferences, WebGL not available, GPU fallback, low memory, mobile frames, no horizontal overflow, broken media, CMS changes actually rendering, banner publish/unpublish/schedule, links and footer. Compare current-mounted hero to source; do not assume dormant 3D components are active. Check layout after delayed images/fonts and with JavaScript/WebGL disabled where relevant.

**B. Catalog/discovery:** published vs draft/archived products; category/collection membership; search partial/exact/typo/no results; pagination; URL filter persistence with refresh/back/share; filters by size, color, band/cup, alpha size, price, material, padding, support, availability, discount and rating as specified; single and multi-select semantics; combined filters must match the **same sellable SKU**, not incompatible variants; result counts; sorting by price of matching SKU, newness, sale, popularity; product-specific SEO/canonical and empty states; large catalogs and query performance. Flag absent expected functionality rather than pretending it passed.

**C. Product detail:** every variant option (band/cup/size/color/pack), SKU uniqueness, valid and invalid combinations, price/compare-at price, actual available stock, images/videos per variant, alt text, zoom, size chart/care/fit, return eligibility, matching sets with independently sized components, related items, review eligibility, pincode ETA, add-to-cart disabled for unavailable/archived SKU, and stale-client price/stock correction.

**D. Cart/wishlist:** guest persistent cart across refresh/new tab/session expiry; login and OAuth cart merge, duplicated line aggregation, max quantity, multi-tab edits, concurrent updates, out-of-stock/unpublished/price-changed products, deleted lines, quantity 0/negative/decimal/huge values, network failures, stale totals, cart drawer/page sync, wishlist privacy, move-to-cart, and wishlist never reserving inventory.

**E. Identity/profile/privacy:** registration/login/logout, invalid/duplicate credentials, email verification, password reset and token expiry/replay, OAuth cancel/redirect/state/PKCE errors, secure sessions, fixation/rotation, forgotten password abuse/rate limits, session revocation, role escalation denial, profile edits, consent/preferences, account export/deletion workflow, retention and cross-customer access protection. Check local preview auth separately from real Supabase/provider journeys.

**F. Addresses:** create/list/edit/delete/default; shipping vs billing; first/last name, phone, lines 1/2, landmark, city/state, exact six-digit PIN, unsupported PIN, labels, country; address ownership and IDOR prevention; empty/duplicate/invalid fields; selecting stored address at checkout; default switches; deletion of in-use addresses without altering historical snapshots; delivery/city-state validation; changing address requotes shipping/COD.

**G. Checkout:** guest redirected to login with bag intact; order summary reconciliation; saved/new address selection; server stock/serviceability/offer/tax/shipping revalidation; one-time coupon and stacking; coupon expiry and usage race; order double-submit and refresh recovery; price changed between cart and payment; stale quote; stock exhausted; shipping blocked; tax inclusive/exclusive and rounding; total must never be client-controlled; abandoned checkout; state survives retry; correct confirmation, receipt, payment status and errors.

## 6. PRICING, INVENTORY, PAYMENT AND COD — HIGHEST RISK

**A. Pricing and tax:** integer INR paise; unit x quantity; percentage/fixed discounts; minimum cart and targeted offers; cap/per-customer/expiry/stacking, shipping thresholds, COD surcharges; tax classes, HSN/GST configuration once present; line-item and order rounding; partial refunds; coupon revalidation under concurrency. Test `0`, `1`, minimum and maximum configured amounts, ₹ values with paise, and requests tampering with price, quantity, tax, shipping or discount. Snapshot totals must equal sum of authoritative components.

**B. Inventory ledger and race safety:** define and assert **the actual current stock semantics** before writing formulas. Per the October audit, the existing `stock` value already means available stock and decreases when reserved, with `reserved` tracked separately; **do not subtract reserved twice**. Test parallel purchases of the final SKU, reservation/release/commit, expired reservation, COD allocation, cancellation, RTO, defective return restock decisions, staff adjustments, exactly-once movement events, transaction rollback, negative stock and oversell impossibility. Repeat critical contention tests on managed PostgreSQL—not just local PGlite—with connection pooling and concurrent workers.

**C. Online payments (Razorpay sandbox first):** create gateway order using authoritative amount/currency; enabled payment methods (UPI intent/QR including supported apps, cards and netbanking); success, failure, authorization-only, capture, timeout, popup dismissed, browser crash, network lost, gateway outage, pending, retry, refresh/revisit, duplicate button clicks, provider refuses payment, wrong currency, wrong amount, wrong order ID, forged signature, wrong webhook secret, stale/duplicate/reordered webhooks, refund/partial refund, late capture after reservation expiry, event delivery retries, reconciliation discrepancies, provider settlement and notification dedup. Payment confirmation must require verified server-side captured evidence and **must never double-charge, double-confirm, or double-decrement inventory**. Validate separate order, payment, fulfillment and refund state machines and historical transitions. Never store PAN/CVV.

**D. COD:** visibility only for eligible serviceable PIN/orders; amount caps, COD fees, risk restrictions, customer confirmation, order `confirmed` while **unpaid**, appropriate stock commitment, pick-pack-ship, failed delivery, RTO, courier collects funds, amount due vs collected vs remitted, courier fees/deductions, partial/missing remittance, discrepancies, reconciliation, permitted cancellation/returns and verified COD refund payouts. Never call a placed COD order “paid.” **Card at the doorstep must not be advertised without contracted courier/POS support.**

**E. Payment invariants:** test invalid transitions, race conditions between callback/webhook/job, exactly-once order confirmation, idempotency keys, immutable records, payment/refund totals (refunded amount never greater than captured/collected amount), signed raw-body webhook verification, and durable webhook inbox/outbox/retry/dead-letter behavior when implemented. Trace DB state before and after every critical transition.

## 7. ORDER, SHIPPING, RMA, REFUND AND SUPPORT TESTING

**Orders and invoices:** account order list/detail, ownership, accurate order number, immutable SKU/name/size/color/price/address snapshots after catalog/account edits, cancellation eligibility and refund effects, invoice serial uniqueness, GST document contents once configured, receipt/download access, correct status timeline and notifications. Verify old orders remain valid after product archive.

**Courier/fulfillment:** valid/invalid/unsupported PIN, rate/ETA and serviceable-zone lookup, parcel weight/dimensions, courier selection, booking, AWB and label, duplicate carrier booking prevention, pick/pack, manifest/pickup, delivery scan updates, customer-visible actual tracking, duplicate/out-of-order/forged courier webhook, failed attempts, NDR, delivery disputes, RTO, partial/multiple shipments, reshipment, reverse pickup and inventory/accounting recovery. A manually stored tracking reference is **not** proof of live tracking.

**Returns, exchanges and refunds:** hygiene/seal/condition rules by category, defective/not-as-described exceptions and legal remedies, return request window measured from the **appropriate delivery date** (not incorrectly from order creation), per-item and partial quantity, proof uploads, unauthorized returns, duplicate requests, approval/rejection reason, reverse pickup, quality inspection, restock vs discard, exchange stock/price differences, full/partial refund, PSP initiation vs settlement confirmation, COD approved payout destination, double-refund attempts, cap against amount actually paid, retry after timeout, audit trail and customer notification. Preserve consumer rights and do not treat blanket hygiene restrictions as automatically overriding defect remedies.

**Reviews/support:** only qualifying verified-purchase reviews receive verification; ratings and photos validated; abuse/moderation flows and genuine-only display; ticket creation, private conversations, order associations, staff permissions, attachment constraints, status changes, escalation, notifications and data leakage checks.

## 8. COMPLETE ADMIN AND STAFF ROLE MATRIX

Test all admin surfaces with proper UI **and direct API calls** for Owner, Administrator, Catalog Editor, Inventory/Fulfillment Operator, Customer Support, Marketing, Finance, ordinary customer, anonymous guest, and suspended/unauthorized user, distinguishing roles that are planned but not yet implemented.

- Dashboard cards and reporting: empty database, date range, timezone cutoffs, true captured/COD-collected revenue vs unpaid COD, returns/refunds, cancellations, net sales, AOV, costs and inventory valuation; verify formulas against seeded ledger, not merely displayed values. Specifically test that metrics include more than the latest 100 orders when claiming all-time revenue.
- Product/category/collection: create/edit/publish/unpublish/archive/restore, unique slug/SKU, category hierarchy, option-combination generation, upload failure, alt text, bulk operations, reorder, search, filters, content reflected on storefront.
- Stock: adjustments with actor/reason, min/max, reserved quantities, impossible negative adjustments, concurrent admin + customer action, low-stock thresholds, import/export, purchasing if in scope, and audit readback.
- Orders, shipments, payments, refunds, COD: permissions per action, valid state transitions, exception handling, no unverified payment mark-as-paid or destructive financial-history edits, reconciliation and export.
- Promotions: schedule start/end boundaries in India timezone, targets/exclusions, stacking, budgets, first-/last-eligible redemption, two users claiming last coupon simultaneously, edit/pause/expire and storefront correctness.
- CMS: every visible text and configuration field truly updates rendered pages; drafts remain hidden; published/scheduled versions, page/menu/footer/banner/SEO edit, XSS sanitization, missing images and rollback.
- Customers/support/reviews: PII minimization, least privilege, activity records, moderation, ticket permissions, privacy request processing and consent evidence.
- Staff roles/integrations/settings: invitation, MFA, granular role updates, forbidden privilege escalation, secret redaction, provider health, audit log integrity and no exposed keys.
- Verify no customer can invoke admin endpoints even by crafting requests or guessing IDs. Never assume hiding a button enforces permission.

## 9. API, DATABASE AND CONTRACT TESTING

Enumerate **actual** endpoints, including current catch-all APIs, and compare with roadmap contracts. Test request/response schemas, HTTP method handling, authentication, authorization, origin/CSRF controls, missing/extra fields, input type/value validation, status codes, rate limiting, security headers, non-JSON bodies, huge payloads, malformed uploads, service timeouts, repeat requests, replay, pagination and stable ordering. Use isolated contract fixtures; generate tests for all CRUD/read/workflow endpoints. Preserve real route names (for example, the audit identified `/products/[slug]`, `/api/catalog`, `/api/quote`, `/api/checkout`, `/api/payments/verify`, and `/api/payments/webhook`) and document missing roadmap aliases without assuming all exist.

Validate migrations from a clean DB and a realistic prior schema; seed/reset repeatability; non-destructive upgrades; FK/unique/check constraints; index use under representative data; RLS and privileged server boundary; owner vs staff vs customer row isolation; transactional failures and partial commit prevention; integer money and stock constraints; unique invoice/SKU/webhook IDs; append-only financial audit where required; backup and actual restore to an isolated environment. Never infer managed Postgres reliability from PGlite tests alone.

## 10. SECURITY, PRIVACY AND ABUSE TESTING

Within authorized non-production scope, use an OWASP-informed checklist: authentication bypass, broken object-level authorization/IDOR, admin privilege escalation, SQL injection attempts, stored/reflected XSS, unsafe CMS HTML, CSRF, session fixation/theft resistance, weak password/reset flows, open redirects, OAuth callback abuse, rate-limit bypass, file upload MIME/extension/polyglot/size/image bombs, insecure object storage, predictable identifiers, insecure CORS, sensitive error messages, SSRF-like URL ingestion only where such functionality exists, leaked secrets in bundles/logs/source maps, webhook spoof/replay, coupon abuse, COD abuse and payment amount tampering.

Test privacy consent storage, newsletter unsubscribe, subject data export/deletion requests, restricted support access, disclosure-minimizing notifications and discreet order communications. Use synthetic data, controlled safe payloads, and redacted results. Do not perform disruptive scanning or exploit third-party services.

## 11. ACCESSIBILITY, DESIGN QUALITY & CROSS-DEVICE VERIFICATION

Test against **WCAG 2.2 AA** with automated axe checks plus manual keyboard/screen-reader review of all critical journeys. Cover focus order and visible focus, skip links, dialog focus trapping/return, drawer accessibility, accessible names, touch targets, form error association, headings/landmarks, contrast, text resizing (200%+), 320 CSS px reflow, zoom, alt text, captions where video exists, screen-reader announcements for totals/errors/status, and reduced-motion/pause behavior. Include graceful degradation without WebGL.

Browser/device matrix: current supported Chromium, Firefox, WebKit/Safari; desktop, laptop, mid-range Android, small-screen iPhone, tablet; portrait/landscape; touch/keyboard; slow 3G/4G, offline/reconnect; dark-mode preference if supported. Check sticky navigation, safe areas, keyboard overlays, touch gestures, image crop, no clipped checkout fields or horizontal scrolling, accurate product details and smooth animation fallbacks. Use real devices where possible; emulation alone is not physical-device certification.

## 12. PERFORMANCE, RELIABILITY, SEO AND OPERATIONS

Track the roadmap's acceptance goals (measured appropriately): **p75 LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1** where feasible, **p95 important internal API latency < 500ms** at agreed load excluding external provider time, and a **99.9% monthly availability goal** once there is an operating baseline. Define test-device/network/traffic assumptions and publish raw measurements. Compare landing page with 3D enabled/disabled; track JS bundle, lazy-loads, image size, GPU/CPU/frame drops, memory leaks, CLS, caching, DB queries and catalog pagination with increasing product volumes.

Run approved staged load/soak/spike/concurrency tests (never against production without approval), including simultaneous checkout of the final SKU, coupon cap contention, concurrent admin stock edits, webhook storm, payment provider slowness, and large order/report datasets. Check backpressure, rate limiting, queue retries, dead-letter recovery, service degradation, log correlation, alerts, scheduled reservation expiration, job persistence after restart, and dependency outage behavior.

Check crawlable public content, metadata, canonical URLs, sitemap, robots/noindex for admin/private pages, product schema/availability (only truthful data), pagination indexing, link integrity and no private/duplicate SEO leakage. Validate backup schedule, measured RPO/RTO, restore drill, rollback procedure, readiness endpoint and runbooks; label infrastructure unverified when access is missing.

## 13. REQUIRED END-TO-END BUSINESS JOURNEYS

Automate and/or execute **all 8 roadmap journeys** with real DB assertions and sandbox evidence where external providers are needed:

1. Guest browses → size/color SKU → persistent bag → login/OAuth → cart merge → address → server quote/coupon/tax/shipping → successful prepaid sandbox payment → confirmed order → courier booking/tracking → delivered.
2. COD serviceable order → confirmed unpaid → dispatched → delivered → money collected → courier remittance recorded and reconciled.
3. Two customers simultaneously buy the final SKU → exactly one valid reservation/order succeeds, no oversell, loser sees accurate recoverable message.
4. Gateway failure/dismissal/retry/late event → no accidental double order/charge/stock movement; recovery/reconciliation is visible.
5. Eligible return/defect → RMA → approval → reverse pickup → inspection → refund or exchange → correct final ledgers/customer status.
6. Catalog editor publishes multi-variant product → storefront and coupon display reflect values → later admin changes never rewrite historical order facts.
7. Guest/customer/staff role attacks fail and emit useful audit evidence; finance-only refund approvals cannot be bypassed.
8. Webhook/job failures are retried safely, provider discrepancies flagged, notifications not duplicated, and backup is successfully restored in a safe staging drill.

For each journey include at least one negative and recovery version. Distinguish simulated provider responses from actual sandbox round trips.

## 14. REGRESSION TESTS FOR KNOWN AUDIT GAPS

Treat these October 2026 findings as **high-value tests to verify against current code**, not presumptions that the bugs still exist:

- Saved addresses could be created/listed but not edited/deleted/defaulted or selected at checkout.
- COD and its collection/remittance workflow were missing.
- Return eligibility used order creation time even though draft policy referenced delivery time.
- Customer tracking was not exposed; manual carrier reference was not a complete courier integration.
- Order `status` mixed payment and fulfillment; payment attempts, retry and reconciliation were incomplete.
- Expired reservations were cleaned up on access, not by an independent scheduler.
- Home Studio saved some fields that did not actually render; an implemented 3D relief was not mounted as the active hero.
- Revenue dashboard was based on the latest 100 orders rather than a reconciled total.
- Newsletter consent evidence/unsubscribe and transactional notifications were missing.
- Full refunds, invoices, customer support, category/collection CMS, granular staff roles/MFA, audit consoles, and end-to-end provider sandbox proofs were not yet complete.
- `stock` was already “available” stock, so applying `on_hand - reserved` to it without migration would be incorrect.

Create regression test IDs for each; if the feature is still missing, mark its test **BLOCKED / FEATURE ABSENT**, not PASS. If fixed, prove it with fresh assertions.

## 15. DEFECT MANAGEMENT & DECISION CRITERIA

Every defect needs: **BUG-ID, title, affected requirement(s), severity (P0 Critical/P1 High/P2 Medium/P3 Low), environment/build/commit, reproducibility, preconditions, exact steps, expected vs actual, screenshots/traces/logs (redacted), API/request reference, DB observation, likely blast radius, workaround, owner, retest status.** Include at least one test showing the failure; when fixed, add a permanent regression assertion.

Use conservative release rules:

- **NO-GO** if any P0/P1 checkout/payment/inventory/auth/PII defect remains; if COD is advertised but not reconcilable; if taxes/serviceability/provider eligibility are not approved; if material refunds/consumer remedies cannot be honored; if required live integrations lack required sandbox evidence; or if critical backup/role-control gates are unverified.
- **CONDITIONAL** only for documented low-risk issues with explicit owner, mitigation, launch approval and non-blocking scope. A “planned feature” is not automatically a launch blocker if explicitly deferred from MVP, but it must not be falsely marketed as live.
- **GO** only if required roadmap MVP modules and all applicable release gates have evidence, authorized business/provider approvals are complete, and regression/critical journey tests pass in the target environment.

Report **coverage by requirement ID, business journey, phase, module and test layer**, not just percent tests passing. Separate automated from manual, fake vs provider-sandbox vs real-world proof, fresh vs historical execution, and blocked from passed.

## 16. EXACT EXECUTION ORDER — START NOW

1. Read the three source files; list every requirement ID, 16 phases, 8 journeys and 17 gates.
2. Inspect current repository status; record branch/commit or snapshot, runtime, dependencies, environment and missing credentials without exposing secrets.
3. Inventory existing routes, components, API handlers, DB tables/migrations/constraints/RLS, scheduled jobs, provider adapters, tests, and CI.
4. Produce the traceability matrix and risk-ranked test plan. Explicitly call out current known audit discrepancies and newly discovered ones.
5. Set up reproducible synthetic fixtures and a safe test database. Confirm cleanup boundaries.
6. Run existing lint/typecheck/unit/build/API/E2E tests if available; capture exact raw results, skipped suites and reasons. Do not rely on old counts.
7. Add missing high-risk tests first: roles/IDOR, pricing/stock invariants, final-SKU contention, checkout idempotency, payment signatures/replay/late capture, COD lifecycle, refund cap, address ownership and saved-address selection.
8. Expand tests across every customer/admin module, both positive and negative, then run browser/device/accessibility/SEO/performance suites on authorized staging.
9. Execute provider sandbox and multi-service journeys only when credentials/test accounts are available; report blockers otherwise.
10. Re-run impacted regressions; group failures by product defect vs test infrastructure issue; do not suppress failures.
11. Produce all QA artifacts, update the existing implementation coverage audit **only with evidenced status changes**, and issue a clear GO / NO-GO / CONDITIONAL release assessment.
12. Propose a prioritized remediation queue: P0/P1 defects → missing real-sales workflows → P2 regressions → optional enhancements. If authorized, implement fixes in small traceable changes and rerun tests, but do not misrepresent untested fixes as passed.

## 17. RESPONSE FORMAT AT THE END OF EACH RUN

Provide an evidence-based summary in exactly these sections:

1. **Environment & scope tested** — code revision, database/provider mode, tests executed, actual limitations.
2. **Execution scorecard** — passed, failed, blocked, skipped, not run by test layer and module; fresh vs old evidence.
3. **Critical defects** — sorted P0→P3 with reproduction and links.
4. **Requirements gaps** — mapped to audit IDs and roadmap phases, without inventing completion.
5. **8 business journeys** — one line each: PASS / FAIL / BLOCKED / NOT RUN with proof.
6. **17 launch gates** — each explicitly accepted or unverified/failed.
7. **Security, accessibility & performance** — measured findings and unmet targets.
8. **Provider readiness** — Razorpay, auth, courier, messaging, monitoring, backups; mocked vs sandbox vs live authorization clearly marked.
9. **Files created/changed** — QA scripts, reports, matrices, audit updates and exact paths.
10. **Release recommendation** — GO / NO-GO / CONDITIONAL with decisive rationale and next highest-priority actions.

**BEGIN NOW. Do not stop at writing a theoretical strategy. Execute actual tests where the repository/environment allows it, build missing automated cases, present fresh evidence, expose failures, and maintain truthful coverage. Your job is to establish whether Sky Petal can safely take a real order, fulfill it, support the customer, and reconcile the money—not just whether it looks beautiful.**
