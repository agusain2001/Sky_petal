"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "./responsive-image";

import {
  ArrowRight,
  ArrowUpRight,
  Flower2,
  Feather,
  Heart,
  Pause,
  Play,
  MoveDown,
  Plus,
  Minus,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { Dialog } from "./store-provider";
import { useEditorialMotion } from "./use-editorial-motion";
import { MagneticLink } from "./landing-interactions";

const Sculpture = dynamic(() => import("./petal-scene"), { ssr: false });
type Content = {
  eyebrow: string;
  headline: string;
  description: string;
  story: string;
  storyBody: string;
};

function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={`editorial-reveal ${className}`}>{children}</div>;
}

function useSectionVisible(
  ref: RefObject<HTMLElement | null>,
  margin: string,
  initial = false,
) {
  const [visible, setVisible] = useState(initial);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: margin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref, margin]);
  return visible;
}

const categories = [
  {
    title: "Bras & bralettes",
    note: "A softer kind of support.",
    image: "bralette",
    category: "bras",
  },
  {
    title: "Sleepwear",
    note: "For the art of slowing down.",
    image: "sleepwear",
    category: "sleepwear",
  },
  {
    title: "Lingerie sets",
    note: "A little something, just for you.",
    image: "set",
    category: "lingerie",
  },
];

