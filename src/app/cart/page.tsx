"use client";
import { BagContents } from "@/components/store-provider";
export default function Page() {
  return (
    <div className="page-shell cart-page">
      <span className="eyebrow">YOUR LITTLE LUXURIES</span>
      <h1>Your lovely bag.</h1>
      <BagContents full />
    </div>
  );
}
