# Local invoices, exchanges, staff MFA and deletion

Implemented 10 November 2026. This is a local implementation contract, not a
merchant/tax/legal approval or provider acceptance certificate. Historical data
and earlier failure evidence remain. All acceptance tests use disposable stores,
synthetic identities, rates and provider responses.

## Staff security

Open `/account/security` after team sign-in. Local-password staff verify their
current password before enrollment. Provider-only staff need a successful
Supabase sign-in recorded on that exact store session within five minutes;
older sessions must sign in again. Provider email confirmation is required before
the application creates a primary session. A different session cannot borrow
the recent-login proof.

Enter the setup key into an authenticator as SHA-1 TOTP, six digits, 30 seconds.
Confirm a code to activate it. Save the ten recovery codes when shown; only their
hashes are retained and each works once. Reusing an accepted TOTP counter fails.
Verification attempts are bounded per account. There is no password-only switch
to remove an enrolled factor.

All admin APIs require a factor when the account is enrolled. Production
(`DEPLOYMENT_ENV=production`) requires enrollment for every staff account;
`STAFF_MFA_REQUIRED=true` enables that same requirement in local/staging use.
Verification is bound to the current session, lasts twelve hours for console
access, and must be within ten minutes for money/configuration/privacy/payment
replay/background-job actions. Customer accounts cannot enroll staff factors.
Deleting a session also deletes its factor and primary-login proofs.

Set server-only `MFA_ENCRYPTION_KEY` to a securely generated 32-byte base64 key
for managed PostgreSQL or production. Local PGlite generates a private
`.staff-mfa-key` file within its database directory when no environment key is
provided. Seeds use AES-256-GCM with a fresh IV; preserve the key securely with
the database recovery process. Do not put keys, setup secrets or recovery codes
in commits, screenshots, logs or chat. Actual provider login/recovery and managed
key/restore behavior remain external acceptance work.

