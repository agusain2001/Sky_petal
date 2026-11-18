# Modules to focus on — QA planning index

**Current recovery:** [Fresh local implementation and retests](../Sky_Petal_Local_Recovery_Report.md) supersede the historical snapshot statements below for the specified scope. Thirteen defect repros close locally; SP-QA-013 remains open. The project is incomplete and real sales remain NO-GO.

**Release assessment: NO-GO for real customer orders.** This list derives from the existing [implementation audit](../Sky_Petal_Implementation_Coverage_Audit.md), the [roadmap](../Sky_Petal_Full_Implementation_Roadmap.md), current source and the fresh [QA execution](EXECUTION_REPORT.md). It is a planning index, not a second implementation status ledger.

All 16 roadmap phases still have unaccepted requirements. Individual features work locally; no entire broad module has complete production acceptance. The 171 classifications are **49 COVERED, 68 PARTIAL, 9 INTEGRATION, 2 FOUNDATION, 31 MISSING, 11 UNVERIFIED, 1 DEFERRED**. These are neither test counts nor a reliable development percentage. In particular, 110 rows describe unfinished implementation/integration/foundation work, 11 need external evidence, and 1 is explicitly deferred. Some are optional.

## Focus first: essential real-sales gaps

| Order | Module / phases | Working locally | What is still incomplete | Audit IDs | Evidence needed to close |
|---|---|---|---|---|---|
| 1 | Financial integrity / 2, 9, 11 | Capture/refund bounds, approvals, manual COD ledgers, immutable events | Completed COD payout evidence is mutable (SP-QA-003); full corrective accounting, secure payout destinations, settlement/bank statements and exceptions | Q07, A12, O17–O18, P19–P20 | Reject ordinary edits, retain compensating correction history; rerun QA-D03 plus actual sandbox refund/bank reconciliation |
| 2 | Payment recovery and reconciliation / 9 | Signed raw ingress, captured evidence checks, idempotent reservation/capture, durable exceptions | Complete attempts/authorized/failed lifecycle, create uncertainty, provider polling/settlement/disputes, late-capture refund/reallocation, deployed expiry/recovery | P09–P17, P20, Q13 | Sandbox success/failure/dismissal/timeout/retry/refund/late capture with DB ledger proof; independent hosted scheduler |
| 3 | Merchant/tax/legal/catalog readiness / 0, 8, 15 | Draft policies and configurable tax/checkout gates | Actual seller/contact/KYC/category approval, rates/HSN/invoice review, final product/color/fit claims, packaging and serviceability SOP | B02–B05, F08, F13, P02, A14, Q26 | Recorded merchant/provider/professional approvals; actual configured catalog and policies. QA does not invent these |
| 4 | Invoice / receipt / credit-note accounting / 8, 10, 11 | Copied order/tax/price/address snapshots | Invoice entity/serials, compliant PDF/download, credit notes, meaningful order numbers and dedicated payment/confirmation experience | O02, O12, P07–P08, Q03/Q07 | Unique numbering and private PDF assertions against approved seller/tax settings |
| 5 | Courier and fulfillment exceptions / 10 | Quote adapter, queued booking/AWB/pickup/documents, authenticated scans and RTO evidence | Actual courier acceptance; NDR actions, cancellation/unknown-outcome runbooks, polling, RTO warehouse/QC recovery, order search/pick-pack; multiple shipments incomplete | P04, O05, O07–O11 | Staging booking → physical/test handover → tracking/delivery; negative NDR/RTO plus no duplicate booking |
| 6 | Returns / exchanges / remedies / 11 | Item RMA, copied terms, delivery-based windows, receipt/QC/disposition, bounded refund review | Proof uploads, reverse pickup, actual replacement SKU/stock/price-difference workflow, case closure and merchant policy acceptance | O13–O18 | Full defect/voluntary/partial return and exchange through actual sandbox refund or verified COD payout |
| 7 | Staff security and production identity / 2, 3, 6 | Local sessions, recognized staff roles and tested selected API/RLS denials | Staff invitation/role editor/granular permissions, admin MFA/step-up, suspended-account workflow; real Supabase email/Google/reset acceptance | A01–A03, U03–U04, Q06/Q09/Q10 | Provider auth/reset/PKCE/session tests; actual runtime-role RLS matrix and MFA finance boundary |
| 8 | Managed infrastructure and recovery / 1, 2, 9, 14, 15 | CI source, migrations, local persistence, protected job consoles | Managed DB contention/storage, readiness/env validation/lint, hosted workers, correlated logs/alerts, backup restore/RPO/RTO, incident/rollback/training and remote CI proof | B08/B10/B13–B15, A09/A13, Q02/Q04/Q13/Q14/Q20/Q23–Q26 | Stage deployment, alert drill, managed final-SKU race, isolated restored backup, approved rollout/rollback |
| 9 | Customer communications and support operations / 10, 11 | Private in-app updates; owned support threads, staff notes, assignment/resolution | Duplicate tracking notices (SP-QA-004), outbound email/SMS templates/provider delivery, support attachments/SLA/grievance/contact ops, notification preferences | O21–O23, U12, Q12/Q13 | Exactly-once event notices; actual test-recipient delivery; private proof uploads, formal care operation |

## Complete the main customer/admin experience next

