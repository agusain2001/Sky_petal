# Commerce operations

The implementation coverage audit remains the progress tracker. This document explains address, pricing/COD, private support, RMA/refund, courier and recovery operations.

## Database upgrades

Run `npm run db:migrate` with the managed PostgreSQL environment before deploying application code. Local PGlite initialization applies the same numbered SQL migrations automatically. Never run a second PGlite process against a directory used by a running server.

`schema_migrations` records each migration's SHA-256 checksum. Applied files must remain unchanged; add a new numbered SQL file for changes. Migration application locks the ledger and applies each version transactionally. `db:export` preserves an existing initial migration.

- `002_address_book.sql`: preserves address JSON; adds labels, shipping/billing purpose, defaults, timestamps and unique default indexes. One deterministic legacy address is initially selected for each customer.
- `003_order_lifecycle.sql`: preserves the existing `status` compatibility field; adds independent stored order/payment/fulfillment/refund fields, real delivery timestamps for new deliveries, billing/SKU snapshots, state events and historical-record guards. Legacy delivery dates, billing addresses and SKU codes remain unknown. Imported state events explicitly identify their provenance.
- `004_payment_recovery.sql`: binds new checkout requests to a fingerprint and stores verified capture events in a private recovery inbox. Old pending checkouts without fingerprints need cancellation/expiry before a new checkout.
- `005_checkout_pricing.sql`: effective tax classes/HSN, product mapping, SKU weights, immutable delivery/tax/discount quotes and order accounting snapshots.
- `006_cod_accounting.sql`: COD confirmation/due/collection/remittance states, append-only gross/fee/evidence ledger and a restricted finance role.
- `007_support_threads.sql`: private order-linked tickets, append-only public/internal messages, assignment, priority and support read policies.
- `008_returns_refunds_jobs.sql`: optional product return terms, item RMA/inspection/events, bounded approved refund records/evidence, durable jobs and private account updates. Existing orders are not assigned invented return terms.
- `009_shipping_execution.sql`: immutable provider booking snapshots/identities, private operational stages and customer-owned courier tracking events.

Orders and copied item/address/accounting records cannot be rewritten through ordinary updates. Payments, payment events, stock movements, audit logs and order-state events reject update/delete. These controls do not replace a restricted runtime database role, backups or DBA controls. Refund requests/approval and verified partial/full completion are now represented independently from original capture/collection truth. Automated COD-provider reconciliation, invoices/credit notes and full corrective accounting remain unfinished.

## Addresses and orders

Customers manage addresses under Account → Addresses. The first eligible address becomes a default; edits and deletion preserve one default for each available purpose. All writes serialize on the customer row and enforce ownership. PIN/mobile validation checks format; it does not certify courier serviceability or city/state correctness.

Checkout resolves saved shipping/billing IDs on the server. Order snapshots remain unchanged when a customer edits or deletes the saved address. A session checkout key survives refresh. Reusing a key with changed quantities, prices, coupon or addresses fails rather than silently charging an old quote. Cancelling that unpaid order permits a fresh checkout. Browser storage being unavailable limits key persistence to the current mounted page.

`/account/orders/[id]` shows the customer's copied details, independent states, actual recorded transition history and manual shipment reference. Legacy references are staff-entered; courier-managed orders additionally show authenticated scan evidence. Pending unpaid reservations and confirmed COD orders before processing support automatic customer cancellation. Captured prepaid cancellation before packing also restores stock and requests finance review, as described below. Capture/cancellation/expiry races serialize and release/commit stock once.

## Tax, delivery and COD setup

Owner/administrator → Studio → Commerce configures checkout activation, warehouse PIN/state, packaging weight, shipping tax, free-delivery threshold and COD fee/limits. Checkout defaults to closed. No GST rate or SKU weight is assumed; staff must configure effective tax classes/HSN, map each product and enter SKU weight. These values require the actual merchant's accountant/provider approval before live use.

