"use client";
import Link from "next/link";
import Image from "./responsive-image";
import { Heart, Plus, ArrowUpRight } from "lucide-react";
import { useStore } from "./store-provider";
import { money, type Product } from "@/lib/types";
export function ProductCard({
  product: p,
  index = 0,
  priority = false,
}: {
  product: Product;
  index?: number;
  priority?: boolean;
}) {
  const { setQuick, wishlist, toggleWishlist, toast } = useStore();
  const price = Math.min(...p.variants.map((v) => v.price));
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={"/products/" + p.slug} tabIndex={-1}>
          <Image
            src={p.image}
            alt={p.title}
            width={600}
            height={800}
            sizes="(max-width: 767px) 45vw, (max-width: 1200px) 30vw, 22vw"
            unoptimized={!p.image.startsWith("/") || p.image.startsWith("//")}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority && index === 0 ? "high" : "auto"}
          />
        </Link>
        {(p.is_new || p.variants[0]?.compare_price) && (
          <span className="product-badge">
            {p.is_new ? "JUST BLOOMED" : "A LITTLE TREAT"}
          </span>
        )}
        <button
          className="card-heart"
          aria-label={`Save ${p.title}`}
          aria-pressed={wishlist.includes(p.id)}
          onClick={() => toggleWishlist(p).catch((e) => toast(e.message))}
        >
          <Heart
            size={17}
            strokeWidth={1.4}
            fill={wishlist.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
        <button className="quick-add" onClick={() => setQuick(p)}>
          Choose your size <Plus size={15} />
        </button>
      </div>
      <div className="product-meta">
        <span>
          {p.category === "wellness"
            ? "YOUR EVERYDAY RITUAL"
            : p.material.toUpperCase()}
        </span>
        <Link href={"/products/" + p.slug} aria-label={`View ${p.title}`}>
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <Link className="product-title" href={"/products/" + p.slug}>
        {p.title}
      </Link>
      <div className="product-price">
        {money(price)}
        {p.variants[0]?.compare_price && (
          <del>{money(p.variants[0].compare_price)}</del>
        )}
      </div>
      <div className="card-swatches" aria-label="Available colours">
        {[...new Map(p.variants.map((v) => [v.color, v])).values()].map((v) => (
          <span
            key={v.color}
            title={v.color}
            style={{ backgroundColor: v.color_hex }}
          />
        ))}
        <span className="sizes-hint">
          {p.category === "wellness" ? "100 ml" : "XS – XXL"}
        </span>
      </div>
    </article>
  );
}
