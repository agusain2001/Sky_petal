# Release readiness — NO-GO

**Current recovery:** [Fresh local implementation and retests](../Sky_Petal_Local_Recovery_Report.md) supersede the historical snapshot statements below for the specified scope. Thirteen defect repros close locally; SP-QA-013 remains open. The project is incomplete and real sales remain NO-GO.

Assessed 1 November 2026 against the dirty working tree based on `2217a83c2f0aa81b09a3f310a5732fd858cbf76f`. The source/DB/HTTP/browser campaign is local and synthetic. No staging/provider/live approval is implied. **Zero of the 17 full target-environment launch gates is signed off.** Several local subsets pass; the gate decision remains separate.

P1 SP-QA-003 permits privileged SQL modification of completed COD payout evidence. No public customer exploit was demonstrated. Essential sandbox payments, actual courier operations, approved tax/policies, MFA/runtime-role controls and backup restore also lack acceptance. These independently prevent a GO decision. Optional V2 omissions are not used as artificial launch blockers.

## All 17 roadmap gates

| Gate | Roadmap criterion | Decision | Fresh evidence and exact remaining dependency | IDs |
|---|---|---|---|---|
| 1 | Legal/product category and payment-provider review | UNVERIFIED | No signed merchant/KYC/category/tax/privacy/returns/contact approvals inspected; draft local content only | B02–B05, F08/F13 |
| 2 | Admin permissions and RLS | UNVERIFIED | Selected RLS and 185 role-route probes pass; actual managed runtime grants, complete table matrix, MFA and suspended sessions not accepted | A01–A03, Q06 |
| 3 | Product/SKU CRUD and inventory movements | UNVERIFIED | Existing owner HTTP create/edit/publish/archive and local invariant tests pass; complete adjustment ledger/idempotency and managed contention remain | A04/A06, P14/P21/P22 |
| 4 | Catalog/size-color filters desktop/mobile | FAILED | Same-SKU filtering and URL regressions pass; selected-SKU price sorting fails QA-H12. Advanced discovery/scale incomplete | C07–C14 |
| 5 | Guest cart persistence/login redirect | FAILED local concurrency; target BLOCKED | Persistence/login subsets pass; request-barrier two-tab add loses an increment (SP-QA-009). Provider merge/device acceptance remains | U15-U19 |
| 6 | Addresses create/edit/default/validation | UNVERIFIED target; local subset PASS | Domain/HTTP/browser CRUD/default/billing/checkout selection pass; actual courier geography/serviceability acceptance remains | U08–U11 |
| 7 | Courier-based pincode eligibility/quote | UNVERIFIED | Mocked contract/negative checks only; needs approved courier test credentials, serviceable PIN and real merchant rate/ETA response | P04 |
| 8 | Server tax/promotions/delivery/COD fee | UNVERIFIED | Synthetic tax/quote/COD paise assertions pass; actual HSN/GST/shipping/promo approval, invoice configuration and target acceptance absent | P01–P08/P18, B04 |
| 9 | PSP sandbox success/failure/timeout/refund | UNVERIFIED | Local signature/capture/refund mocks pass; needs Razorpay sandbox account/keys/webhook secret and actual capture/refund proof | P09–P13, O17 |
| 10 | Duplicate/late webhook and inventory races | FAILED local recovery; target BLOCKED | Local final-SKU/capture replay pass; duplicate semantic notices and stale-worker success statistics fail. Managed/provider contention remains | P11/P14-P17, Q13 |
| 11 | COD unpaid/collection/remittance reconciliation | FAILED full control; local lifecycle PASS | Synthetic quoted COD browser and ledger limits pass; completed payout evidence is mutable QA-D03. Actual courier/bank statement reconciliation absent | P18–P20, O18, Q07 |
| 12 | Fulfillment/tracking/NDR/RTO | UNVERIFIED | Mocked booking uncertainty/tracking/monotonic/RTO checks pass; actual courier handover, NDR/reverse/cancellation/warehouse recovery incomplete | O05/O07–O11 |
| 13 | Policy-correct returns/exchanges/refunds | UNVERIFIED | Local item/RMA/QC/caps/approval tests pass; actual reverse pickup/exchange/proof uploads/settled refund and approved remedy policy missing; QA-D03 open | O13–O18 |
| 14 | Editable banners/collections/3D | FAILED | CMS eyebrow/description/story save but fail rendering in both projects; banner/collection/3D publishing absent/incomplete; flower dormant | F02/F11/F12, A05 |
| 15 | Mobile/motion/WebGL/accessibility | FAILED | Existing 26 browser checks pass; 320px scan and fallback pass; desktop filter contrast and keyboard search focus-return fail. Manual assistive-technology/accepted cross-engine/physical-device evidence remains open | F04, Q17/Q19/Q20 |
| 16 | Backup restore/incident/rollback drills | UNVERIFIED full gate; local restore PASS | Closed disposable store restores matching financial/count/migration state and serves private orders. Automated managed backup/RPO/RTO/incident/rollback remains unverified | Q23-Q25 |
| 17 | Production onboarding/approved live smoke | UNVERIFIED | Merchant onboarding/deployment approvals unavailable; no separate live authorization/cost cap. No live side effects attempted | B03/B14, Q26 |

