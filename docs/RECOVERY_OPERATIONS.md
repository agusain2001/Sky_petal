# Local recovery operations

These changes are local implementation evidence. Real orders remain **NO-GO**.
Staging was unavailable and the user explicitly selected continued local work.

## Completed payout evidence

Apply migrations with the existing migration runner before deploying application
code. `010_payout_evidence_integrity.sql` is additive: it does not overwrite,
delete or backfill any historical payout. Completed refund updates are rejected
by a database trigger, including writes by a non-owner application writer with
UPDATE privileges. Existing immutable refund events remain the original evidence.
Legacy completed refunds without a reference are retained for controlled manual
investigation; the migration does not manufacture one.

In Studio → Refunds, a finance, administrator or owner account can request an
evidence correction on a processed COD refund. Supply the corrected statement
reference, a reason and independent proof. Another authorized account must approve
it with an independent reconciliation reference. The original refund reference,
amount, status and payout remain unchanged. Approved corrections are a separate
append-only reconciliation trail; they do not send money. Competing approvals are
serialized on the refund and stale previous references are rejected. Correction
requests and approvals are both audited and hidden from customer responses.

API paths: POST `/api/admin/refunds/evidence-corrections` and
`/api/admin/refunds/evidence-corrections/approve`. Both require a current finance
role. Corrected evidence is returned only in the authorized staff refund list.

Use a forward migration for any later repair. Do not edit an applied migration or
drop integrity triggers to roll back application code. Keep database ownership and
schema-change privileges outside the runtime account. A database owner/superuser
can alter the schema; these guards do not establish cryptographic tamper proofing.
Managed-role grants and independent bank reconciliation still require staging.

## Newsletter consent

`011_newsletter_consent.sql` suppresses historical emails with no consent proof.
New subscriptions require literal `consent:true`; the server records its consent
version, source, time and an append-only event. The server stores a hash of the
unsubscribe bearer token. POST `/api/newsletter/unsubscribe` accepts that token
and is idempotent. The footer exposes unsubscribe after a successful subscription.

Any future marketing dispatcher must read `marketing_eligible_subscribers`, check
current suppression immediately before dispatch, and include the tokenized
unsubscribe flow in its approved template. No outbound dispatcher or message
delivery is claimed. Sender approval, double opt-in policy, durable customer
preferences and delivery/bounce acceptance remain separate work.

## Cart and asynchronous work

POST `/api/cart` supports `operation:"increment"` for Add to bag and `"set"` for
explicit quantity editing. Omitting operation preserves the existing set API.
Cart writes lock the cart row used by checkout and recheck the published SKU,
current available stock and 20-unit cap inside the transaction. A bag does not
reserve stock. Managed-pool contention and wider login-merge races remain open.

Job success/failure/defer counters increment only when the update still owns an
unexpired running lease and returns a row. A stale worker cannot acknowledge
another worker's work. Provider side effects still require provider idempotency;
this change does not promise exactly-once external execution.

Courier notices use booking + status code + normalized timestamp as their
identity. Different envelopes retain separate scan evidence without repeating
the same customer notice. Historical notices are retained, not deleted.

## SEO and performance

Set `NEXT_PUBLIC_SITE_URL` to the approved HTTPS origin. Indexing additionally
requires `DEPLOYMENT_ENV=production` and `SITE_INDEXING_ENABLED=true` when building
and running the deployment. Default and staging builds use noindex, deny crawling
and emit an empty sitemap. Production sitemap generation includes only published
products and selected public pages. Private routes also receive `X-Robots-Tag`.
Rebuild when changing deployment/indexing configuration; robots directives do not
replace authentication.

Product JSON-LD reports actual SKU prices, INR and stock, without invented ratings.
Images use responsive local optimization, fonts have metric-adjusted local
fallbacks, and catalog products are present in server-rendered HTML. The silk and
reduced-motion/WebGL fallbacks remain. Mobile simulated LCP is still over budget;
do not promote the performance gate from these changes.

## Reproduce local checks

For payment-attempt states, safe retry behavior, operator permissions and the
HTTP maintenance worker, see [Payment recovery](PAYMENT_RECOVERY.md). The new
012/013 migrations are additive. Apply through the existing checksummed migration
runner; do not replace an already applied migration.

Product media uploaded after server startup is served by the allowlisted
`/images/[filename]` handler as WebP. The local upload directory still needs
durable object-storage replacement/backup before managed deployment acceptance.

`npm run test:recovery` creates a new disposable OS-temp database and synthetic
access file, clears provider settings, runs Node/type/build/HTTP/browser/QA and
latency checks, and records commands with UTC timestamps in a unique directory
under `qa/evidence/recovery/`. It stops its own server and restores pre-existing
screenshots. Credentials stay in OS temporary storage; browser traces are disabled.
No payment, courier or outbound message provider is called.

The optional `scripts/measure-web-performance.mjs` requires `LIGHTHOUSE_CLI` and
`CHROME_PATH` pointing to installed local tools. It creates another isolated local
server and records four Lighthouse navigations with the exact commands. Reports
are lab samples, not field p75, real-device or staging acceptance.

Full release blockers and all 17 gates remain in `qa/RELEASE_READINESS.md`; the
171-ID implementation ledger remains `Sky_Petal_Implementation_Coverage_Audit.md`.
