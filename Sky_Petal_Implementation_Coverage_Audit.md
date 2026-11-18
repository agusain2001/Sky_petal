# Sky Petal — Implementation Coverage Audit

**Audit baseline:** 1 November 2026 (Asia/Kolkata); local commerce/security/privacy supplement updated 10 November 2026.
**Baseline:** [Full implementation roadmap](Sky_Petal_Full_Implementation_Roadmap.md), especially sections 2–15.  
**Assessment:** Substantial local storefront and commerce implementation; the full roadmap and real-sales release are **not complete**.

This report compares the current source, schema, routes, tests and delivery notes with the roadmap. It describes what exists now, without treating the roadmap's proposed work as completed work. The initial assessment was read-only; the local implementation increments recorded below change application features. Business approvals, provider dashboards, deployment infrastructure and live transactions were not inspected.

## 1. How to read the checklist

| Status | Meaning |
| --- | --- |
| **COVERED** | The specifically named capability exists in the local implementation. This does not certify its entire parent module or production readiness. Test evidence is stated separately. |
| **PARTIAL** | A working subset exists, but stated requirements or acceptance checks remain. |
| **INTEGRATION** | Provider-facing code exists; configuration and successful provider tests are still required before accepting the integration. |
| **FOUNDATION** | Schema or scaffolding exists, without the complete usable workflow. |
| **MISSING** | No implementation found for the named capability in the inspected source. |
| **UNVERIFIED** | Completion requires external evidence that is absent from this workspace or was not checked. This does not prove the external work has never happened. |
| **DEFERRED** | Optional/later work explicitly deferred in delivery notes. |

**Counting rule:** The detailed tables in section 4 form the feature inventory. Phase summaries, schema mappings, route mappings, journeys and release gates are cross-checks of that inventory; do not add their rows to a completion total. Rows vary in scope, so a percentage of rows would not be a reliable engineering-effort or launch-readiness percentage.

**Phase rule:** No full phase can be signed off from the available evidence. Each phase has at least one unfinished or unverified Definition of Done requirement. This is compatible with many individual features being covered.

**Inventory totals:** 171 detailed checklist rows, with unique IDs and checked local evidence links.

| Status | Rows |
| --- | ---: |
| COVERED | 51 |
| PARTIAL | 71 |
| INTEGRATION | 8 |
| FOUNDATION | 2 |
| MISSING | 27 |
| UNVERIFIED | 11 |
| DEFERRED | 1 |
| **Total** | **171** |

For planning: **51 rows describe covered local capabilities; 108 describe incomplete implementation/integration/foundation work; 11 need external verification; 1 is explicitly deferred.** Some incomplete items are optional/V2. These are feature classifications, not a completion percentage; see the independent QA supplement for execution dispositions.

## 2. What is already usable, and what remains

| Area | Already covered | Remaining before full roadmap acceptance |
| --- | --- | --- |
| Storefront | Responsive editorial homepage, navigation, mounted silk scene, motion controls, catalog, PDP and sample media | Complete CMS coverage, verified merchant content, advanced discovery, full accessibility/performance acceptance |
| Shopping | Exact size/color SKU selection, persistent guest bag, account merge, wishlist, server pricing and basic coupons | Concurrent cart-update acceptance, real shipping/tax rules, advanced offers |
| Identity | Local registration/login/logout, sessions, password changes, ownership and role checks | Provider verification/reset/Google tests, admin MFA, granular staff management, complete preferences/privacy operations |
| Payments/inventory | Reservations, local final-SKU contention, checkout idempotency, captured-payment validation, duplicate capture protection and local COD ledgers | Gateway/courier sandbox proof, complete payment attempts/retries, hosted expiry/reconciliation, immutable COD payout evidence and verified provider acceptance |
| Studio/admin | Product and SKU editing, archive/publish, local media upload, stock display, manual fulfillment steps, limited homepage editing, coupon editor | Category/collection management, broader business operations, role administration, finance, customer care and operational consoles |
| After purchase | Private order/detail/scans, cancellation, item RMA/QC/restock, bounded refunds, replacement-order links, private invoice/credit-note PDFs, support and account updates | Actual courier/refund/accounting acceptance, approved seller/policy configuration, reverse pickup, proof uploads, email/SMS and full operational closure |
| Delivery/operations | TypeScript project, SQL migration/seed helpers, RLS policies, test suites, CI workflow source | Verified remote CI/staging, hosted database/storage, monitoring, load tests, backup restore, live provider acceptance and launch operations |

## 3. Phase-by-phase roadmap comparison

| Phase | Assessment | Present | Missing or unverified phase acceptance |
| --- | --- | --- | --- |
| 0 — Discovery and commercial policy | PARTIAL | Roadmap, India/INR assumptions, sample taxonomy, roles and brand direction | Approved PRD/journeys, seller/KYC/category eligibility, reviewed policies/tax, shipping SOP, KPIs and ownership sign-off |
| 1 — Project and infrastructure | PARTIAL | Next.js/TypeScript, strict typing, styling, reusable components, env example, CI workflow | Lint setup, environment validation, protected environments, staging deployment, health checks, structured monitoring/logging and remote CI evidence |
| 2 — Database/RLS/migrations | PARTIAL | Core local schema, SQL export/migration, sample seed, RLS, indexes and local concurrency test | Complete roadmap entities, managed PostgreSQL verification, storage policies, broader permissions/financial controls and restore test |
| 3 — Admin/catalog/stock | PARTIAL | Role-guarded Studio, product/SKU forms, publishing/archive, image upload and movement writes | MFA, invitations/granular permissions, category/collection CRUD, SKU combination generator, richer stock ledger and exact-once adjustment acceptance |
| 4 — Design/3D/CMS | PARTIAL | Editorial responsive UI, bloom viewer, silk scene, pause/reduced-motion/fallback code and automated browser checks | Full CMS/banners/3D controls, reconnect unused CMS fields, current-source visual acceptance and complete accessibility audit |
| 5 — Catalog/PDP/search | PARTIAL | DB catalog, basic combined filters, URL state, sort, search, gallery/zoom, SKU validation and general fit guide | Advanced lingerie/collection filters, autocomplete, pagination, richer product attributes/media, complete discovery SEO and remaining acceptance tests |
| 6 — Customer identity/addresses | PARTIAL | Local auth, provider integration source, profile name, complete address CRUD/defaults, saved checkout selection, privacy actions | Provider tests, full geographic/serviceability validation, preferences and completed privacy handling |
| 7 — Cart/wishlist/merge | PARTIAL | Persistent guest and account bags, capped SKU merge, drawer/page, wishlist, server checks | Concurrent cart quantity/merge acceptance, comprehensive out-of-stock recovery; guest persistence uses a DB plus cookie rather than local storage |
| 8 — Pricing/shipping/tax/promotions | PARTIAL | Server paise pricing, basic percent coupons, preview fee threshold, checkout gate and order snapshots | Merchant-reviewed tax/invoice settings, real courier contract acceptance, expanded coupon rules/redemption limits and staging acceptance |
| 9 — Payments/COD | PARTIAL | Capture/COD ledgers, bounded approved partial/full refunds, durable evidence/retry and manual COD payout proof | Sandbox acceptance, full attempts/create uncertainty, late-capture/dispute/settlement resolution, hosted workers and bank/courier reconciliation |
| 10 — Orders/courier/fulfillment | PARTIAL | Private order/scans, manual fulfillment, queued courier booking/AWB/pickup/labels, source/amount checks and RTO evidence | Actual provider acceptance, NDR/reverse/cancellation recovery, full pick-pack/search/corrections, partial shipments and invoices |
| 11 — Returns/refunds/support | PARTIAL | Copied item terms, RMA/receipt/QC/restock, finance approvals, verified refund state, private support and in-app updates | Approved policy/remedies, uploads, reverse pickup, real replacements/price differences, outbound messages and full case/provider acceptance |
| 12 — Marketing/CMS/insights | PARTIAL | Basic coupons, limited home text editing, local newsletter capture, small admin metrics and catalog CSV | Scheduled/targeted promotions, full CMS/blog/menu/banner editing, templates/moderation, trustworthy comprehensive finance/funnel reports and exports |
| 13 — Retention/merchandising | PARTIAL | Featured-related products, product tabs, general measurement guidance and newsletter form | Personalized recommendations/quiz, recently viewed, matching sets, back-in-stock, unsubscribe/provider delivery and optional loyalty/referrals/gifts |
| 14 — Hardening/QA/SEO | PARTIAL | Local commerce/security tests, HTTP/browser suites, axe subset and reduced-motion/overflow checks | Whole staging purchase-to-delivery/refund journeys, broader RLS/security/concurrency tests, load/CWV budgets, full WCAG review, SEO files and recovery drill |
| 15 — Production/operations | UNVERIFIED | Local run instructions and provider setup notes | Production hosting/KYC/provider connections, live smoke purchase/refund/courier proof, approved launch checklist, support/incident/rollback/backup SOPs and admin training |

## 4. Detailed feature inventory

Evidence IDs link to source and verification material in section 5. A source reference establishes implementation presence; it does not mean every behavior in that file has been exercised by a test.

### A. Business requirements, repository and environments

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| B01 | Product/engineering roadmap and market assumptions | COVERED | Roadmap records India-first, INR, one merchant and domestic launch assumptions. Commercial approval is separate. [E01] |
| B02 | Approved PRD, process diagrams, customer journeys, audiences and KPIs | PARTIAL | Roadmap describes journeys; no approved PRD/process-diagram/KPI sign-off found. [E01] |
| B03 | Merchant legal entity, PSP category/KYC and wellness eligibility | UNVERIFIED | Delivery notes require merchant review; no approval evidence inspected. [E18] |
| B04 | Approved tax, privacy, hygiene/returns, grievance and consumer policies | UNVERIFIED | Draft policy pages exist; final merchant and professional reviews have no recorded acceptance here. [E13] |
| B05 | Shipping SOP, warehouse, packaging and supplier/catalog documentation | UNVERIFIED | Preview assumptions and samples exist; actual commercial arrangements are not evidenced. [E01, E18] |
| B06 | Next.js, TypeScript strict mode and styling foundation | COVERED | Installed project, strict `tsconfig`, Tailwind/PostCSS and shared style files. Fresh typecheck passed. [E02] |
| B07 | Reusable storefront/admin UI, loading, error and 404 states | COVERED | Components, dialogs and App Router boundary files exist. Full UI-kit accessibility certification is separate. [E03, E17] |
| B08 | Strict linting and lint CI gate | MISSING | No lint script/config or CI lint step found. Typecheck is not linting. [E02] |
| B09 | Domain-oriented modular monolith | PARTIAL | Address, pricing, COD, order, support, RMA/refund, courier, jobs and capture recovery have domain modules. Remaining catalog/auth/admin catch-all decomposition and external-message outbox remain. [E27, E28] |
| B10 | GitHub CI | PARTIAL | Workflow source runs typecheck, tests, build and browser/API checks. Successful remote execution/branch enforcement not verified. [E02] |
| B11 | Version control/remotes/branch protection | UNVERIFIED | Git is available in this workspace and existing uncommitted work was preserved. Remotes, branch protection and remote CI were not verified. |
| B12 | Environment example and production local-auth guard | COVERED | `.env.example`, server-only secret usage and public-production local-auth guard exist. No secrets were printed/read for this audit. [E02, E04] |
| B13 | Startup environment schema validation and feature flags | MISSING | Scattered variable checks exist; no complete validated environment contract or feature flag system found. [E04, E05] |
| B14 | Protected dev/staging/production, hosting, HTTPS/domain and deployment ownership | UNVERIFIED | Local start scripts/setup notes exist; deployed environments and protection settings were not verified. [E18] |
| B15 | Health/readiness checks and dependency status | MISSING | `/api/me` is a session/config endpoint, not a dedicated operational health/readiness check. [E04] |

