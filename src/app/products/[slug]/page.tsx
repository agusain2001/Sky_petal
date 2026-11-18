import { getProducts } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { publicSiteOrigin, productStructuredData, safeJsonLd } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = (await getProducts()).find((p) => p.slug === slug);
  if (!p) notFound();
  return {
    title: p.title,
    description: p.description,
    alternates: {
      canonical: `${publicSiteOrigin()}/products/${encodeURIComponent(p.slug)}`,
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await getProducts();
  const p = products.find((x) => x.slug === slug);
  if (!p) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(productStructuredData(p)),
        }}
      />
      <ProductDetail
        product={p}
        related={products
          .filter((x) => x.id !== p.id && x.featured)
          .slice(0, 4)}
      />
    </>
  );
}
