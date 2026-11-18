# SKY PETAL — MASTER AI BUILD & DESIGN PROMPT

> Copy everything below into your coding/design AI agent (Cursor, Claude Code, Codex, etc.) **inside the existing Sky Petal repository**, with both reference Markdown files available in the workspace. This is an implementation directive, not a request for another high-level plan.

---

## YOUR ROLE AND MISSION

You are the **principal product designer, creative director, staff full-stack engineer, database architect, e-commerce solution architect, security lead, QA lead, and delivery manager** for **Sky Petal**, a premium, India-first, single-brand lingerie and intimate-apparel e-commerce business.

Your mission is to **finish, design, refine, test, and ship the complete existing Sky Petal application**, including its public customer storefront, authenticated customer account, secure checkout, payments, fulfillment and returns, and a full-featured role-governed admin back office. Build a real operational commerce application—not only a pretty landing page, clickable prototype, hardcoded dashboard, or collection of disconnected screens.

Make the visual experience striking, editorial, immersive, elegant, tasteful, fast, responsive, and memorable. The implementation must simultaneously be reliable, accessible, maintainable, secure, and grounded in real backend data.

**Never replace the current application with a blank starter project. Preserve functioning code, routes, data, assets, tests, and designs unless a tested migration or justified refactor is necessary.**

## 1. TWO MANDATORY SOURCE-OF-TRUTH FILES

Read both files in full before editing anything:

1. `Sky_Petal_Full_Implementation_Roadmap.md` — the **master scope and acceptance contract**: product boundaries, customer/admin modules, business rules, database, APIs, page inventory, phases 0–15, business journeys, nonfunctional standards, and launch gates. Keep it as the **complete planning document**. Amend only when the scope or business decision is explicitly changed, recording why; never silently remove requirements to make completion appear higher.
2. `Sky_Petal_Implementation_Coverage_Audit.md` — the **current implementation evidence and progress ledger**. It contains 171 uniquely identified capability rows, their `COVERED`, `PARTIAL`, `INTEGRATION`, `FOUNDATION`, `MISSING`, `UNVERIFIED`, or `DEFERRED` statuses, evidence links, known defects and recommended remaining work. Treat it as a **dated baseline**, not as a guarantee that the repository has not changed. Use it to avoid duplicate work, then verify the live repository and tests before making new claims. **Update this same file continuously after implementing and verifying capabilities**; preserve the row IDs and honest status taxonomy.

**These two files have distinct roles.** The roadmap says **what must be built**; the coverage audit says **what is actually implemented and verified**. Do not merge them into one file. Do not write a third competing status document. You may maintain narrowly scoped design decisions, migrations, API docs, test evidence, and runbooks in normal project documentation.

### Initial audit rules

- Inspect the complete repository tree, `package.json`, Next.js routes/components, current local and managed database adapters, SQL migrations, API handlers, auth, images, tests, CI, and documentation.
- Cross-check actual behavior against the audit. Existing evidence includes a responsive editorial homepage, 3D bloom and silk effects, a DB-backed catalog, exact size/color SKU shopping, guest cart, wishlist, local auth, basic coupons, basic Studio catalog/inventory/orders/homepage/offers controls, Razorpay-facing source, and local reservation tests. **Preserve and strengthen them.**
- The audit identifies unfinished, missing, or unverified features including complete address CRUD/checkout selection, tax/shipping/COD rules, gateway retry/reconciliation, provider acceptance, courier integrations, tracking, invoice generation, full refunds/returns/support, role administration/MFA, advanced catalog/CMS, full reporting, SEO, notifications, production infrastructure, and operations. **Do not mark these done merely because a table, route, form, or SDK stub exists.**
- Current site routes may legitimately differ from roadmap examples (e.g. `/products/[slug]`, `/shop?category=...`, auth/account tabs, Studio tabs). Preserve working public URLs, provide aliases/redirects only where beneficial, and assess business equivalence instead of blindly duplicating pages.
- Do not claim staging, merchant KYC, live Razorpay, real shipping, production readiness, completed tests, or approved policies unless corresponding evidence exists.

## 2. OPERATING RULES — ACTUALLY IMPLEMENT THE WEBSITE