Configure `SHIPROCKET_TOKEN`, or `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD`, in server secret storage. Credentials never enter settings responses. The adapter uses the [official Shiprocket serviceability API](https://apidocs.shiprocket.in/) for courier availability, quoted rates and estimates. It requires matching courier postcode/city/state evidence before selecting a tax jurisdiction. Unknown/mismatched destinations, unavailable couriers, malformed rates, authentication failures and timeouts fail closed. City aliases and merchant-specific courier responses need provider acceptance testing.

Customers explicitly check delivery and totals before checkout. Quotes expire after five minutes and bind customer/cart, method, address, tax/weight/price details and coupon. Reservation rechecks the quote, effective tax rules, configuration, quantities and stock. Prices are treated as GST-inclusive; integer-paise discount allocation and GST extraction preserve the order total. The configured intra-state split or IGST is stored with the order and item snapshots. This is not a GST invoice generator or legal tax certification.

COD requires an eligible courier, a merchant-allowed PIN, the configured total cap and open-order limit. Confirmation commits stock once, clears purchased cart quantities and leaves payment `due`; Razorpay is not called. Before processing, a customer may cancel and restore committed stock once. Manual staff fulfillment can ship/deliver an unpaid COD order without pretending payment was captured.

Owner/administrator/finance → Studio → COD records verified courier/bank evidence. Collections cannot exceed the amount due. Remittance gross cannot exceed verified collections and cannot predate its collection evidence; fees and net receipts remain separate. Repeated references are idempotent, conflicting evidence is rejected, and records are append-only/audited. Payment becomes collected/remitted only after the corresponding full amount is supported by ledger evidence. Recording staff must actually review that evidence. Automated courier statements, bank-feed reconciliation and corrective finance are not implemented by this manual ledger. Separate approved COD refund evidence is described below.

## Customer care

Customers use `/account/support` or the order's help link to open private tickets. Only their own orders can be linked; defect and grievance topics remain available independently of the simplified return window. Requests support idempotent creation, customer replies and reopening resolved conversations.

Owner/administrator/support → Studio → Support reads the queue, assigns authorized staff, adds public replies or internal notes, changes priority and resolves with a customer-visible explanation. Customer endpoints and RLS hide internal notes. Staff reads/replies/status changes are audited. The queue displays the latest 100 tickets and a thread the latest 200 messages. Public staff replies create private account updates; internal notes never notify customers. Attachments, outbound email/SMS, SLA automation and the merchant's formal grievance/contact process remain separate work.

New deliveries record `delivered_at`; authenticated courier delivery uses the actual scan time. Product voluntary-return windows/seal terms are copied into future quotes/order lines. Unknown legacy terms or delivery dates require care review for voluntary returns. Defect/damage/incorrect-item requests can reach review independently; approved merchant policy and remedy acceptance remain required.

## Verified capture recovery

Razorpay webhook validation uses HMAC-SHA256 over the unmodified request body. Valid `payment.captured` payloads enter the capture inbox; signed refund created/processed/failed events enter the durable commerce queue. the callback path also requires a signed callback and a provider lookup confirming capture. The stored fields exclude customer email, card details and the original raw payload.

The inbox commits evidence before order processing. A failed capture returns HTTP 503, keeps its exception and can be retried. Atomic claims use a five-minute processing lease; repeat events and callback/webhook races rely on the captured-payment transaction for idempotency. A changed payload under an existing event identity is rejected. Late captures and additional distinct payments never force a paid status or inventory override.

Owner/administrator → Studio → Payments shows the latest 100 events, attempts and exceptions. Retry re-runs the existing verified evidence; it cannot modify the amount, payment identity or historical order. Every operator retry attempt is audited. The screen does not implement provider balance/settlement reconciliation or issue refunds. Late capture and duplicate-charge resolution still require an approved reconciliation/refund workflow.

## Maintenance entry points

For managed PostgreSQL, schedule `npm run commerce:maintain` with the server environment, or invoke `POST /api/internal/maintenance` from a trusted scheduler using `Authorization: Bearer <COMMERCE_MAINTENANCE_SECRET>`. Configure a random secret of at least 32 characters in server secret storage. The HTTP endpoint rejects unconfigured/incorrect credentials and does not use customer cookies.

Maintenance releases expired reservations and processes up to 20 due capture events per invocation. Failed events wait five minutes before worker retries; the worker stops automatically selecting an event after ten attempts. Abandoned processing leases are reclaimed after five minutes. An operator may still manually retry after investigating an exhausted event. Provider webhook redelivery also retries processing independently of the worker cap.

No scheduler has been installed or verified in this local increment. To use the command with PGlite, stop the local server first; use the HTTP endpoint for the active local process. Real scheduling, alert routing, provider API reconciliation and refund resolution remain deployment work.

## Provider references checked

Razorpay documents duplicate and out-of-order deliveries, event IDs and retries after non-2xx responses in its [webhook best practices](https://raw.githubusercontent.com/razorpay/markdown-docs/master/webhooks/best-practices.md). Signature verification follows its [validation guide](https://raw.githubusercontent.com/razorpay/markdown-docs/master/webhooks/validate-test.md); payload validation uses its [payment-event reference](https://raw.githubusercontent.com/razorpay/markdown-docs/master/webhooks/payments.md). Local synthetic signatures and embedded-database tests do not establish Razorpay sandbox/live acceptance.

## Isolated acceptance checks

`SKY_PETAL_BUILD_DIR=.next-acceptance` isolates builds from a running developer server. Set `DATABASE_DIR` to a new OS-temporary `sky-petal-acceptance-*` directory, clear provider/managed-database variables, and set `TEST_OWNER_ACCESS_FILE` to an OS-temporary JSON filename. Run `npx tsx scripts/prepare-acceptance.ts` before starting that test server; it creates an owner only inside the explicitly named disposable database and writes its generated credentials to the temporary file.

The setup also seeds explicitly synthetic captured/delivered and pending orders for order-history/cancellation browser checks. Their provider IDs and courier references are synthetic, and they establish no provider transaction evidence.

For the quoted COD browser suite, set `TEST_COMMERCE_FIXTURES=true` during that setup. It configures synthetic tax/courier fixtures only in the guarded temporary database, with separate customer accounts per browser project. Browser fixtures use an explicitly extended, pre-issued quote lifetime so long CI runs can finish; normal application quotes retain the five-minute lifetime. The CI workflow now uses this disposable setup. Successful remote CI execution remains unverified.

Use `ALLOW_LOCAL_AUTH=true` only for that local production-build test process. Point `TEST_BASE_URL` at the disposable server and run `test:api` and the Playwright commerce suite. Browser screenshots use `commerce-*`/`payment-operations-*` filenames. The admin upload test creates a normalized QA image in `public/images`; remove only that test-generated file afterward. Do not point mutation tests at the merchant's store.

## Item returns and inspected stock

Customers select owned order lines/quantities in order detail and view history at /account/returns. Request keys bind the full request and prevent duplicates. Active quantities and exact net-paise allocations cannot exceed copied order items, including after rejected requests. Product terms are configured under Studio > Commerce for future quotes; no universal return period is invented. Defect/damage/incorrect-item requests require a delivered order but are not silently rejected because voluntary terms or an old delivery date are unknown.

Owner/administrator/support/fulfillment review RMAs under Studio > Returns. Receipt needs an actual handover reference. Owner/administrator/fulfillment inspect every line before finance can request an RMA refund. Restock adds only inspected saleable quantities to AVAILABLE stock and writes one compensating movement; quarantine/dispose never add stock. Inspections and state events are retained. Exchange selections request review only: automatic replacement selection, inventory reservation, price differences and reverse pickup are not yet implemented. Proof uploads and full case closure/remedy policies remain incomplete.

## Refund requests, approval and completion

Studio > Refunds is restricted to owner/administrator/finance. Requests lock the order and reserve against captured Razorpay funds or actual COD collections, less all other active/completed refunds. RMA requests additionally require inspection and remain capped by copied net item value. Delivery/COD charges need a separately reasoned adjustment. New online refunds must be at least 100 paise. Pending provider responses do not imply completion.

Online approval creates a durable refund.submit job. The adapter uses the [official Razorpay refund API](https://razorpay.com/docs/api/refunds/create-normal/) with a stable local UUID receipt/body and refund idempotency header. Before an uncertain retry it looks up that payment's refunds by receipt; known IDs use provider fetch. [The official SDK documents the payment-scoped lookup endpoint](https://github.com/razorpay/razorpay-node/blob/master/lib/resources/payments.js). Only matching INR/payment/amount/provider evidence can mark processed. Raw-body signed refund webhooks are retained before background application. Pending refunds defer and poll again without spending the failure retry budget; failed/unknown identity or amount conflicts remain visible for investigation. Actual provider acceptance has not been run.

COD does not call the prepaid refund API. A different authorized account must approve its manual payout. Finance then records verified completed payout evidence, unique statement reference and a payout timestamp after approval; the application does not itself send a bank payout. Secure destination collection/vaulting, bank/payout integration and real reconciliation remain unfinished. No test made a real payout.

The order's refund_state is ledger-derived pending/partially_refunded/refunded. Original payment_state stays captured/collected/remitted as historical receipt truth; refunds never erase the capture or collection. Full refund does not automatically change delivered fulfillment. An RMA closes from provider/manual refund evidence only when its full copied net item cap has been processed. Invoice credit notes and a complete financial reporting model remain required.

Captured prepaid orders may cancel before packing: committed stock/sales are reversed once and a full refund request is recorded atomically for finance approval. Duplicate capture callbacks after this cancellation remain duplicates and cannot re-commit stock. A packed order with an active courier booking cannot acquire a new refund request until handover is resolved. Later cancellation requires customer-care/operations review.

## Courier execution and tracking

Studio > Shipping is restricted to owner/administrator/fulfillment. Move an eligible quoted order to processing, enter its actual packed dimensions and an existing merchant-approved pickup location. The request snapshots billing/shipping/SKU/tax/weight/INR charges. The worker searches the exact source order ID before create, then verifies remote identity, total, payment method and destination before AWB assignment. It assigns the quoted courier, schedules pickup and retains HTTPS label/manifest links. Documents contain delivery PII and are available only through the authorized staff console. The [official Shiprocket API](https://apidocs.shiprocket.in/) supplies these operations; successful merchant/provider acceptance is still required.

A lost create/AWB/pickup response moves into an explicit unknown stage. Retry first inspects the existing provider record. If its outcome is still unknown, another create/assignment/pickup is blocked. Reconcile that source order/shipment in the provider account; a generic job retry does not blindly recreate it. A provider amount/destination/courier mismatch stops execution. Unknown-outcome operations and merchant-specific API shapes require sandbox testing and an operator runbook before launch.

Configure a random server COURIER_WEBHOOK_TOKEN of at least 32 characters and register the HTTPS /api/shipping/events URL in the courier dashboard using its x-api-key security-token field. Never put this secret into query strings or client settings. This is token authentication over HTTPS, not a fabricated courier HMAC scheme. The endpoint retains only allowlisted event data, deduplicates it and acknowledges durable receipt. Use shipment_status_id: the provider's current_status_id uses a different enum. Supported provider local timestamps are interpreted in Asia/Kolkata; invalid, pre-order or future evidence fails processing and remains an operational exception.

Booking/label/pickup alone keep fulfillment processing. Authenticated movement scans confirm shipped; delivery scans confirm delivered at their actual time. Stale/duplicate scans cannot downgrade delivered history. Courier-managed orders cannot be manually marked shipped/delivered through the legacy staff path. RTO scans remain separate and never imply customer delivery, COD collection or automatic stock restoration. Polling fallback, NDR actions, reverse pickup, RTO warehouse QC and full provider exception/cancellation recovery remain incomplete.

## Durable jobs and private updates

The existing protected maintenance endpoint/CLI now processes capture recovery plus refund/courier jobs. Schedule it independently of user traffic with COMMERCE_MAINTENANCE_SECRET. Work uses immutable dedup keys/payloads, five-minute fenced leases, abandoned-lease recovery, ten failure attempts and visible dead work. Provider-pending refunds defer for later polling. Owner/administrator can inspect, process and retry under Studio > Background work; retries are audited. Hosted scheduling and alerting have not been deployed.

Account > Updates persists private, deduplicated order/courier/RMA/refund/public-support notices and owned read markers. This is an in-app channel. No email/SMS/WhatsApp was sent; sender configuration, outbound templates/delivery logs, preferences/consent and provider acceptance still need implementation.
