# SKY PETAL — QA-to-Production Completion Roadmap

**Planning baseline:** 1 November 2026 QA campaign. **Release decision:** **NO-GO for real customer orders**.  
**Purpose:** An execution-order supplement to `Sky_Petal_Full_Implementation_Roadmap.md`, **not** a replacement for that master roadmap or a parallel implementation-status tracker. The authoritative feature status remains `Sky_Petal_Implementation_Coverage_Audit.md`; QA status remains in `qa/`.

## 1. Source of truth and current baseline

Read in this order: `qa/BUG_REPORT.md`, `qa/MODULE_GAPS.md`, `qa/EXECUTION_REPORT.md`, `qa/RELEASE_READINESS.md`, `Sky_Petal_Full_Implementation_Roadmap.md`, `Sky_Petal_Implementation_Coverage_Audit.md`, then inspect the **current** repository. If audit/header material disagrees, privilege the freshest reproduced evidence; verify against the working tree before updating anything. Do not overwrite the 171-row audit or manufacture sign-offs.

- Fresh QA: existing Node/domain tests **97 pass, 2 skip**; HTTP regression suite **29 pass**; existing desktop/mobile Playwright suite **26 pass**. Additional targeted probes identified **nine behavior defects** and **one missing SEO capability**. These are overlapping test layers—not an application completion percentage.
- Requirement inventory in the fresh module gaps report: **171** IDs = **49 COVERED, 68 PARTIAL, 9 INTEGRATION, 2 FOUNDATION, 31 MISSING, 11 UNVERIFIED, 1 DEFERRED**. These classifications describe feature evidence, not the number of test cases passed.
- All **17 release gates** remain unaccepted; full eight journey certification remains open. The QA run used an isolated local database/application copy; no Razorpay, Supabase, Shiprocket, live messages, actual courier, managed PostgreSQL, or production transaction was accepted.
- **Do not rebuild locally functioning features:** saved-address create/edit/delete/default/checkout selection, core guest cart persistence, exact size-color SKU choice, the existing COD order/collection/remittance foundation, item-RMA/support threads, local courier adapter/booking/scan code and captured-prepaid aggregate. Harden and extend these rather than restarting them.
- The code was reported as a dirty `master` worktree based on `2217a83c2f0aa81b09a3f310a5732fd858cbf76f`. Check the actual current revision before making changes. Preserve uncommitted work.

## 2. Delivery rules (apply to every phase)

1. **Inspect → reproduce → write a failing regression → implement the smallest complete vertical slice → run focused tests → run surrounding regressions → document evidence → update the existing audit.**
2. Full vertical slice means user/admin UI, server authorization, transactional domain logic, schema/migrations, validation, errors, idempotency/recovery, and tests as applicable. Never mark a mocked external integration as live.
3. Use safe additive, versioned migrations with a verified backfill and rollback/forward-fix strategy. Preserve historical orders, refunds, payouts, invoices, audit and RMA data. Use integer paise for money and enforce exact SKU inventory invariants.
4. Never modify or charge real users, payment accounts, couriers, subscribers or bank balances without separate explicit authorization. Use synthetic fixtures and sandbox accounts. Redact keys, access tokens, personal data, bank details and full webhook bodies from evidence.
5. Never delete/disable tests or loosen assertions to achieve green CI. Record **PASS / FAIL / BLOCKED / NOT RUN**, separating local mocks from target-environment proof. Maintain the original roadmap phase 0–15 definitions and all 17 release gates.
6. Deliver small reviewable changes, preferably one fix/vertical slice per change. If work needs external access, create a clearly bounded integration contract and **BLOCKED** evidence item, then move to the next safe local prerequisite.
7. Run `typecheck`, a real lint gate after adding it, unit/domain tests, targeted HTTP/security tests, browser tests, and migrations on a disposable database at the appropriate phases. The QA snapshot's webpack build passed; the default Turbopack copied-tree build was blocked, **not** a proven product failure. Verify in-place build separately.
8. A feature's code and an actual provider outcome are different acceptance levels. Do not close the corresponding `EXT` campaign or a release gate without real test evidence.

