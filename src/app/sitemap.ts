import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/db";
import { indexingEnabled, publicSiteOrigin } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return [];
  const origin = publicSiteOrigin();
  return [
    ...[
      "",
      "/shop",
      "/about",
      "/contact",
      "/fit-guide",
      "/policies/privacy",
      "/policies/returns",
      "/policies/shipping",
      "/policies/terms",
    ].map((path) => ({ url: origin + path })),
    ...(await getProducts()).map((p) => ({
      url: `${origin}/products/${encodeURIComponent(p.slug)}`,
    })),
  ];
}
