# SKY-PETAL — Full E-Commerce Product & Engineering Roadmap

**Project:** Sky-Petal — Premium Lingerie, Intimate Apparel & Permitted Wellness  
**Market assumption:** India-first, INR, domestic shipping, one brand and one merchant (not a marketplace)  
**Architecture:** Modular monolith; Next.js + TypeScript + PostgreSQL/Supabase; external PSP and courier integrations  
**Purpose:** A phase-by-phase implementation contract and acceptance checklist, not a claim that features are already implemented

## 1. Product boundaries and non-negotiable behaviors

Sky-Petal has two separate interfaces using one governed backend: **customer store** and **admin back office**. Guests can explore and add products to cart; **login is required when beginning checkout**. An admin can manage website content and business operations but cannot erase financial history, bypass payment confirmation, or silently rewrite completed orders. All financial calculations happen on the server. Inventory is tracked at *sellable SKU (size × color)* level. Order, payment, fulfillment, and refund statuses are distinct. Every personally identifiable record is protected by least-privilege authorization.

### Business rules to confirm before production
- Exact catalog: bras, bralettes, panties, sets, sleepwear, shapewear, accessories, and which wellness goods are eligible for sale and payment processing.
- Legal seller entity, GST registration/invoicing requirements, return/refund policy by product type, privacy policy, grievance/contact details, consumer rights, supplier documentation, age policy where legally required.
- Available couriers, packaging sizes/weights, serviceable pincodes, COD eligibility and fees, prepaid shipping rates, return pickups and RTO handling.
- Approved Razorpay merchant category and enabled payment methods; verify wellness items are permitted with the PSP and logistics provider before publication.
- Single-currency launch (INR), single origin warehouse initially, domestic India shipping. Architect for additional warehouses, currencies, and international shipping later.

## 2. Full customer-site module inventory

| Module | Requirements / behaviors | Acceptance examples |
|---|---|---|
| Brand landing / 3D experience | Flower/silk scene, pointer/touch interaction, subtle bloom/parallax, editorial sections, motion choreography, optimized loading, pause and reduced-motion mode, SEO-text fallback | Core content available without WebGL; mobile usable; reduced-motion respected |
| Navigation / discovery | Header, mega menu, categories, collections, search, breadcrumbs, announcements, footer, policy links | All links work; keyboard/touch accessible |
| Product listing | Dynamic category and collection pages, query-based filters, multi-filter chips, sort, pagination or infinite load, URL state, counts, empty states | Combining band/cup size + color + price + availability returns only qualifying SKUs |
| Search | Autocomplete, spelling normalization, trending queries, product/category results, no-results fallback | Query and filters persist on refresh/back navigation |
| Product detail | Media gallery, zoom/video, variant selection, actual price/stock, size guide, fit notes, material/care, delivery estimation, return eligibility, review display, related products | Unavailable size cannot be purchased; exact SKU added |
| Guest shopping cart | Add, remove, quantity, line totals, persistent storage, server price/stock re-check, cart drawer and page | Guest cart survives refresh and login redirect |
| Identity | Email/password, Google OAuth, verification, reset, secure sessions, logout, account removal request | No login needed to add to bag; required before checkout |
| Customer profile | Name, contact, profile, consent/preferences, saved sizes (optional), saved addresses, notification preferences | Customer cannot access someone else's profile/address |
| Address book | Shipping and billing addresses; name, phone, line1/2, landmark, city, state, pincode, country; label/default; validation | Pincode and address validated; checkout snapshots immutable |
| Wishlist | Add/remove, saved across logins, move to cart, alerts if opted in | Wishlist does not reserve stock |
| Checkout | Address, serviceability, delivery option, coupon, accurate totals, tax/shipping, payment option, final review | Login redirect preserves cart; all amounts recomputed server side |
| Online payment | UPI/GPay/PhonePe where enabled, cards, netbanking, wallet where enabled, status page, retry, receipts | Payment confirmed only with verified gateway evidence |
| COD | Availability by pincode, fee/caps, fraud controls, order confirmation, delivery collection reconciliation | COD order is confirmed/unpaid until money collected/reconciled |
| Orders | Confirmation, list/detail, line snapshot, cancellation policy, tracking, invoice and notifications | Historical order prices unaffected by later catalog edits |
| Returns/exchanges | RMA request, category/condition eligibility, reasons, upload proof, pickup, inspection, refund/exchange status | Defective/not-as-described remedies not incorrectly blocked |
| Reviews / Q&A | Verified-purchase reviews, moderation, photo uploads with content policy, report abuse, product Q&A (optional) | Only eligible purchasers can verify purchase review |
| Customer support | FAQ, contact, support tickets, chat/WhatsApp optional, grievance escalation | Tickets linked to order with permission checks |
| Content | Brand story, size guide, care guide, delivery/return/refund policy, blog/journal, privacy/terms | Editable by authorized CMS roles, published content indexed |
| Notifications | Order placed/paid, COD confirmed, shipped, out for delivery, delivered, refund and support; consented marketing | No duplicate messages after webhook retry |
| Commerce extras | Recently viewed, recommendations, gift cards, referral, loyalty, bundles, back-in-stock | Release in later phases, not launch blockers |