## 3. Execution dependencies at a glance

```text
R0  Baseline + staging/sandbox procurement  ──────────────────────────────────┐
  ↓                                                                         │
R1  P1 payout-evidence integrity (immediate release blocker)                 │
  ↓                                                                         │
R2  Reproduced P2 regressions + SEO (local reliability/accessibility)        │
  ↓                                                                         │
R3  Payment/COD lifecycle, late-event resolution, finance reconciliation    │
  ↓                          ↘                                              │
R4  Approved tax + invoices/credit notes  R5 Courier exceptions/NDR/RTO      │
  ↓                          ↘              ↓                              │
R6  Returns/exchange/reverse pickup + settled refunds                       │
  ↓                                                                         │
R7  Staff roles/MFA/provider auth + RLS    R8 Notices/privacy/support       │
  ↓                                      ↘                                  │
R9  Catalog/CMS/promotions/reports + remaining customer/admin workflows     │
  ↓                                                                         │
R10 Managed staging + job scheduling + backups/monitoring + full QA <────────┘
  ↓
R11 Provider UAT + merchant approvals + all 8 journeys/17 gates
  ↓
R12 Controlled production release only after approved GO
  ↓
R13 Optional V2, only after first-sales reliability
```

Parallel procurement of EXT01–EXT12 begins at R0; **do not wait until R11** to request test accounts and approval inputs. Different engineers may work in parallel on independent branches, but payment/stock migration changes must be sequenced and integrated carefully.

## 4. Detailed phase-by-phase implementation contract

### R0 — Protect the baseline, set up execution, unblock external dependencies
**Scope:** Repository/QA readiness and external prerequisites, without changing live business data.  
**Work:** Inspect dirty worktree and current code, preserve application/original tests; reproduce critical cases in an isolated DB; inventory migrations/API/roles; establish safe feature flags and environment schema validation; add lint if absent; ensure test fixture setup/cleanup; clarify MVP vs later scope; schedule merchant tax/return/COD/packaging and provider sandbox/onboarding decisions. Run existing local test suites without conflating their counts.  
**Outputs:** Baseline revision/test matrix, a **short first-change plan** linked to source IDs, environment/access dependency list, `qa/` evidence location and reproducible seed strategy.  
**Done when:** Existing working state preserved; baseline is reproducible; no live effects; missing credentials/approvals explicitly listed (not fabricated).

### R1 — P1: make completed COD payout evidence tamper-evident **FIRST**
**Defect:** `SP-QA-003`. **Mapping:** Q07, A12, O18; gates 2, 11, 13.  
**Work:** Identify refund/payout evidence lifecycle and actual server/DB writer roles. Enforce DB-level immutability of finalized payout evidence, approval, amount, beneficiary and timestamps for normal application/service roles. Preserve corrections as separately authorized **append-only compensating records**, with actor/reason/reference, non-repudiable audit and reconciliation linkage. Restrict arbitrary privileged updates; apply least-privilege roles, signed evidence references, proper redaction and safe migration of existing rows. Avoid pretending a DB superuser can be prevented from overriding every control; define the threat model and ensure the QA-probed privileged writer is blocked by ordinary DML.  
**Regression:** Reproduce QA-D03 against the migrated DB; finalize `QA-PAYOUT-ORIGINAL` then attempt to replace it with `QA-PAYOUT-REPLACED`: direct update rejected or made non-effective; original remains; authorized correction creates a separate traceable event; refund totals and audit remain consistent. Test other final/partial states, stale approvals, two-approver authorization and concurrency.  
**Done when:** Fresh P1 regression passes in isolated DB **and** integrity is enforced under intended managed runtime role; independent actual-bank reconciliation remains a separate external gate.