### B. Storefront, 3D, navigation and content

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| F01 | Responsive editorial landing and brand tokens/typography | COVERED | Homepage sections, local fonts, palette and desktop/mobile styles exist. Prior visual/browser evidence available. [E03, E17, E19] |
| F02 | Interactive procedural 3D bloom | PARTIAL | Procedural flower code remains, but current `home.tsx` mounts only `Sculpture mode="silk"`; existing motion tests explicitly assert that bloom/hero-petal sections are absent. Earlier bloom screenshots and LANDING_MOTION notes are historical. Resolve roadmap scope before treating the dormant flower as a completed mounted feature. Fresh source/browser evidence: [QA execution](qa/EXECUTION_REPORT.md). [E03, E17] |
| F03 | Silk scene and scroll/motion choreography | COVERED | Shader silk, Motion and GSAP section effects exist. Performance certification is separate. [E03] |
| F04 | Ambient pause, reduced motion and static/WebGL fallback | COVERED | Motion preferences, pause controls, static assets, WebGL detection/error boundary and offscreen/hidden-tab suspension exist. Prior checks cover a subset. [E03, E17] |
| F05 | WebGL hero relief actually used on the homepage | PARTIAL | Relief implementation remains in `petal-scene.tsx`, but current home mounts `silk`/`flower`, not `hero`. Current hero uses `/images/hero.webp`; older delivery notes describe a different active hero. [E03, E19] |
| F06 | Optional Kling hero video | DEFERRED | Delivery notes explicitly defer it; no generated video integration found. It is not required for the current static/3D experience. [E18, E19] |
| F07 | Original optimized sample product/editorial images | COVERED | PNG/WebP assets and prompts exist. These are editorial samples, not verified merchant photography/specifications. [E19] |
| F08 | Actual product/color photography, product claims and fulfillment promises | UNVERIFIED | Catalog/media/packaging/fit claims still need merchant acceptance; matching color photography is not established. [E13, E18, E19] |
| F09 | Header, shop dialog, mobile navigation, footer and search entry | COVERED | Navigation and search dialogs operate locally; Escape now restores the originating trigger. Recovery browser checks pass on desktop/mobile. Full manual accessibility acceptance remains Q19. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| F10 | Breadcrumbs and policy links | COVERED | PDP/catalog/checkout navigation and links to implemented policy URLs exist. Literal roadmap route differences are mapped in section 7. [E03, E12, E13] |
| F11 | All homepage text editable in CMS | PARTIAL | Supported editable eyebrow, description, story and storyBody now render on desktop/mobile; QA-B02 passes. Broader homepage block/banner/version/3D publication remains unfinished. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| F12 | Banners, image/CTA editing, 3D settings and scheduled publishing | MISSING | No full banner/3D configuration, content versioning, draft/schedule workflow or page builder. [E03, E04, E09] |
| F13 | About/story, general fit, policy and contact pages | PARTIAL | Static source-managed pages exist; contact details and policies are explicitly unfinished drafts. [E13] |
| F14 | CMS-managed FAQ, care content, journal/blog, navigation/footer and SEO | MISSING | General fit/care text exists in source/PDP; no complete editorial management or journal/FAQ system. [E03, E09, E13] |

### C. Catalog, product modeling and discovery

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| C01 | Published catalog backed by database | COVERED | Products and variants loaded from DB; archived products excluded publicly. [E04, E05] |
| C02 | Independent size × color SKU, price and available stock | COVERED | Unique SKU and product/color/size constraints, variant prices and stock exist. Local invariant tests passed again. [E05, E16] |
| C03 | Normalized band/cup/alpha/pack options and variant status | PARTIAL | Size/color strings support current samples; no normalized option tables, separate band/cup/pack model or per-variant publish status. [E05] |
| C04 | Fit/coverage/support/padding/wire/strap attributes and model details | PARTIAL | Description/material/care exist; structured lingerie attributes and verified per-product fit/model information are absent. [E05, E12] |
| C05 | Category browsing | COVERED | `/shop?category=...` backed by category field. Dedicated category URL/management is separate. [E03, E04] |
| C06 | Collections and collection product assignments | FOUNDATION | `collections`/`product_collections` tables exist; no complete collection browse/filter/admin workflow. [E05] |
| C07 | Size/color/material/price/availability/sale/new filters | COVERED | API matches variant-dependent filters against the same SKU; client retains URL filters/chips and empty/error/loading states. [E03, E04, E17] |
| C08 | Multiple selections within one filter dimension | PARTIAL | Different dimensions combine; URL holds a single size/color/category/material value per key. Multi-select faceting is incomplete. [E03, E04] |
| C09 | Band/cup, coverage, support, padding, rating and collection filters | MISSING | No complete controls/backend filtering for these dimensions. [E03, E04, E05] |
| C10 | Sort by price, name, sales and newness | PARTIAL | Price sorting now uses only same-SKU matches for active size/color/price/stock/sale filters; ascending/descending regression and QA-H12 pass. Newest still uses a boolean; scalable/advanced sorting remains. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| C11 | Result counts and query state on reload | COVERED | API total/client count, URL search/filter/sort state and reload tests exist. [E03, E04, E17] |
| C12 | Pagination/infinite load and scalable search queries | MISSING | Catalog loads all products/variants then filters/sorts in memory; no cursor/page limit. [E04, E05] |
| C13 | Basic text search and no-results recovery | COVERED | Case-insensitive substring match on title/description/material/category through `/shop?q=...`. [E03, E04] |
| C14 | Autocomplete, spelling normalization, trending and category result types | MISSING | Static suggested category links are not an autocomplete/trending search service. [E03, E04] |
| C15 | Product gallery and zoom | COVERED | Product image arrays, thumbnails and zoom dialog exist. [E12] |
| C16 | Product video and variant-specific media | MISSING | Product media table is not a complete variant gallery/video workflow; selection does not map to variant-specific imagery. [E05, E12] |
| C17 | Stock-aware exact-SKU selector and quantity limits | COVERED | Size/color resolve variant; unavailable selections disabled; API validates SKU/published product/quantity. [E04, E12, E16, E17] |
| C18 | Size guide, measurements and category-specific charts | PARTIAL | General preview chart/dialog and measurement guidance exist; schema chart table is not a managed per-product/band-cup chart flow. [E03, E05, E13] |
| C19 | Material/care, return guidance and delivery information on PDP | PARTIAL | Material/care and generic draft shipping/return text exist; no per-SKU serviceability/ETA or policy-derived eligibility. [E12] |
| C20 | Related products and matching-set links | PARTIAL | Featured products excluding current product are shown; no matching-set relationship or independent component-size selection. [E12] |
| C21 | Product SEO metadata and crawlable content | PARTIAL | Server-rendered PDP/title/description exist; listing is fetched client-side, with no full catalog SEO/canonical/structured-data solution. [E12, E14] |

### D. Customer identity, profile, addresses, cart and wishlist

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| U01 | Local email/password registration and login | COVERED | Salted scrypt passwords, regular customer default role and local auth flow; earlier HTTP tests plus fresh password unit checks. Local mode is for preview. [E04, E07, E16, E17] |
| U02 | Session tokens, expiration, secure cookie flags and logout | COVERED | Hashed opaque session tokens, seven-day expiry, HttpOnly/SameSite and production Secure cookie, DB session deletion on logout. [E04, E07] |
| U03 | Supabase email signup/verification/login and Google OAuth | INTEGRATION | SSR client/code exchange, provider login/signup and guest merge code exist. Successful provider journey is not evidenced. [E04, E08] |
| U04 | Provider password recovery and reset email | INTEGRATION | Reset request/callback/password update code exists; SMTP/provider reset flow needs acceptance. Local preview deliberately cannot email reset links. [E04, E08] |
| U05 | Password change and other-session revocation | COVERED | Current local password or verified provider account required; other store sessions removed. Provider behavior still needs provider tests. [E04, E17] |
| U06 | Private account/orders/addresses ownership | COVERED | Session-derived user IDs, private queries and RLS policies exist. Tests cover selected boundaries; exhaustive matrix is separate. [E04, E06, E07, E16, E17] |
| U07 | Editable customer profile | PARTIAL | Name can be updated, email displayed. Phone, saved sizes and complete profile fields are not implemented. [E04, E10] |
| U08 | Multiple saved addresses: create and list | COVERED | Private create/list plus expanded Indian address fields, persistence and browser/HTTP acceptance. [E20, E23] |
| U09 | Address edit/delete/default, labels and billing/shipping distinction | COVERED | Owner-scoped PATCH/DELETE, labels, shipping/billing/both purpose, per-purpose defaults, serialized writes and default reassignment are implemented and locally tested. [E20, E23] |
| U10 | Indian address field and pincode validation | PARTIAL | Address format/country validation remains; checkout additionally requires courier postcode/city/state agreement before tax jurisdiction selection. Actual provider response/alias acceptance remains unverified. [E20, E24] |
| U11 | Use saved address/default selection at checkout | COVERED | Checkout loads defaults, selects saved shipping/billing or new addresses, resolves IDs by owner/purpose server-side, and snapshots both addresses. Desktop/mobile and domain tests pass. Gateway checkout remains P09. [E20, E23] |
| U12 | Consent, notification and privacy preferences | PARTIAL | Explicit newsletter consent now records version/source/time and immutable decisions, with tokenized unsubscribe and legacy suppression. Full account notification/privacy preferences and real message delivery remain unfinished. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| U13 | Customer data export | COVERED | Customer export now includes an explicit owned-data inventory, including persisted support tickets/public messages and consent events, excluding other customers, internal notes, credentials and bank evidence. Direct HTTP and domain regressions pass; retention/deletion operations remain Q12/U14. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| U14 | Account deletion request and fulfillment workflow | PARTIAL | Owned request/status, approved policy snapshots, account closure/session revocation, marketing suppression, open-obligation/retention holds, scoped local erasure and worker processing now exist. Other customers and financial totals stay protected. Real policy identification and external identity/provider/backup erasure remain unverified. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| U15 | Guest browse/add without login; login required to begin checkout | COVERED | Guest bag works; checkout page and checkout mutation require sign-in; checkout return URL exists. [E04, E11, E17] |
| U16 | Persistent guest cart | COVERED | Server-side DB cart with opaque 30-day HttpOnly cookie. Refresh persistence exists; this intentionally differs from roadmap local-storage wording. [E04, E17] |
| U17 | Account bag, drawer/page, quantity/remove and empty/error states | COVERED | DB-backed cart, drawer/full page, server price/stock reads and bounded quantity updates. [E03, E04] |
| U18 | Login/register cart merge with duplicate SKU caps | COVERED | Quantities summed/capped to 20 and current stock; guest cart removed. Local register/login HTTP coverage exists; OAuth acceptance remains U03. [E04, E08, E17] |
| U19 | Concurrent cart updates/merge and robust stock-change recovery | PARTIAL | Add to bag uses a transactional server delta; two concurrent PDP tabs now yield quantity 3 from 1. Explicit set/remove and stock/cap tests pass. Wider concurrent login-merge and managed-pool recovery acceptance remain. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| U20 | Persistent wishlist and move/add to bag | COVERED | User/product wishlist persists, private toggle/list and product shopping flow exist. Wishlist does not allocate inventory. [E03, E04] |
| U21 | Wishlist/back-in-stock alerts | MISSING | No opt-in subscription, stock-change trigger, delivery or unsubscribe workflow. [E04, E05] |

