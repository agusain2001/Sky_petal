# Vercel catalog preview

The storefront and backend API run together as one Next.js Vercel project.

- Public URL: https://sky-petal.vercel.app
- GitHub: https://github.com/agusain2001/Sky_petal (branch main)
- Vercel project: sky-petal, Node.js 24
- Database: Neon PostgreSQL, pooled connection with full TLS verification
- Applied database migrations: 21
- Bundled sample products: 11

## Configuration

DATABASE_URL, MFA_ENCRYPTION_KEY and COMMERCE_MAINTENANCE_SECRET are private Vercel environment variables. Never copy their values into source control. DATABASE_AUTO_MIGRATE is false: run versioned migrations deliberately before deploying schema changes. Local .env.local is ignored by Git.

The project is a catalog preview. ALLOW_LOCAL_AUTH=false and SITE_INDEXING_ENABLED=false. Supabase authentication and Razorpay payments are unconfigured. Complete provider setup and acceptance testing before enabling real commerce. Production admin uploads also require durable object storage; Vercel's filesystem is not persistent.

## Local verification

npm ci
npm run typecheck
npm test
npm run build
npm start

The local production server uses http://127.0.0.1:4317. npm test uses isolated test databases. Tests depending on a configured local HTTP/owner fixture are skipped by default.

## Deployment

Deploy main into the existing sky-petal Vercel project, preserving its environment variables. The initial deployment was created from the GitHub commit through the Vercel API. Continuous deployment on future pushes additionally requires connecting this existing project to agusain2001/Sky_petal under Vercel Settings > Git.

Verify /, /shop, /products/the-petal-bralette, /api/catalog, /api/cart and /images/hero.webp. Anonymous /api/admin requests must return 401. Confirm guest bag persistence and the checkout sign-in gate in Brave.

## Dependency security

The archived Next.js 16.4.3 was updated to 16.4.6 to resolve the advisories reported by npm audit. The production dependency audit after updating reported zero vulnerabilities.