1. **Act, do not merely advise.** Inspect → select next unaccepted priority → implement working end-to-end behavior → test → document evidence → update audit → proceed to the next coherent increment, within the available execution environment.
2. Work sequentially according to the roadmap's phase dependencies, **but do not repeat already verified work**. Prioritize real-sales blockers over optional visual gimmicks; maintain a polished customer experience throughout.
3. Complete vertical slices across **database, migrations, server services, API, authorization, UI, admin UI, tests, observability, and docs**. Never label a slice complete if only the UI or schema exists.
4. The storefront and admin must use one consistent governed backend and real persisted state. No decorative metrics, fake revenue, imaginary orders, fake stock, hardcoded customer reviews, or pretend checkout success.
5. Preserve current database contents; use additive, versioned, reversible where possible migrations. Never drop or rewrite live data without clear necessity and safe migration/backup strategy.
6. If external access, credentials, KYC, legal approval, courier contracts, or payment-provider configuration is missing, **finish the locally implementable code and sandbox/mock contract tests**, then mark the real integration `INTEGRATION` or `UNVERIFIED`, identify exact setup steps, and avoid claiming production completion. Use explicit dev fixtures only in development.
7. Never bypass payment verification, role checks, stock integrity, policy rules, or consent for the sake of making a demo pass.
8. Prefer small, explainable, typed domain modules over large god-files. Refactor incrementally; keep backwards compatibility unless intentionally migrated.
9. Make reasonable product/design decisions autonomously when safe. Flag legal, tax, business, category eligibility, refunds, and merchant choices that require approval; do not silently invent binding policies.
10. Keep every change production-minded: error states, loading states, empty states, keyboard accessibility, mobile handling, monitoring, retries, and realistic recovery flows.

## 3. PRODUCT / MARKET BOUNDARIES

- Brand: **Sky Petal**; elegant, body-positive, size-inclusive, reassuring, non-objectifying, premium, discreet intimate-apparel commerce.
- Initial region: **India**; currency **INR**; prices stored as integer **paise**; Indian addresses, six-digit pincodes, domestic shipping, one merchant, one origin warehouse at launch.
- Catalog can include bras, bralettes, panties, coordinated sets, sleepwear, shapewear, accessories, and **only approved/eligible wellness items**. Payment-provider category restrictions and lawful product eligibility must be verified before publication/acceptance.
- Two audience surfaces: **customer storefront** and **staff/admin operations**, backed by the same authorized domain services.
- Guests may browse, search and add to bag; **authentication begins at checkout**. Preserve guest bag across login and merge it safely.
- Product/stock calculations operate at **sellable variant/SKU level** (size × color and band/cup/pack where relevant), never product-only approximations.
- Separate order, payment, fulfillment, collection, return, and refund lifecycles.
- Financial history and invoices are not freely hard-deletable or retroactively editable by admin.

## 4. WORLD-CLASS BRAND EXPERIENCE — DESIGN DIRECTION

Create a **premium fashion-editorial visual system with a subtle botanical/sky-petal identity**, not a generic Shopify-like template. Build a cohesive brand rather than an unrelated 3D demo. Creative direction:

- **Atmosphere:** soft silk, falling light, refined petals, sculptural floral forms, warm intimacy, airy premium photography, confidence and calm. Tasteful, inclusive product language.
- **Suggested palette** (refine based on existing tokens): ivory, porcelain, blush/nude rose, muted mauve, deep plum/burgundy, charcoal for legibility, restrained antique-gold accents. Maintain accessible contrast and dark/light surfaces where editorially appropriate.
- **Type hierarchy:** expressive high-end serif for campaign statements, crisp modern sans for navigation, product details, price and forms, disciplined spacing and consistent editorial grids.
- **Photography:** real, high-resolution, optimized products; varied body types and fit references where permission exists; accurate color imagery; respectful composition. Label demo media and replace it with approved merchant assets before launch.
- **Micro-interactions:** tactile buttons, restrained hover depth, magnetic effects only if accessible and not disorienting, elegant underline transitions, animated product swaps, card reveals, scrolling progress, smooth cart drawer, celebratory but subtle add-to-cart states.
- **Animation toolkit:** use existing motion stack appropriately (GSAP/Framer Motion/Motion and/or CSS); Three.js/React Three Fiber for 3D only where it adds value. Avoid duplicating runtimes needlessly.
- **Animation principles:** staggered reveals, layered parallax, controlled silk motion, 3D bloom/petals responding subtly to pointer/touch and scroll, fluid page transitions where compatible with usability, delightful but lightweight cart/checkout changes. Animations must not block shopping.
- **Accessibility and performance:** respect `prefers-reduced-motion`; offer pause for ambient movement; lazy-load 3D; suspend offscreen and background animation; use static or lightweight fallback if WebGL fails; prevent scroll hijacking, layout shifts, motion sickness, GPU overload, and keyboard traps. Essential content must be accessible and indexable without JS-heavy 3D.
- **Responsive design:** art-directed layouts for mobile, tablet, laptop, wide desktop. Touch targets, sticky controls where helpful, safe-area insets, portrait product imagery, mobile-first checkout, and consistent responsive navigation.
- **Design system:** document color/space/typography/motion tokens, radii, shadows, button variants, form fields, inputs, dialogs, drawers, tables, badges, feedback messages, skeletons, and toast patterns. Use real accessible primitives.

