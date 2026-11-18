import type { Product, Variant } from "./types";
export function filterCatalog(catalog: Product[], q: URLSearchParams) {
  let products = [...catalog];
  const search = q.get("q")?.toLowerCase();
  if (search)
    products = products.filter((p) =>
      `${p.title} ${p.description} ${p.material} ${p.category}`
        .toLowerCase()
        .includes(search),
    );
  if (q.get("category"))
    products = products.filter((p) => p.category === q.get("category"));
  if (q.get("new") === "true") products = products.filter((p) => p.is_new);
  if (q.get("material"))
    products = products.filter((p) => p.material === q.get("material"));
  const matches = (v: Variant) =>
    (!q.get("size") || v.size === q.get("size")) &&
    (!q.get("color") || v.color === q.get("color")) &&
    (!q.get("min") || v.price >= Number(q.get("min")) * 100) &&
    (!q.get("max") || v.price <= Number(q.get("max")) * 100) &&
    (q.get("stock") !== "true" || v.stock > 0) &&
    (q.get("sale") !== "true" || (v.compare_price || 0) > v.price);
  products = products.filter((p) => p.variants.some(matches));
  const price = (p: Product) =>
    Math.min(...p.variants.filter(matches).map((v) => v.price));
  const sort = q.get("sort");
  if (sort === "price-asc") products.sort((a, b) => price(a) - price(b));
  if (sort === "price-desc") products.sort((a, b) => price(b) - price(a));
  if (sort === "alphabetical")
    products.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "bestselling") products.sort((a, b) => b.sales - a.sales);
  if (sort === "newest")
    products.sort((a, b) => Number(b.is_new) - Number(a.is_new));
  return products;
}