### E. Pricing, checkout, payment and inventory accounting

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| P01 | Server-authoritative integer-paise totals | COVERED | Quote/reservation use DB variant prices; client totals ignored; local pricing/coupon tests passed again. [E04, E15, E16] |
| P02 | Product tax class/HSN/GST and effective tax rules | PARTIAL | Effective tax classes/HSN, product mapping, inclusive GST extraction, per-line discount allocation and intra/inter-state snapshots are implemented and locally tested. Merchant/accountant rates, invoice compliance and provider/staging acceptance remain pending. [E24] |
| P03 | Server shipping fee threshold | COVERED | Legacy bag preview retains its server threshold. Actual checkout uses the immutable courier quote with configurable merchant free-delivery threshold; preview amounts cannot authorize an order. [E24] |
| P04 | Courier pincode eligibility, delivery bands/options/rates/ETA | INTEGRATION | Shiprocket auth/serviceability adapter validates rates, destination postcode/city/state, COD availability and provider estimates; missing credentials or malformed/unknown data fail closed. Contract mocks pass; no real provider call accepted. Booking/labels/tracking remain O08/O10. [E24] |
| P05 | Basic percent coupon create/update/activate/deactivate | COVERED | DB percent coupon, active flag, server validation and Studio editor. [E04, E09, E16, E17] |
| P06 | Offer schedule, min spend, eligible items, stacking, budgets and redemption limits | MISSING | Coupon schema only stores code/percent/active; no expiry, targets, redemption/per-customer limits or flat discount engine. [E05, E15] |
| P07 | Immutable checkout/order snapshot | PARTIAL | Quotes bind cart/address/method, tax/HSN/weight, discounts and shipping/COD charges; orders/items preserve snapshots. Immutable invoice/credit-note snapshots and bounded line-specific partial credits now exist. Legacy unknowns, broader corrective financial states and target-environment accounting acceptance remain. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| P08 | Address/coupon/summary and final payment UI | PARTIAL | Saved shipping/billing, explicit courier quote, included-tax/fee review, prepaid or COD and private order detail work locally. Live payment/courier acceptance and dedicated confirmation/payment-status flows remain. [E24] |
| P09 | Razorpay server order and hosted UPI/cards/netbanking UI | INTEGRATION | Provider order API and hosted checkout source exist. Enabled methods/category and successful sandbox purchase not verified. [E04, E11] |
| P10 | Signed callback plus provider captured-payment lookup | COVERED | Source verifies HMAC, ownership and provider status/order ID before confirmation; confirmation validates amount/currency. Real gateway round-trip remains P09. [E04, E15] |
| P11 | Raw-body signed capture webhook and duplicate capture protection | COVERED | Raw-body HMAC, captured-payload validation, durable sanitized ingress and duplicate payment protection are locally tested, including callback/webhook races. Provider sandbox proof remains P09. [E22, E23] |
| P12 | Pending/authorized/failed/expired/refund state and payment attempt history | PARTIAL | Durable one-per-checkout attempts, immutable identity, signed/provider authorization/failure observations and advisory client events now exist. Authorization survives incomplete reads and does not mark paid. Complete refund/financial resolution and real provider acceptance remain. [Payment recovery](docs/PAYMENT_RECOVERY.md), [fresh evidence](Sky_Petal_Local_Recovery_Report.md). |
| P13 | Safe payment popup dismissal/failure/retry | PARTIAL | Existing session key/fingerprint checks remain. Intent commits before provider creation; lost response uses original-receipt lookup without another create call. Owned dismissal/failure reports are advisory. Customer uncertainty messaging and audited staff reconciliation exist. Multi-device/real popup/provider and merchant recovery acceptance remain. [Payment recovery](docs/PAYMENT_RECOVERY.md). |
| P14 | Transactional reservations, checkout deduplication and oversell guard | COVERED | Conditional stock writes, cart/order locks and transaction rollback; fresh embedded DB tests cover duplicate checkout, final SKU and rollback. Managed DB contention is separate. [E15, E16] |
| P15 | Reservation expiry/release | PARTIAL | Exactly-once expiry is available through maintenance CLI and bearer-protected HTTP. A non-overlapping HTTP worker avoids a second PGlite process; ordinary unpaid expiry ends bounded polling without permanent checkout hold. Hosted scheduler/alerts and complete release-movement ledger remain unverified. [Payment recovery](docs/PAYMENT_RECOVERY.md). |
| P16 | Late/out-of-order payment, reconciliation, disputes and settlement | PARTIAL | Provider receipt lookup and bounded payment polling now reconcile attempts through the shared capture inbox. Late/additional captures remain retained exceptions and never force paid/stock overrides. Settlement/dispute comparison and complete refund/reallocation resolution remain unfinished. Provider calls were mocked locally. [Payment recovery](docs/PAYMENT_RECOVERY.md). |
| P17 | Durable webhook inbox, retries, dead letters and operator replay | PARTIAL | Durable capture/refund/courier inbox/jobs and bounded retry/replay remain. Capture completion/failure now also requires the current lease token and unexpired lease; replacement-worker regression passes. Studio exposes attempts and audited reconciliation requests. Hosted scheduling, alerts and complete provider/reconciliation coverage remain unverified. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| P18 | COD checkout, pincode/cap/fee/fraud/confirmation rules | PARTIAL | COD quote/checkout, courier and PIN eligibility, total cap, fee, serialized open-order limit, confirmed-unpaid state, stock commit and pre-processing cancellation exist. Phone confirmation, production fraud review and courier acceptance remain. [E24] |
| P19 | COD due/collected/remitted and payout reconciliation | PARTIAL | Finance collection/remittance ledger and bounded, independently approved manual COD refund evidence are available. Gross/fees/net and immutable references remain separate. Automated statements/bank feeds, payout destinations, corrections and production reconciliation remain unfinished. [E24, E27] |
| P20 | Separate order/payment/fulfillment/refund states | PARTIAL | Independent order/payment/fulfillment/refund history now derives pending/partial/full refund state from verified refund records while preserving original capture/COD collection truth. Disputes, authorization and complete corrective financial transitions remain. [E27, E29] |
| P21 | Full on-hand/reserved/available inventory model | PARTIAL | `stock` means available and decreases on reservation; `reserved` is tracked separately. No physical on-hand/warehouse balance/reservation entities. Do not subtract reserved from this `stock` again. [E05, E15] |
| P22 | Inventory movement ledger and auditable adjustments | PARTIAL | Capture/admin movement rows exist; adjustment reason is generic, actor is separate audit data, no movement read UI or idempotency key, no full reserve/release ledger. [E04, E05, E15] |
| P23 | Automated low-stock/reorder/purchasing/receiving | PARTIAL | Studio highlights/counts variants below 5. Configurable thresholds, alerts, supplier receipts and purchase orders absent. Supplier/multi-warehouse expansion is later scope. [E05, E09] |

### F. Orders, fulfillment, returns, reviews and support

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| O01 | Private order list and historical line display | COVERED | Private historical order lines/events are assembled in batches with customer-scoped child IDs. A 105-order correctness/ownership regression passes and the bounded local history latency target passes; managed load remains Q20. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| O02 | Order detail, order number, receipt/confirmation and payment-status pages | PARTIAL | Private /account/orders/[id] now displays copied accounting/addresses, independent states and events. Human order numbers, invoice/receipt and dedicated confirmation/payment-status flows remain. [E21, E23] |
| O03 | Customer cancellation policy/action and inventory restoration | PARTIAL | Unpaid reservations/COD and captured prepaid orders before packing can cancel atomically. Paid cancellation restores committed available stock once and records a full refund request for finance approval; duplicate captures remain idempotent after cancellation. Processing/courier cancellation and approved merchant policy still require work. [E27, E29] |
| O04 | Admin order list and manual forward transitions | COVERED | Role-guarded forward fulfillment now commits status, shipment reference and audit in one transaction, records actual delivery time and rejects invalid transitions. Local rollback and permission tests pass. [E21, E23] |
| O05 | Admin search/filter/detail, pick-pack and exception corrections | MISSING | No full order search/details/line picking/packing/correction workflow. [E04, E09] |
| O06 | Shipment carrier/reference entry | COVERED | Manual dispatch writes carrier/tracking into one shipment per order. This alone does not integrate a courier. [E04, E05, E09] |
| O07 | Customer-visible carrier/AWB/tracking events and real timeline | PARTIAL | Owned booked carrier/AWB and retained scan history remain; equivalent booking/status/normalized-time notices are deduplicated. Actual courier, polling and exception acceptance remain. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| O08 | Courier booking, labels/AWB, pickup, manifests and carrier selection | INTEGRATION | Durable quoted-courier booking uses copied addresses/SKU/tax/parcel data and verifies remote order identity, total, method and PIN. Create/AWB/pickup uncertainty is reconciled before further side effects; unknown outcomes never blindly create another shipment. Merchant pickup setup and successful provider execution remain unverified. [E28, E29] |
| O09 | Parcel weight/dimensions and partial/multiple shipments | PARTIAL | Parcel measurements and booking exist, but shipments.order_id and shipping_bookings.order_id remain UNIQUE and no shipment-item allocation/split-shipment workflow exists (initial/009 migrations). Partial/multiple shipments are missing independently of courier configuration. Real provider labels/handover remain unverified. [QA report](qa/EXECUTION_REPORT.md). |
| O10 | Verified courier webhooks, monotonic scan history and deduplication | INTEGRATION | Authenticated ingress retains distinct scan evidence; semantic customer notices deduplicate independently of envelopes. QA-D04 passes; provider webhook/polling/alert/recovery campaigns remain unverified. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| O11 | NDR, RTO, reverse logistics and stock reconciliation | PARTIAL | RTO/exception scans are retained separately; RTO delivery never claims customer delivery, payment collection or automatic restocking. NDR reattempt/cancellation actions, reverse booking and warehouse receipt/QC reconciliation remain missing. [E28, E29] |
| O12 | Invoice number, GST invoice document and downloadable PDF | PARTIAL | Immutable invoice/credit-note records, atomic financial-year numbering, seller configuration, private PDF/JSON, completed-refund linkage and line-specific partial/mixed-tax allocation exist with local tests. Approved actual seller/policy configuration, multilingual font scope if required, and merchant/accountant acceptance remain unverified. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| O13 | Customer return request intake | PARTIAL | Owned per-item requests enforce remaining quantities, idempotent request keys, copied voluntary windows/seal conditions and exact net-paise allocation, including rejection/re-request rounding. Defect/damage/incorrect-item review remains available without voluntary terms or a legacy delivery date. Merchant policy and proof-upload acceptance remain. [E27, E29] |
| O14 | Policy explanation, hygiene conditions and defect remedy path | PARTIAL | Merchant-configured product return terms are copied into new checkout quotes/order lines and explained in order detail; unset or excluded voluntary terms do not suppress defect/grievance review. Full category/remedy policy, legal review and product-wide disclosure acceptance remain. [E27, E29] |
| O15 | RMA detail/items, proof upload, approvals/reasons and customer status | PARTIAL | Customer order/returns pages and staff RMA console show item quantities/value, approvals/reasons, receipt references, immutable status events and inspection status. Proof uploads, reverse pickup and full case closure/remedy acceptance remain. [E27, E29] |
| O16 | Return pickup, inspection, disposition/restock and exchange | PARTIAL | Existing inspected disposition/restock rules remain. An inspected/completed exchange RMA can link one owned new replacement checkout; its exact SKU reservation/payment/fulfillment use ordinary order controls. The original inspected-item refund is independent and bounded; UI shows both totals and net cost. Direct net-difference checkout, real reverse pickup and provider/merchant acceptance remain. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| O17 | Prepaid refund initiation, partial limits and completion/webhooks | INTEGRATION | Finance requests/approval, serialized verified-funds and item caps, Razorpay stable receipt/key, pre-retry lookup, partial refunds, signed durable webhook ingress, provider polling and terminal completion evidence exist. Pending/timeout responses never imply success. Real provider acceptance, settlements/disputes, MFA and complete corrective accounting remain. [E27, E29] |
| O18 | COD refund and secure payout approval/reconciliation | PARTIAL | Completed COD refunds/evidence are database-protected; separate append-only correction requests need independent approval and reconciliation proof. Self/stale/concurrent approval and finance UI/API regressions pass. Secure payout destination and real bank/provider reconciliation remain. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| O19 | Verified-delivery review creation and real display | PARTIAL | Eligibility query, unique buyer/product review, form/list exist. Complete positive delivered-buyer acceptance test not found. [E04, E05, E12] |
| O20 | Review moderation, reply, report abuse, photo policy and Q&A | MISSING | Reviews publish without a moderation-state workflow; no review media/report/Q&A management. Q&A is optional roadmap scope. [E04, E05, E09, E12] |
| O21 | Support tickets/messages, order links, staff console and escalation | PARTIAL | Private order-linked tickets, queue/assignment, staff notes, public resolution/reopening and audited reads remain working. Public staff replies now create private account updates; internal notes never notify customers. Uploads, external notifications, SLA, extended pagination and merchant grievance operations remain. [E25, E27] |
| O22 | Customer-care profile/order history, private notes and PII access log | PARTIAL | Support reads and queue access are audited; private staff notes and order references are permission protected. Full customer/profile care console and privacy fulfillment remain missing. [E25] |
| O23 | Order/payment/shipping/refund/support transactional notifications | PARTIAL | Deduplicated persistent private in-app updates cover confirmation, courier preparation/movement, RMA/refunds and public support replies; customers can mark owned updates read. Email/SMS templates, sender/provider delivery, consent/preferences and outbound delivery evidence remain missing. [E27, E28, E29] |