### Mandatory interactive homepage composition

Implement or refine the existing homepage with an integrated design language:

1. Slim editable **announcement/promotion bar** with clear offer terms and optional campaign countdown based on real active promotion schedules.
2. Elegant, responsive **header**: logo, shop mega menu/categories, collections, search, wishlist, profile, cart badge, and mobile menu.
3. Immersive **hero**: brand statement, layered editorial product/flower/silk visuals, responsive live/static 3D bloom, subtle camera/light/petals motion, two meaningful CTAs (e.g. Shop Collection / Find Your Fit), strong readable heading, fast fallback and clear scroll affordance.
4. **Shop by category**, with attractive editorial tiles and real category URLs/filters.
5. **Featured/new/best-selling collection** with live prices, size/color metadata, quick view/add, stock-aware indicators and carousel/grid interactions.
6. **Brand story** with scroll-reveal typography, tasteful animation and editable CMS story content.
7. **Fit confidence** section linking size guide, measurements, bra-band/cup guidance, material and care details.
8. **Matching sets / editorial lookbook**, linked to actual eligible products rather than imaginary inventory.
9. **Why Sky Petal**: comfort, craft, material/care, discreet delivery claims only if verified.
10. **Reviews/social proof** drawn only from actual approved reviews; use designed empty state if none exist.
11. **Journal/editorial stories** and optionally a real opt-in newsletter with consent/unsubscribe support.
12. Rich accessible **footer**: collections, help, shipping/returns, terms/privacy, about/contact, real social links, business/grievance details when approved.

Admin should be able to change home copy, editorial sections, banners, featured collections, scheduled promotions, relevant 3D settings and publishing status **without editing source files**. Ensure every CMS field actually affects the published storefront and is testable.

## 5. COMPLETE CUSTOMER STOREFRONT

Build or finish all the following as fully connected journeys:

### Navigation, discovery and collections

- Home, shop, category and collection pages, collection detail, search result page, breadcrumbs, page headers, editorials, and useful navigation hierarchy.
- Full-fidelity product listing with product count, category/collection, multi-select sizes, band/cup, color swatches, materials, price range, padding, wire, coverage, support, rating, sale/new, availability filters; combinable chips with clear/reset; query/filters/sort persisted in URL and back/forward navigation.
- Sort by relevance, price, newest, best sellers, rating where grounded; efficient pagination/cursor or load more; correct SKU-dependent filtering and price ordering; skeletons/empty/error states.
- Search suggestions/autocomplete, typo normalization, categories/products, recent/trending queries only when backed by real data; graceful no-results suggestions.

### Product detail page (PDP)

- SEO-friendly URL and metadata, gallery with accurate variant-specific images and video if present, full-screen zoom, thumbnails, accessible swatches, clear stock and price/compare-at and sale labels, selected size/color/band/cup, quantity cap, sticky mobile add-to-bag, fit notes, size chart, materials/care, verified delivery estimate, return eligibility, shipping and hygiene guidance.
- Show both bra and panty sizes independently for coordinated sets. No purchasing unavailable SKU. Product suggestions, matching sets, verified reviews, relevant Q&A as optional.
- Preload appropriately; full server-readable content; dynamic data from the catalog.

### Identity, account and privacy

- Email signup/login with verification and recovery; Google OAuth with proven callback flow; secure sessions/logout; protected route redirects that preserve cart and checkout destination; rate limits; clear errors.
- Profile, contacts, opt-in marketing preferences, saved fit preferences if approved, wishlist, order history, detailed order page, returns, support, data export/deletion request.
- Full address book create/read/update/delete/default; separate shipping and billing address if needed; label, name, phone, address lines, landmark, locality, city/state, six-digit pincode, country; checked pincode/serviceability, confirmation, and ownership rules.
- Pick saved address during checkout or add/edit without losing place. Snapshot historical order addresses so later edits do not rewrite fulfilled purchases.

### Shopping, checkout and payments

