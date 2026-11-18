"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "./responsive-image";
import { Feather, PackageCheck, Flower2 } from "lucide-react";
import type { Product } from "@/lib/types";
import { VariantPicker, Dialog, api, useStore } from "./store-provider";
import { ProductCard } from "./product-card";
export function ProductDetail({
  product: p,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const [image, setImage] = useState(p.image);
  const [zoom, setZoom] = useState(false);
  const { user, toast } = useStore();
  const [reviews, setReviews] = useState<
    { id: string; name: string; rating: number; body: string }[]
  >([]);
  useEffect(() => {
    api<typeof reviews>("reviews?product=" + p.id)
      .then(setReviews)
      .catch(() => {});
  }, [p.id]);
  return (
    <div className="page-shell">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">The collection</Link>
        <span>/</span>
        <span>{p.title}</span>
      </div>
      <div className="product-detail">
        <div>
          <button
            onClick={() => setZoom(true)}
            style={{ padding: 0, width: "100%" }}
            aria-label="Zoom product image"
          >
            <Image
              src={image}
              alt={p.title}
              className="detail-main-image"
              preload
              width={1024}
              height={1280}
              sizes="(max-width: 767px) calc(100vw - 50px), 50vw"
              unoptimized={!image.startsWith("/") || image.startsWith("//")}
            />
          </button>
          <div className="gallery-thumbs">
            {[...new Set([p.image, ...p.images])].map((src, i) => (
              <button
                onClick={() => setImage(src)}
                key={src}
                aria-label={`View product image ${i + 1}`}
              >
                <Image
                  src={src}
                  alt={`${p.title}, view ${i + 1}`}
                  width={80}
                  height={100}
                  sizes="80px"
                  unoptimized={!src.startsWith("/") || src.startsWith("//")}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">
            {p.is_new ? "JUST BLOOMED / " : "THE SOFTNESS COLLECTION / "}
            {p.material.toUpperCase()}
          </span>
          <h1>{p.title}</h1>
          <p>{p.description}</p>
          {p.variants.length ? (
            <VariantPicker product={p} />
          ) : (
            <p>This piece is being prepared. Check back soon.</p>
          )}
          <div className="detail-perks">
            <span>
              <Feather />
              Gentle on your skin
            </span>
            <span>
              <PackageCheck />
              Discreet packaging
            </span>
          </div>
          {[
            [
              "The lovely details",
              `${p.material}. Designed for everyday comfort with a little extra thought in every stitch.`,
            ],
            ["Care for your softness", p.care],
            [
              "Shipping & delivery",
              "Complimentary standard delivery on orders of ₹2,990 and above. Otherwise ₹99. Delivery estimates are confirmed when fulfillment is configured. Your order is packed discreetly.",
            ],
            [
              "Returns & hygiene",
              "For hygiene reasons, opened intimate bottoms, shapewear, and personal-care products cannot be returned unless defective. Eligible unworn items with tags may be requested for return within 14 days of delivery.",
            ],
          ].map(([title, body]) => (
            <details className="accordion" key={title}>
              <summary>{title}</summary>
              <p>{body}</p>
            </details>
          ))}
        </div>
      </div>
      <section className="review-section">
        <span className="eyebrow">HONEST WORDS, FROM REAL CUSTOMERS</span>
        <h2>How it feels.</h2>
        {reviews.length ? (
          reviews.map((r) => (
            <div key={r.id} className="panel">
              <strong>
                {r.name} · {r.rating}/5 · Verified purchase
              </strong>
              <p>{r.body}</p>
            </div>
          ))
        ) : (
          <p>
            No reviews just yet. Your experience could be the first. Reviews are
            accepted after a verified delivery.
          </p>
        )}
        {user && (
          <form
            className="panel"
            style={{ marginTop: 25, maxWidth: 600 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = Object.fromEntries(new FormData(form));
              try {
                await api("reviews", {
                  product_id: p.id,
                  rating: Number(data.rating),
                  body: data.body,
                });
                setReviews(
                  await api<typeof reviews>("reviews?product=" + p.id),
                );
                form.reset();
                toast("Thank you for sharing your honest experience.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <h3 style={{ marginBottom: 15 }}>Your honest words.</h3>
            <p style={{ marginBottom: 15 }}>
              Reviews are available to customers with a delivered purchase of
              this piece.
            </p>
            <label className="field">
              Your rating
              <select name="rating" required defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option value={n} key={n}>
                    {n} out of 5
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginTop: 15 }}>
              How did it feel?
              <textarea name="body" required minLength={10} maxLength={2000} />
            </label>
            <button className="button outline" style={{ marginTop: 20 }}>
              Share my review
            </button>
          </form>
        )}
      </section>
      {related.length > 0 && (
        <section style={{ paddingTop: 30 }}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">LOVELY TOGETHER</span>
              <h2>
                A little more to <em>love.</em>
              </h2>
            </div>
          </div>
          <div className="product-grid">
            {related.map((r, i) => (
              <ProductCard product={r} key={r.id} index={i} />
            ))}
          </div>
        </section>
      )}
      <Dialog open={zoom} onClose={() => setZoom(false)} title={p.title}>
        <img src={image} alt={p.title + " enlarged"} className="zoom-photo" />
      </Dialog>
    </div>
  );
}
