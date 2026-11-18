import type { Product } from "./types";
export function publicSiteOrigin() {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4317",
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Invalid site URL");
    return url.origin;
  } catch {
    return "http://localhost:4317";
  }
}
/** Indexing needs explicit production opt-in, never merely NODE_ENV=production
 * (staging also uses a production build). */
export function indexingEnabled() {
  return (
    process.env.SITE_INDEXING_ENABLED === "true" &&
    process.env.DEPLOYMENT_ENV === "production" &&
    publicSiteOrigin().startsWith("https://")
  );
}
export function productStructuredData(p: Product) {
  const origin = publicSiteOrigin(),
    url = `${origin}/products/${encodeURIComponent(p.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description,
    image: [new URL(p.image, origin).href],
    url,
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      url,
      priceCurrency: "INR",
      price: (v.price / 100).toFixed(2),
      availability: `https://schema.org/${v.stock > 0 ? "InStock" : "OutOfStock"}`,
    })),
  };
}
export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