### R2 — Eliminate remaining reproduced defects and absent SEO
**Mapping:** F11/Q19/C07/O07/O10/P17/Q13/M06/M07/C10/U19/F09/Q22; gates 4, 10, 14, 15. **Do not bundle unrelated changes in one giant patch.**

| Order | Defect | Required fix + permanent verification |
|---|---|---|
| 1 | `SP-QA-006` | Reject `consent:false`, missing consent, or invalid consent version **on the server**; write timestamp/source/version/decision audit, not just email. Do not send marketing until valid opt-in. Test negative HTTP and no persisted subscription. |
| 2 | `SP-QA-009` | Stop lost two-tab Add-to-bag increments. Use transactional delta increment or compare-and-swap/versioned quantity updates with safe retry; preserve absolute **set quantity** semantics for explicit edits. Parallel two-tab additions from quantity 1 result in 3, without oversell. |
| 3 | `SP-QA-004` | Deduplicate user-facing courier notices by semantic shipment/state/time identity while retaining distinct tracking evidence and webhook event records. Replayed state creates one notice, genuinely new state creates another. |
| 4 | `SP-QA-005` | Treat a worker's fenced status update as success **only when it updated its currently leased row**. Lease-loss returns neutral/lost status and accurate counters; never delete the new owner's job. Ensure external side effects retain idempotency. |
| 5 | `SP-QA-007` | Price sorting respects only variants matching all active size/color/etc filters; pagination/count/sort share the same filtered SQL/query basis. Reproduce XXL A/B fixture and correct B-before-A order. |
| 6 | `SP-QA-001` | Either wire each exposed CMS field (`eyebrow`, `description`, `story`) to visible published homepage content or deliberately unexpose unsupported fields through approved scope; preserve `storyBody`; browser assert content after save/reload for desktop/mobile. |
| 7 | `SP-QA-002` | Fix shop sidebar label colors/tokens to meet WCAG 2.2 AA (at least 4.5:1 for ordinary text); audit both default desktop and opened mobile filters across states. |
| 8 | `SP-QA-010` | Restore focus to Search trigger after Escape/close without breaking focus trap and nested dialogs; test real keyboard operation on supported engines. |
| 9 | `SP-QA-008` | Implement proper `robots.txt` (`text/plain`), `sitemap.xml` (`application/xml`), canonical metadata and accurate Product JSON-LD for published products. Avoid indexing private/admin/staging and unapproved inventory/claims. Test response types and rendered metadata. |

**Done when:** All nine items have scoped green regression proof (eight remaining behavior defects + one SEO gap), no new major regressions; keep the original P1 item closed only with R1 evidence. Local fixes do **not** convert provider/merchant gates to GO.

### R3 — Complete payment, COD and financial-event lifecycles
**Mapping:** P09–P20, O17–O18, Q07/Q13, A12; gates 9–11.  
**Work:** Separate order, payment, fulfillment, refund and COD states; implement durable payment attempts and provider uncertainty states; idempotent checkout/create order with attempts/retries/dismissal/timeouts; provider polling and replay-safe raw-body signed webhooks; robust reservation expiration hosted worker; late capture: safe reallocation or approved refund/exception; outbox/inbox and dead-letter/replay console; settlement and refund comparison with external provider; COD due/collected/remitted ledger, courier deductions/shortages, secure payout destination, independent bank evidence and correction trail; staff approval and authorization.  
**Critical negative paths:** Duplicate callbacks/webhooks; authorization without capture; wrong amount/currency; crash between provider acceptance and DB commit; provider timeout with unknown outcome; late payment after reservation release; concurrent last-SKU checkout; partial/duplicate refunds; missed COD remittance. Never double-decrement stock, double-charge or mark COD collected solely on delivery.  
**Done when:** Isolated deterministic tests and state-transition invariants pass, controlled exception dashboard works, and later **EXT01/EXT02/EXT07/EXT10** provider/bank tests are completed before release sign-off.

