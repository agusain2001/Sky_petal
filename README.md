# Sky Petal

The cinematic homepage refresh is available at **http://127.0.0.1:4318**. Restart it with `start-cinematic-preview.cmd`; it uses its own local preview database. See [the landing-page delivery notes](docs/CINEMATIC_LANDING.md) and [new generated assets and final prompts](docs/CINEMATIC_ASSETS.md).

A working Next.js commerce application with an editorial ivory, blush and plum storefront, original generated product imagery, React Three Fiber petals, persistent PostgreSQL data, customer accounts, cart, checkout integration and an independently authorized Studio admin area.

## Open the running application

- Storefront: http://127.0.0.1:4317
- Studio: http://127.0.0.1:4317/admin
- Private local owner sign-in: `data/local-access.json` (ignored by version control; do not publish or share).

This delivery is a local development store. It is **not ready to accept live customer payments**. See `docs/STATUS.md` for tested behavior, missing integrations and remaining launch work. There are no invented reviews, sales figures, completed payments or external fulfillment results.

The [current local recovery report](Sky_Petal_Local_Recovery_Report.md) records
the 10 November payment/rendering fixes, reproducible evidence and remaining
issues. See [payment recovery operations](docs/PAYMENT_RECOVERY.md) for attempt
states, safe reconciliation and the optional HTTP maintenance worker.

[Invoices, exchanges, staff MFA and deletion](docs/COMPLETION_OPERATIONS.md)
document the additional local workflows, required merchant configuration and
read-only staging checks. External acceptance and mobile LCP remain open.

## Run locally

Node.js 22.12+ is required. This project was verified with Node 24.

```powershell
npm ci
npm run setup:local
npm run dev
```

You can also double-click `start-sky-petal.cmd` after installation. The development server opens on port 4317. Open the URL above in a browser.

Development uses `.next-dev`, production builds use `.next`, and the optional
port-4318 cinematic preview uses `.next-cinematic-dev`. These separate output
directories prevent one running preview from losing assets when another build
runs. `SKY_PETAL_BUILD_DIR` can override the directory for isolated checks.
Restart a production preview after rebuilding it so its HTML and asset files
come from the same build.

The application automatically creates the schema and seeds 11 sample products with independent size/colour SKU inventory. Data is stored on disk in `data/sky-petal`; restarting the app retains it. Run **one** PGlite application process against this folder. Stop the application before running owner provisioning or offline database helpers against this same folder. Tests use a separate temporary database.

`npm run setup:local` creates a random local owner password once, saves it privately, and preserves an existing owner on subsequent runs. Customer registration never grants an administrative role. To provision a chosen team email while the app is stopped:

```powershell
$env:OWNER_EMAIL='your-team-email@example.com'
# Set OWNER_PASSWORD privately in your shell, or let the script generate one.
node node_modules/tsx/dist/cli.mjs scripts/create-owner.ts
```

For a local production build preview:

```powershell
npm run build
$env:ALLOW_LOCAL_AUTH='true'
npm start
```

`ALLOW_LOCAL_AUTH` is only for this loopback preview. Keep it false on a public deployment. Without Supabase configured, public production registration fails closed.

## Authentication and Google OAuth

Copy `.env.example` to `.env.local` and configure your own Supabase project URL and public anon key. Enable email confirmation, a real SMTP sender and Google OAuth in Supabase. Add these exact local redirect destinations to the provider allow-list, and the matching HTTPS URLs for production:

- `http://127.0.0.1:4317/auth/callback`
- `http://127.0.0.1:4317/auth/callback?next=%2Faccount%3Fview%3DPassword`

Set `NEXT_PUBLIC_SITE_URL` to the actual origin. The app uses the established Supabase SSR flow for provider accounts; the server verifies the provider response before creating the private store session. Google sign-in and email confirmation merge the guest bag into the account bag and return to checkout. Duplicate SKU quantities are summed and capped to available stock. The reset-email flow returns to the Password tab; the provider session must verify the same account before a password update.

When Supabase is configured, existing development passwords are not accepted through the provider. Register or sign in with the same verified email to link the store profile; provision its role with the owner helper. Never expose server database credentials to a browser.

## Managed PostgreSQL