### Lingerie-specific product modeling
- Variant dimensions: band/cup where applicable, XS–XXL or brand-specific alpha sizing, color, possible pack size. Maintain *normalized option values* with unique SKU combinations.
- Product fit attributes: coverage, padding, wired/non-wired, strap type, support level, fabric, wash care, fit notes, model information (with consent).
- Product-level and variant-level media, category-specific size charts, size availability, materials, and return eligibility indicators.
- Related products and matching-set linking; do not assume panties and bras share sizes.
- Clearly disclose sanitary/hygiene handling rules, sealed packaging expectations, exchange exceptions, and statutory consumer remedies. Avoid blanket misleading no-return promises.
- Discreet packaging where actually fulfilled; restrict access to sensitive purchases and communications.

## 3. Admin / business-operation module inventory

| Admin module | Create, read, update, archive, workflow capabilities |
|---|---|
| Admin identity & roles | Owner, admin, catalog editor, inventory/fulfillment operator, support, marketing, finance; 2FA/MFA as available; invitations; permissions and audit |
| Product management | Draft/publish/archive products, categories, collections, tags, descriptions, photos, videos, SEO, size charts, related items |
| Variant management | SKUs, colors, sizes, prices, list price, weight, dimensions, barcode, status, reorder thresholds |
| Inventory | Stock adjustments and reasons, movement ledger, reserve/release, low-stock warnings, purchase receipts, optional supplier/warehouse tracking, export |
| Sales & orders | Search/filter orders, payment/fulfillment flags, pick/pack, cancellations, partial fulfillment, invoices, status history |
| Payments & reconciliation | Payment attempts, gateway IDs, settlement tracking, COD due/collected/remitted, mismatches, failed payments, approved refund requests |
| Shipping | Pickup location, shipping rules, serviceability, courier choice, label/AWB, manifests, pickup, tracking, NDR, RTO, reverse logistics |
| Returns & exchanges | RMA review, conditions, approvals/rejections with reasons, pickup, inspection, restock disposition, replacement, refunds |
| Discount engine | Coupons, flat/percentage offers, eligible SKUs/categories, minimum cart amount, time windows, usage caps, per-customer limit, exclusions, stacking rules |
| Home/CMS | 3D-hero settings, announcements, banners, promotional blocks, navigation, footer, editorial collections, FAQs, pages, blog, SEO meta; draft/publish/schedule |
| Customer care | Users, contact preferences, order/ticket history, address updates with authorized workflow, private notes; PII access logs |
| Reviews | Approve/reject, reply, flag, verify purchase, prevent counterfeit ratings |
| Reporting | Revenue (paid/collected), gross/net sales, AOV, orders, discount impact, tax, refunds, unpaid COD, RTO, stock valuation, best sellers, conversion funnel |
| Settings | Store address, policies, serviceability, thresholds, taxes, shipping charges, payment configuration, domain, branding, integrations |
| System operations | Audit trail, webhook delivery status, failed jobs, integration health, admin access logs, backup/restore status |

**Important:** "Admin can CRUD the whole website" means content and operational entities; **financial events, payment audit records and historic invoices are append-only or corrected via compensating actions**, not hard deleted. Product deletion should normally be soft-delete/archive after orders exist.

## 4. Payment, COD, and shipping methods

| Checkout method | Correct workflow |
|---|---|
| UPI: Google Pay, PhonePe, other supported apps | Use Razorpay Standard Checkout's currently supported UPI Intent/dynamic QR flows; customers pick available UPI apps. Do **not** implement deprecated manual UPI Collect input as the core flow. |
| Credit / debit cards | Hosted gateway checkout and tokenization/3DS handled by PSP; never store PAN/CVV in Sky-Petal DB. |
| Netbanking/wallets | Show only provider-enabled methods; gateway creates verified payment record. |
| COD | Internal order method, eligibility and surcharge rules, optional phone confirmation, reserve/commit stock, ship as COD, mark paid only when collection/remittance verified. |
| Cash/card at doorstep | Ordinary courier COD often means cash/UPI and **does not guarantee card terminal support**. Offer card-at-delivery only with an explicitly contracted courier/POS service and confirmed support. |
| Prepaid refund | Initiate refund via PSP, record request, follow provider webhook and settlement lifecycle; separate initiated vs completed refund. |
| COD refund | Obtain approved payout destination by secure procedure; manual/bank transfer/provider payout workflow with reconciliation and proper access control. |