### R4 — Merchant-approved tax, invoice, receipts and credit notes
**Mapping:** B02–B05, P02/P07/P08, O02/O12, Q03/Q07; gates 1, 8, 13.  
**Work:** Obtain actual seller identity, GST/HSN/tax configuration and invoice policy review. Build immutable sequential/legal invoice numbering under concurrency, issuer/buyer and line-item snapshots, tax components, discounts, delivery charges, downloadable private PDF, customer confirmation and finance controls. Issue credit notes for eligible post-invoice corrections/refunds, referencing original invoice without mutation; reconciliation, safe reissue policies and access controls. Show clear meaningful order number and payment receipt/status.  
**Done when:** Parallel issuance cannot duplicate numbers, PDF numbers/totals match snapshots/approved tax rules, unauthorized fetch is denied, cancellation/refund produces correct documented treatment, and merchant/accountant approval is recorded. Do not hardcode unverified tax rates or seller details.

### R5 — Finish shipping and fulfillment exception operations
**Mapping:** P04, O05/O07–O11, A13; gates 7, 12.  
**Work:** Preserve the existing quote/booking/scan foundation. Complete admin order find/detail/pick-pack, courier choice and exact parcels, unknown booking outcomes and safe polling, shipment booking deduplication, approved pickup/handover, actual label/AWB documents, customer-visible carrier tracking, delivery failures/NDR actions, customer contact/reschedule, RTO to warehouse QC and inventory disposition, split/partial shipments where MVP requires them, cancellation boundary, return labels and reverse pickup.  
**Done when:** Complete contracted courier test flow in staging from rate/PIN through delivery plus NDR/RTO and reverse negative case; no duplicate booking; reconciled shipments and stock. Mocks are local contract proof, **not** EXT04/EXT05 acceptance.

### R6 — Finish returns, exchanges and actually settled refunds
**Mapping:** O13–O18, O21, Q07; gate 13.  
**Work:** Preserve item RMA, delivery-based windows, QC/disposition and bounded approval flows. Add privacy-checked proof uploads and media retention policy, return policy by category/defect, item quantities and partial returns, reverse pickup, received-item inspection, restock/scrap reasons, exact replacement SKU stock reservation, price difference collection/credit, no duplicate replacement/refund, prepaid provider refunds (initiation vs completion), secure COD payout with approval/reconciliation, customer/staff notifications and closure. Ensure legally required defect-remedy route is not blocked by voluntary hygiene policy.  
**Done when:** Voluntary, defect, wrong item, partial, exchange, failed pickup, duplicate and timed-out refund cases pass; actual sandbox refund and COD proof acceptance remain EXT02/EXT05/EXT10 dependent.

### R7 — Staff security, identity and database permission acceptance
**Mapping:** A01–A03, U03–U04, Q06/Q09/Q10/Q12; gate 2.  
**Work:** Staff invitations, lifecycle/suspension, least-privilege permission matrix and finance/refund step-up approval, MFA and secure recovery, complete Supabase email/Google/reset/callback provider testing, user/role impersonation boundaries, media/storage policies and RLS under real runtime roles, rate limiting and auth security reviews. Ensure support access is minimum necessary and recorded.  
**Done when:** Negative and positive permission matrix, account suspension, staff MFA finance boundary, actual provider auth and reset journey and managed RLS tests pass (EXT03/EXT07).

### R8 — Notifications, privacy, and operational customer care
**Mapping:** O21–O23, U07/U12–U14, M06–M07, Q12/Q13; gates 10, 13.  
**Work:** Consent-versioned preferences, proof of marketing consent, unsubscribe, marketing suppression, data export/completion/retention/deletion workflow and audit; idempotent transactional email/SMS templates, provider delivery logs, retries and bounces; private support attachments, assignment/SLA/escalation and approved contact/grievance details. Avoid notifying multiple times on semantic replay, and avoid sensitive lingerie order details on shared-device channels without appropriate choices.  
**Done when:** Negative consent/unsubscribe/deletion cases pass and test recipients receive actual transactional communications with end-to-end delivery status; EXT06 still required for external acceptance.