### G. Admin catalog, staff permissions and operational tools

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| A01 | Protected Studio and role checks per existing operation | COVERED | Owner, administrator, catalog editor, fulfillment and support recognized; sensitive mutations restrict role lists. Earlier denial/owner-positive tests exist. [E04, E07, E09, E17] |
| A02 | Invitations, role editor, permission matrix and finance/marketing roles | PARTIAL | Finance/marketing role values added; COD finance is restricted and finance does not receive customer order-address lists. Staff invitations, role editor, multiple roles and granular permission tables remain absent. [E24] |
| A03 | Admin MFA and step-up approval for sensitive overrides/refunds | PARTIAL | Encrypted TOTP enrollment, replay rejection, single-use hashed recovery codes, session-bound verification and recent verification for financial/configuration/privacy/replay actions now exist. Production requires staff enrollment; provider-only enrollment requires a fresh primary proof on that exact session. Existing independent finance approvals remain. Actual Supabase/MFA, managed key recovery and external security acceptance are unverified. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| A04 | Product create/edit/publish/archive/restore | COVERED | Studio form/API and retained records; draft and archive share `published=false`, rather than distinct editorial states. [E04, E09, E17] |
| A05 | Category/collection/tag management | FOUNDATION | Category/collection relational tables exist; UI uses fixed categories. No complete management/tag endpoints or screens. [E04, E05, E09] |
| A06 | SKU create/edit, independent price/compare price/stock | COVERED | Manual variant form/API and uniqueness constraints. [E04, E05, E09, E17] |
| A07 | Automatic SKU combination generator, barcode and parcel fields | PARTIAL | Variant weight exists (migration 005); shipping validates parcel measurements. Automatic SKU combinations and barcodes remain absent. Source evidence corrects the previous claim that no weight/parcel fields exist; no complete generator acceptance. [QA report](qa/EXECUTION_REPORT.md). |
| A08 | Local product image upload with limits/re-encoding | COVERED | JPEG/PNG/WebP, size/pixel limits, random filename and Sharp WebP conversion; earlier upload tests exist. Durable storage is separate. [E04, E17] |
| A09 | Object storage buckets, policies, signed media and scanning | MISSING | Uploads write into `public/images`; no durable multi-instance storage, bucket policy, signed-URL workflow or malware scanning integration. [E04, E18] |
| A10 | Catalog CSV export | COVERED | Client download includes product id/title/slug/category/published. It is not an inventory/finance export. [E09] |
| A11 | Import, bulk catalog/stock edits and import validation | MISSING | No safe CSV import/bulk processing workflow. [E04, E09] |
| A12 | Audit event writes and immutable finance protections | PARTIAL | Completed refunds are now protected against ordinary application-writer updates; immutable correction and approval records preserve originals and actor/proof trails. Legacy migration and concurrency regressions pass. Full invoice/credit-note and managed access acceptance remain. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| A13 | Audit/movement browser, admin access log and job/provider console | PARTIAL | Worker outcome counters now require a successful unexpired lease-fenced RETURNING row; stale success/failure/defer reports remain zero. Operational retry consoles remain; full access-log browser/alerts/hosted monitoring are unfinished. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| A14 | Store settings, shipping/tax/payment integration configuration | PARTIAL | Commerce/tax/COD, parcel, invoice-seller and retention settings have guarded workflows; server secrets are not returned. Actual approved seller/retention data still needs its repository source identified/configured, alongside contact policy and broader integration/operational acceptance. [Local operations](docs/COMPLETION_OPERATIONS.md). |

### H. Marketing, reporting and later merchandising

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| M01 | Basic admin sales/customer/stock metrics | PARTIAL | Captured-prepaid tile now sums all captured Razorpay payment records; customer count excludes staff; recent-order tile explicitly caps at 100. Full analytics, net/refund/settlement and finance permission reporting remain. [E04, E23] |
| M02 | GMV/captured/COD collected/remitted/net sales definitions and reports | MISSING | No comprehensive reconciled accounting reports or explicit complete formulas. Current revenue tile is not full captured/settled revenue reconciliation. [E04, E05] |
| M03 | COGS, inventory value, gross/contribution margin | MISSING | No cost-of-goods valuation or fulfillment/marketing/gateway/RTO cost reporting. [E05] |
| M04 | Funnel/events, AOV, conversion, repeat/refund/RTO/stock/campaign analytics | MISSING | No analytics event pipeline, time-series reports, date filters or report exports. Product sales counters alone do not meet this scope. [E04, E05, E09] |
| M05 | Scheduled flash sales/collections/campaigns and targeted promotions | MISSING | Basic coupon/new/featured flags exist, without scheduling/targets/exclusions/usage limits. [E04, E05, E09] |
| M06 | Newsletter form and local email persistence | COVERED | Newsletter form/server require explicit consent, provide feedback and support immediate tokenized unsubscribe. Domain and browser negative/positive checks pass; no external delivery claimed. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| M07 | Server consent evidence, marketing provider/templates and unsubscribe | PARTIAL | Server consent/version/source/time, immutable events, legacy suppression and hashed-token unsubscribe now exist. Outbound marketing provider/templates, sender/delivery/bounce acceptance and broader preferences remain missing. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| M08 | Personalized recommendations and recently viewed | MISSING | Static/featured suggestions exist; no personalization/history model or allowed-data controls. [E03, E12] |
| M09 | Fitting quiz with calculated, catalog-specific size result | MISSING | Measurement preview/dialog explicitly does not calculate a size. [E03] |
| M10 | Matching sets, bundles and price-aware cross-sell | MISSING | No linked garment sizes/bundle inventory/pricing reconciliation. [E05, E12] |
| M11 | Gift cards, referrals, loyalty and subscriptions | MISSING | Later/optional roadmap scope; no balances, redemption/referral ledger or subscription system found. [E05] |
| M12 | Consented abandoned-cart messages and optional WhatsApp support | MISSING | No provider/workflow/consent/unsubscribe implementation. Optional scope must be confirmed before making it a launch dependency. [E04, E05] |
| M13 | Multilingual, international, multi-currency and multi-warehouse growth | MISSING | V2 scope; current store assumes INR/domestic delivery and has no complete translation/warehouse expansion. [E01, E05] |

### I. Database, security, QA, SEO and operations

| ID | Requirement | Status | Present evidence / exact remaining work |
| --- | --- | --- | --- |
| Q01 | Local persistent PostgreSQL-compatible storage | COVERED | On-disk PGlite, auto schema/sample seed and local start helpers. Intended for one local process. [E05, E18] |
| Q02 | Managed PostgreSQL adapter/migration/seed | INTEGRATION | `pg` adapter with transactions/TLS option and migration/seed helpers exist. Managed deployment, runtime role grants and load/concurrency acceptance not verified. [E05] |
| Q03 | Full roadmap database design | PARTIAL | Additive migrations now include invoice/credit-note documents/sequences, payment attempts, encrypted staff factors/session proofs, exchange links and privacy processing on the earlier RMA/refund/job/courier foundation. Full normalized options/warehouse/permissions and other roadmap entities remain incomplete. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| Q04 | Migration/reset/rollback lifecycle | PARTIAL | Forward numbered migrations now have checksums, transactional ledger locking and local legacy-data/reapply tests. Managed upgrade, rollback/reset and restore drills remain unverified. [E20, E23] |
| Q05 | Foreign keys, unique keys, money/stock checks and indexes | PARTIAL | New tax validity, money/weight, method/state, quote/reference uniqueness and support ownership/query indexes add constraints. Full normalized option/warehouse/invoice accounting and production grants remain incomplete. [E24, E25] |
| Q06 | PostgreSQL RLS and server ownership/role enforcement | PARTIAL | RLS enabled on current tables, selected read policies, no browser mutation grants; fresh test exercises a custom browser role. Production-role provisioning/provider-identity mapping and complete read/write matrix need verification. [E04, E06, E16] |
| Q07 | Financial/history immutability and corrective entries | PARTIAL | Ordinary DML guards protect completed refunds and issued documents; separate corrections, approvals and bounded credit notes are retained. Reviewed expired-retention processing permits scoped personal-field erasure while preserving financial identity/amount/state columns. Legacy/refund/mixed-tax regressions pass. Managed runtime-role and actual accounting acceptance remain. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| Q08 | Request validation, password hashing and same-origin checks | COVERED | Existing handlers use Zod, parameterized SQL, hashed sessions/passwords and mutation origin-host comparison. This is a defined subset, not an OWASP certification. [E04, E07, E16, E17] |
| Q09 | Login/coupon/COD bot protection and rate limiting | PARTIAL | DB limits for auth/password/newsletter; no full IP/bot/coupon/COD abuse controls. [E04] |
| Q10 | HTTPS/security headers, OAuth/session/recovery security audit | PARTIAL | Secure production cookie flags, anti-frame/no-sniff/referrer headers and provider code exchange exist. Hosted TLS, OAuth/recovery configuration and full CSRF/XSS/security review not verified. [E02, E04, E07, E08] |
| Q11 | Payment credentials kept server-side; hosted card entry | COVERED | Secret keys used in server route, browser receives publishable key/order; no card/CVV storage model. Audit did not inspect or certify external secret storage. [E04, E11] |
| Q12 | Minimal PII visibility, access logs and retention/export/deletion operations | PARTIAL | Owned exports, reviewed retention decisions, account minimization and bounded local erasure now exist, including courier/job payloads and audit/consent personal fields after retention expiry. Ordinary immutability and cross-customer checks remain. Formal access-log coverage, approved actual policy and external provider/backup erasure remain unverified. [Local operations](docs/COMPLETION_OPERATIONS.md). |
| Q13 | Outbox, asynchronous jobs and exactly-once side-effect delivery | PARTIAL | Semantic courier notice dedup and unexpired lease-fenced outcome accounting now pass QA-D04/05 and regressions. Durable jobs/provider identities remain; outbound outbox, hosted workers and real provider acceptance are unverified. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| Q14 | Structured logs, correlation/tracing IDs, error alerts and dashboards | MISSING | Console error logging exists; no Sentry/tracing/structured logs/alerts/exception dashboard. [E02, E04] |
| Q15 | Local unit/database/concurrency/security suite | COVERED | Fresh unchanged Node rerun: 97 PASS, 2 expected HTTP-suite skips. Initial unchanged run had one flaky final-SKU fixture causing child and parent failures; preserve baseline-unit.log. Independent explicit-SKU contention passes. Additional adversarial probes: 6 PASS/3 FAIL; finance projection, notice dedup and stale-worker reporting remain open. [Fresh execution](qa/EXECUTION_REPORT.md). |
| Q16 | HTTP customer/admin authorization and mutation suite | PARTIAL | Latest disposable production-preview HTTP suites: 29 passed, zero skipped. New browser workflow additionally calls protected item-return, inspection, refund approval and private-update endpoints. Provider/staging and full negative-role matrix acceptance remain separate. [E29] |
| Q17 | Browser shopping/editorial/reduced-motion/accessibility checks | PARTIAL | All 26 original browser cases pass. Independent six-configuration run: raw 11 PASS/15 FAIL; two WebKit cart failures pass on HTTPS retest (Secure-cookie environment), leaving 13 PASS/13 FAIL. Six strict Tab/BODY assertions are not proven background-focus defects; separate Escape focus restoration fails. Firefox crashes before an application page. Physical devices/manual acceptance remain open. [Fresh execution](qa/EXECUTION_REPORT.md). |
| Q18 | Full positive/negative permission, recovery, refund and provider suites | PARTIAL | Adds DB-backed item policy/ownership/quantity/rounding/QC, partial/full bounded refunds, COD maker-checker, lost-response recovery, authenticated event ingress, courier identity/amount checks, stale tracking and RTO safety. Actual provider failures, broad staff/MFA matrix, load and production recovery acceptance remain. [E29] |
| Q19 | Full WCAG 2.2 AA acceptance | PARTIAL | Reported filter contrast, visible-label mismatch and Search Escape focus-return now pass automated desktop/mobile recovery checks, including open mobile filters. Full manual screen-reader/zoom/touch/physical-device WCAG acceptance remains unverified. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| Q20 | Core Web Vitals, target-device GPU and agreed-load p95 acceptance | UNVERIFIED | Batched 105-order local history now passes p95 <500ms (72ms, zero errors). Responsive images/fonts/SSR improve subsets, but mobile Lighthouse LCP remains above 2500ms; latest CLS is zero. Reports are lab samples with retained warnings, not field/target-device/staging certification. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| Q21 | Caching/image CDN and scale controls | PARTIAL | Responsive local Next Image delivery, metric-adjusted fonts, server-rendered catalog and batched history are implemented and regression-tested. Public API remains no-store; catalog filtering is in memory; full CDN/cache/scale acceptance remains. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| Q22 | Canonical URLs, sitemap, robots file and product structured data | COVERED | Valid robots.txt/XML sitemap, published-product canonical and escaped truthful SKU Product JSON-LD are implemented. Default/staging indexing is denied; explicit approved HTTPS production opt-in is required. HTTP and production/unpublished/private-route regressions pass locally. [Recovery evidence](Sky_Petal_Local_Recovery_Report.md). |
| Q23 | Automated backup, RPO/RTO and tested restore | UNVERIFIED | Closed disposable local-store backup/reopen preserves 112 orders, 108 payments, 107 audit rows, nine migrations and 31739400 synthetic captured paise. Restored application serves 105 customer orders and denies expired/replayed sessions. Automated managed backups, RPO/RTO, failover and production restore drills remain unverified. [Restore](qa/evidence/local-restore.json), [application smoke](qa/evidence/restored-http.json). |
| Q24 | Production uptime/SLO alerts, dependency degradation and incident response | UNVERIFIED | No operating baseline, alert routing or incident/support procedures verified. [E18] |
| Q25 | Controlled release, rollback, staff training and stock import | UNVERIFIED | Local setup documented; production rollout/rollback/training/import acceptance not evidenced. Import implementation also absent (A11). [E18] |
| Q26 | Live low-value payment/courier/refund and approved launch | UNVERIFIED | No authorized live/sandbox-to-delivery evidence or approved release checklist available. [E18] |
| Q27 | Optional later purchasing/forecasting/supplier operations | MISSING | Optional supplier tables, purchase receipts/POs and advanced forecasting not implemented. [E01, E05] |