| Module / phases | Current subset | Missing or failing work | Audit IDs |
|---|---|---|---|
| Catalog modeling and merchandising / 3, 5 | Published catalog, unique size/color SKUs, base category queries | Category/collection/tag CRUD, normalized band/cup/pack, fit attributes/charts, variant media/video, SKU generator/barcodes, independent matching sets | C03–C06, C16/C18/C20; A05/A07 |
| Search/filter/sort/scale / 5 | Basic substring search, same-SKU combined filters, URL persistence | Selected-SKU price sort fails (SP-QA-007); multi-select/advanced facets, autocomplete/typos/trends, server pagination and scalable queries | C07–C14, Q21 |
| CMS/brand content / 4, 12 | Headline/storyBody/announcement and static info pages; active silk scene | Saved eyebrow/description/story do not render (SP-QA-001); banners/media/3D controls, schedules/drafts/versions, menus/footer/FAQ/journal/SEO. Procedural bloom code is dormant, not mounted; decide current roadmap scope | F02/F05/F11–F14 |
| Inventory operations / 3, 9 | Available stock/reserved, conditional reservations, selected movements and low-stock display | Physical on-hand/warehouse model, full reserve/release/adjustment actor/reason/idempotency ledger/read UI, thresholds/alerts; optional receiving later | P21–P23, A11–A13, Q05 |
| Cart/profile/privacy / 6, 7 | Guest persistence, local login merge, wishlist, full saved-address edit/delete/default/checkout selection | Two-tab Add to bag loses an increment (SP-QA-009); broader merge/stale-stock recovery acceptance, provider auth, complete profile/preferences, privacy export inventory and deletion processing | U03–U04/U07/U10/U12–U14/U19 |
| Promotions / 8, 12 | Simple active percent coupon | Fixed/targeted/stacked/scheduled offers, minimum spend/budgets/expiry, per-customer and total redemption limits/races | P06, M05 |
| Finance and operations reporting / 12 | All-record captured-prepaid tile, recent orders and limited counts | GMV/net/refund/COD/settlement formulas, date filters, reconciled exports, AOV/funnel, COGS/value/margin, campaign/RTO reporting | M01–M04 |
| Reviews / 11, 12 | Delivered-purchase review eligibility/source | Full delivered-buyer positive acceptance, moderation/replies/reporting/photo policy; Q&A optional | O19–O20 |
| Accessibility/SEO/performance / 14 | Existing desktop/mobile browser regressions, subset axe, reduced motion/WebGL fallback | Desktop filter contrast (SP-QA-002), keyboard search focus return (SP-QA-010); manual WCAG/screen-reader/zoom, independently accepted Firefox/WebKit/real devices, SEO documents/canonical/JSON-LD (SP-QA-008), CWV/agreed-load/GPU/uptime evidence | C21, Q17–Q22 |
| Marketing consent / 6, 12, 13 | Browser checkbox and email persistence | Server accepts consent:false (SP-QA-006); consent/version records, unsubscribe, outbound provider/templates/preferences | U12, M06–M07 |

## Explicit later/optional scope

Back-in-stock alerts (U21), personalized/recently viewed products and fit quiz (M08–M09), matching-set/bundle enhancements (M10, scope dependent), loyalty/referrals/gift cards/subscriptions (M11), abandoned-cart/WhatsApp (M12), multilingual/international/multi-currency/multi-warehouse (M13), purchasing/forecasting (Q27), and Kling video (F06) should follow reliable commerce unless explicitly promoted into MVP. Do not present any as working today. A later-scope gap alone is not a launch blocker.

## Corrections to older Markdown claims

- Saved-address edit/delete/default/checkout selection is **implemented and freshly tested**, not missing. U09/U11 should not be rebuilt.
- COD placement/confirmed-unpaid/collection/remittance and refund/support code now exists. The remaining work is financial/provider/operational closure, not starting those entire modules from zero.
- Customer-owned order/scans and courier booking code exist; manual/synthetic proofs still do not establish actual provider operations.
- Return windows use delivery evidence/copied terms now; defect remedies remain reviewable. Do not repeat the old order-created-time diagnosis without a failing case.
- The captured-prepaid tile passed a >100-order check. Full finance reports remain absent; this specific historic truncation concern did not reproduce.
- Expiry has protected CLI/HTTP entry points. Hosted scheduling/alerts are still unverified.
- The current homepage mounts only silk. Older bloom/hero descriptions and images do not prove that a flower is currently rendered; the roadmap scope discrepancy remains explicit.
- `stock` already means available stock. Do not subtract `reserved` from it again.

The smallest first remediation is **SP-QA-003's completed payout-evidence guard**, followed by its permanent regression. In parallel at the business level, obtain sandbox/provider/merchant setup needed to close the payment and fulfillment campaigns. Product fixes were not part of this QA-only run.

<!-- LOCAL-RECOVERY-2026-11-01 -->
## Local recovery update

2026-11-01T15:08:44.621Z. This planning index's earlier defect descriptions are historical. [Fresh recovery](../Sky_Petal_Local_Recovery_Report.md) resolves payout immutability/corrections, explicit consent/unsubscribe, cart increment loss, semantic notice duplication, worker accounting, matching-SKU sort, exposed CMS field rendering, contrast/focus/label findings, missing SEO documents and persisted-support export. Batched history meets the local latency target; mobile LCP remains open.

Current 171-ID classifications are 51 COVERED, 70 PARTIAL, 11 UNVERIFIED, 28 MISSING, 1 DEFERRED, 2 FOUNDATION, 8 INTEGRATION in the canonical audit. Essential local payment-attempt/reconciliation, invoice/credit-note, reverse/exchange, staff/MFA, outbound messaging and operations work still remains; staging absence is not the only remaining gap. Real provider/merchant/managed acceptance stays blocked.