These gate IDs reproduce roadmap section 15 order. “FAILED” means a concrete current failure or absent required publishing behavior; “UNVERIFIED” means the full gate lacks required proof, even if implementation is partial. Gate statuses are not replacements for the audit taxonomy.

## Eight complete business journeys

| Journey | Full decision | Proof of local subset / why full journey is not accepted |
|---|---|---|
| J1 guest → prepaid → delivered | BLOCKED | Guest/cart/auth/address browser subset passes; no actual Supabase/Razorpay/courier capture-to-delivery proof or outbound notice |
| J2 COD → collected → remitted | BLOCKED | `e2e/pricing-cod.spec.ts` passes desktop/mobile with persisted synthetic quote and manual finance evidence; no actual courier collection or bank statement; SP-QA-003 open |
| J3 two buyers/final SKU | BLOCKED target; local PASS | QA-D01: exactly 1 reservation; stock=0/reserved=1. Existing DB contention tests pass. Managed pooled workers and customer loser/recovery UI still need acceptance |
| J4 gateway failure/retry/late event | BLOCKED | Local signature/replay/late-exception/cancellation/expiry tests pass; actual popup/provider timeout/multi-device recovery and reconciliation missing |
| J5 RMA → reverse pickup → refund/exchange | BLOCKED | RMA/QC/restock/approved refund/private update browser subset passes; reverse booking, actual replacement and real refund settlement absent |
| J6 catalog editor publish → coupon → immutable history | NOT RUN as combined journey | Component slices pass owner catalog HTTP, coupon/domain snapshots and public SKU browser checks; full catalog-editor-role combined positive/negative/recovery chain not executed |
| J7 access-control attack matrix + finance-only refund | BLOCKED full acceptance | 185 role-route plus customer/guest boundaries pass; full direct-positive mutation/suspended/MFA/managed-role table matrix remains, no complete security sign-off |
| J8 retry/reconcile/notify once/restore | FAIL local dedup/lease subset; managed recovery BLOCKED | QA-D04/05 fail; QA-O01/02 local restore/readback pass. Actual provider discrepancy and managed backup/incident drills remain |

No complete provider journey is labeled PASS from mocked responses. Negative/recovery evidence is present for selected local slices; full negative/recovery variants of all eight journeys remain open.

## External campaign blockers

| Case | Required evidence | Dependency / status |
|---|---|---|
| EXT01 | Razorpay capture/methods/failure/dismiss/timeout/replay | BLOCKED: approved isolated sandbox account, test keys, hosted test callback/webhook endpoint and synthetic buyer |
| EXT02 | Prepaid partial/full refund settlement/retry | BLOCKED: EXT01 capture plus real test refund/readback/webhook receipt |
| EXT03 | Supabase email verification/reset/Google/callback security | BLOCKED: isolated provider project, allowed redirect settings, OAuth client and controlled test mailbox |
| EXT04 | Courier rate/PIN/city/booking/AWB/pickup/label/tracking | BLOCKED: merchant test credentials, configured pickup, eligible test PIN and courier-approved test campaign; mocks alone insufficient |
| EXT05 | NDR/RTO/reverse pickup/exchange | BLOCKED: missing operational actions/reverse/replacement workflow plus courier-approved test flow |
| EXT06 | Transactional message delivery/preferences/unsubscribe | BLOCKED: missing outbound workflow/consent and sender/test-recipient/provider configuration |
| EXT07 | Managed PostgreSQL migration/RLS/pooled final-SKU/refund race | BLOCKED: isolated managed instance, least-privilege role and fixture/cleanup authority |
| EXT08 | Backup restore/RPO/RTO | BLOCKED: real backup, isolated restore target, runbook and operations access |
| EXT09 | Remote CI/staging monitoring/scheduler | BLOCKED: exact-commit remote CI/deployment evidence and staging operations access |
| EXT10 | Merchant tax/category/policy and bank/COD approval | BLOCKED: merchant/provider/professional approvals and independent statement evidence |
| EXT11 | Agreed-load/CWV/GPU/availability acceptance | NOT RUN: representative stage/device/traffic model, field data and operating baseline unavailable; small local timing observation is separate |
| EXT12 | Approved low-value production order/refund/courier | BLOCKED: merchant onboarding and explicit separate live authorization/cost cap not supplied |

