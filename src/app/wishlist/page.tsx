"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore, api } from "@/components/store-provider";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";
export default function Page() {
  const { user, wishlist } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    api<{ products: Product[] }>("catalog")
      .then((x) => setProducts(x.products))
      .catch(() => {});
  }, []);
  return (
    <div className="page-shell">
      <span className="eyebrow">KEEP THE LOVELY THINGS CLOSE</span>
      <h1 className="page-title">Your favourites.</h1>
      {!user ? (
        <div className="empty-state">
          <p>Sign in to save your favourites for a little later.</p>
          <Link href="/account?next=/wishlist" className="button dark">
            Sign in
          </Link>
        </div>
      ) : wishlist.length ? (
        <div className="product-grid">
          {products
            .filter((p) => wishlist.includes(p.id))
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>A little wish, waiting to happen.</h2>
          <p>Tap the heart on anything you love.</p>
          <Link className="button outline" href="/shop">
            Find something lovely
          </Link>
        </div>
      )}
    </div>
  );
}