## 5. Evidence index and verification boundaries

| Ref | Files inspected | What they establish |
| --- | --- | --- |
| E01 | [Roadmap](Sky_Petal_Full_Implementation_Roadmap.md) | Required scope, phases, journey definitions, release gates and later options |
| E02 | [package.json](package.json), [tsconfig](tsconfig.json), [CI workflow](.github/workflows/ci.yml), [Next config](next.config.ts), [.env.example](.env.example) | Tooling, scripts, strict typing, CI source, headers and configuration template |
| E03 | [Home](src/components/home.tsx), [Chrome](src/components/chrome.tsx), [3D scene](src/components/petal-scene.tsx), [motion](src/components/use-editorial-motion.ts), [catalog](src/components/catalog.tsx), [store provider](src/components/store-provider.tsx), [styles](src/app/cinematic.css) | Current storefront UI and interaction wiring |
| E04 | [API dispatcher](src/app/api/[...path]/route.ts) | Actual GET/POST branches, validation, roles, pricing, gateway and admin behavior |
| E05 | [DB/schema/adapter](src/lib/db.ts), [SQL migration](migrations/001_initial.sql), [migrate](scripts/migrate.ts), [seed](scripts/seed.ts), [export](scripts/export-schema.ts) | Current persisted entities, constraints and database adapters/helpers |
| E06 | [RLS policies](src/lib/rls.ts) | Browser grants and row read policies; server writes use a trusted connection |
| E07 | [Auth](src/lib/auth.ts) | Password hashing, store sessions, ownership and role helpers |
| E08 | [Supabase](src/lib/supabase.ts), [OAuth callback](src/app/auth/callback/route.ts), [cart merge](src/lib/cart.ts) | Provider integration code and callback/cart behavior |
| E09 | [Admin](src/components/admin.tsx) | Five available Studio tabs and their actual controls |
| E10 | [Account](src/components/account.tsx) | Account tabs, saved-address subset, order progress and privacy actions |
| E11 | [Checkout](src/app/checkout/page.tsx) | Checkout form, login redirect, quote and hosted-payment UI |
| E12 | [Product route](src/app/products/[slug]/page.tsx), [PDP](src/components/product-detail.tsx), [SKU picker](src/components/store-provider.tsx) | Product SSR/metadata, media, review and variant flows |
| E13 | [Static information pages](src/app/[...info]/page.tsx) | Implemented info URL keys, source-managed drafts and missing merchant details |
| E14 | [Layout](src/app/layout.tsx), [shop route](src/app/shop/page.tsx), [admin route](src/app/admin/page.tsx), route inventory | Metadata and SEO route presence/absence |
| E15 | [Commerce](src/lib/commerce.ts) | Reservation, expiry, totals, captured payment and stock transaction behavior |
| E16 | [Commerce tests](tests/commerce.test.ts) | Test source and fresh local execution results |
| E17 | [API tests](tests/api.test.ts), [admin tests](tests/admin.test.ts), [shopping E2E](e2e/store.spec.ts), [editorial E2E](e2e/experience.spec.ts), [Playwright config](playwright.config.ts) | Automated acceptance scope and limitations |
| E18 | [README](README.md), [prior status](docs/STATUS.md), [prior verification](docs/VERIFICATION.md) | Prior test claims, local setup, integration and operational limitations; not treated as fresh proof |
| E19 | [Cinematic notes](docs/CINEMATIC_LANDING.md), [asset notes](docs/CINEMATIC_ASSETS.md), [image prompts](docs/IMAGE_PROMPTS.md), [saved report](playwright-report/index.html) | Historical browser/visual evidence and generated sample asset provenance |
| E20 | [Address services](src/lib/addresses.ts), [Address UI](src/components/address-book.tsx), [address migration](migrations/002_address_book.sql), [migration runner](src/lib/migrations.ts) | Address ownership/defaults, checkout selection and additive versioning |
| E21 | [Order services](src/lib/orders.ts), [order UI](src/components/order-card.tsx), [lifecycle migration](migrations/003_order_lifecycle.sql), [domain tests](tests/address-orders.test.ts) | Separate stored states, copied history, atomic fulfillment and unpaid cancellation |
| E22 | [Capture inbox](src/lib/payment-inbox.ts), [payment migration](migrations/004_payment_recovery.sql), [Studio recovery](src/components/payment-operations.tsx), [operations guide](docs/COMMERCE_OPERATIONS.md) | Durable verified capture recovery, fingerprint binding, maintenance/replay and operational limitations |
| E23 | [Recovery tests](tests/payment-recovery.test.ts), [ingress tests](tests/payment-ingress.test.ts), [commerce browser tests](e2e/commerce.spec.ts), fresh verification section below | Tests actually run in this increment; no provider/staging/live transaction proof |
| E24 | [Pricing](src/lib/pricing.ts), [commerce settings](src/lib/commerce-config.ts), [shipping adapter](src/lib/shipping.ts), [COD service](src/lib/cod.ts), migrations [005](migrations/005_checkout_pricing.sql)/[006](migrations/006_cod_accounting.sql), [tax/COD tests](tests/pricing-cod.test.ts), [adapter tests](tests/shipping.test.ts) | Typed settings, effective tax/immutable quotes and safe manual COD accounting; real provider acceptance pending |
| E25 | [Support service](src/lib/support.ts), [customer/staff UI](src/components/support-center.tsx), [007 migration](migrations/007_support_threads.sql), [support tests](tests/support.test.ts) | Owned threads, protected notes, assignment, resolution/reopening and read/mutation audit |
| E26 | [COD browser journey](e2e/pricing-cod.spec.ts), [support browser journey](e2e/support.spec.ts), current local/HTTP checks | Fresh 1 November verification below; synthetic courier data is explicitly identified |
| E27 | [RMA service](src/lib/returns.ts), [refund service](src/lib/refunds.ts), [jobs](src/lib/jobs.ts), [RMA/finance UI](src/components/returns-center.tsx), [008 migration](migrations/008_returns_refunds_jobs.sql) | Copied terms, item RMA/QC/restock, paid cancellation, bounded approved refunds, durable recovery and private updates |
| E28 | [Courier workflow](src/lib/fulfillment.ts), [shipping UI](src/components/shipping-operations.tsx), [009 migration](migrations/009_shipping_execution.sql), [customer order UI](src/components/order-card.tsx) | Queued booking/AWB/pickup/documents, authenticated tracking, source/amount verification and RTO safety; no real provider execution |
| E29 | [Domain tests](tests/returns-refunds.test.ts), [adapter contracts](tests/fulfillment-adapters.test.ts), [signed/token ingress tests](tests/payment-ingress.test.ts), [RMA browser workflow](e2e/returns-refunds.spec.ts) | Latest fresh local verification below; synthetic provider evidence only |