**Payment status model:** `created → pending → authorized → captured` with `failed`, `expired`, `refunded`, `partially_refunded` as separate paths. **Order status:** `pending_payment → confirmed → processing → shipped → delivered`, with cancellation/return variants. **COD:** `confirmed (payment_due) → shipped → delivered (collection_pending) → collected/remitted` as verified. Payment state and order state must never be a single column.

**Safe prepaid checkout orchestration**
1. Customer has logged in and selected variant quantities and an eligible delivery address.
2. Server validates cart, published SKU status, serviceable pincode, product restrictions, offer eligibility, GST/shipping rules, and calculates final amount in integer paise.
3. In one database transaction, create a pending order + immutable item/price/address snapshots + expiring SKU reservation. Record checkout idempotency key.
4. Server creates gateway order for the authoritative amount, stores external ID and payment attempt; checkout UI opens the gateway.
5. Verify signed callback and confirmed provider status server-side; process signed webhooks idempotently, including retry/out-of-order events.
6. On verified captured payment, commit inventory allocation and set order paid/confirmed once. Publish notification and fulfillment job via an outbox.
7. On expiration without payment, release reservation. If payment arrives after release, reconcile securely: reallocate available stock or issue refund/manual exception. Never silently oversell.
8. Scheduled reconciliation compares local payment/refund records with provider truth and flags discrepancies.

**COD checkout orchestration:** same server pricing/stock validation, create `payment_method=cod` and confirm based on serviceability/fraud policy; there is no successful online charge. Inventory commits on confirmed COD order and restores only on valid cancellation/RTO/return with auditable movements. Courier collects and remits cash to merchant per agreement, with separate entries for collection, courier deductions, and remittance.

**Shipping workflow:** verify pincode → rate/ETA → assign courier → generate AWB/label → pickup → transit scans → delivery attempt/NDR → delivered or return to origin; support reverse pickup for eligible returns. Protect against duplicated courier webhook updates and missing tracking events.

## 5. Recommended database structure: PostgreSQL

**Core principles:** relational normalized entities; ULID/UUID PKs; timestamps (`created_at`, `updated_at`), explicit audit users; money in integer minor units (INR paise), currency code, immutable historical order snapshots; foreign keys and uniqueness; targeted indexes; soft delete for published/order-referenced products; JSONB only for genuinely flexible content/attributes, never as a replacement for key relationships.

### Identity and permissions
| Table | Key columns / purpose |
|---|---|
| `profiles` | `id` FK to auth identity, name, phone, consent metadata |
| `role_definitions` | role names and descriptions |
| `permissions` | stable permission codes such as `products.write` and `refunds.approve` |
| `role_permissions` | role to permission join |
| `staff_roles` | user to back-office role join |
| `addresses` | customer_id, normalized shipping/billing fields, default flags |
| `consent_events` | customer, consent type, version, decision, timestamp |
| `audit_logs` | actor, action, object, before/after references, request ID, IP metadata as permitted |

### Catalog and inventory
| Table | Key columns / purpose |
|---|---|
| `categories` | name, slug, parent_id, publish order, SEO fields |
| `collections` | title, slug, merchandising metadata, schedule |
| `collection_products` | collection_id, product_id, placement/order |
| `products` | slug, brand, title, description, status, tax_class_id, return_policy_id, timestamps |
| `product_media` | product_id, optional variant_id, storage reference, alt text, sort order |
| `option_types` | Size, color, band, cup, pack |
| `option_values` | type_id and canonical value/label/order |
| `product_variants` | product_id, unique SKU, price_paise, compare_at_paise, weight/dimensions, status |
| `variant_option_values` | variant_id, option_value_id; normalized SKU combinations |
| `size_charts` / `size_chart_rows` | category/brand-specific size systems and measurement rows |
| `product_attributes` | typed/catalog-filterable attributes or references to controlled value tables |
| `warehouses` | location and fulfillment settings; one row at launch |
| `inventory_balances` | variant_id + warehouse_id, on_hand, reserved, reorder_threshold, version |
| `inventory_reservations` | order_id, variant_id, quantity, expires_at, reservation status |
| `inventory_movements` | variant_id, change, reason, actor, order/supplier reference, timestamp |
| `suppliers` / `purchase_orders` / `purchase_order_lines` | optional sourcing/receiving operations |

