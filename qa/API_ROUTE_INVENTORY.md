# Actual route and operation inventory

Source scan of the tested dirty tree; 61 distinct literal GET/POST branches, nine dynamic dispatch expressions, plus address PATCH/DELETE. Branch presence is not endpoint acceptance.

| Method | Actual operation | Fresh acceptance scope |
|---|---|---|
| GET | /api/catalog | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/home | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/me | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/auth/google | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/cart | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/wishlist | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/orders | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/addresses | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/returns | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/returns | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/refunds | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/refunds | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/jobs | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/shipments | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/notifications | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/reviews | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/support/tickets | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/support | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/payments | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/commerce | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin/cod | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| GET | /api/admin | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/shipping/events | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/internal/maintenance | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/payments/webhook | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/media | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/support/tickets | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/commerce | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/tax-class | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/product-tax | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/cod | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/checkout/quote | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/payments/retry | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/auth | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/logout | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/cart | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/quote | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/newsletter | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/wishlist | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/profile | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/password | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/addresses | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/privacy | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/returns | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/returns | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/shipments | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/return-policy | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/refunds | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/refunds/review | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/refunds/manual-confirm | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/jobs/retry | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/jobs/run | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/notifications/read | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/reviews | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/checkout | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/payments/verify | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/product | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/variant | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/order | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/cms | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |
| POST | /api/admin/coupon | Existing tests/role probes cover selected operations; full operation schema/boundary contract NOT RUN |

## Dynamic dispatch evidence

- route.ts:245: `if (path === "orders" || /^orders\/[^/]+$/.test(path)) {`
- route.ts:264: `path.startsWith("admin/"),`
- route.ts:272: `path.startsWith("admin/"),`
- route.ts:312: `if (/^(support\/tickets|admin\/support)\/[^/]+$/.test(path))`
- route.ts:317: `path.startsWith("admin/"),`
- route.ts:504: `if (/^(support\/tickets|admin\/support)\/[^/]+\/reply$/.test(path)) {`
- route.ts:511: `path.startsWith("admin/"),`
- route.ts:515: `if (/^admin\/support\/[^/]+$/.test(path)) {`
- route.ts:856: `if (/^orders\/[^/]+\/cancel$/.test(path)) {`

PATCH/DELETE are limited to `/api/addresses/:id`. Catch-all existence does not implement arbitrary roadmap paths. `/api/catalog`, `/api/cart`, `/api/quote`, `/api/checkout`, `/api/payments/verify`, `/api/payments/webhook` retain their actual names. Authoritative quote is `/api/checkout/quote`; `/api/quote` is a bag preview. Shipping ingress is `/api/shipping/events`.

## Pages and route handlers

- src/app/account/notifications/page.tsx
- src/app/account/orders/[id]/page.tsx
- src/app/account/page.tsx
- src/app/account/returns/page.tsx
- src/app/account/support/page.tsx
- src/app/admin/page.tsx
- src/app/api/[...path]/route.ts
- src/app/auth/callback/route.ts
- src/app/cart/page.tsx
- src/app/checkout/page.tsx
- src/app/page.tsx
- src/app/products/[slug]/page.tsx
- src/app/shop/page.tsx
- src/app/wishlist/page.tsx
- src/app/[...info]/page.tsx

## Missing contract families / equivalent routes

Collections, journal/help, full CMS, invoices, granular staff management, promotion redemptions and messaging/provider delivery have no complete implementation. Product detail uses `/products/[slug]`; category/search use `/shop` query parameters; login/profile/address/order lists are account modes/tabs. Studio views implement some admin functions without separate URLs; assess actual functions rather than aliases. Support/order dynamic paths are present in the listed dispatcher evidence. Full per-operation response-schema/huge-body/timeout/security contracts remain a test backlog.
