# Durable payment recovery

This is local implementation guidance. Provider test-mode acceptance, bank
reconciliation and production release approval remain separate requirements.

## Creation and uncertainty

Migration 012 adds one durable payment attempt per prepaid checkout. The intent
and original receipt commit before the server calls Razorpay. The network call
does not hold a database transaction open. A concurrent checkout cannot create
another provider order for that intent.

A lost response leaves an `unknown` attempt. A later request or the maintenance
worker looks up the original receipt; it does not repeat the create call. The
returned receipt, INR amount and provider order identity must match. An absent,
ambiguous or mismatched result remains unresolved. A crashed worker's lease can
be reclaimed. Provider idempotency and genuine sandbox behavior still require
external acceptance; a local stub cannot establish those guarantees.

An unresolved creating/unknown/authorized/manual-review attempt blocks another
checkout for that customer. The original checkout remains accessible for status
and reconciliation. Do not clear this guard by editing rows to bypass financial
review. This deliberately conservative behavior must be evaluated during merchant
acceptance, including the process for resolving an uncertain or late payment.

## Evidence and status

- Signed `payment.authorized` and `payment.failed` webhooks retain allowlisted
  observations. Provider reads also record observations. Card/contact fields are
  discarded. Event identity conflicts are rejected.
- Authorization is not capture. Order fulfillment remains gated by the existing
  captured-payment verification and inventory transaction.
- Verified capture callbacks, webhooks and polling share the existing replay-safe
  capture inbox. A stale worker cannot acknowledge another worker's inbox lease.
- Late capture after stock release remains a financial exception. It does not
  reallocate stock, force a paid state or issue an unapproved refund. Completing
  its actual refund/settlement process is still unfinished work.
- Migration 013 separately records browser dismissal/failure/pending-verification
  reports. These are advisory and ownership-checked. They never establish payment
  success or authoritative provider failure.
- Customer exports include owned attempts, observations and client reports using
  explicit projections, without leases or staff recovery errors.

## Staff workflow

Studio → Payments shows the latest 100 checkout attempts and verified capture
events. Owner/administrator access is required. Queue reconciliation for an
unresolved attempt; it creates an audit entry and schedules a provider lookup.
It does not create an additional provider order or override payment/inventory.
After ten automatic checks, unresolved attempts move to manual review. An expired
reservation with no authorized or captured payment observed stops polling without
holding the customer's next checkout indefinitely. An authorization stays fenced
for reconciliation even after reservation expiry. A staff retry resets that budget
explicitly. Inspect retained capture exceptions independently.

API additions:

- GET `/api/admin/payment-attempts`
- POST `/api/admin/payment-attempts/reconcile` with an attempt `id`
- POST `/api/payments/client-event` with an event UUID, owned `order_id` and
  `dismissed`, `failed` or `verification_pending` kind

Customer order responses include `payment_attempt_state`, while actual
`payment_state` remains independent. The account UI explains uncertain outcomes
and asks customers to check debits before paying again.

## Maintenance

The existing maintenance endpoint now expires reservations, processes retained
capture events, reconciles payment attempts and runs commerce jobs. Missing
Razorpay credentials skip payment polling; no provider success is inferred.

`npm run commerce:worker` runs a non-overlapping HTTP polling loop against the
running application's maintenance endpoint. Configure the same server-side
`COMMERCE_MAINTENANCE_SECRET` (at least 32 characters) on server and worker.
`COMMERCE_MAINTENANCE_URL` defaults to the local port-4317 endpoint;
`COMMERCE_MAINTENANCE_INTERVAL_MS` defaults to 60000. Remote targets require HTTPS.
The worker rejects redirects, URL credentials and query parameters. Logs exclude
tokens and provider payloads. SIGINT/SIGTERM stop it cleanly.

Do not run the original direct-database `commerce:maintain` command concurrently
with another process using the same PGlite folder. The HTTP worker avoids opening
a second database process. Managed worker supervision, alerting, scheduler uptime
and recovery remain staging acceptance work.

## Reference contracts

The provider lookup uses Razorpay's documented receipt filter and per-order
payment read endpoint: [order listing](https://github.com/razorpay/markdown-docs/blob/master/api/orders/fetch-all.md),
[payment endpoints](https://github.com/razorpay/markdown-docs/blob/master/api/payments.md).
No real provider call was used as test evidence for this implementation.