### R9 — Complete core catalog, CMS, promotions and reconciled admin reporting
**Mapping:** C03–C14/C16/C18/C20/C21, A05/A07/A11–A14, F02/F05/F11–F14, P06/P21–P23, M01–M05, O19–O20; gates 3, 4, 14.  
**Work:** Category/collection/tag CRUD, normalized sizing/fit/pack, size charts and SKU generator, correct variant media, matching-set links as scoped, multi-select faceting, search suggestions, pagination/SQL-scale queries, correct stock movements/read UI and configurable alerts; CMS content propagation, banners, version/draft/publish/schedule, navigation/footer/journal/FAQ, SEO; final decision whether flower scene mounts (currently silk-only) and required reduced-motion fallback; scheduled/targeted coupons with atomic redemption limits; review moderation; finance reports with explicit GMV/net/prepaid/COD/refund/settlement/COGS definitions and exports.  
**Done when:** Catalog editor can publish through complete role-limited journey J6; report totals reconcile to ledger across >100 orders; promotions cannot oversubscribe; homepage changes reflect published state; desktop/mobile and accessibility regressions pass.

### R10 — Managed staging, operations, observability and hardening
**Mapping:** B08/B10/B13–B15, A09/A13, Q02/Q04/Q13/Q14/Q17–Q25; gates 2, 3, 10, 15, 16.  
**Work:** Isolated managed PostgreSQL and object storage, migration/backfill/rollback drill, native role grants/RLS, pooled checkout contention, hosted scheduler for reservation expiry/reconciliation/job retries, durable queue and DLQ, health/readiness checks, structured logs/correlation/alerts, CI lint/type/build/test and branch protection, protected staging/production config, backup/restore RPO/RTO drill, incident/rollback playbooks, dependency degradation, browser/device WCAG and reasonable performance/load budgets.  
**Done when:** Deployed exact-source staging with successful remote CI, managed final-SKU/refund race proofs, monitored worker run/replay, independently restored backup, timed recovery and rollback evidence, browser accessibility/SEO/performance acceptance. EXT07–EXT09/EXT11 required.

### R11 — External integration campaigns and complete release acceptance
**Mapping:** All eight journeys J1–J8; all 17 roadmap gates; EXT01–EXT12.  
**Work:** Collect genuine signed merchant/category/tax/shipping/return/privacy approvals. Run test-mode Razorpay capture/timeout/refund and verified webhooks; Supabase verification/OAuth/reset; contracted courier pincode/rate/booking/handover/NDR/RTO/reverse; message delivery; managed DB/RLS/concurrency; backup restore; CI/staging/monitoring; performance and accessibility; finance/COD statement reconciliation. Re-run original 171-ID acceptance traceability. No live purchases until a separate authorizing GO decision and agreed spend cap.  
**Done when:** Every *MVP-critical* requirement and all 17 release gates has documented PASS/approved evidence; zero unresolved P0/P1 and no unacceptable P2 for payment, money, security, stock, checkout, shipping, privacy, invoicing or returns. An incomplete optional V2 item does not make real-sales MVP impossible if explicitly deferred and no policy or architecture contract requires it.

### R12 — Controlled production rollout and operational handoff
**Mapping:** Roadmap phase 15; gate 17; EXT12.  
**Work:** Approved production credentials, secure environment config, domain/TLS, merchant policies/contact, stock migration, operations runbooks and training, inventory/settlement reconciliation monitoring, gradual rollout/feature flags, independently authorized low-value smoke purchase/refund/courier test with cost limit, rollback readiness and support/on-call ownership.  
**Done when:** Documented final **GO** signed by engineering/QA/merchant/operations; authorized live test and reconciliation verified; monitoring operational. If not, remain **NO-GO** with truthful blockers.

### R13 — Optional roadmap V2 after real-sales stability
**Scope:** Back-in-stock, personalized recommendations, richer fit quiz and sets, loyalty/referrals/gift cards, abandoned-cart/WhatsApp where consent permits, international/multicurrency/multiwarehouse, supplier forecasts, Kling video.  
**Rule:** Require explicit feature approval, correct stock/financial/consent modeling and QA before each release. These should not distract from real-sales-critical fixes.

