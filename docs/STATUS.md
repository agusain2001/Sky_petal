# Delivery and launch status

This is executable source and a running local store. A full public production launch is not complete. Provider-dependent journeys have not been falsely marked as tested.

| Area | Implementation | Verification |
| --- | --- | --- |
| Editorial storefront, mobile layout and original photography | Implemented; 12 generated assets, 11 seeded products | Browser visual review and responsive tests |
| Motion and Three.js petals | Implemented; lazy desktop rendering, WebGL fallback, pointer input, pause and reduced-motion behavior | Reduced-motion/overflow checks; visual review; no cross-device GPU certification |
| Kling hero video | Pending user setup; explicitly deferred | No generation request made |
| PostgreSQL catalog and SKU stock | Implemented, on-disk PGlite locally; managed PostgreSQL adapter included | Database and HTTP tests passed locally; managed provider not connected |
| Catalog search, category/size/colour/material/price/stock/sale/new filters | Implemented with URL state and matching-SKU availability | HTTP and desktop/mobile combination/reload tests |
| Sorting | Favourites, new arrivals, price, sales count and alphabetical implemented | URL/browser and API checks |
| Advanced band/cup, coverage/support/padding, rating and collection filters | Not yet implemented as complete discovery controls | Not tested |
| Product gallery, zoom, variant validation, quantity, care and fit guide | Implemented | Desktop/mobile exact-SKU shopping test; invalid/oversold SKU HTTP tests |
| Guest cart, drawer/full page and persistence | Implemented server-side using opaque HttpOnly cart cookie | HTTP and browser refresh tests |
| Account cart merge | Implemented, sums by SKU and caps to available stock | Local email login and registration merge tests passed; OAuth merge awaits provider test |
| Local development accounts | Implemented with salted scrypt, hashed opaque sessions and role checks | Registration/login/logout/password/ownership HTTP checks |
| Supabase email registration/verification, Google sign-in and recovery | Integration source implemented; requires merchant Supabase configuration and SMTP | Live provider verification blocked by missing credentials |
| Customer profile, saved addresses, wishlist, privacy export/deletion request | Implemented; deletion is a request for review | Profile/wishlist/address UI built; privacy/authorization API checks; no completed legal deletion workflow claim |
| Orders and status steps | Private order list and server-authorized status transitions implemented | Paid state and transaction tests; live paid-to-delivered journey not run |
| Checkout address, delivery, coupon, order summary and sign-in gate | Implemented | HTTP totals/coupon/ownership tests and browser sign-in gate tests |
| Razorpay creation, signature verification, capture lookup and webhook deduplication | Implemented; unconfigured store fails closed | Core signatures/capture/dedup tested locally; real provider flows blocked by missing merchant credentials |
| Inventory reservation, oversell prevention and expiration | Implemented with conditional stock writes and transactions | Concurrent final-SKU, expiry, rollback and duplicate-checkout tests passed |
| Expiry scheduler and late-payment reconciliation | Expiry function implemented; independent scheduled worker and reconciliation/refund process not yet implemented | On-access expiry test passed; scheduled production operations not tested |
| Studio roles and backend authorization | Owner/admin/catalog/fulfillment/support roles recognized; sensitive writes separately authorized | Anonymous/customer rejection, owner positive CRUD/upload/CMS tests |
| Product editing, archive/restore, variants and independent stock | Implemented; unpublished records retained | Owner create/update/SKU/archive/storefront propagation tests |
| Product media and gallery | JPEG/PNG/WebP upload, pixel/size limits, safe re-encoding and gallery URLs implemented | Real WebP upload and unsafe media rejection tests |
| CSV and bulk catalog operations | CSV export implemented; import, bulk edits and safe permanent deletion not yet implemented | Export UI present; import not tested |
| Categories, collections and tags | Category/collection relational storage exists; comprehensive management UI and tags are not complete | Seed/schema only |
| Homepage CMS and promotions | Hero, announcement and philosophy text editable; offers stored and validated in database | Owner CMS and coupon tests |
| Full-page CMS, policies, blogs, FAQs and 3D settings | Remaining section text is source-managed; full CMS not yet implemented | Draft informational pages render; editorial launch review pending |
| Analytics | Actual captured revenue, recent order count, customers and low-stock SKU count | Database-backed; no fabricated analytics; chart/date-filter suite not yet implemented |
| Reviews | Verified-delivery-only creation endpoint, product review form and real review display | Server eligibility enforced; no fabricated testimonials; complete delivered-order review test pending |
| Returns | Eligible-order request endpoint and customer action implemented | Requires operational review; automatic refunds/exchanges not implemented |
| Refunds, invoices, support-ticket operations and customer-service console | Schema foundations only; complete workflows not yet implemented | Not tested |
| Tax, shipping carrier and transactional email | Preview shipping/tax-inclusive assumptions; no real tax/carrier/email connection | Blocked by merchant details and providers |
| Privacy and database access | RLS, ownership checks, private sessions, same-origin mutation checks, basic auth rate limits and audit records | Database RLS, cross-origin and unauthorized-access checks passed |
| Production operation | Build verified; deployment configuration documented | HTTPS hosting, object storage, backups, monitoring, load/performance targets and public deployment remain pending |
| Accessibility | Dialog focus management, semantic forms, labels, keyboard focus and reduced motion implemented | Homepage axe serious/critical findings resolved; full manual WCAG 2.2 AA audit not claimed |

## Before accepting real orders

Connect managed PostgreSQL, Supabase/Google/SMTP and the eligible Razorpay merchant account; complete a provider test-mode purchase and a real webhook retry. Publish actual product specifications, matching colour photography, merchant contact details, tax/invoice rules and reviewed policies. Complete the remaining operational workflows listed above, schedule reservation expiration, and test backup/recovery, privacy handling and performance on the selected host. Keep development authentication and private local-access files out of any public deployment.