## Next release review

Fix and independently retest P1 financial evidence protection first. Complete first-sale invoice, payment reconciliation, returns/reverse/exchange, outbound notification and access/recovery controls from [MODULE_GAPS.md](MODULE_GAPS.md). Then execute target-environment provider/managed-DB/restore campaigns, close observed P2 defects, and obtain merchant/operations sign-off. Do not claim a conditional launch while essential money/provider/recovery gates remain open.
## Independent local verification supplement

**NO-GO remains the final recommendation. Zero of 17 full target-environment gates is signed off.** The original gate table above remains the merchant/provider checklist; the following fresh evidence updates it without closing a full gate.

- Gates 4/5: exact-SKU filtering passes, matched-SKU price sorting fails; two-tab cart loses an increment (SP-QA-007/009).
- Gates 10/11/13: local stock/refund caps and approvals pass. Completed manual payout evidence can be replaced by privileged DML (SP-QA-003); immutable event records remain protected and no public exploit is demonstrated. Courier semantic duplicate notices and false stale-worker success remain open (SP-QA-004/005). Real provider reconciliation remains BLOCKED.
- Gates 14/15: ignored CMS fields, contrast, visible-label/name mismatch and Escape focus return fail (SP-QA-001/002/010/011). WebKit cart passes the corrected HTTPS environment; Firefox crashes during blank-page preflight. Physical-device/manual assistive acceptance remains open. Lighthouse mobile LCP/home CLS and local order-history p95 miss investigative budgets (SP-QA-013/014); field p75/INP is unmeasured.
- Gate 16: a closed disposable local backup now restores matching financial/count/migration state and serves authenticated orders; expired/replayed sessions stay denied. This is not automated managed backup, RPO/RTO, full incident failover or rollback acceptance.
- Privacy/security: role forging, expiry/revocation, ownership and tested role-route boundaries pass locally. Newsletter ignores refusal and export omits stored support data (SP-QA-006/012). No complete production security sign-off.

Eight journeys remain full-target **J1/J2/J3/J4/J5/J7 BLOCKED**, **J6 NOT RUN as a combined publication-to-delivery journey**, **J8 FAIL local dedup/lease subset plus BLOCKED managed/provider recovery**. Fresh J6 subcase QA-D09 proves catalog edits/archive cannot rewrite purchased items; fresh J8 local restore/session recovery passes. These do not complete the missing provider/operational steps.

All 171 requirements have dispositions and linked evidence in [traceability](REQUIREMENTS_TRACEABILITY_MATRIX.md); focused run totals and limitations are in [execution](EXECUTION_REPORT.md). Full requirement results: 2 PASS, 46 FAIL, 17 BLOCKED, 105 NOT RUN, 1 SKIPPED. No launch-readiness percentage is asserted. Do not accept real sales until first-sale omissions/defects are resolved and approved managed-stage/provider/merchant acceptance is evidenced. No charges, refunds, payouts, courier bookings or external messages were initiated in this audit.

<!-- LOCAL-RECOVERY-2026-11-01 -->
## Current local recovery delta — NO-GO retained

2026-11-01T15:08:44.621Z. The historical tables above retain their snapshot evidence. [Recovery retests](../Sky_Petal_Local_Recovery_Report.md) close SP-QA-001–012 and SP-QA-014 locally; SP-QA-013 remains OPEN.

- Gates 4/5: selected-SKU sorting and two-tab delta adds now pass; broader discovery/login-merge/target acceptance remains incomplete.
- Gates 2/10/11/13: completed refund evidence is database-protected with independently approved corrections; duplicate notices and stale-worker statistics now pass. Managed roles/races, bank reconciliation, payout destinations, full returns/exchanges and actual PSP settlement remain unaccepted.
- Gates 14/15: exposed CMS field propagation and reported automated contrast/focus/label failures now pass both viewports. Broad CMS/3D publishing, complete manual WCAG/device acceptance and mobile LCP remain unfinished.
- Privacy support export and long-order local API latency now pass; formal retention/deletion and managed performance remain unaccepted. Gate 16 still needs managed restore/incident/rollback acceptance.

**0 of 17 full target-environment gates are signed off.** J1/J2/J3/J4/J5/J7 remain BLOCKED for full target acceptance; J6 is still not accepted as a combined full journey. J8's local dedup/lease subset now passes, while managed/provider recovery remains BLOCKED.

EXT01/02/03/04/05/06/07/08/09/10/12 remain BLOCKED; EXT11 target acceptance remains UNVERIFIED, with a failing local mobile LCP budget. User selected local continuation because staging is not ready. No live authority is implied. Next local work remains R3 payment lifecycle/reconciliation, followed by missing first-sale invoice/reverse/exchange/security/message/operations implementation.
