# Sky Petal QA strategy — 1 November 2026

The scope is independent QA and a practical unfinished-module list. The build prompt is a reference contract, not authorization to implement product features or deploy. The roadmap controls requirements; the existing implementation audit retains its IDs and classifications. Execution status is separate.

## Environment and safety

Branch `master`, base commit `2217a83c2f0aa81b09a3f310a5732fd858cbf76f`, with substantial existing uncommitted implementation. Source SHA-256 manifests identify the tested working tree; the commit alone does not identify it. Node 24.16.0 on Windows. Test databases are newly created OS-temporary PGlite stores. The loopback production preview uses a copied application, its own output/database, and generated synthetic accounts. No production/shared database, provider dashboard, message, booking, charge, refund or payout is used.

The copy shares installed dependencies through a junction. Default Turbopack could not resolve that junction outside its detected root; the unchanged application was successfully built with the supported `--webpack` option. This is a QA topology limitation, not evidence that the repository's normal default build fails. No application code or original tests were changed. A typing error in the existing QA probe and an invalid negative-test payload were corrected and recorded.

## Risk order and methods

1. Inventory current source, all 171 audit IDs, roadmap phases/DoD, routes, migrations and CI source.
2. Typecheck, existing Node tests and optimized production build. Preserve initial failures as well as retests.
3. Database invariants: final SKU, refund caps, immutable evidence, RLS, invalid RMA restock, queue leases and notification deduplication. Provider responses/signatures are explicitly synthetic.
4. Actual HTTP customer/admin tests and role matrix (owner, administrator, catalog editor, fulfillment, support, finance, marketing, two customers, plus anonymous denials). Exercise IDOR, CSRF origin, forged identity, session revocation, consent, filtered sorting and >100-order revenue.
5. All existing browser specs, then independent rendered-CMS checks, axe AA-tagged scans and 320px reflow on seven public critical pages, reduced motion/WebGL fallback.
6. Read-only local SEO/content-type probes and sequential API timing observations. These do not certify CWV, target-load latency or uptime.
7. Provider, managed-PostgreSQL, physical-device, manual assistive-technology and recovery acceptance remain blocked/not run as separately identified.

## Fixtures and cleanup

`qa/harness.mjs prepare` copies source without `.env` files; `scripts/prepare-acceptance.ts` refuses managed DBs/non-temporary stores. `qa/prepare-fixtures.ts` adds all staff roles, two customers and 105 synthetic captured orders without calling a PSP. Generated credentials remain in the temporary access file and are excluded from evidence. The historical-order fixture temporarily increases one SKU to 1000 units; `qa/normalize-baseline-fixture.ts` restores the existing HTTP suite's explicit stock precondition to 12 before running that suite. This is fixture setup, not a weakened assertion.

CMS browser mutations restore original content in `finally`. Product/uploads/order mutations remain only in the disposable snapshot/database. Stop the QA server after evidence collection; keep temporary stores for reproduction or remove only the recorded QA run directory after review. Never recursively remove the dependency junction or original project. Retained report files contain synthetic identifiers only. Authentication traces are excluded from new audit tests.

## Entry, exit and ownership

Local entry: dependency installation, writable temporary storage and an installed Edge/Chromium browser. External entry: approved isolated staging, managed DB runtime role, sandbox merchant/auth/courier accounts, reviewed seller/tax/policy settings, test notification destination, hosted workers, and isolated backup target. Configure secrets in environment storage, never reports/chat.

Release exit: all applicable 17 gates accepted; no unresolved P0/P1 money/checkout/inventory/auth/privacy defects; essential journeys proven in the target environment with real sandbox evidence; policy/merchant approvals recorded; restore/rollback demonstrated. An optional V2 item can be deferred explicitly, without advertising it as live.

Engineering owns defects and missing workflows; merchant/finance owns catalog, tax and payout evidence; operations owns courier/RTO/support; platform owns managed DB, workers, monitoring and restore; QA owns independent retests and evidence. These are proposed responsibilities, not named-person assignments or approvals.

## Reproduction

Use the exact environment paths in `evidence/environment.json` and raw commands/logs in [EXECUTION_REPORT.md](EXECUTION_REPORT.md). Set `TEST_BASE_URL` to the newly created loopback server, never a shared deployment. Clear provider and managed-database variables for that process. Run `npm.cmd test`, `npm.cmd run test:api`, `npm.cmd run test:browser`, the two `qa/*-probes.ts` scripts, and `playwright test --config qa/playwright.config.ts`. Failing QA probes intentionally exit nonzero; do not delete them to make CI green.

This run provides broad local regression and targeted risk evidence. It does not claim an exhaustive security assessment, every endpoint boundary, full roadmap acceptance, full browser/device coverage or legal compliance certification.
## Independent local verification supplement

This supplement uses a second disposable exact-source snapshot and PGlite store. The repository's application, original tests, assets, migrations and roadmap are hashed before/after; tests build and write only inside temporary storage. Synthetic credentials and TLS private keys remain outside the repository. Trace recording is off because auth network traces can contain credentials; public-page screenshots, JSON, logs and SQL assertions are retained.

Added layers: exact-SKU competing reservations; privileged DML finance projection checks; semantic duplicate scans and lost job lease; eight staff/customer role boundaries; 105 captured synthetic orders; two-tab request-barrier cart race; Chromium/WebKit at desktop/Android/iPhone/tablet/landscape widths; all-severity axe WCAG 2.1/2.2 tags; explicit focus-return diagnostic; Lighthouse simulated mobile/desktop; bounded loopback read load; closed-store copy/restore followed by authenticated application reads and expired/revoked session checks.

Normal browser download and local Lighthouse process access initially failed in the sandbox; approved retries installed browsers/tooling only under the temporary run root. Firefox still crashes on an empty page and is BLOCKED. WebKit requires HTTPS for production Secure guest cookies: its two HTTP cart failures pass using the disposable loopback TLS proxy. No real devices, actual provider transactions, outbound communications or staging load tests were performed.

Reference checklists: [OWASP WSTG](https://owasp.org/projects/web-security-testing-guide), [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Automated scans do not certify all WCAG criteria or security controls. Reproduction scripts require explicit TEST_BASE_URL, QA_EVIDENCE_DIR and the private temporary TEST_OWNER_ACCESS_FILE; never substitute a live store. API load is 220 local read requests, maximum concurrency four; no live load/security campaign is authorized.
