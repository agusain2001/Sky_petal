# Recovery implementation file map

This is the local increment's file map. The working tree already contained other
uncommitted work; it was not committed, reset or treated as this increment's work.
See [fresh results and limitations](../Sky_Petal_Local_Recovery_Report.md).

| Workstream | Implementation files |
|---|---|
| Invoice/credit-note sequences, original snapshots, private PDF delivery and line-specific partial tax allocation | [invoice service](../src/lib/invoices.ts), [Studio/customer documents](../src/components/invoice-documents.tsx), migrations [015](../migrations/015_invoice_documents.sql), [018](../migrations/018_document_exchange_guards.sql), [019](../migrations/019_document_snapshot_shape.sql) |
| Staff TOTP, encrypted enrollment, replay-safe recovery, session-bound MFA and provider primary-login proofs | [MFA service](../src/lib/staff-mfa.ts), [security screen](../src/components/staff-security.tsx), [authentication](../src/lib/auth.ts), migrations [014](../migrations/014_staff_mfa.sql), [020](../migrations/020_primary_session_proofs.sql) |
| Replacement checkout and independent original-refund exchange workflow | [exchange service](../src/lib/exchanges.ts), [return UI](../src/components/returns-center.tsx), [refund rules](../src/lib/refunds.ts), migrations [016](../migrations/016_exchanges.sql), [021](../migrations/021_exchange_refund_independence.sql) |
| Reviewed account closure, retention holds, narrowly scoped local erasure and late-payload suppression | [deletion service](../src/lib/privacy-deletion.ts), [privacy operations](../src/components/privacy-requests.tsx), [migration 017](../migrations/017_privacy_fulfillment.sql), existing job/courier services |
| Read-only staging prerequisites and implementation acceptance | [readiness service](../src/lib/release-readiness.ts), [CLI](../scripts/staging-readiness.ts), [domain regressions](../tests/completion.test.ts), [browser journey](../e2e/completion.spec.ts), [operations contract](COMPLETION_OPERATIONS.md) |
| Prepared native responsive photography | [asset preparation](../scripts/prepare-images.ts), [delivery component](../src/components/responsive-image.tsx), [source inventory](../src/lib/responsive-assets.ts), generated `public/images/responsive/` variants |
| Durable payment attempts, provider uncertainty, observations, advisory browser events and fenced reconciliation | [migration 012](../migrations/012_payment_attempts.sql), [migration 013](../migrations/013_payment_client_events.sql), [payment recovery service](../src/lib/payment-attempts.ts), [inbox](../src/lib/payment-inbox.ts), [commerce](../src/lib/commerce.ts), [Studio operations](../src/components/payment-operations.tsx), [customer orders](../src/components/order-card.tsx), [regressions](../tests/payment-attempts.test.ts), [recovery contract](PAYMENT_RECOVERY.md) |
| Non-overlapping maintenance against the running application's database | [HTTP worker](../scripts/commerce-worker.ts), [.env.example](../.env.example) |
| Runtime-created product images available after production startup | [image handler](../src/app/images/[filename]/route.ts), [HTTP upload regression](../tests/admin.test.ts) |
| Immediate initial HTML, critical image preload and deferred animation work | [initial-render regression](../e2e/initial-render.spec.ts), [home](../src/components/home.tsx), [catalog](../src/components/catalog.tsx), [shop](../src/app/shop/page.tsx), [editorial animation](../src/components/use-editorial-motion.ts), [local font layout](../src/app/layout.tsx); global loading boundary removed |
| Completed payout guard and independent correction ledger/UI/API | [migration 010](../migrations/010_payout_evidence_integrity.sql), [refund service](../src/lib/refunds.ts), [Refunds UI](../src/components/returns-center.tsx), [API handler](../src/app/api/[...path]/route.ts) |
| Consent evidence, suppression and unsubscribe | [migration 011](../migrations/011_newsletter_consent.sql), [newsletter service](../src/lib/newsletter.ts), [footer](../src/components/chrome.tsx), API handler |
| Serialized cart delta and explicit set/remove; dialog focus/reduced motion | [cart service](../src/lib/cart.ts), [store provider/dialog](../src/components/store-provider.tsx), API handler |
| Semantic courier notices and worker outcome fencing | [fulfillment](../src/lib/fulfillment.ts), [jobs](../src/lib/jobs.ts) |
| Matching-SKU sort and server-rendered catalog | [catalog query](../src/lib/catalog.ts), [shop page](../src/app/shop/page.tsx), [catalog UI](../src/components/catalog.tsx), API handler |
| CMS fields and motion labels; filter contrast and image sizing | [home](../src/components/home.tsx), [global styles](../src/app/globals.css), [chrome](../src/components/chrome.tsx) |
| Private export inventory; batched historical order assembly | [privacy](../src/lib/privacy.ts), [orders](../src/lib/orders.ts), API handler |
| SEO/indexing and local font/image delivery | [SEO helpers](../src/lib/seo.ts), [robots](../src/app/robots.ts), [sitemap](../src/app/sitemap.ts), [PDP metadata](../src/app/products/[slug]/page.tsx), [layout/fonts](../src/app/layout.tsx), [product card](../src/components/product-card.tsx), [product detail](../src/components/product-detail.tsx), [Next config](../next.config.ts), [.env.example](../.env.example) |
| Permanent regression coverage | [recovery domain tests](../tests/recovery.test.ts), [refund tests](../tests/returns-refunds.test.ts), [legacy migration tests](../tests/address-orders.test.ts), [retained-connection test](../tests/migration-reuse.test.ts), [explicit multi-variant fixture](../tests/commerce.test.ts), [recovery browser tests](../e2e/recovery.spec.ts), [finance/export closure](../qa/recovery-closure.spec.ts) |
| Isolated evidence and CI source | [recovery runner](../scripts/verify-recovery.mjs), [Lighthouse runner](../scripts/measure-web-performance.mjs), [evidence recorder](../qa/record-recovery.mjs), recovery Playwright configs in `qa/`, [CI workflow](../.github/workflows/ci.yml), [package scripts](../package.json), [.gitignore](../.gitignore) |

Next.js regenerated `next-env.d.ts`, its alternate-build TypeScript includes and
incremental type state while building `.next-recovery`. The default application
build directory remains `.next`; the recovery runner selects its separate output
through `SKY_PETAL_BUILD_DIR`.

The existing coverage audit, defect/execution/readiness/module-gap reports,
traceability matrix and recovery roadmap receive evidence supplements. Historical
observations remain. No merchant legal/tax data, credential, provider approval or
deployment result was invented.
