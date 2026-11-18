import { Catalog } from "@/components/catalog";
import { getDB, getProducts } from "@/lib/db";
import { expireReservations } from "@/lib/commerce";
import { filterCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Shop the collection" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value))
      for (const item of value) params.append(key, item);
  }
  await expireReservations(await getDB());
  const all = await getProducts();
  return (
    <Catalog
      initialProducts={filterCatalog(all, params)}
      initialAll={all}
      initialQuery={params.toString()}
    />
  );
}