The implementation follows [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238)
and the relevant [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Invoices and credit notes

Studio → Invoices is available to owner, administrator and finance. Only
owner/administrator can configure legal name, seller address, GSTIN where
applicable, issuer state, prefix and merchant/accountant approval reference.
No seller, GST rate or approval has been invented or prefilled as real data.
The user indicated approved details exist in the repository; their exact file
has not yet been identified. Requirements asking for approval are not approvals.

Issue an invoice against an accepted order. It uses its immutable item/discount,
tax, billing, delivery/COD and payment-term snapshots; legacy orders missing
those facts are rejected. Issuer GST/state must agree with the recorded tax
origin. An invoice is not evidence of COD collection.

Numbering uses an atomic, non-decreasing sequence for each document kind and
financial year at the Asia/Kolkata April boundary. Prefixes support one to three
uppercase letters, and generated numbers fit sixteen characters. Order locks
and unique keys make concurrent/repeated issuance return one document. Issued
documents cannot be edited or deleted through ordinary writes. Credit notes are
separate documents linked to the original and one verified completed refund.

Item-return credit notes allocate the refund to those original returned lines.
Partial refunds without an RMA require finance to select the original invoice
and assign the refunded amount to item/delivery/COD lines. The server checks
eligible remaining line values, refund amount, duplicate allocation and total
credit bounds. Cumulative paise calculations retain each source's original tax
rate and avoid rounding drift across partial credits and mixed-tax baskets.
The original invoice stays unchanged.

Customers find issued documents in order detail. JSON snapshots and PDF
downloads check ownership; staff access checks role and MFA. Responses are
private/no-store. PDFs show issuer, buyer, order, line/tax amounts, charges,
discount, document references and totals. PDF text currently uses the standard
Helvetica encoding: unsupported characters fail with an explicit message and
the exact JSON snapshot remains available; multilingual font rendering still
needs expansion if the approved merchant content requires it. No silent text
substitution is used. Seller policy and actual accounting acceptance remain
required before live issuance.

## Exchanges

This implementation uses replacement checkout plus a separate original refund.
It does not collect an invented net payment or treat an internal credit as money.

1. Customer requests an exchange for owned delivered item quantities.
2. Staff approve, receive and inspect the original items under the existing RMA
   workflow. Restock, quarantine and disposal decisions retain their evidence.
3. Customer selects the exact replacement size/colour through the ordinary shop
   and checkout. Existing reservations, expiry, payment/COD checks and stock
   concurrency controls apply to that replacement order.
4. Customer links their new replacement order to the inspected/completed RMA.
   Other customers, the original order, pre-request orders, closed checkouts and
   duplicate replacement links are rejected. Linking never moves stock again.
5. Finance independently requests/reviews the original eligible refund. Its
   funding and amount stay governed by verified original payment and inspected
   item caps. A failed/cancelled or not-yet-created replacement does not withhold
   the original inspected-item refund. Payment/refund initiation is distinct
   from completion evidence.

The interface shows the replacement's full checkout total, original refundable
item value, refunded amount and net cost after the original refund. Replacement
delivery charges are included in its checkout; the original item refund does
not silently promise an original-shipping refund. The replacement has its own
order, payment, fulfillment and invoice. Direct net-difference checkout is not
implemented. Courier reverse pickup and actual provider refund/settlement remain
unverified while their environments are unavailable.

## Privacy deletion and retention

Account → Privacy records one open deletion request per customer and exposes its
status. Studio → Privacy is owner/administrator only and requires recent MFA
when enforced/enrolled. Staff configure the approved financial/support retention
periods, policy version and approval reference. Each reviewed request snapshots
that policy; later settings do not silently shorten its retention decision.

Approval closes the account, pseudonymizes profile identity, removes addresses,
bag lines, wishlist, reviews and notifications, revokes sessions, and suppresses
marketing. Pseudonymous cart/ledger IDs remain where foreign keys require them.
Transaction/support records remain held until policy expiry and completion of
open order, return, COD, refund, uncertain-payment, support and queued-job
obligations. Later financial documents/refunds/support activity extend the
calculated deadline. Zero retention never releases stock or erases an open order.

The maintenance worker or an authorized staff action processes eligible requests.
A single transaction locks the request/customer/orders and gives an approved,
expired request a narrowly scoped erasure context. Original DB immutability
guards still apply to ordinary edits and to money, identity, status and stock
columns. Only enumerated personal-data fields may change during erasure.

The local inventory covers order/billing addresses, quote addresses, invoice
buyer data, courier request/documents/scans, return descriptions/notes,
inspection descriptions, support bodies/messages, financial free-text/evidence
references after retention expiry, scoped audit detail, marketing email/consent
identifiers, and finished/dead courier/refund job payloads. Redacted dead jobs
cannot be replayed. A late courier update for a completed erasure is acknowledged
without retaining new location information.

Local completion keeps pseudonymous ledger amounts, quantities, IDs and
timestamps. It explicitly retains `external_followup=true`: Supabase, payment,
courier, message-provider copies and backups are not claimed deleted by a local
SQL transaction. A closed/suspended identity cannot regain a store session via
the provider callback. Actual external erasure/backup expiry and merchant policy
acceptance remain required. No real customer's deletion was executed in testing.

## Preparing external acceptance

Studio → Release checks reports only configuration and local DB prerequisites,
active staff lacking enrollment, and twelve UNVERIFIED external campaigns. It
does not turn configured keys or local mocks into a successful integration.

With the application running, `npm run staging:check` reads the bearer-protected
`/api/internal/readiness` endpoint. Set the same `COMMERCE_MAINTENANCE_SECRET` on
the server and caller, and optionally `READINESS_URL`; remote URLs require HTTPS.
The command performs no charge, refund, shipment, message or deployment. It
returns exit code 2 for NO-GO, 1 for an incomplete check, and prints no credentials.

Target-environment capture/refund, identity/MFA, courier/reverse, messaging,
managed RLS/concurrency, restore, CI/scheduler/alerts, merchant approvals,
device/load/field metrics and separately authorized live smoke still require
their original evidence. No release gate is accepted here.

## Storefront performance

`npm run prebuild` prepares responsive WebP variants of the existing local
photography. Known assets use native `srcset` discovery; hero/PDP preloads and
eager first catalog images remain. New uploads/remote images keep the existing
Next image path. The recovery runner prepares assets before building too.

Next 16's documented experimental `inlineCss` option removes the production
stylesheet round trip. It applies globally and duplicates CSS in initial HTML/
RSC payloads, so repeat navigations re-download more CSS; revisit this tradeoff
when target-network evidence is available. Brand fonts retain swap behavior;
the optional-font experiment was not retained.

Mobile LCP still requires truthful measurement against its 2500 ms target.
Prepared images, smaller critical work and high lab scores do not alone close
SP-QA-013 or establish field/device acceptance. Raw experiments remain under
`qa/evidence/recovery/lighthouse-*`.