## 5. External dependency campaign — start in R0, accept in R11

| ID | External evidence required | Dependency to arrange early |
|---|---|---|
| EXT01 | Razorpay test capture, methods, failure/dismissal, timeout, webhook replay | Approved merchant test account, keys and safe callback/webhook test URL |
| EXT02 | Actual sandbox full/partial refund and settlement readback | EXT01 captured test charge |
| EXT03 | Supabase email verification, Google OAuth, reset, callback safeguards | Isolated provider project, redirect allowlist and test mailbox |
| EXT04 | Real courier test rate/PIN, booking, AWB, pickup, scans | Courier-approved test account, origin and serviceable test PIN |
| EXT05 | NDR/RTO and reverse pickup/exchange | Courier-approved negative/reverse test workflow |
| EXT06 | Transactional messaging, preferences and unsubscribe | Sender/provider configuration and consented test recipient |
| EXT07 | Managed PostgreSQL migrations, runtime RLS and pooled contention | Isolated managed DB with least-privilege service identities |
| EXT08 | Backup/restore, measured recovery against RPO/RTO | Isolated restore target, backup system and operations approval |
| EXT09 | Remote CI, stage scheduler, alerts, integration health | Repo/environment ownership and monitored staging |
| EXT10 | Seller/KYC/category/tax/returns/contact/COD bank approvals | Merchant and relevant provider/professional reviewers |
| EXT11 | Agreed-load, CWV, accessibility and uptime evidence | Test population, devices, stage capacity and approved targets |
| EXT12 | Low-value *live* smoke order/refund/courier | Separate explicit go-live authorization, merchant approval and cost cap |

## 6. Definition of done for each change

- Reproduced defect or documented requirement gap with issue ID; established safe test preconditions.
- Implemented complete business outcome with permission/security/transactional consistency, not just UI.
- New regression **fails on previous behavior and passes after fix**; relevant existing suites pass.
- Migration runs on empty and representative retained schema/data; rollback or forward-fix rehearsed.
- Evidence links include exact command, environment, data setup, screenshots/traces where relevant and sanitized DB assertions.
- Requirement ID's existing implementation status is changed **only if grounded**, plus separate QA execution state; relevant defect closed only after independent retest.
- `qa/RELEASE_READINESS.md` gate remains UNVERIFIED/BLOCKED until all its conditions are met, regardless of local passing subset.
- Handoff describes remaining blockers, external credential dependencies (never actual secrets), and the exact next safe slice.

## 7. Final release gate — stringent GO / NO-GO

**NO-GO automatically** for unresolved payment capture/refund/COD evidence integrity; insecure role/RLS/MFA controls; stock oversell/corruption; absent legally required invoice/tax documentation; unsupported shipping/return/refund operations advertised to users; missing merchant/PSP/courier approvals; unknown provider outcomes; absent backup restore/incident response; or incomplete critical external journeys.

**GO only** after all 17 first-sales release gates have accepted target-environment evidence, eight essential journeys pass, approved merchant documents/configuration are present, and the team explicitly authorizes the controlled launch. Publish any optional deferred scope separately and never relabel mocked tests as live acceptance.

<!-- LOCAL-RECOVERY-2026-11-01 -->
## Execution evidence supplement

2026-11-01T15:08:44.621Z: R1 and the listed R2 defect fixes now have local retest evidence in [the recovery report](Sky_Petal_Local_Recovery_Report.md). Privacy/order-history and performance prerequisites were also implemented; SP-QA-013 mobile LCP stays open. This note records execution sequencing, not a replacement feature-status ledger. All 171 IDs stay in the implementation audit. Next local slice is R3 payment-attempt lifecycle/reconciliation. Full first-sales implementation and EXT01–EXT12/17-gate acceptance are unfinished; NO-GO remains.