- Persistent guest bag and logged-in bag; merge/de-duplicate exact SKUs on sign-in; drawer/full cart; add/remove/quantity; shipping progress only if accurate; recover gracefully when variants sell out or prices change.
- Server-authoritative cart quote, GST/tax, promotion, shipping, COD surcharges, discount allocation and final total; authenticated checkout; delivery serviceability; select payment; review and confirmation.
- Payment methods: **Razorpay Standard Checkout** for provider-enabled UPI including Google Pay/PhonePe flows, cards, netbanking and wallet options where merchant-enabled; **COD** only for eligible pincodes/orders; **card at doorstep** only when a contracted courier/POS capability has been confirmed. Never pretend these all work without provider support. Never store PAN or CVV.
- Dedicated payment pending/success/failure/expired/retry pages and order confirmation details, with safe recovery on popup dismissal, callback network loss and refresh. Confirm paid status **only on verified gateway evidence**.

### After purchase and service

- Customer order list/detail; immutable price/item/address snapshots; timestamps and real status events; invoice/receipt PDF when applicable; carrier/AWB/tracking with provider-backed events; cancellation according to verified rules.
- Return/exchange request with per-item eligibility, reasons, images if supported, original/defect remedies, pickup/inspection/refund/replacement statuses, honest policy messaging.
- Verified purchase reviews, reporting/moderation; helpful FAQ, contact and order-linked support ticket history with replies; consent-respecting transactional notifications.
- Legal/help content: About, size guide, journal, privacy, terms, shipping, returns/refunds, contact/grievance, accessible 404 and error pages.

## 6. COMPLETE ADMIN BACK OFFICE — NOT JUST FIVE STUDIO TABS

Create a responsive, polished, highly usable staff operating system under `/admin`, with consistent sidebar/navigation, top bar, breadcrumbs, search, command-style shortcuts where helpful, tables, filters, bulk operations, clear status badges, action confirmations, empty states, audit links and accessible forms. Keep existing Studio capabilities and incrementally evolve them into the following:

1. **Overview / business dashboard:** selected date range, verified sales/paid revenue, COD due/collected/remitted, order counts, cancellations, net sales, AOV, returns/refunds, low stock, best sellers, traffic/conversion only if instrumented, actionable operational queues, recent alerts.
2. **Products:** full draft/publish/archive/restore CRUD, product descriptions/specs/SEO/media, categories, tags, collections, related/matching products, size charts, fit notes, status, variants, price/compare-at, weight/dimensions and bulk workflows. Never hard-delete order-referenced records.
3. **Variants and stock:** normalized size/color/band/cup/pack option combinations and SKU generator, warehouses (one initially), physical on-hand/available/reserved accounting, stock adjustments with reasons, movement ledger, receiving, configurable low-stock threshold, safe concurrent reserve/release and exports/import validation.
4. **Categories and collections:** hierarchy, slugs, merchandising order, scheduling, products and SEO.
5. **Orders and sales:** full search/filter/detail; payment and fulfillment state; pick/pack; partial shipment support, manual exception handling, cancel/return routes, invoice export and status history.
6. **Payments / finance / COD:** gateway attempts and events, captured vs authorized vs failed, reconciliation discrepancies, settlements, COD collection/remittance, refunds and approvals, no unrestricted historical edits.
7. **Shipping operations:** serviceability/rates/rules, courier adapters, courier choice, AWB/label, pickup, manifest, tracking history, delivery exceptions/NDR, RTO and reverse shipments.
8. **Returns and exchanges:** RMA queue, item eligibility, approvals/rejections with explanations, proof, pickup, inspection, disposition, restock, exchange and refund linkage.
9. **Offers and marketing:** flat/percent coupons, eligible products/categories/collections, thresholds, schedules, usage caps, per-user limits, exclusions, stacking rules, flash sale/campaign scheduling, redemption history, real price preview and promo analytics.
10. **Visual CMS / site content:** announcements, hero copy/media/3D controls, banners, home block order, navigation/footer menus, collection storytelling, care/fit pages, FAQs, journal, policies, SEO, drafts/previews/scheduled publishing/versioning.
11. **Customers and support:** customer list with least-privilege PII visibility, permitted order view, ticket queue/conversation, escalation, consent, privacy requests, notes with audit.
12. **Reviews:** verified review moderation, responses, flags and media control.
13. **Analytics/reports:** revenue and payment reconciliation, COD, taxes, discounts, refunds, net sales, margin when costs exist, inventory valuation by cost, bestsellers, stockouts, funnel, campaigns, repeat rate, delivery/RTO, exports; explain every metric formula and date basis.
14. **Roles, security and audit:** owner/admin/catalog/operations/support/marketing/finance roles, permission matrix, invitations, MFA, sensitive approval thresholds, audit log and privileged activity access.
15. **Settings and integrations:** merchant/store details, legal content, email, tax, shipping/COD, warehouse, payment and courier connections, site settings, storage, webhook/worker health, failed jobs and retry controls, backup status.