export function Home({
  products,
  content,
}: {
  products: Product[];
  content: Content;
}) {
  const [tab, setTab] = useState("New arrivals");
  const [paused, setPaused] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);
  const [measure, setMeasure] = useState("underbust");
  const [systemReduced, setSystemReduced] = useState<boolean | null>(null);
  const [motionReady, setMotionReady] = useState(false);
  const reduced = !motionReady || systemReduced !== false;
  const hero = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  useEditorialMotion(page, paused || !!reduced);
  const silk = useRef<HTMLElement>(null);
  const silkVisible = useSectionVisible(silk, "120px");
  const heroVisible = useSectionVisible(hero, "100px", true);
  useEffect(() => {
    setMotionReady(true);
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setSystemReduced(motionMedia.matches);
    };
    update();
    motionMedia.addEventListener("change", update);
    return () => {
      motionMedia.removeEventListener("change", update);
    };
  }, []);
  const featured =
    tab === "Best loved"
      ? [...products].sort((a, b) => b.sales - a.sales).slice(0, 4)
      : tab === "Little rituals"
        ? products.filter((p) => p.category === "wellness")
        : products
            .filter((p) => p.featured && p.is_new)
            .concat(products.filter((p) => p.featured && !p.is_new))
            .slice(0, 4);
  const headline = content.headline.includes("superpower")
    ? ["Softness,", "in Every Form."]
    : content.headline.split("\n");
  return (
    <div
      ref={page}
      className="cinematic-home relative"
      data-paused={paused || !!reduced}
    >
      <div className="reading-progress" aria-hidden="true" />
      {!heroVisible && !reduced && (
        <button
          className="page-motion-control"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume page motion" : "Pause page motion"}
        </button>
      )}
      <section className="bloom-hero" ref={hero} aria-labelledby="hero-title">
        <div className="bloom-art">
          <Image
            src="/images/hero.webp"
            alt="Blush silk and ivory lace lingerie with a pink peony on softly sunlit satin"
            width={1536}
            height={1024}
            preload
            sizes="(max-width: 767px) 120vw, 70vw"
          />
        </div>
        <div className="bloom-atmosphere" />
        <div className="hero-editorial-label">INTIMATES. REIMAGINED.</div>
        <div className="bloom-copy">
          <span className="eyebrow">
            <i /> {content.eyebrow}
          </span>
          <h1 id="hero-title" aria-label={headline.join(" ")}>
            {headline.map((line, i) => (
              <span className="heading-mask" key={line}>
                <span className={i === 1 ? "italic" : ""}>{line}</span>
              </span>
            ))}
          </h1>
          <p>{content.description}</p>
          <div className="bloom-actions">
            <MagneticLink
              className="button dark magnetic-button"
              href="/shop"
              disabled={paused || !!reduced}
            >
              Explore collection <ArrowUpRight size={16} />
            </MagneticLink>
            <Link href="#our-world" className="text-link">
              Discover Sky-Petal <ArrowRight size={15} />
            </Link>
          </div>
          <div className="bloom-footnote">
            <Flower2 size={22} strokeWidth={0.75} />
            <span>
              Soft on your skin.
              <br />A little kinder to yourself.
            </span>
          </div>
        </div>
        <div className="bloom-hero-bottom">
          <Link href="#our-world" className="scroll-cue">
            <span className="scroll-cue-line">
              <MoveDown size={15} />
            </span>{" "}
            SCROLL TO FEEL
          </Link>
          <span className="hero-edition">01 — THE SOFTNESS ISSUE</span>
          <button
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
            className="motion-control"
          >
            {paused ? <Play size={11} /> : <Pause size={11} />}{" "}
            {paused ? "Resume ambient motion" : "Pause ambient motion"}
          </button>
        </div>
      </section>
      <div className="brand-ribbon">
        <span>Intimately considered</span>
        <Flower2 />
        <span>Beautifully comfortable</span>
        <Flower2 />
        <span>For every version of you</span>
        <Flower2 />
        <span>Everyday, extraordinary</span>
        <Flower2 />
      </div>
      <section className="feeling-story editorial-section" id="our-world">
        <Reveal className="feeling-heading">
          <span className="eyebrow">01 / OUR PHILOSOPHY</span>
          <h2>
            {content.story.split("\n").map((line, index) => (
              <span key={index} style={{ display: "block" }}>
                {line.split(" ").map((word, i) => (
                  <span className="story-word" key={i}>
                    {word}{" "}
                  </span>
                ))}
              </span>
            ))}
          </h2>
        </Reveal>
        <Reveal className="feeling-aside" delay={0.12}>
          <div className="feeling-still">
            <Image
              src="/images/hero.webp"
              alt="Lace, silk, and a pale peony in gentle sunlight"
              width={1536}
              height={1024}
              sizes="(max-width: 800px) 75px, 110px"
              loading="lazy"
            />
          </div>
          <p>
            {content.storyBody ||
              "Thoughtfully designed for your comfort, your confidence, and every beautiful version of you."}
          </p>
          <Link href="/about" className="text-link">
            A softer way of being <ArrowUpRight size={15} />
          </Link>
        </Reveal>
        <span className="feeling-annotation">A LOVE LETTER TO YOURSELF</span>
      </section>
      <section className="category-edit editorial-section" id="collections">
        <Reveal className="editorial-heading">
          <div>
            <span className="eyebrow">02 / FIND YOUR SOFTNESS</span>
            <h2>
              A world of <em>your own.</em>
            </h2>
          </div>
          <Link href="/shop" className="text-link">
            Explore all collections <ArrowUpRight size={16} />
          </Link>
        </Reveal>
        <div className="editorial-categories">
          {categories.map((c, i) => (
            <Reveal
              key={c.category}
              className={`category-piece category-piece-${i}`}
              delay={i * 0.08}
            >
              <Link
                href={`/shop?category=${c.category}`}
                className="editorial-category"
              >
                <div className="category-window">
                  <Image
                    src={`/images/${c.image}.webp`}
                    alt={c.title}
                    width={1024}
                    height={1280}
                    sizes="(max-width: 800px) 86vw, 28vw"
                    loading="lazy"
                  />
                  <span className="category-index">
                    0{i + 1} / THE COLLECTION
                  </span>
                  <span className="category-circle">
                    <ArrowUpRight size={24} strokeWidth={1} />
                  </span>
                </div>
                <div className="category-caption">
                  <h3>{c.title}</h3>
                  <span>{c.note}</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal className="category-directory">
          <span>AND A LITTLE MORE…</span>
          {[
            ["Panties", "panties"],
            ["Bodysuits", "bodysuits"],
            ["Loungewear", "loungewear"],
            ["Intimate wellness", "wellness"],
          ].map(([title, slug]) => (
            <Link key={slug} href={`/shop?category=${slug}`}>
              {title}
              <ArrowUpRight size={13} />
            </Link>
          ))}
        </Reveal>
      </section>
      <section className="petal-edit" id="petal-edit">
        <div className="petal-edit-photo">
          <Image
            src="/images/petal-editorial.webp"
            alt="Champagne silk sleepwear and a blush robe draped over a vintage chair in morning light"
            width={1536}
            height={1024}
            sizes="100vw"
            loading="lazy"
          />
        </div>
        <div className="petal-edit-grain" />
        <Reveal className="petal-edit-copy">
          <span className="eyebrow">THE NEW COLLECTION / NO. 01</span>
          <h2>
            The
            <br />
            <em>Petal Edit.</em>
          </h2>
          <p>
            Delicate by nature.
            <br />
            Extraordinary by feeling.
          </p>
          <MagneticLink
            href="/shop?category=lingerie"
            className="button light"
            disabled={paused || !!reduced}
          >
            Explore the collection <ArrowUpRight size={17} />
          </MagneticLink>
        </Reveal>
        <span className="petal-edit-note">A LITTLE ROMANCE, EVERY DAY.</span>
        <Flower2 className="edit-flower" size={150} strokeWidth={0.3} />
      </section>
      <section
        className="loved-section editorial-section"
        id="made-to-be-loved"
      >
        <Reveal className="editorial-heading">
          <div>
            <span className="eyebrow">03 / YOUR NEXT FAVOURITES</span>
            <h2>
              Made to be <em>loved.</em>
            </h2>
          </div>
          <Link href="/shop" className="text-link">
            Discover the lovely things <ArrowUpRight size={16} />
          </Link>
        </Reveal>
        <div className="edit-tabs" aria-label="Featured product selection">
          {["New arrivals", "Best loved", "Little rituals"].map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}>
              {t}
              {tab === t && <span />}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="product-selection">
          <div key={tab} className="product-grid">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
        <p className="catalog-editorial-note">
          An introduction to our world. Editorial imagery and sample collection.
        </p>
      </section>
      <section
        className="silk-experience"
        ref={silk}
        aria-labelledby="silk-title"
      >
        <span className="eyebrow silk-topline">04 / FEEL THE DIFFERENCE</span>
        <div className="silk-fallback" aria-hidden="true" />
        {silkVisible && !reduced && <Sculpture mode="silk" paused={paused} />}
        <Reveal className="silk-copy">
          <h2 id="silk-title">
            A little luxury.
            <br />
            <em>A lot of comfort.</em>
          </h2>
          <p>
            Softness isn’t just a detail.
            <br />
            It’s where everything begins.
          </p>
        </Reveal>
        <div className="silk-annotation one">
          <span /> A SOFTER TOUCH
        </div>
        <div className="silk-annotation two">
          <span /> THOUGHTFULLY CONSIDERED
        </div>
        <div className="silk-bottom">
          <span>
            {reduced ? "THE ART OF SOFTNESS" : "MOVE SLOWLY. FEEL THE FLOW."}
          </span>
          <Feather size={20} strokeWidth={1} />
          <span>AN ARTISTIC EXPLORATION OF SILK</span>
        </div>
      </section>
      <section className="fit-editorial editorial-section" id="fit">
        <Reveal className="fit-copy">
          <span className="eyebrow">05 / YOUR PERFECT KIND OF COMFORT</span>
          <h2>
            Beautifully yours.
            <br />
            <em>Perfectly fitted.</em>
          </h2>
          <p>
            Because a beautiful fit starts with you. A little guidance, a few
            simple measurements, and the confidence to find your comfort.
          </p>
          <button className="text-link" onClick={() => setFitOpen(true)}>
            Let’s find your fit <ArrowUpRight size={17} />
          </button>
        </Reveal>
        <Reveal className="fit-preview">
          <div className="fit-drawing">
            <svg viewBox="0 0 240 250" fill="none" aria-hidden="true">
              <path
                d="M80 25C89 40 83 60 60 65L39 70 31 113 63 128 72 198C91 219 149 219 168 198L177 128 209 113 201 70 180 65C157 60 151 40 160 25"
                stroke="currentColor"
                strokeWidth="1"
              />
              <path
                d="M63 83C72 143 168 143 177 83M75 181C101 164 139 164 165 181"
                stroke="currentColor"
                strokeWidth=".7"
                opacity=".45"
              />
              <path
                d={
                  measure === "underbust"
                    ? "M62 132 Q120 149 178 132"
                    : "M59 106 Q120 124 181 106"
                }
                stroke="#a5697a"
                strokeWidth="1.6"
                strokeDasharray="4 4"
              />
              <path
                d="M120 141V190"
                stroke="currentColor"
                opacity=".3"
                strokeWidth=".5"
              />
            </svg>
            <span className="measurement-tag">
              {measure === "underbust" ? "01 / UNDERBUST" : "02 / BUST"}
            </span>
          </div>
          <div className="fit-measure-buttons">
            {["underbust", "bust"].map((m, i) => (
              <button
                key={m}
                aria-pressed={measure === m}
                onClick={() => setMeasure(m)}
              >
                <span>0{i + 1}</span>
                {m === "underbust" ? "Your underbust" : "Your bust"}
                {measure === m ? <Minus size={15} /> : <Plus size={15} />}
              </button>
            ))}
          </div>
          <p aria-live="polite">
            {measure === "underbust"
              ? "Wrap a soft tape snugly around your ribcage, just beneath your bust. Keep it level and breathe naturally."
              : "Measure around the fullest part of your bust. Keep the tape level and relaxed, without compressing."}
          </p>
        </Reveal>
      </section>
      <section className="being-you">
        <div className="being-image">
          <Image
            src="/images/petal-editorial.webp"
            alt="A flowing blush robe and champagne sleepwear beside sunlit curtains"
            width={1536}
            height={1024}
            sizes="(max-width: 800px) 100vw, 50vw"
            loading="lazy"
          />
        </div>
        <Reveal className="being-copy">
          <Flower2 size={40} strokeWidth={0.7} />
          <span className="eyebrow">MORE THAN INTIMATES</span>
          <h2>
            The beauty
            <br />
            of being <em>you.</em>
          </h2>
          <p>
            No rules to follow. No one else to be. Just beautifully considered
            pieces for the body you live in and the life you make your own.
          </p>
          <Link href="/about" className="text-link">
            Discover our story <ArrowUpRight size={16} />
          </Link>
          <span className="being-signature">With love, Sky-Petal</span>
        </Reveal>
      </section>
      <section className="ritual-section editorial-section" id="wellness">
        <Reveal className="ritual-still">
          <div className="ritual-arch">
            <Image
              src="/images/wellness.webp"
              alt="Botanical body oil and a rose quartz stone on warm ivory limestone"
              width={1024}
              height={1280}
              sizes="(max-width: 800px) 76vw, 35vw"
              loading="lazy"
            />
          </div>
          <span>SMALL MOMENTS. BEAUTIFUL POSSIBILITIES.</span>
        </Reveal>
        <Reveal className="ritual-copy">
          <span className="eyebrow">06 / COME BACK TO YOURSELF</span>
          <h2>
            Your ritual
            <br />
            of <em>self-care.</em>
          </h2>
          <p>
            A pause. A deep breath. A moment that belongs only to you. Discover
            the little luxuries that make everyday rituals feel extraordinary.
          </p>
          <Link href="/shop?category=wellness" className="button outline">
            Explore little rituals <ArrowUpRight size={16} />
          </Link>
          <div className="ritual-details">
            <Feather size={18} strokeWidth={1} />
            <span>SLOW DOWN. SOFTEN. SIMPLY BE.</span>
          </div>
        </Reveal>
      </section>
      <section className="closing-note">
        <Flower2 size={28} strokeWidth={0.8} />
        <span className="eyebrow">A NOTE FROM SKY-PETAL</span>
        <Reveal>
          <h2>
            Here’s to feeling beautiful.
            <br />
            <em>On your own terms.</em>
          </h2>
        </Reveal>
        <Heart size={17} strokeWidth={1} />
      </section>
      <Dialog
        open={fitOpen}
        onClose={() => setFitOpen(false)}
        title="A little guidance. A beautiful fit."
      >
        <div className="fit-guide-intro">
          <Feather size={35} strokeWidth={0.8} />
          <p>
            Use a soft measuring tape and wear an unpadded bra. Keep the tape
            level around your body.
          </p>
          <ol>
            <li>
              <strong>Measure your underbust</strong>
              <p>
                Measure snugly beneath your bust, while breathing naturally.
              </p>
            </li>
            <li>
              <strong>Measure your bust</strong>
              <p>Measure loosely around the fullest part of your bust.</p>
            </li>
            <li>
              <strong>Compare your measurements</strong>
              <p>
                Check the guide for your chosen style. Fit varies between styles
                and fabrics; this preview does not calculate a size.
              </p>
            </li>
          </ol>
          <Link
            href="/fit-guide"
            className="button dark"
            onClick={() => setFitOpen(false)}
          >
            Explore the full fit guide <ArrowRight size={16} />
          </Link>
        </div>
      </Dialog>
    </div>
  );
}