Set a server-only `DATABASE_URL`, and set `DATABASE_SSL=require` when your provider uses publicly trusted TLS. The app uses the PostgreSQL pool adapter automatically. Production does not auto-migrate the schema; apply migrations with a migration owner before running the server with its trusted server role:

```powershell
npm run db:export
npm run db:migrate
# Optional, for a staging store: npm run db:seed
```

These helpers read environment variables from the calling shell. To load a local environment file explicitly, use `node --env-file=.env.local --import tsx scripts/migrate.ts` (or `scripts/seed.ts`). Do not seed sample stock into a live merchant catalog. The migration is idempotent and includes foreign keys, unique slugs/SKUs, money and inventory constraints, indexes, and RLS. Browser roles have catalog reads and user-specific private reads; browser mutations are not granted. The server uses a trusted private connection and enforces role checks and ownership on every privileged/private operation.

The local upload implementation writes re-encoded WebP media to `public/images`. Production needs durable shared object storage and an asset origin before scaling across instances. PGlite is for local execution only, not a multi-instance production database.

## Razorpay

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` on the server. Configure the merchant webhook for `payment.captured` at `/api/payments/webhook`. Verify merchant/category eligibility before enabling permitted wellness items. Use test credentials and provider test events before accepting live payments.

The server calculates integer-paise totals from database SKU prices, validates coupons, locks the customer cart, reserves stock conditionally in one transaction, and creates the provider order behind an order lock. The browser does not decide whether an order is paid. The completion endpoint verifies the HMAC and fetches the provider payment to require a matching captured amount/currency/order. Webhooks verify the raw-body signature and use unique event/payment IDs. Capture and inventory consumption are transactional and idempotent.

Reservations expire after 15 minutes and are released when the catalog, checkout or customer orders are accessed. Before production, schedule an independent expiry job and implement reconciliation/manual refund handling for captured payments arriving after a reservation was released. No live API requests or charges were made during development.

Preview shipping is free from ₹2,990 after discounts, otherwise ₹99. Preview prices are treated as tax inclusive. This is not a configured tax engine. Confirm GST treatment, invoices, actual shipping/serviceability, hygiene/returns policies and merchant contact information before launch.

## Checks

```powershell
npm run typecheck
npm test
npm run build
# With the application running on port 4317:
$env:TEST_BASE_URL='http://127.0.0.1:4317'
npm run test:api
npm run test:browser
```

Windows browser checks use installed Microsoft Edge. Linux CI uses Playwright Chromium (`npx playwright install --with-deps chromium`). Local owner API tests require `data/local-access.json`. The API tests intentionally create disposable QA accounts and archived QA catalog records in the target local store. Run them only against a local or disposable staging environment.

Database tests cover reservations, concurrency, rollback, coupon/price calculation, signatures, capture, duplicate events, expiration, password hashing and RLS. HTTP tests cover carts, guest/account merging, private data, role authorization, SKU validation, server quotes, password changes, media, CMS and admin catalog updates. Browser tests cover desktop/mobile shopping, URL filters, reduced motion, overflow and serious/critical axe accessibility findings. Passing automated checks does not establish a full WCAG conformance claim or production performance certification.

## Source organization

- `src/app/`: App Router pages, authentication callback and server routes.
- `src/components/`: storefront, catalog, product gallery, cart/dialogs, accounts and Studio.
- `src/lib/`: database, RLS, sessions, Supabase, inventory/payment transactions and types.
- `migrations/`: reproducible PostgreSQL schema and row policies.
- `tests/`, `e2e/`: executable backend and browser tests.
- `public/images/`: 12 generated PNG originals and optimized WebP assets.
- `docs/IMAGE_PROMPTS.md`: exact generation prompts and saved filenames; built-in ImageGen was used.
- `docs/STATUS.md`: implementation/test matrix and remaining work.

The requested Kling generation remains pending by the user’s choice. No fal.ai call was made. Optional video can be added after `FAL_KEY` is configured and generation is approved. The existing Three.js petals and Motion animations operate independently.

Technical references used: [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [PGlite file storage](https://pglite.dev/docs/filesystems), [Motion configuration](https://motion.dev/docs/react-motion-config), and [Razorpay integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).
