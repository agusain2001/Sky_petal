import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
const config: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Compact storefront CSS arrives with the first HTML response on slow links.
  // Next 16's documented experimental option applies to production builds only.
  experimental: { inlineCss: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      ...[
        "/admin/:path*",
        "/account/:path*",
        "/api/:path*",
        "/checkout",
        "/cart",
        "/wishlist",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};
export default function nextConfig(phase: string): NextConfig {
  return {
    ...config,
    // Isolated output keeps local development available during production QA.
    distDir:
      process.env.SKY_PETAL_BUILD_DIR ||
      (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
  };
}
