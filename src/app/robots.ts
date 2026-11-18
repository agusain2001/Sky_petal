import type { MetadataRoute } from "next";
import { indexingEnabled, publicSiteOrigin } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/account",
        "/checkout",
        "/cart",
        "/wishlist",
      ],
    },
    sitemap: `${publicSiteOrigin()}/sitemap.xml`,
  };
}