**Stock invariant:** `available = max(0, on_hand - reserved)`, maintained with transactional row locks or conditional SQL updates; never computed from client-provided data. If using reserve-then-commit, define whether `on_hand` denotes physical total or sellable ownership and keep it consistent across all stock movements.

### Shopping and order accounting
| Table | Key columns / purpose |
|---|---|
| `carts` | customer_id nullable, anonymous token/session, expiry |
| `cart_items` | cart_id, variant_id, quantity, unique(cart_id, variant_id) |
| `wishlists` / `wishlist_items` | customer-level wishlists |
| `orders` | order number, customer_id, payment_state, fulfillment_state, currency, monetary totals, shipping/billing snapshots, created_at |
| `order_items` | order_id, SKU/variant_id, title and selected options snapshot, unit/list price, tax and discount snapshot, quantity |
| `order_status_events` | order_id, state, actor/source, timestamp, reason |
| `payment_attempts` | order_id, gateway, external_order_id, payment_id, amount, status, idempotency key |
| `payment_events` | provider event ID unique, signature verification, payload safe reference, processed_at |
| `refunds` | order_id, payment_id, amount, reason, status, gateway refund ID, approver |
| `shipments` | order_id, courier, carrier shipment ID, AWB, label, current status, costs |
| `shipment_items` | shipment_id, order_item_id, quantity for partial shipments |
| `tracking_events` | shipment, provider status ID, event time, raw status and normalized status |
| `cod_collections` | shipment/order, amount due, collected, remitted, courier reconciliation details |
| `returns` / `return_items` | order-item condition, quantity, reason, disposition, policy decision, refund linkage |
| `tax_classes` / `tax_rules` | effective-date GST/HSN configuration by product/legal rules |
| `invoices` | unique compliant invoice number, order, issued_at, totals and stored invoice document reference |

### Promotions, content and operations
| Table | Key columns / purpose |
|---|---|
| `promotions` | rule type, priority, schedule, stacking, target, budget |
| `promotion_targets` | eligible products/categories/collections |
| `coupon_codes` | code, promotion_id, usage caps, expiry |
| `coupon_redemptions` | code/customer/order with unique usage constraints |
| `reviews` / `review_media` | product, order proof, score, moderation status |
| `cms_pages` | slug, status, SEO, content version |
| `cms_blocks` | page_id, block_type, content JSON, placement |
| `banners` | image, CTA, start/end, visibility target |
| `navigation_menus` / `navigation_items` | editable menus |
| `site_settings` | strictly typed configuration; secrets remain outside DB |
| `notification_templates` / `notification_logs` | template, channel, delivery status |
| `support_tickets` / `ticket_messages` | private customer support workflow |
| `webhook_inbox` | external event ID unique, provider, status, attempts |
| `job_outbox` | domain event ID unique, type, payload ref, attempts, processed_at |
| `integration_health` | current provider state, last success/error, last checked |

### Database constraints and indexing
- Unique: SKU, published slug, invoice number, coupon code where applicable, provider event ID, payment idempotency key.
- Foreign keys for all child records and `ON DELETE RESTRICT` for financial/history entities.
- Index `products(status, category_id)`, `product_variants(product_id)`, normalized options and search fields, `orders(customer_id, created_at DESC)`, `orders(payment_state, created_at DESC)`, `shipments(awb)`, `inventory_reservations(expires_at, status)`, and event/job retry queues.
- Atomic coupon redemption counters; do not oversubscribe usage caps.
- RLS: public can read only published catalog/content; customer owns cart/wishlist/orders/addresses; staff access via guarded permissions; payment/stock movements restricted to trusted server operations.
- Archive/restore operations preserve referential history. Backup schedules and restore exercises are mandatory.

### Simplified entity relationship view
```
auth.users --1:1--> profiles --1:N--> addresses
     |                       |---1:N--> orders --1:N--> order_items --N:1--> product_variants
     |                       |                 |---1:N--> payment_attempts --1:N--> payment_events
     |                       |                 |---1:N--> shipments --1:N--> tracking_events
     |                       |                 |---1:N--> returns / refunds
     |                       |---1:N--> carts --1:N--> cart_items --N:1--> product_variants
     |                       '--1:N--> wishlists --1:N--> wishlist_items
     '--N:M--> staff_roles --> permissions
products --1:N--> product_variants --N:M--> option_values
products --N:M--> collections
product_variants --1:N--> inventory_balances --1:N--> inventory_movements
orders --1:N--> inventory_reservations
promotions --1:N--> coupon_codes --1:N--> coupon_redemptions
```

## 6. Page and route map