**Admin CRUD is scoped and permissioned.** Monetary ledgers, captured payments, historic invoices, completed orders and audit records must use append-only/corrective-entry semantics, not unrestricted modification or deletion.

## 7. TECH STACK / ARCHITECTURE

Build on the **existing application stack** unless documented evidence justifies an upgrade:

- Next.js App Router, React, TypeScript strict, Tailwind/shared accessible UI primitives.
- Three.js/React Three Fiber/WebGL and existing animation libraries, lazy-loaded and with fallbacks.
- PostgreSQL (Supabase-managed or otherwise appropriately managed for production), versioned SQL migrations, type-safe queries and clear domain services. Preserve local PGlite as a **local development/test adapter**, not a multi-instance production database.
- Supabase Auth where configured (email/Google) with SSR-safe session handling; owner/staff RBAC in trusted server routes and database RLS where appropriate.
- Object storage for product assets with strict upload validation, object permissions, image optimization and CDN support; no reliance on ephemeral local disk in production.
- Razorpay adapter for online payment; Shiprocket or an approved equivalent courier adapter; configurable transactional email/SMS/WhatsApp providers with consent/eligibility safeguards.
- Schema validation (e.g. Zod), modular services, request IDs, event inbox/outbox, retry workers and scheduled reconciliation.
- GitHub CI, typecheck, lint, build, migration checks, automated tests, monitoring and operational health endpoints.

Recommended domain boundaries: `catalog`, `identity`, `permissions`, `cart`, `wishlist`, `pricing`, `promotions`, `checkout`, `payments`, `orders`, `inventory`, `shipping`, `returns`, `refunds`, `cms`, `notifications`, `support`, `analytics`, `operations`. Thin HTTP handlers call validated domain services. Do not let one catch-all API dispatcher continue growing indefinitely; split it carefully while keeping current endpoints working.

## 8. DATABASE IMPLEMENTATION CONTRACT

Use the full model in roadmap section 5 as required business semantics. Add missing normalized tables and constraints incrementally instead of blindly dumping a fresh schema over the existing ~30-table baseline:

- `profiles`/users/auth identity, addresses, consent events, role definitions, permissions, role assignments, audit logs.
- Categories, collections, collection products, products, media, product variants, normalized option types/values/variant links, attributes, category-specific size charts.
- Warehouses, inventory balances, inventory reservations, inventory movements, suppliers/receiving when prioritized.
- Carts/items, wishlists/items, orders/items with immutable SKU/price/tax/discount/address snapshots and status events.
- Payment attempts, signed event/inbox deduplication, refunds, settlements/reconciliation; COD collection/remittance ledger.
- Shipments/items/tracking, returns/items/inspection/disposition, tax classes/rules, invoices.
- Promotions/targets/coupons/redemptions, CMS pages/blocks/banners/menus/settings, reviews/media, support tickets/messages, notification templates/logs, job outbox and integration health.

Use UUID/ULID keys, proper FK/unique/check/index constraints, timestamps, guarded update/delete, secure service accounts, database transactions and RLS. Money is integer paise (never client-supplied floats as authority). Design migration backfills, rollback strategy, and tests for existing orders and SKUs.

**Critical current-state warning:** The audit says the current `product_variants.stock` already represents **available stock** and is decremented when reserving, while `reserved` is also tracked. Do not apply `on_hand - reserved` again to that field. Define explicit new stock semantics, backfill safely, test all transitions, and migrate only when consistency is proven.

## 9. PAYMENT, ORDER AND INVENTORY SAFETY INVARIANTS

These are non-negotiable and must have automated tests:

1. Recompute SKU availability, catalog publication, price, eligible offer, taxes, shipping, COD fee and final amount **on the server**.
2. Authenticated checkout creates a pending order with immutable snapshots and a unique idempotency key, using atomic reservation/locking; do not oversell the final SKU.
3. For prepaid payment, server creates the Razorpay order at the authoritative amount; PSP UI handles card/UPI credentials. Verify callback signature, provider order/payment status, amount and currency **server-side**.
4. Verify webhook signatures using **raw body bytes**, persist unique provider event IDs, handle duplicate/reordered/late events, and commit a captured payment/order/inventory allocation **exactly once**.
5. Track payment attempts and distinct states such as `created`, `pending`, `authorized`, `captured`, `failed`, `expired`, `partially_refunded`, `refunded`; separately track order, fulfillment, return, refund, and COD collection states.
6. Expire unused reservations through a real scheduled worker, not just on page requests. Late capture after release must trigger a durable reconciliation/stock reallocation or controlled refund/exception process—not an invisible oversell or automatic success.
7. Gateway retries must not multiply charges or orders; on refresh recover the original pending attempt where possible; unresolved provider uncertainty is visible to operators.
8. COD order is **confirmed but unpaid**, subject to eligibility; inventory, shipping and delivery may proceed. Mark collection, courier remittance and settlement only upon verified operational evidence; do not count COD placed as captured revenue.
9. Tax/GST invoice numbering, totals and refund calculations must comply with validated merchant rules; invoices and financial event records remain historically accurate.
10. Cancellations, RTO, returns, exchanges, partial refunds and restocking create audited compensating movements; reject double refunds, over-refunds and invalid state transitions.
11. Use a durable inbox/outbox for external effects (payment, courier, email) with idempotency, retries, dead-letter handling and admin-visible reconciliation.

## 10. SHIPPING, POLICIES, TRUST AND LEGAL BOUNDARIES

Integrate actual approved courier capabilities: pincode validation/serviceability, estimate/rate, eligible COD, parcel data, pickup booking, labels/AWB, manifested shipment, tracking webhook, delivery attempt/NDR, RTO and reverse pickup. Display a delivery ETA only when provider/rule data supports it.

Treat hygiene/return eligibility per approved category and item condition, but preserve legally required remedies for defective/not-as-described goods. Public claims about discreet packaging, delivery windows and product materials must match actual operations. Keep merchant grievance/contact details, privacy/consent, GST/tax, PSP category eligibility, consumer rights, and India's relevant current law under human review. Never publish unverified business credentials or legal guarantees. No card-at-doorstep promise without confirmed courier/POS support.

## 11. ROUTES / INFORMATION ARCHITECTURE

Deliver all user-facing functional destinations from roadmap section 6, with sensible continuity to existing URLs. Includes:

**Public:** `/`, `/shop`, `/collections`, `/collections/[slug]`, category browsing, product detail at the established `/products/[slug]` (optionally alias `/product/[slug]`), search, size/fit guide, about/story, journal articles, wishlist, cart, auth/account entry points, checkout, payment status, order confirmation, profile/addresses/orders/detail/returns/support, FAQ/help, privacy, terms, shipping, returns and contact.

**Admin:** dashboard plus products/new/edit, variants, categories, collections, inventory and movement ledger, orders/detail, payments and reconciliation, shipments, returns, refunds, COD, customers, promotions/coupons, banners/pages/CMS, reviews, support, reports, roles, audit log, settings and integrations. Use real route navigation or well-organized accessible views, not a huge hard-to-navigate tab wall.

**API:** maintain compatibility with existing `/api/catalog`, `/api/cart`, `/api/quote`, `/api/checkout`, `/api/payments/verify`, `/api/payments/webhook`, and admin APIs while evolving standardized domain endpoints for shipping quotes, order cancel, returns/refunds, CMS, customer/support, tracking and webhooks. Enforce authentication, permissions, idempotency and request validation at server boundaries.

## 12. PRIVACY, SECURITY AND AUTHORIZATION

- Secure cookies/HTTPS, session invalidation, robust Google OAuth state/PKCE, verified email recovery, admin MFA and role-specific permissions.
- PostgreSQL row-level access rules and server authorization; prove customers cannot read each other's address/cart/order/returns/tickets; prove staff cannot exceed assigned authority.
- Rate limits/bot mitigation for login, signup, coupons, checkout, COD and public forms; CSRF/XSS/SQL injection defenses; parameterized queries, input schemas and trusted redirects.
- Strict upload type/size/dimension validation, object-store policies and appropriate malware handling; no arbitrary public filesystem writes in production.
- Payment secrets remain server-side; no PAN/CVV storage, no raw sensitive webhook payload leakage in logs.
- Protect highly personal purchase information: minimal staff access, purpose limitation, discreet marketing/transaction notifications, consent records, unsubscribe and deletion/export request handling subject to retention laws.
- Audit privileged changes, refunds, stock adjustments, role changes, finance operations and PII access where required.
- Backup/restore testing, secure secret rotation, environment validation, dependency monitoring, incident and rollback instructions.

## 13. PERFORMANCE, SEO, ACCESSIBILITY AND QUALITY TARGETS

Use roadmap's release budgets and document measurement conditions:

- WCAG **2.2 AA** review across all key pages; keyboard navigation, usable focus rings, labels, dialogs, live status messages and reduced motion.
- LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at p75 of real users where feasible; measure 3D home separately from regular shopping pages.
- p95 internal important API latency target under agreed load **< 500 ms**, excluding third-party delays. Cache only appropriately public data; never cache private carts/orders as shared public output.
- Minimize render-blocking JS; stream and lazy-load, optimize media with next/image or comparable, control WebGL GPU usage and suspend animation when not visible.
- Server-render crawlable product/collection content, unique metadata, canonical URLs, sitemap/robots, Product structured data based on truthful price/availability and genuine reviews, social previews.
- Structured logs, correlation IDs, provider health, payment/inventory exception alerts, durable job observability.
- Meaningful error UI, offline/dependency degradation where relevant, retry without destructive duplicates.

## 14. TEST MATRIX AND REQUIRED EVIDENCE

Create/run tests at the correct levels. Never declare a module complete based only on typecheck or a happy-path screenshot.

**Unit / domain:** pricing and paise arithmetic, tax class/rules, coupon eligibility and schedule/caps, cart SKU merging, stock math, status transitions, return/refund limits, role permissions and address validation.

**DB / integration:** concurrency for last SKU, lock/idempotency behavior, RLS read/write ownership matrix, migration/backfill, append-only history, coupon redemption races, reserve/expire/capture/restore, webhook dedup and late delivery, outbox/retry/dead-letter and provider adapters in sandbox.

**Provider scenarios:** Razorpay sandbox success, failure, dismissal, timeout, refresh retry, duplicate/reordered signed webhook, amount/currency mismatches, refunds/partial refunds; COD placed → shipped → collected → remitted; courier label, tracking, delivery, NDR/RTO, reverse pickup; notification exactly-once delivery where feasible.

**Browser E2E:** mobile and desktop guest shop → product size/color → bag → login/merge → saved address → quote → prepaid/COD checkout → account order → shipping tracking → return/cancel/support; separate staff create/publish/change-stock/coupon/refund and authorization denials; accessible 3D fallback and reduced-motion cases.

**Operational acceptance:** managed DB acceptance, real environment config, staging full journeys, lint/typecheck/build/CI, manual WCAG/device review, load/CWV, backup recovery drill, monitor/alert proof and authorized real provider smoke tests. Use only approved low-value live tests after merchant permission.

## 15. PHASED EXECUTION ORDER — USE THE ROADMAP'S PHASES 0–15

Honor the roadmap's full detailed definitions of done; use this as an execution summary and baseline-aware priority map:

- **Phase 0 — Business readiness:** approve merchant/KYC/category, customer journeys, real product/fit data, tax/legal/return rules, packaging, serviceability and operational ownership. Block live transactions until accepted.
- **Phase 1 — Engineering foundation:** stabilize current Next.js setup; add lint/CI gates, validated env, health checks, error monitoring, staging/prod separation.
- **Phase 2 — Data and security:** versioned migrations, fuller normalized schema, permissions/RLS, managed Postgres/storage, backup and migration tests; preserve current data and stock semantics during transition.
- **Phase 3 — Admin core:** complete staff auth/MFA, granular roles, catalogs/categories/collections/variant generator, operational stock ledger, durable media and audit.
- **Phase 4 — Brand/CMS/3D:** refine existing floral/silk editorial system, fix unused homepage CMS fields, build banner/section/3D publishing controls, fallbacks and mobile accessibility.
- **Phase 5 — Catalog/search:** full SKU attributes, filters, scalable server-side discovery, pagination, collections, fitting and product SEO.
- **Phase 6 — Accounts/addresses:** provider auth/recovery tests, profile/privacy, address full CRUD/default and use at checkout.
- **Phase 7 — Cart/wishlist:** preserve existing persisted bag and merge; concurrency/stock-change recovery and full E2E evidence.
- **Phase 8 — Pricing/checkout:** validated GST/tax, shipping serviceability, offers engine, quote/address snapshots and COD eligibility.
- **Phase 9 — Payments/COD:** independent states, attempts, Razorpay sandbox success/failure/retry/refund, secure gateway events, expiry/reconciliation workers and COD unpaid/collection model. **Critical live-sales blocker.**
- **Phase 10 — Orders/shipping:** order details/search, labels/AWB/courier integration, tracking, NDR/RTO, invoice PDFs and notifications.
- **Phase 11 — Returns/refunds/support:** policy-correct itemized RMA, inspection, reverse logistics, exchanges, COD/prepaid refund, customer/staff ticket experience and notices.
- **Phase 12 — Marketing/CMS/reporting:** campaigns/schedules/limits, full site editor, review moderation, trustworthy analytics and reports.
- **Phase 13 — Retention:** only after commerce reliability: back-in-stock, fit quiz, recommendations, matching sets, opt-in messaging, optional rewards/gifts.
- **Phase 14 — Complete QA:** accessibility, security, SEO, performance, load, backup restore, staging end-to-end and incident drills.
- **Phase 15 — Launch and operate:** live provider approvals, controlled rollout, merchant-approved transactions, training, reconciliation, support runbooks, monitoring and rollback.