### Historical read-only audit checks (before these implementation increments)

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm.cmd run typecheck` | PASS | Current TypeScript compiles without emitting application output. |
| `npm.cmd test` | PASS: 14 passed, 2 skipped, 0 failed | Embedded temporary-DB suite ran. Two HTTP suites skip because `TEST_BASE_URL` was not set. Runner totals include the parent test. |
| Source/schema/route/test inventory | Completed | Status assignments are based on current code, not roadmap checkboxes alone. |
| `git status --short` | Not available | Workspace has no Git repository; no commit/remotes/branch-protection claim. |

**Historical boundary:** that earlier read-only audit did not rerun build, HTTP, browser, provider, load or production checks. Fresh local implementation checks are recorded next. The fresh commerce suite uses its own temporary database; it does not exercise the user's running store. Existing delivery notes record prior build/typecheck, 24 HTTP tests and a later 12-case browser pass on 30 October. The older verification note reports 46 checks across its earlier runs, with 8 browser cases. Those are different historical runs; do not combine them into a fresh-test total or assume the older screenshots match today's source.

Historical test limit: the older amount/currency test changes only amount. New address/order tests and ingress suites explicitly exercise wrong currency. RLS tests exercise selected reads under a custom role, not every production grant/policy. Local PGlite contention passing does not establish identical behavior under a managed PostgreSQL pool.

### Prior implementation verification — 30 October 2026 (Asia/Kolkata)

The merchant confirmed **continue locally; merchant setup is pending**. No provider secrets were requested in chat, no live purchase or external message was sent, and the running developer server was preserved. Builds used a separate .next-acceptance output and HTTP/browser tests used an OS-temporary database on port 4320.

| Check actually executed | Result | Scope and limits |
| --- | --- | --- |
| TypeScript + optimized Next.js production build | PASS | Final application source compiled; isolated output did not replace the running developer build. |
| npm test | PASS: 48 passed, 2 skipped, 0 failed | Runner includes parent tests. Temporary PGlite databases; explicit signed webhook/maintenance handlers, wrong currency, address ownership/defaults, migration upgrade/reapply/checksum rejection and retained-connection upgrade, immutable snapshots, cancellation/capture races and recovery. HTTP suites skipped here because TEST_BASE_URL was unset. |
| npm run test:api with disposable production server | PASS: 26 passed, 0 skipped, 0 failed | Customer and owner mutations, address CRUD, role denials, payment-recovery permissions, cart/auth/catalog/CMS and uploads. No external provider called. |
| Playwright commerce.spec.ts | PASS: 4 passed | Two journeys on desktop Edge and mobile Chromium emulation: address CRUD/default/billing/saved checkout and restricted payment console/private order boundary, positive delivered-order history/reference and unpaid cancellation using explicitly synthetic fixtures. Address page serious/critical axe subset and page-width checks pass. |
| Selected store.spec.ts regressions | PASS: 6 passed | Guest SKU/cart/auth gate, filter reload and admin protection on desktop/mobile; recorded separately from full storefront/motion certification. |
| Visual review | Completed | New commerce-addresses mobile and payment-operations desktop screenshots inspected. Existing homepage/motion edits and old artifacts were preserved. |

No Razorpay/Supabase/courier sandbox or live transaction, managed PostgreSQL contention, hosted scheduler, tax/legal acceptance, load/CWV certification, full WCAG review or restore drill was performed. DB mocks/synthetic provider signatures establish local behavior only.

**Status transitions:** U09 and U11: MISSING → COVERED. P16, P17, O03, O07, A13, Q13 and Q18: MISSING → PARTIAL. P07/P08/P12/P13/P15/P20/O02/O13/A12/M01/Q04/Q07 remain PARTIAL with updated implementation evidence. No phase was marked complete. All 171 feature IDs and the roadmap were preserved.

### Earlier local verification - 1 November 2026 (Asia/Kolkata)

The merchant setup remains pending, and the user authorized continued local implementation. The roadmap remains unchanged. CI source now prepares the disposable fixtures (including synthetic browser quotes with a longer fixture-only TTL); remote GitHub execution was not verified. Public quotes still expire after five minutes. All new migrations preserve existing records and the original available-stock semantics. Tests run against temporary databases on a separate production-build server, not the merchant's running store.

| Fresh check | Result | Limits |
| --- | --- | --- |
| npm test | PASS: 73 passed, 2 skipped, 0 failed | Parent tests are included. HTTP suites skip here without TEST_BASE_URL; they run separately below. Adds real DB quote/tax/COD/support state checks and fetch-contract courier tests. |
| Production build/typecheck | PASS | Next.js source build and generated route compilation; no deployment acceptance. |
| Disposable-server HTTP suites | PASS: 29 passed, 0 skipped | Product/tax/SKU configuration, private support, staff resolution/notes, role denial and earlier commerce/auth/catalog checks. |
| Commerce/COD/support browser journeys | PASS: 8 passed | Final source on desktop and mobile Chromium/Edge emulation: addresses, order history/cancellation, quote-backed COD, manual finance reconciliation and private support resolution/reopening. Scoped serious/critical axe and page-width checks pass. |
| Shopping regressions | PASS: 6 passed | Guest SKU/cart persistence, checkout login gate, URL-filter reload and unauthenticated admin protection. |
| Visual inspection | Completed | New mobile COD ledger and support-thread screenshots inspected; existing landing/motion work preserved. |

The COD browser journey uses a clearly synthetic courier response backed by a persisted test quote, then the real protected order/stock/ledger HTTP paths. It is not Shiprocket or Razorpay sandbox/live evidence. Synthetic GST classes exist only in the disposable fixture; the merchant database is not assigned invented rates. No real collection, remittance, shipment, provider payment, email/SMS or legal approval was performed.

Status changes in this increment: P02/P18/P19/A02/O22 moved MISSING to PARTIAL; P04 moved MISSING to INTEGRATION; A14/O21 moved FOUNDATION to PARTIAL. Other listed rows retain their status with richer evidence. No phase or production release gate was marked complete.

### Latest local verification - 1 November 2026: RMA, refunds and courier execution

This is a later implementation increment than the earlier same-date checks above. Merchant setup is still pending. The roadmap and all 171 existing feature IDs are preserved; no phase or production gate is signed off.

| Freshly executed check | Actual result | Limits |
| --- | --- | --- |
| npm test | PASS: 97 passed, 2 skipped, 0 failures | 99 includes parent tests. HTTP suites skip here and run separately. Temporary PGlite plus mocked provider contracts; no managed PostgreSQL acceptance. |
| Production source build/typecheck | PASS | Final Next.js production build, including new routes. No deployment certification. |
| HTTP customer/admin suites | PASS: 29 passed, 0 skipped | Disposable production preview on loopback with ALLOW_LOCAL_AUTH=true. That local-only flag is not enabled for public production. |
| Commerce/COD/support/RMA browser workflows | PASS: 10 passed | Desktop Edge and mobile Chromium emulation; RMA staff context also uses the mobile viewport. Item request, review/receipt/QC, bounded finance approval and private updates verified. Scoped serious/critical axe and page-width assertions pass. |
| Selected shopping regressions | PASS: 6 passed | SKU/cart/sign-in gate, URL-filter reload and protected administration on desktop/mobile. Full landing/motion suite was not rerun. |
| Visual review | Completed | Current mobile RMA operations and private-update screenshots inspected. Existing homepage/motion work preserved. |

Changed customer pages: account navigation/order detail, /account/returns and /account/notifications. Changed Studio screens: Returns, Refunds, Shipping, Background work and product return terms in Commerce. New migrations 008/009 preserve historical records and AVAILABLE-stock semantics; new services are returns.ts, refunds.ts, jobs.ts and fulfillment.ts. Protected API operations cover owned returns/refunds/updates, RMA review/receipt/inspection, finance request/review/manual evidence, courier booking/list, durable-job process/retry and authenticated courier/refund ingress. Maintenance now executes retained jobs as well as capture recovery/expiry.

The tests cover rejection/re-request paise allocation, exact-once saleable restock, paid cancellation/capture replay, concurrent refund caps, COD maker-checker/chronology, retained unknown events, pending/failed job budgets, lost provider responses, remote amount/destination checks, stale delivery events and RTO safety. Provider-fetch tests use the documented endpoints and synthetic responses; browser finance stops at queued online approval and does not send a refund. One earlier responsive rerun failed because a selector matched two valid refund rows in a reused fixture; the selector was corrected and the final clean-fixture run above passed. The initial production preview also correctly rejected local auth until its documented loopback-only flag was supplied. These are not hidden as final application failures.

Status transitions: O08/O09/O10 moved MISSING to INTEGRATION; O11/O16/O18/O23/A03 moved MISSING to PARTIAL; O15 moved FOUNDATION to PARTIAL; O17 moved FOUNDATION to INTEGRATION. Other referenced rows retain their categories with updated evidence. Inventory totals are 50 COVERED, 67 PARTIAL, 9 INTEGRATION, 2 FOUNDATION, 31 MISSING, 11 UNVERIFIED and 1 DEFERRED. These are not a production-completion percentage.

No live/sandbox payment/refund, actual shipment/label/pickup, collection/remittance/bank payout, outbound email/SMS, legal/GST approval, hosted scheduler, remote CI, load/CWV certification, full WCAG review or restore drill was performed. Remaining first-sale engineering includes invoices/credit notes, MFA/granular permissions, reverse pickup/replacements, outbound notifications and late-capture/provider/finance exception resolution. Merchant/provider configuration and approval must accompany staging acceptance.

## 6. Database coverage against the roadmap

The current schema contains **45 tables** after migrations 001-009. The roadmap proposes a considerably richer relational model. Names need not be identical, but the missing business semantics still need implementation.

| Roadmap family | Current equivalent | Coverage / remaining model |
| --- | --- | --- |
| Profiles/auth/addresses | `users`, `sessions`, `addresses` | Local identity plus address labels/purpose/defaults and billing snapshots; full profiles and consent remain missing |
| Role definitions/permissions/staff roles | `users.role` | Fixed roles including finance/marketing; permission joins/invitations/multiple roles absent |
| Consent and audit | `newsletter`, `privacy_requests`, `audit_logs` | Request/email storage and audit writes; versioned consent/retention/PII audit absent |
| Categories/collections/products | `categories`, `collections`, `products`, `product_collections` | Base relational catalog; hierarchy/slug/SEO/scheduling/merchandising management reduced |
| Media/options/size charts/attributes | `product_media`, `product_variants`, `size_charts` | Product images also stored on `products`; free size/color strings; normalized options/chart rows/attributes/variant media not complete |
| Warehouses/balances/reservations/movements | Variant `stock`/`reserved`, `inventory_movements`, order rows | No warehouse/balance/reservation tables; reservations inferred from order items/status; not a full physical-stock ledger |
| Suppliers/purchase orders/lines | None | Optional/later sourcing/receiving scope absent |
| Carts/wishlists | `carts`, `cart_items`, `wishlists` | Functional simplified cart/wishlist; no full guest expiry cleanup or named wishlist model |
| Orders/items/status events | `orders`, `order_items`, `order_status_events`, `invoice_documents` | Independent states and protected financial snapshots; separate invoice/credit-note history; only reviewed expired retention permits personal-address/buyer erasure |
| Payment attempts/events/refunds | `payments`, `payment_events`, `payment_webhook_inbox`, `refunds`, `refund_events`, `commerce_jobs` | Verified capture/refund recovery, bounded approval and immutable evidence; broader attempts, late-capture resolution, disputes/settlements and corrective accounting remain |
| Shipment/items/tracking/COD | `shipments`, `shipment_bookings`, `shipment_tracking_events`, `cod_ledger` | Copied provider booking/stages, authenticated scan history and separate immutable COD ledger; partial shipment items, NDR/reverse/cancellation and real reconciliation remain |
| Returns/return items | `returns`, `return_items`, `return_inspections`, `return_events` | Item policy/review/receipt/QC/disposition and exact-once restock; proof upload, reverse booking and replacement orchestration remain |
| Tax classes/rules/invoices | `tax_classes`, quote/item tax snapshots, `invoice_documents`, `document_sequences` | Effective tax mapping, immutable issuance/numbering, mixed-tax line credit allocation and private PDFs; merchant/accountant acceptance unverified |
| Promotions/targets/codes/redemptions | `coupons` | Percent/active only; no complete promotions engine/limits/redemption accounting |
| Reviews/media | `reviews` | Buyer review row; moderation/media/reporting absent |
| CMS/pages/blocks/banners/menus | `cms_content` | One home content object; no full CMS entities/editorial lifecycle |
| Settings | `site_settings` | Commerce/tax/COD, invoice issuer and retention-policy configuration; actual approved values and broader integration acceptance unverified |
| Notifications/templates/logs | `account_notifications`, `commerce_jobs` | Private deduplicated in-app updates and owned read markers; external provider/template/delivery/consent infrastructure remains absent |
| Support/ticket messages | `support_tickets`, `ticket_messages` | Owned order-linked tickets/messages, staff notes/queue/resolution; attachments/notifications/SLA unfinished |
| Webhook inbox/outbox/integration health | `payment_webhook_inbox`, `commerce_jobs` | Durable capture/refund/courier ingress and leased retries/operator console; external-message outbox, hosted health/alerts and broad reconciliation remain |
| Migration history | `schema_migrations` | Applied version/checksum ledger; local legacy-preservation/reapply tests |
| Auth abuse limits | `rate_limits` | Extra local protection for selected endpoints, not full bot/fraud infrastructure |

## 7. Page and API coverage

An equivalent experience can satisfy a business requirement with different URLs. A catch-all route does **not** mean every roadmap URL has been implemented.

### Public/account pages

| Roadmap pages | Current implementation | Assessment |
| --- | --- | --- |
| `/`, `/shop`, `/cart`, `/wishlist`, `/checkout`, `/account`, `/auth/callback` | Same routes | Present; workflow limitations listed above |
| `/product/[slug]` | `/products/[slug]` | Equivalent PDP, plural path; no singular alias found |
| `/category/[slug]` | `/shop?category=...` | Category experience present; dedicated category route absent |
| `/search` | Header search → `/shop?q=...` | Basic equivalent, advanced search absent |
| `/login`, `/signup`, `/forgot-password` | Modes inside `/account` | Equivalent UI modes; provider recovery remains unverified |
| `/account/profile`, `/account/addresses`, `/account/orders` | Tabs inside `/account` | Functional subsets; no dedicated subroutes |
| `/size-guide`, `/our-story` | `/fit-guide`, `/about` | Static equivalents |
| `/privacy`, `/terms`, `/shipping`, `/returns` | `/policies/privacy`, `/policies/terms`, `/policies/shipping`, `/policies/returns` | Draft equivalents; root aliases absent |
| `/contact` | `/contact` | Page present, care-team details not configured |
| `/wellness` | `/shop?category=wellness` plus landing section | Category equivalent, dedicated content page absent |
| `/collections`, `/collections/[slug]` | No full equivalent | Absent |
| `/journal`, `/journal/[slug]`, `/help` | No full equivalent | Absent |
| `/checkout/payment-status`, `/order/confirmation/[number]` | Redirect after verified payment to private order detail | Dedicated status/confirmation absent |
| `/account/orders/[id]`, `/account/returns`, `/account/support` | Private order detail/events/scans, per-item return intake, returns/refunds page, private updates and support threads | Reverse booking, proof uploads, replacements and outbound notification acceptance remain |

### Admin pages

`/admin` currently offers **Catalog, Inventory, Orders, Homepage, Offers, Commerce, Support and restricted Payments/COD** tabs. Product/SKU create/edit are dialogs. This is a usable subset, not the complete admin route map.

| Roadmap area | Current equivalent | Gap |
| --- | --- | --- |
| Products/new/edit/variants | Catalog/dialogs | Base functionality exists; dedicated routes absent |
| Inventory | Inventory tab | Current stock/reserved display and edit; full movements/receiving controls absent |
| Orders | Orders tab | Latest-order list and manual transitions; search/details/partial fulfillment absent |
| Coupons/promotions | Offers tab | Basic coupon upsert only; no full promotion management |
| Banners/pages | Homepage tab | Limited text object only; no banners/pages CMS |
| Categories/collections | No management equivalent | Missing |
| Stock movements/shipments/returns/refunds/payments/COD reconciliation | Payment recovery and manual COD evidence consoles | Full provider finance, stock movement, shipping, returns/refunds and automated reconciliation consoles remain unfinished |
| Customers/reviews/support/reports | Scoped support queue, private notes, assignment and resolution; summary tiles/basic reviews | Full customer/review/reporting management remains absent |
| Roles/audit/settings/integrations | No management equivalent | Missing |

### API/service contracts

| Roadmap contract | Actual equivalent | Coverage |
| --- | --- | --- |
| Product listing/search reads | `GET /api/catalog?...` | Combined basic implementation; no dedicated product-by-slug/search/category/collection API or pagination |
| Shipping serviceability/quote reads | `POST /api/checkout/quote` | Courier-backed immutable quote/estimates, tax and COD policies; real provider acceptance pending |
| Cart item add/update/delete | `GET/POST /api/cart` (`quantity=0` removes) | Equivalent existing behavior; no separate PATCH/DELETE item routes |
| Cart merge | Internal login/register/OAuth helpers | Behavior exists; separate public merge API is unnecessary for current UI |
| Checkout quote/start | Preview `POST /api/quote`, authoritative `POST /api/checkout/quote`, `POST /api/checkout` | Immutable configured tax/courier/COD quote and transactional reservation; provider attempt/reconciliation acceptance remains unfinished |
| Payment verify | `POST /api/payments/verify` | Implemented provider-facing verification source |
| Razorpay webhook | `POST /api/payments/webhook` | Captured-event handler; roadmap `/api/webhooks/razorpay` alias absent |
| Shipping/messaging webhooks | `POST /api/shipping/events`; no messaging ingress | Token-authenticated durable courier event handler exists and local ingress tests pass; actual courier delivery remains unverified. Messaging is absent. |
| Order cancel | `POST /api/orders/:id/cancel` | Unpaid and captured-prepaid-before-packing cancellation with exactly-once stock release; paid cancellation records a finance-review refund request |
| Returns/reviews | `POST /api/returns`, `GET/POST /api/reviews` | Intake/review subset only |
| Support tickets | `GET/POST /api/support/tickets`, thread detail/reply, admin queue/reply/update | Private usable workflow; notifications, uploads and full operations acceptance unfinished |
| Customer auth/profile/address/privacy/wishlist/orders | `/api/auth`, `/api/auth/google`, `/api/logout`, `/api/me`, `/api/profile`, `/api/password`, `/api/addresses`, `/api/privacy`, `/api/wishlist`, `/api/orders` | Present subsets; address CRUD/default/purpose and saved checkout selection now implemented |
| Admin products/variants | `POST /api/admin/product`, `/api/admin/variant` | Base upsert; stock changes bundled into variant update |
| Admin order fulfillment | `POST /api/admin/order` | Manual status/tracking-reference changes only |
| Admin CMS/promotions | `POST /api/admin/cms`, `/api/admin/coupon` | Home text/basic coupons only |
| Admin media | `POST /api/admin/media` | Local image upload |
| Admin refunds/settings/full CMS | Commerce/tax/COD settings and mapping endpoints | Refund request/review/manual evidence, RMA review/QC, shipping booking and durable-job operations exist; full CMS/invoice/broader settings remain missing |
| Operational health/retry/reconciliation | `GET /api/admin/payments`, `POST /api/admin/payments/retry`, `POST /api/internal/maintenance`, maintenance CLI | Capture replay/expiry entry points; hosted scheduler, provider truth/settlement and general health missing |

## 8. Essential business journey acceptance

| Roadmap journey | What currently works | What prevents full acceptance |
| --- | --- | --- |
| 1. Guest → prepaid purchase → delivered | Browse/filter/SKU/cart/auth merge, price quote, gateway source and local capture logic | Provider login/payment proof, saved address/serviceability/tax, notifications, courier booking/tracking and staging delivery proof |
| 2. COD → collected → remitted | Locally verified eligible quote, confirmed-unpaid checkout, manual delivery and evidence-backed collection/remittance | Actual courier execution, independent statement/bank proof, RTO/refund and automated reconciliation acceptance |
| 3. Two buyers contend for final SKU | Fresh local embedded DB test permits exactly one checkout | Managed PostgreSQL/staging contention and user recovery acceptance |
| 4. Gateway failure/abandon/retry | UI failure/dismiss handling, refresh-persistent keys, fingerprint validation, durable capture recovery and local expiry/race tests | Provider failure/timeout/refresh retry, payment attempts, late capture, scheduler and reconciliation |
| 5. Return → pickup → inspect → refund/exchange | Owned item policy/RMA, receipt/QC/disposition/restock, approved bounded provider/manual refunds and private updates | Reverse pickup, actual replacements, proof uploads, external notifications and merchant/provider acceptance |
| 6. Admin publish → storefront → coupon → historical integrity | Product/SKU/publication/archive/basic coupons and copied item details | Category/collection controls, broader permission coverage and explicit historical-edit acceptance/immutability |
| 7. Customer/staff access control | Customer/anonymous denial, owner-positive operations, selected RLS tests | Finance permission/refund workflow, MFA and full staff/data-access matrix |
| 8. Operations/retry/discrepancy/notify/restore | Durable verified capture inbox, operator replay and independent maintenance entry points | Hosted jobs/outbox, full provider/courier reconciliation, notifications, alerting and backup restore |

## 9. Roadmap build gates — current verdict

These mirror the 17 gates in roadmap section 15. **None is signed off as a complete production gate.** Some underlying local behaviors have passed tests.

| # | Gate | Verdict and reason |
| --- | --- | --- |
| 1 | Legal/category/provider review | UNVERIFIED — merchant/professional approvals absent from available evidence |
| 2 | Admin permissions and RLS | PARTIAL — selected local authorization/RLS checks; full permission and production matrix missing |
| 3 | Product/SKU CRUD and inventory movements | PARTIAL — local product/SKU implementation; full movement semantics, actor/reason/history and exact-once adjustment proof incomplete |
| 4 | Catalog size/color filters mobile/desktop | PARTIAL — selected current desktop/mobile filter/reload checks pass; complete discovery scope remains unfinished |
| 5 | Guest cart persistence and checkout login redirect | PARTIAL — fresh selected desktop/mobile shopping/merge/gate checks pass; complete provider purchase and broader acceptance remain |
| 6 | Address create/edit/default/validation | PARTIAL — complete local CRUD/default/select and format checks pass; real pincode/city/state/courier validation remains |
| 7 | Courier-based pincode eligibility and quote | INTEGRATION — adapter/quote contract checks pass; real credentials, city aliases and merchant/provider acceptance unverified |
| 8 | Server tax/promotions/delivery/COD surcharges | PARTIAL — configured tax, quote shipping and COD fee tests pass; merchant rules, expanded promotions and provider/staging acceptance remain |
| 9 | Gateway sandbox success/failure/timeout/refund | UNVERIFIED - local approved bounded refund and recovery code exists; no provider sandbox acceptance |
| 10 | Duplicate/late webhook and inventory race tests | PARTIAL — signed ingress, capture/cancellation races, late exceptions and final-SKU tests pass; broader event types and provider/managed staging remain unverified |
| 11 | COD unpaid/collection/remittance reconciliation | PARTIAL — local unpaid-through-delivery and verified-staff ledger tests pass; real courier/bank evidence and automation remain unverified |
| 12 | Fulfillment/courier/tracking/NDR/RTO | PARTIAL — manual status/reference subset only |
| 13 | Policy-correct returns/exchanges/refunds | PARTIAL - item policy/RMA/QC/restock, bounded approved refunds and local recovery tests pass; merchant policy, reverse booking, replacements, proof uploads and actual provider acceptance remain |
| 14 | Editable banners/collections/3D content | PARTIAL — limited home text only |
| 15 | Mobile/motion/WebGL/accessibility | PARTIAL — source and prior automated subset; complete manual/device acceptance missing |
| 16 | Backup restore/incident/rollback drill | UNVERIFIED |
| 17 | Production merchant onboarding/live smoke order | UNVERIFIED |

## 10. Important corrections to broad completion claims

1. **Address CRUD is locally verified.** Edit/delete, purpose/defaults and checkout selection now exist; geographic/courier validation remains separate.
2. **Manual shipment references are customer-visible.** Order detail now exposes carrier/reference and real order transition events. This is not a live courier scan feed.
3. **Return intake uses copied terms and delivery evidence.** New quotes preserve product windows/seal conditions; legacy unknown terms/delivery dates require care review for voluntary returns. Defect/damage/incorrect-item requests remain reviewable; no universal 14-day policy is asserted.
4. **CMS save success is not proof that all fields change the page.** Current home uses `headline`/`storyBody`; header uses announcement. Other editable home fields are unused. The existing CMS test checks the API response for `eyebrow`, not rendered page propagation.
5. **A 3D implementation file is not proof it is mounted.** Current home uses a static `/images/hero.webp` hero plus separate bloom/silk scenes. Older notes saying `hero-softness-v2.webp` and relief are the active hero do not match current source.
6. **Independent lifecycle fields include COD due/collected/remitted.** Customer/admin screens expose DB-guarded states/events. Automated COD reconciliation, authorization, refunds and corrections remain unfinished.
7. **The financial tile reports captured prepaid volume.** It sums all captured Razorpay payment records and is labeled accordingly. It is not settlement, net sales, COD or refund-adjusted reporting.
8. **Newsletter consent is currently a browser check.** The API records only email/time, without requiring or preserving consent/version; the promised unsubscribe path is absent.
9. **Expiry has independent entry points.** CLI/HTTP maintenance can release reservations without browsing the catalog. No deployed scheduler or alert has been verified.
10. **`stock` already represents available stock in current code.** It is decremented on reserve and paired with `reserved`; applying the roadmap's on-hand-minus-reserved formula directly to it would double-subtract.
11. **Selected history has append-only guards.** Orders, financial request identity/approval, payment/refund/inspection/tracking events, movements and audits are protected and tested locally. Invoices, corrective accounting and managed runtime-role verification remain incomplete.
12. **Refunds now have an integration workflow; support and commerce settings have usable local workflows.** Their broader notification/grievance/provider acceptance is still incomplete. Fresh QA found a mutable manual-payout evidence field; see SP-QA-003.
13. **Gateway code and local capture tests are not a completed real payment integration.** No fresh sandbox/live provider transaction was performed here.
14. **Fresh and historical tests are distinct.** E23 records this implementation increment; earlier test claims remain historical and are not added to its totals.

## 11. Prioritized remaining work

These are implementation/review priorities, not permission requests or instructions to perform the work during this audit.

| Priority | Work package | Completion evidence required | Likely owner |
| --- | --- | --- | --- |
| 1 — Before real sales | Confirm merchant/catalog eligibility, seller/tax/policies/contact/packaging/serviceability rules | Approved requirements and actual merchant/provider details; verified product specifications/media | Merchant + relevant professional/provider reviewers |
| 1 — Before real sales | Extend the new lifecycle foundation with complete attempts, refunds, quotes and accounting | State-transition and immutable-history tests; migrations exercised in staging | Engineering |
| 1 — Before real sales | Validate configured tax and courier-backed quote/COD eligibility; finish invoices and expanded promotions | Create/edit/default/select address tests; provider-backed serviceability/rates and server total acceptance | Engineering + merchant |
| 1 — Before real sales | Complete provider-create uncertainty, late-capture/refund resolution and hosted expiry/reconciliation | Sandbox success/fail/abandon/retry/late-event tests, managed DB contention and retry/exception visibility | Engineering + payment provider |
| 1 — Before real sales | Validate the implemented COD/manual ledger with courier/bank evidence; finish automation and exceptions | Confirmed-unpaid → collected/remitted tests and courier finance reconciliation | Engineering + merchant/courier |
| 1 — Before real sales | Complete courier fulfillment, visible tracking, invoice and notifications | Staging prepaid/COD order through label/pickup/delivery, verified webhooks and invoice/message proof | Engineering + merchant/courier |
| 1 — Before real sales | Finish RMA/exchanges/refunds/paid cancellation and support notifications/uploads/SLA | Per-item eligibility/defect path, reverse pickup/QC, bounded idempotent refunds and customer/staff workflow tests | Engineering + operations |
| 1 — Before real sales | Deploy managed DB/auth/storage; add MFA, monitoring/backups and recovery/rollback procedures | Provider auth recovery tests, complete role/RLS matrix, restore drill, alert/rollback evidence and controlled live smoke transaction | Engineering + operations |
| 2 — Complete roadmap v1 | Category/collection/attribute/SKU generation, advanced filters/search and full CMS | Publish/search/filter/content propagation tests on mobile/desktop; staff permission acceptance | Engineering + catalog/content staff |
| 2 — Complete roadmap v1 | Promotion rules/scheduling, review moderation, finance/operational reports | Limits/redemptions/refund-adjusted report reconciliation and campaign authorization tests | Engineering + finance/marketing |
| 2 — Complete roadmap v1 | Full accessibility, security, SEO, performance and browser acceptance | Agreed load/CWV budget, manual WCAG review, supported-browser/device results, metadata/indexing proof | Engineering + QA |
| 3 — Optional/later | Back-in-stock, personalization, matching sets, quiz, recently viewed and marketing automation | Explicit scope, consent/unsubscribe, inventory/discount reconciliation and customer acceptance | Product + engineering |
| 3 — Optional/later | Kling video, loyalty/referrals/gift cards/subscriptions, international/multilingual/multi-warehouse/sourcing/forecasting | Approved optional scope plus capability-specific evidence | Product + engineering |

Use the **COVERED** rows to identify delivered local capabilities; use **PARTIAL / INTEGRATION / FOUNDATION / MISSING** rows to plan implementation; use **UNVERIFIED** rows to collect external acceptance evidence. Production launch still depends on the essential Phase 0–11 and Phase 14–15 release gates, not on the visual completeness of the storefront.

## 12. Independent QA campaign — 1 November 2026

The user requested QA and a module-by-module unfinished-work list, cross-checked against the Markdown contracts. This campaign did not authorize product implementation, deployment or live transactions. Existing uncommitted source and original tests were preserved; see [source preservation](qa/evidence/preservation.json) and [tested hashes](qa/evidence/fresh/source-inventory.json). The base commit is `2217a83c2f0aa81b09a3f310a5732fd858cbf76f`, but its dirty working tree is the actual tested snapshot.

Fresh results, separate from all historical runs above:

| Layer | Fresh result | Boundary |
|---|---|---|
| Existing Node suite | 97 PASS / 0 FAIL / 2 SKIPPED | 99 runner entries include parents; HTTP suites run separately; PGlite and mocked providers |
| Existing HTTP suites | 29 PASS / 0 FAIL | New isolated loopback production preview, synthetic records |
| Additional HTTP probes | 196 PASS / 2 FAIL | 198 assertions including 185 role-route combinations; consent:false and selected-variant price sort fail |
| Additional domain probes | 5 PASS / 3 FAIL | Payout evidence mutability, semantic notice dedup and stale-worker success summary fail |
| Entire existing browser suite | 26 PASS / 0 FAIL | Seven spec files on desktop/mobile Edge/Chromium emulation |
| Independent browser audit | 3 PASS / 3 FAIL | CMS propagation fails both projects; desktop catalog contrast fails; 320px scan and WebGL/reduced-motion fallback pass |
| Follow-up browser concurrency / focus | 0 PASS / 2 FAIL | Independently reproduced two-tab lost cart increment and keyboard search focus-return failure |
| Final typecheck / optimized build | PASS | Initial existing QA typing issue corrected. Build used `--webpack`; default copied-tree Turbopack resolution was blocked by external dependency junction |

See [execution details](qa/EXECUTION_REPORT.md), [defects](qa/BUG_REPORT.md), [171-ID traceability](qa/REQUIREMENTS_TRACEABILITY_MATRIX.md), [module focus list](qa/MODULE_GAPS.md) and [all 17 gates / eight journeys](qa/RELEASE_READINESS.md). There are nine reproduced behavior defects plus the observed missing SEO capability; these are not 171 failed requirements. Full per-action negative/boundary/provider/device expansion remains incomplete and is not represented as executed. Other QA artifacts added in the workspace are preserved but excluded from these campaign totals unless independently rerun here.

**Evidenced classification change:** F02 COVERED → PARTIAL. Current home mounts only `Sculpture mode="silk"`; procedural bloom code is dormant and existing motion tests explicitly require flower/hero-petal sections absent. Historical bloom descriptions/screenshots are not current mounted-feature proof. No other detailed row was promoted. Counts are now **49 COVERED, 68 PARTIAL, 9 INTEGRATION, 2 FOUNDATION, 31 MISSING, 11 UNVERIFIED, 1 DEFERRED = 171**.

Fresh defects qualify existing partial claims: Q07/A12/O18 lack a guard against privileged SQL replacement of completed manual payout evidence (P1 SP-QA-003; no customer exploit demonstrated). O07/O10/Q13 allow duplicate semantic courier notices (SP-QA-004). P17/Q13 maintenance reports a stale lease's completion as success even though its fenced row stays running (SP-QA-005). F11, C10 and M07 historical concerns reproduced. Q19 has a serious desktop catalog contrast failure. The all-record captured-prepaid tile passed >100-order verification; do not repeat the old truncation claim as a fresh failure.

**Release: NO-GO.** No full target-environment launch gate is signed off. Actual provider sandbox, managed PostgreSQL/staff MFA, merchant/tax/policy acceptance, reverse/exchange/invoice/outbound-message workflows and backup/incident/rollback evidence remain incomplete or unverified. No live charge/refund/payout, courier booking or external message was made. The full roadmap remains unchanged.
## Independent local verification supplement

Fresh independent primary snapshot: **NO-GO**. All 171 IDs preserved; no roadmap/application/original-test changes. [Detailed fresh execution](qa/EXECUTION_REPORT.md), [408 latest focused case records](qa/MASTER_TEST_CASES.md), [source-hash preservation](qa/evidence/primary-preservation.json). Earlier campaign history above remains distinct.

Fresh assertions: Node 97 PASS/2 SKIPPED (initial flaky fixture retained); original HTTP 29 PASS; all original browser cases 26 PASS; domain 6 PASS/3 FAIL; latest focused HTTP 196 PASS/2 FAIL; cross-engine raw 11 PASS/15 FAIL, corrected HTTPS retest leaves 13 PASS/13 FAIL (six strict native-focus oracle failures are not proven application traps). Local restore PASS; restored HTTP/session/privacy 5 PASS/1 FAIL. Aggregate 379 PASS/26 FAIL/2 SKIPPED/1 BLOCKED includes parent/environment rows, not completed features.

Classification corrections supported by fresh evidence: F09 COVERED -> PARTIAL (Escape loses trigger focus); A07 MISSING -> PARTIAL (weight/parcel fields already exist, automatic combinations/barcodes missing); O09 INTEGRATION -> PARTIAL (multiple/split shipment allocation absent). F02 was already corrected to PARTIAL for dormant bloom. Other edited rows qualify current evidence. Current totals: **48 COVERED, 71 PARTIAL, 8 INTEGRATION, 2 FOUNDATION, 30 MISSING, 11 UNVERIFIED, 1 DEFERRED = 171**.

New defects SP-QA-011/012 cover label/name accessibility and omitted support-ticket export. SP-QA-013/014 record local Lighthouse and order-history latency budget misses, without claiming field/staging failure certification. Local closed-store restore retains 112 orders/108 payments/107 audit rows/nine migrations and synthetic captured sum; managed backup/RPO/RTO remains unverified. Full independent requirement disposition: 2 PASS, 46 FAIL, 17 BLOCKED, 105 NOT RUN, 1 SKIPPED. Provider sandbox, managed PostgreSQL, merchant approvals, missing first-sale modules and complete manual/device/recovery acceptance remain open.

<!-- LOCAL-RECOVERY-2026-11-01 -->
## Local recovery supplement

2026-11-01T15:08:44.621Z: 171 IDs retained, with 51 COVERED, 70 PARTIAL, 11 UNVERIFIED, 28 MISSING, 1 DEFERRED, 2 FOUNDATION, 8 INTEGRATION. These are capability classifications, not a completion percentage. Historical QA supplements above describe their original snapshots. The current changed rows link to [fresh recovery evidence](Sky_Petal_Local_Recovery_Report.md). Full release remains NO-GO, 0/17 target gates accepted.

<!-- LOCAL-COMPLETION-2026-11-10 -->
## Local completion supplement — 10 November 2026

Invoice/credit-note issuance, replacement-order exchange links, staff TOTP/session
step-up, reviewed retention/local erasure and read-only readiness checks are now
implemented and locally exercised. O12 changes from MISSING to PARTIAL. The
inventory remains 171 IDs: 51 COVERED, 71 PARTIAL, 27 MISSING, 11 UNVERIFIED,
8 INTEGRATION, 2 FOUNDATION and 1 DEFERRED. Other updated rows remain PARTIAL
because their stated policy/provider/managed acceptance is still absent.

See [current recovery results](Sky_Petal_Local_Recovery_Report.md) and
[workflow/operations contract](docs/COMPLETION_OPERATIONS.md). No full release
gate is signed off. Mobile LCP remains over target; the actual approved
seller/retention source still needs identification/configuration, and external
provider/staging outcomes remain UNVERIFIED. No live effect was attempted.