**Customer/public**: `/`, `/shop`, `/collections`, `/collections/[slug]`, `/category/[slug]`, `/product/[slug]`, `/search`, `/size-guide`, `/our-story`, `/journal`, `/journal/[slug]`, `/wellness`, `/wishlist`, `/cart`, `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/checkout`, `/checkout/payment-status`, `/order/confirmation/[number]`, `/account`, `/account/profile`, `/account/addresses`, `/account/orders`, `/account/orders/[id]`, `/account/returns`, `/account/support`, `/help`, `/privacy`, `/terms`, `/shipping`, `/returns`, `/contact`.

**Admin**: `/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]`, `/admin/categories`, `/admin/collections`, `/admin/variants`, `/admin/inventory`, `/admin/stock-movements`, `/admin/orders`, `/admin/orders/[id]`, `/admin/shipments`, `/admin/returns`, `/admin/refunds`, `/admin/payments`, `/admin/cod-reconciliation`, `/admin/customers`, `/admin/coupons`, `/admin/promotions`, `/admin/banners`, `/admin/pages`, `/admin/reviews`, `/admin/support`, `/admin/reports`, `/admin/roles`, `/admin/audit-log`, `/admin/settings`, `/admin/integrations`.

## 7. API and service contracts

**Read-focused endpoints/services:** `GET /api/products`, `/api/products/:slug`, `/api/search`, `/api/categories`, `/api/collections`, `/api/shipping/serviceability`, `/api/shipping/quote`; implement cursor pagination for large data.

**Customer mutations:** `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:id`, `POST /api/cart/merge`, `POST /api/checkout/quote`, `POST /api/checkout/start`, `POST /api/payments/verify`, `POST /api/orders/:id/cancel`, `POST /api/returns`, `POST /api/reviews`, `POST /api/support/tickets`. Validate with schema and authorization. Never take customer IDs or authoritative prices from untrusted clients.

**Provider ingress:** `POST /api/webhooks/razorpay`, `POST /api/webhooks/shipping`, `POST /api/webhooks/messaging` with source verification, replay detection, and event persistence before processing.

**Admin mutations:** `/api/admin/products`, `/api/admin/variants`, `/api/admin/inventory/adjust`, `/api/admin/promotions`, `/api/admin/orders/:id/fulfill`, `/api/admin/refunds/:id/approve`, `/api/admin/cms/pages`, `/api/admin/settings`; server-check granular permissions and log sensitive operations.

Use a **domain-oriented implementation** (`catalog`, `identity`, `cart`, `pricing`, `checkout`, `payments`, `orders`, `inventory`, `shipping`, `returns`, `promotions`, `cms`, `notifications`, `analytics`). Keep request handlers thin; domain services own business invariants; repositories encapsulate persistence. Use a transaction/outbox pattern for side effects.

## 8. Full development roadmap — sequential phase gates

Each phase has **Build** and **Definition of Done (DoD)**. Do not mark a phase finished until its DoD has evidence in tests and a running environment.

### PHASE 0 — Discovery, commercial policy, accounts, and requirements
**Build:** inventory business types; confirm India launch, merchant/KYC/payment category, legal entity, tax handling, item hygiene/returns, shipping SOP, privacy/consent text, roles, target audiences, KPIs, catalog taxonomy, SKU conventions. Write PRD, process diagrams and approved user journeys.
**DoD:** signed-off requirement list, confirmed payment provider eligibility, policy drafts sent for legal review, baseline brand tokens, deployment ownership. **Blocker:** do not activate payment methods for an unapproved regulated category.

### PHASE 1 — Repository, environments, design and infrastructure foundation
**Build:** Next.js/TypeScript project, strict linting, Tailwind/UI primitives, folder/domain structure, GitHub CI, feature flags, protected development/staging/production environments, secrets, domain strategy, Sentry, structured logs, environment validation.
**DoD:** deployable skeleton to staging, CI lint/typecheck/build passes, secrets not leaked, health endpoint and basic error monitoring functional.

### PHASE 2 — Database schema, RLS, core roles, migrations
**Build:** complete core schema/migrations (identity, catalog, variants, inventory, carts, orders, payments), seed fixtures, RLS grants/policies, staff permissions, storage buckets/policies, indexes, row-level financial controls; backup plan.
**DoD:** migrate/reset seed reproducibly; customer A cannot read/write customer B; non-admin cannot mutate catalog; inventory transactions pass concurrency tests; restore test executed.

### PHASE 3 — Admin authentication, initial catalog CRUD and stock control
**Build:** secure `/admin` shell, permissions, admin MFA policy, role guard per operation, category/collection CRUD, product CRUD, photo upload, SKU combination generator, SKU-specific prices, stock adjustments, archive/publish, audit event log.
**DoD:** authorized staff publishes a multi-variant bra with size/color prices and images; public API shows it; unauthorized staff blocked; stock movement recorded exactly once.