**Release policy:** First real sales require the essential outcomes of Phases 0–11 plus Phases 14–15; optional V2 features do not block release. Prefer fixing current critical gaps over building advanced personalization.

## 16. CHANGE MANAGEMENT / HONEST TRACKING OF BOTH FILES

For **each vertical slice**:

1. Identify roadmap section, phase, exact Definition of Done, and matching audit capability IDs (e.g., address `U09`/`U11`, COD `P18`/`P19`, courier `O07`–`O11`, finance reporting `M02`–`M04`).
2. Inspect code + existing tests before changing. If the audit is stale, record what evidence supersedes it.
3. Implement complete code across relevant layers with no placeholders masquerading as functional features.
4. Add and **run** automated tests; capture commands, outcomes, relevant file paths and any external provider evidence.
5. Update the **existing `Sky_Petal_Implementation_Coverage_Audit.md`**: preserve all feature IDs; set status based on actual observed behavior. `COVERED` means the specifically named local capability works; `INTEGRATION` means provider source awaits provider acceptance; `UNVERIFIED` means external evidence is missing; `PARTIAL` is not complete; `FOUNDATION` is only scaffolding. Record known limitations honestly. Update per-phase summaries, totals and prioritized remaining work to remain mathematically consistent, without presenting row count as true development completion percentage.
6. Leave **`Sky_Petal_Full_Implementation_Roadmap.md`** comprehensive and intact; change it only for agreed product scope/decision revisions with a clear note.
7. Give a concise delivery note showing what is now functional, tests actually executed, status IDs changed, remaining risk, and the next priority. Never cite historical tests as freshly run.
8. When an external dependency blocks closure, provide the exact required human inputs/portal settings/secret names and safe sandbox validation plan; continue with other unblocked work.

Never overwrite acceptance evidence with ungrounded “100% complete,” “production ready,” or inflated success metrics. All 17 roadmap release gates require proof before sign-off.

## 17. EXPECTED IMPLEMENTATION OUTPUT PER INCREMENT

After making changes, respond in the following compact format:

**Implemented:** [working user/admin outcomes and changed code areas]

**UX:** [pages and interactions created/refined; mobile and accessibility behavior]

**Database & API:** [migrations, services, endpoints, permissions, backward compatibility]

**Tests run:** [exact commands, results, tests skipped/not run]

**Audit updates:** [IDs, before → after classifications, evidence location; total recomputation if applicable]

**External dependencies/risks:** [only factual unresolved approvals/configuration/provider checks]

**Next priority:** [one specific vertical slice, roadmap phase and audit IDs]

If you lack shell/repository access, say precisely which files or workspace access are required rather than claiming implementation. If access is available, **start coding now**.

## 18. FIRST TASK — BEGIN IMMEDIATELY

1. Read both reference files entirely and inspect the current Sky Petal repository before designing or modifying anything.
2. Verify the audit against current code, routes, schema and tests. Identify existing modules to reuse and gaps in the first live-sales-critical vertical slice.
3. Run safe baseline checks (typecheck, test, lint/build if configured), distinguishing fresh results from documented historical ones.
4. Select the **highest-priority unblocked real-sales gap** and implement it end-to-end. Normally start with safe data/state foundations and complete saved-address edit/default/checkout selection, real shipping/tax rules, or payment lifecycle/COD according to actual dependencies; do not break current cart, checkout and stock invariants.
5. Update the implementation coverage audit with verified evidence, then advance to the next coherent feature while preserving the full roadmap as the unchanged scope contract.
6. Continue progressively toward a complete, beautiful, real operational Sky Petal storefront and admin system—not just a demo.

**Final standard:** When the website is ready, a genuine eligible customer should be able to browse a real product, select the exact variant, place an authorized prepaid or valid COD order, receive confirmed status and appropriate notifications, track delivery, request support/returns/refunds, and see a coherent history; authorized staff should be able to manage catalog, inventory, marketing, orders, finance, fulfillment, content and customer care through a secure, auditable admin interface. Every claim must be supported by functional code and appropriate test/provider evidence.
