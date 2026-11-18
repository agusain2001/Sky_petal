# Verification performed on 30 October 2026

The following checks ran against this delivery. Failed intermediate checks were corrected and rerun; the final results below are the latest completed results.

| Check | Final result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; application and metadata routes generated or registered |
| `npm test` | 14 database/security tests passed; 2 HTTP suites skipped here because they require a running app |
| `TEST_BASE_URL=http://127.0.0.1:4317 npm run test:api` | 24 tests passed; 0 skipped |
| `TEST_BASE_URL=http://127.0.0.1:4317 npm run test:browser` | 8 desktop/mobile tests passed |
| Total executed passing tests across the three runs | 46 |
| Dependency installation audit | npm reported 0 known vulnerabilities when dependencies were installed; not a future security guarantee |
| Image optimization | 12 source PNGs and 12 WebP outputs saved |
| Browser visual review | Desktop and mobile hero/screenshots inspected; local in-app preview inspected |
| Homepage accessibility | No serious or critical axe findings in the tested WCAG rule set at the two tested sizes, with reduced motion enabled |

The responsive browser runs include exact colour/size selection, adding to the bag, refresh persistence, checkout requiring sign-in, combined URL filters and sorting, reduced motion, horizontal-overflow checks and anonymous admin denial.

After starting the built application, the homepage, catalog and session endpoints returned HTTP 200. The desktop and mobile shopping journeys were repeated against the running production build: both passed. These repeat checks are not added again to the 46-test total. The final running-site screenshot is `artifacts/sky-petal-running.png`.

Backend tests include concurrent purchase of a final SKU, rollback on insufficient inventory, repeat checkout, reservation release, price/coupon authority, payment amount/currency verification, duplicate capture processing, raw signature checks, cross-origin rejection, session/privacy boundaries and owner catalog/stock/CMS/media operations. Supabase, Razorpay, SMTP, carrier and managed PostgreSQL network integrations were not connected; tests of local payment logic do not constitute a live provider transaction.

Screenshots: `artifacts/sky-petal-desktop.png`, `artifacts/sky-petal-mobile.png`. The latest browser report is in `playwright-report/index.html`. Detailed launch limitations are in `STATUS.md`.

On this Windows host, embedded PostgreSQL tests and the Next.js build required normal host file permissions. The final verified tests were run with those permissions. The local development preview was replaced by the built app for handoff, with local authentication explicitly enabled on the loopback address only.