### PHASE 4 — Brand design system, 3D landing, public CMS
**Build:** brand typography/colors, accessible UI kit, responsive nav, page sections, high-quality product/editorial media, performant 3D flower/silk centerpiece, smooth motion, reduced-motion/mobile fallback, content blocks and editable banners.
**DoD:** landing readable without WebGL; CMS changes publish without deployment; 3D fallback and pause work; mobile and desktop smoke tests, accessibility audit.

### PHASE 5 — Catalog, PDP, filters, sorting and search
**Build:** dynamic listings, size/color/price/material/coverage/support/availability filters, sort, URL persistence, typed search and suggestions, SEO metadata, product details, stock-aware variant selection, size guide.
**DoD:** filter combinations return correct SKUs; prices/status from DB; invalid product/size cannot be added; search/breadcrumb/mobile testing passes.

### PHASE 6 — Customer authentication, profiles and address book
**Build:** Google login, email/password registration, verification/reset, secure sessions, account pages, profile and multiple Indian addresses with pincode/city/state fields, account consent/privacy preferences.
**DoD:** sign-up/login/reset tested; staff and customer role separation; no cross-account data access; addresses save/default/edit; logout revokes session appropriately.

### PHASE 7 — Guest cart, user cart, wishlist and cart merge
**Build:** local guest cart, DB user cart, merging with quantity caps and duplicate SKU combination, cart drawer/page, wishlist, server-side stock/price recheck, error/empty states.
**DoD:** guest cart survives refresh, login redirects back to checkout, merged totals/quantities correct; out-of-stock cart items handled; tests cover concurrent quantity updates.

### PHASE 8 — Pricing, tax, shipping eligibility, promotions and checkout
**Build:** server-controlled price quote, product/tax class mapping, GST and invoice settings, pincode serviceability, delivery fee bands, COD eligibility/fees, coupon engine, rate/stock validation, immutable quote snapshots, checkout UX.
**DoD:** client cannot alter price/discount/tax; expired coupons and double-usage blocked; delivery address and shipping cost valid; order totals deterministic; login required to proceed.

### PHASE 9 — Online payment gateway and COD (critical release gate)
**Build:** payment provider adapter, server-created payment order, hosted UPI/cards/netbanking, callbacks and verified webhooks, payment attempts, retry/expiry, atomic stock reservation, reconciliation scheduler, COD confirmation and pending-collection model, provider sandbox test suite.
**DoD:** successful prepaid order captured once; failed/abandoned retriable; duplicate/out-of-order webhooks never double-decrement stock; COD unpaid and collected status distinct; disputed/late payments handled safely; no secrets in browser.

### PHASE 10 — Order management, courier integration and fulfillment
**Build:** admin order search/details, pick-pack, shipping label/AWB, pickup, tracking, NDR, RTO, parcel dimensions and weight, multiple shipment support, invoice PDF, customer timeline, manual exception handling.
**DoD:** prepaid and COD orders are shipped through courier sandbox/test flow, tracking displayed, incorrect webhook rejected, shipment status never reverses without explicit correction, stock movements reconcile.

### PHASE 11 — Returns, exchanges, refunds and customer support
**Build:** category/condition policy engine, RMA, proof uploads, return pickup, quality check, disposition/restock, prepaid gateway refund, verified COD refund workflow, support tickets, buyer notifications.
**DoD:** ineligible return has proper policy explanation; defective goods legal remedy route preserved; partial refund cannot exceed paid amount; audit and notification produced; no double refund.

### PHASE 12 — Admin marketing, CMS, campaign scheduling and insights
**Build:** promo editor, flash sales, coupons, collection scheduling, home hero/banner/CMS blocks, email template management, review moderation, sales reports, funnel and basic stock insights, exports.
**DoD:** admin creates scheduled sale with usage limits; pricing reflects schedule and exclusions; actual paid/COD-collected revenue computed correctly; campaign and CMS permissions tested.

### PHASE 13 — Customer retention and merchandising enhancements
**Build:** opt-in back-in-stock alerts, product recommendations, recently viewed, fitting quiz, matching sets, cross-sell, gift cards/referrals/loyalty if needed, abandoned cart messaging with consent, optional WhatsApp support.
**DoD:** behavior personalized only with allowed data and consent; unsubscribe works; no false social proof; discounts and gifts reconcile accurately.

### PHASE 14 — Hardening, load, accessibility, SEO and full acceptance QA
**Build:** unit/integration/E2E security suites, RLS tests, concurrency, malicious request/payment forgery cases, browser testing, WCAG checks, reduced-motion, load testing, backups/recovery drill, sitemap/robots/structured data, monitoring alerts.
**DoD:** the complete purchase-to-delivery journeys pass in staging; payment and inventory reconciliation green; agreed Core Web Vitals budget met for target devices; accessibility issues resolved; restore exercise confirmed.

