"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, X, ArrowRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { api, Dialog } from "./store-provider";
import { ProductCard } from "./product-card";
const categories = [
  ["bras", "Bras & bralettes"],
  ["lingerie", "Lingerie sets"],
  ["sleepwear", "Sleepwear"],
  ["panties", "Panties"],
  ["loungewear", "Loungewear"],
  ["bodysuits", "Bodysuits"],
  ["shapewear", "Shapewear"],
  ["accessories", "Accessories"],
  ["wellness", "Self-care & wellness"],
];
export function Catalog({
  initialProducts,
  initialAll,
  initialQuery,
}: {
  initialProducts: Product[];
  initialAll: Product[];
  initialQuery: string;
}) {
  // The server already resolved this request's URL. Reading it again through
  // useSearchParams suspends the entire catalog behind client-side recovery.
  // App Router supplies a new initialQuery on filter and back/forward navigation.
  const params = new URLSearchParams(initialQuery);
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const all = initialAll;
  const first = useRef(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const query = params.toString();
  const setFilter = useCallback(
    (key: string, value: string) => {
      const q = new URLSearchParams(query);
      if (value) q.set(key, value);
      else q.delete(key);
      router.push("/shop?" + q.toString(), { scroll: false });
    },
    [query, router],
  );
  useEffect(() => {
    if (first.current && query === initialQuery) {
      first.current = false;
      return;
    }
    first.current = false;
    let active = true;
    setLoading(true);
    api<{ products: Product[] }>("catalog?" + query)
      .then((r) => {
        if (active) {
          setProducts(r.products);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, initialQuery]);
  const filters = (
    <>
      <div className="filter-group">
        <h3>Your kind of lovely</h3>
        {categories.map(([id, title]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={params.get("category") === id}
              onChange={(e) =>
                setFilter("category", e.target.checked ? id : "")
              }
            />
            {title}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h3>Find your size</h3>
        <select
          aria-label="Filter by size"
          value={params.get("size") || ""}
          onChange={(e) => setFilter("size", e.target.value)}
        >
          <option value="">All sizes</option>
          {["XS", "S", "M", "L", "XL", "XXL", "100 ml"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <h3>Colour</h3>
        {["Petal Rose", "Champagne", "Midnight Plum", "Rose"].map((c) => (
          <label key={c}>
            <input
              type="checkbox"
              checked={params.get("color") === c}
              onChange={(e) => setFilter("color", e.target.checked ? c : "")}
            />
            {c}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h3>Price range (₹)</h3>
        <div className="filter-prices">
          <label>
            From
            <input
              type="number"
              min="0"
              max="1000000"
              aria-label="Minimum price"
              defaultValue={params.get("min") || ""}
              key={"min" + params.get("min")}
              placeholder="0"
              onBlur={(e) => setFilter("min", e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="number"
              min="0"
              max="1000000"
              aria-label="Maximum price"
              defaultValue={params.get("max") || ""}
              key={"max" + params.get("max")}
              placeholder="Any"
              onBlur={(e) => setFilter("max", e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="filter-group">
        <h3>Feel-good fabrics</h3>
        <select
          aria-label="Filter by material"
          value={params.get("material") || ""}
          onChange={(e) => setFilter("material", e.target.value)}
        >
          <option value="">All fabrics</option>
          {[...new Set(all.map((p) => p.material))].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <h3>The little extras</h3>
        {[
          ["stock", "In stock"],
          ["sale", "A little treat (sale)"],
          ["new", "Just bloomed"],
        ].map(([k, title]) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={params.get(k) === "true"}
              onChange={(e) => setFilter(k, e.target.checked ? "true" : "")}
            />
            {title}
          </label>
        ))}
      </div>
    </>
  );
  const title = params.get("q")
    ? `A little search for “${params.get("q")}”.`
    : params.get("new")
      ? "Freshly bloomed."
      : categories.find((c) => c[0] === params.get("category"))?.[1] ||
        "All things lovely.";
  return (
    <div className="page-shell">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Shop the collection</span>
      </div>
      <div className="catalog-heading">
        <span className="eyebrow">THOUGHTFULLY MADE. BEAUTIFULLY YOU.</span>
        <h1 className="page-title">{title}</h1>
        <p className="page-intro">
          Beautiful things for your everyday. Find the pieces that feel like
          you, from the very first layer.
        </p>
      </div>
      <div className="catalog-bar">
        <span>
          {loading
            ? "Finding lovely things…"
            : `${products.length} little luxuries`}
        </span>
        <div className="catalog-controls">
          <button className="mobile-only" onClick={() => setDrawer(true)}>
            <SlidersHorizontal size={14} /> Filter
          </button>
          <label>
            Sort:{" "}
            <select
              aria-label="Sort products"
              value={params.get("sort") || "relevance"}
              onChange={(e) => setFilter("sort", e.target.value)}
            >
              {[
                ["relevance", "Our favourites"],
                ["newest", "Newest arrivals"],
                ["price-asc", "Price: low to high"],
                ["price-desc", "Price: high to low"],
                ["bestselling", "Best selling"],
                ["alphabetical", "A to Z"],
              ].map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="catalog-layout">
        <aside className="filters" aria-label="Product filters">
          {filters}
        </aside>
        <div className="catalog-results">
          {[...params.entries()].filter(([k]) => k !== "sort").length > 0 && (
            <div className="active-filters">
              {[...params.entries()]
                .filter(([k]) => k !== "sort")
                .map(([k, v]) => (
                  <button key={k} onClick={() => setFilter(k, "")}>
                    {k}: {v === "true" ? "yes" : v}
                    <X size={11} />
                  </button>
                ))}
              <button onClick={() => router.push("/shop", { scroll: false })}>
                Clear all
              </button>
            </div>
          )}
          {error ? (
            <div className="form-error">
              {error}
              <button onClick={() => window.location.reload()}>
                {" "}
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="product-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  className="skeleton"
                  style={{ aspectRatio: "3/4" }}
                  key={i}
                />
              ))}
            </div>
          ) : products.length ? (
            <div className="product-grid">
              {products.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  index={i}
                  priority={i < 2}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>A little too specific?</h2>
              <p>Try removing a filter to find your next favourite.</p>
              <button
                className="button outline"
                onClick={() => router.push("/shop")}
              >
                See all the lovely things <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Find your lovely"
        drawer
      >
        {filters}
        <button
          className="button dark full"
          style={{ marginTop: 25 }}
          onClick={() => setDrawer(false)}
        >
          Show {products.length} lovely things
        </button>
      </Dialog>
    </div>
  );
}