### PHASE 15 — Production release, operations and growth
**Build:** real provider KYC approval, live webhook endpoints, controlled production rollout, end-to-end low-value live transactions with authorized credentials, support SOP, incident response, stock imports, policies and contact pages, monitoring, backups, admin training, reconciliation reports.
**DoD:** launch checklist approved; live payment/courier test successful; refund policy and operational contacts published; admin can run business without code changes; rollback documented; outstanding errors tracked.

## 9. Release planning — must-have vs later

**MVP / first real-sales release:** Phases 0–11 essential parts + Phase 14/15 launch gates; product and inventory admin, browse/search/filters/PDP, guest cart, Google/email auth, addresses, serviceability, coupons (basic), online payments/COD, orders, delivery tracking, essential notifications, returns, basic CMS, basic reports, legal/policy pages. 3D hero may start with one optimized artistic scene and lightweight transitions.

**Enhanced v1:** Full 3D editorial choreography, additional page builder blocks, staff granular controls, advanced offers, partial shipments, COD reconciliation exports, customer reviews, returns automation, analytics, operational reports.

**V2:** Loyalty points, referrals, gift cards, subscriptions if relevant, multilingual site, multi-warehouse, international checkout, recommendations, fit personalization, supplier purchasing, advanced forecasting.

## 10. Essential business journeys to validate

1. **Guest → purchased prepaid:** guest filters size/color → adds product → cart persists → checkout requires login → Google/email login → merge cart → select address → valid coupon + shipping + tax → UPI/card checkout → backend verifies captured payment → order confirmed → courier booking → delivered.
2. **COD:** logged-in user checkout → pincode eligible → COD fee shown → COD order confirmed but unpaid → shipment tracking → courier collection/remittance → finance records COD settlement.
3. **Inventory contention:** two customers attempt final SKU simultaneously → only valid inventory allocation succeeds → other sees stock failure/recovery path.
4. **Gateway failure/retries:** payment popup closed or failed → pending order visible, retry safely → no duplicate order charge or stock decrement.
5. **Returns:** eligible buyer requests RMA → staff approval → reverse pickup → inspection → refund or exchange → customer sees state.
6. **Admin publish:** catalog editor creates product and inventory → publishes → store updates → coupon applies correctly → subsequent edits cannot rewrite historical order details.
7. **Access control:** customer cannot call admin endpoint, staff member without finance permission cannot refund, admin actions audited.
8. **Operations:** stuck webhook gets retried safely, courier discrepancy flagged, customer notified once, backup restored in staging.

## 11. Nonfunctional requirements / measurable targets

| Area | Initial acceptance target |
|---|---|
| Accessibility | WCAG 2.2 AA review; keyboard navigation; visible focus; accessible forms; no forced motion |
| Core Web Vitals | LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at the 75th percentile of real users where feasible; track separately for 3D landing and shopping pages |
| Reliability | 99.9% monthly uptime goal after operating baseline; documented dependency degradation and incident response |
| Performance | Use server caching for public product pages; avoid caching private cart/orders; p95 important API response target <500 ms under agreed load excluding external provider latency |
| Security | OWASP review; RLS/grants tests; MFA for admin; signed/unique webhooks; CSRF/XSS safeguards; least privilege; upload type/size scanning rules |
| Data durability | Automated database backups; documented RPO/RTO per service tier; restore test before launch |
| Scalability | Support traffic growth with read caching, image CDN, controlled jobs, SQL indexing and queues; avoid premature microservices |
| Observability | Structured logs, tracing/correlation IDs, error alerts, payment/stock exception dashboards, job retry visibility |
| SEO | Server-rendered crawlable products, canonical URLs, sitemap, proper structured data, real reviews only, unique meta |
| Privacy | Minimal personal-data collection, consent management, deletion/export requests subject to retention obligations, discreet communications |
| Quality | Unit and integration tests per module; Playwright E2E on main journeys; CI quality gates, migrations and rollback |
| Compliance | GST/tax rules reviewed by accountant; consumer protection/return rules reviewed; DPDP obligations mapped to phased timeline |

## 12. Security and trust controls

- Use hosted payment UI and do not store card details or CVV. Keep merchant keys in server-only secret storage.
- HTTPS, secure cookies, strong session expiration, Google OAuth state/PKCE, email verification and account recovery protection.
- RBAC enforced in server handlers and PostgreSQL RLS; owner-only permissions for integrations/finance; extra approval for large refunds/stock overrides.
- Strong Zod request validation, request rate limits, bot protection for login/coupons/COD, CSRF protections for cookie-auth mutations, signed URLs and restricted media uploads.
- Check webhook signatures against **raw request bytes** and validate provider IDs, amount, currency and intended order. Persist unique provider event IDs before mutation.
- Apply outbox + retry for emails, courier booking and webhooks. Dead-letter unprocessable events, alert operations and expose admin retry controls.
- Limit sensitive PII retention and visibility. Customer support should see minimum necessary details; never log raw payment credentials.
- Preserve transaction history through immutable events and corrective entries, not destructive edits.
- Review India's 2026 e-commerce amendments (stated effective **1 January 2027**) and DPDP phased obligations; verify exact duties with Indian counsel.

## 13. Analytics definitions

- **Gross merchandise value (GMV):** sum of ordered product value under clearly defined discount/tax treatment; *not* equivalent to money collected.
- **Captured prepaid:** verified settled/captured payment volume; reconcile gateway settlement separately.
- **COD collected:** verified doorstep cash amount; **COD remitted:** money actually received from the courier, net of adjustments as defined.
- **Net sales:** define consistent treatment for returns, cancellations, promotions, tax and shipping; expose the formula.
- **Inventory available:** on-hand minus reserved; **inventory value:** uses actual cost of goods, not selling price.
- **Gross margin:** sales minus COGS; **contribution margin:** also deduct fulfillment, marketing, gateway fees, RTO costs as relevant.
- Other dashboards: sessions, add-to-cart, checkout starts, payment success, conversion by category/size, orders, AOV, repeat rate, refunds, RTO, COD refusal, stockouts, campaign results.

## 14. Suggested project repository structure

```text
sky-petal/
  app/
    (store)/                  # customer storefront routes
    (auth)/                   # login, registration, callbacks
    account/                  # customer self-service
    admin/                    # staff control panel
    api/                      # thin HTTP controllers + webhooks
  components/
    ui/                       # shared design system
    commerce/                 # product cards, cart, checkout
    three/                    # lazy 3D components
    admin/                    # reusable admin tables/forms
  features/
    catalog/ identity/ cart/ inventory/ pricing/
    checkout/ payments/ orders/ shipping/ returns/
    promotions/ cms/ notifications/ analytics/
  lib/
    db/ auth/ permissions/ validators/ integrations/
  supabase/
    migrations/ seed.sql tests/   # migration and RLS tests
  workers/                    # outbox processing / reconciliation
  tests/
    unit/ integration/ e2e/
  docs/
    adr/ runbooks/ api/ requirements/
  .github/workflows/
```

## 15. Build gates / checklist

- [ ] Legal/product category and payment-provider review complete.
- [ ] Admin permissions and RLS tests passed.
- [ ] Product/SKU CRUD + inventory movements verified.
- [ ] Product catalog and size/color filters correct on mobile and desktop.
- [ ] Guest cart persists and login redirects back to checkout.
- [ ] Customer address create/edit/default/validation works.
- [ ] Shipping pincode eligibility and quotes reflect courier capabilities.
- [ ] Taxes, promotions, delivery and COD surcharges computed only server-side.
- [ ] Gateway sandbox payment success/failure/timeout/refund verified.
- [ ] Duplicate/late webhook and inventory race tests passed.
- [ ] COD orders remain unpaid until collection/remittance reconciliation.
- [ ] Admin order fulfillment, courier tracking, NDR/RTO workflows tested.
- [ ] Returns/exchanges and refunds comply with approved policy and law.
- [ ] Editable banners/collections/3D content publish correctly.
- [ ] Mobile/reduced-motion/WebGL fallbacks and accessibility pass.
- [ ] Backup restore and incident/rollback drills completed.
- [ ] Production merchant onboarding and live smoke order verified.

## 16. Sources to validate integrations and compliance

- Razorpay payment integration: https://razorpay.com/docs/payments/
- Razorpay merchant restrictions: https://razorpay.com/terms/
- Razorpay UPI changes: https://tfs.np.razorpay.in/docs/payments/payment-methods/upi/faqs
- Supabase authentication: https://supabase.com/docs/guides/auth
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Shiprocket API: https://apidocs.shiprocket.in/
- Next.js security and authorization: https://nextjs.org/docs/app/guides/authentication
- India Consumer Affairs e-commerce rules: https://consumeraffairs.gov.in/pages/consumer-protection-acts
- India DPDP Rules announcement: https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2190014&lang=2&reg=3

**Note:** The plan describes integration requirements and tests, not completed merchant account connections. Tax rates, payment eligibility, delivery capabilities, age restrictions, and legal policy must be verified for the actual catalog and legal entity before going live.
