"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  UserRound,
  Heart,
  ShoppingBag,
  Menu,
  ArrowRight,
  Flower2,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { api, useStore, Dialog } from "./store-provider";
export function Logo() {
  return (
    <Link className="logo" href="/">
      SKY
      <span className="logo-flower">
        <Flower2 size={23} strokeWidth={1} />
      </span>
      PETAL<span className="logo-caption">SOFTNESS, IN EVERY SENSE.</span>
    </Link>
  );
}
const links = [
  ["New in", "/shop?new=true"],
  ["Lingerie", "/shop?category=lingerie"],
  ["Bras & bralettes", "/shop?category=bras"],
  ["Sleep & lounge", "/shop?category=sleepwear"],
  ["Self-care", "/shop?category=wellness"],
  ["Our world", "/about"],
];
export function Header() {
  const { cart, setBagOpen, user } = useStore();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState(
    "A little something for you — 10% off your first order with SOFT10",
  );
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    setMobile(false);
    setShopOpen(false);
  }, [path]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 60);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    api<{ announcement: string }>("home")
      .then((x) => x.announcement && setAnnouncement(x.announcement))
      .catch(() => {});
  }, []);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        <span>{announcement}</span>
        <Link href="/shop">
          Find your little luxury <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className={`header${scrolled ? " is-scrolled" : ""}`}>
        <div className="header-main">
          <div className="header-left">
            <button
              className="icon-button mobile-only"
              aria-label="Open menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <Logo />
          </div>
          <div className="header-mobile-logo">
            <Logo />
          </div>
          <nav className="main-nav" aria-label="Main navigation">
            <Link href="/">Home</Link>
            <button
              onClick={() => setShopOpen(true)}
              aria-expanded={shopOpen}
              aria-haspopup="dialog"
            >
              Shop <ChevronDown size={10} />
            </button>
            <Link href="/#collections">Collections</Link>
            <Link href="/about">Our story</Link>
            <Link href="/shop?category=wellness">Wellness</Link>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Search products"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </button>
            <Link
              className="icon-button desktop-only"
              href="/account"
              aria-label={user ? "Your account" : "Sign in"}
            >
              <UserRound size={19} />
            </Link>
            <Link
              className="icon-button desktop-only"
              href="/wishlist"
              aria-label="Wishlist"
            >
              <Heart size={19} />
            </Link>
            <button
              className="icon-button bag-button"
              aria-label={`Open bag, ${cart.reduce((s, x) => s + x.quantity, 0)} items`}
              onClick={() => setBagOpen(true)}
            >
              <ShoppingBag size={19} />
              <span>{cart.reduce((s, x) => s + x.quantity, 0)}</span>
            </button>
          </div>
        </div>
      </header>
      <Dialog
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        title="A world of softness"
      >
        <div className="mega-menu">
          <nav className="mega-menu-nav" aria-label="Shop collections">
            {[
              ["All the lovely things", "/shop"],
              ...links.slice(0, 5),
              ["Panties", "/shop?category=panties"],
              ["Bodysuits", "/shop?category=bodysuits"],
            ].map(([title, url]) => (
              <Link key={url} href={url} onClick={() => setShopOpen(false)}>
                {title}
                <ArrowUpRight size={18} strokeWidth={1} />
              </Link>
            ))}
          </nav>
          <Link
            className="mega-menu-image"
            href="/shop?category=lingerie"
            onClick={() => setShopOpen(false)}
          >
            <img
              src="/images/petal-editorial.webp"
              alt="The Petal Edit, a collection of soft silk pieces"
            />
            <span>DISCOVER THE PETAL EDIT ↗</span>
          </Link>
        </div>
      </Dialog>
      <Dialog
        open={mobile}
        onClose={() => setMobile(false)}
        title="A world of softness"
        drawer
      >
        <nav className="mobile-nav">
          {links.map(([title, url]) => (
            <Link key={url} href={url} onClick={() => setMobile(false)}>
              {title}
              <ArrowRight size={18} />
            </Link>
          ))}
          <Link href="/account" onClick={() => setMobile(false)}>
            My account
          </Link>
          <Link href="/wishlist" onClick={() => setMobile(false)}>
            Wishlist
          </Link>
        </nav>
      </Dialog>
      <Dialog
        open={search}
        onClose={() => setSearch(false)}
        title="Find something lovely"
      >
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(false);
            router.push("/shop?q=" + encodeURIComponent(query));
          }}
        >
          <Search size={21} />
          <input
            aria-label="Search products"
            placeholder="Try silk, bralette, or a little self-care…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button aria-label="Search" className="icon-button">
            <ArrowRight size={20} />
          </button>
        </form>
        <p className="muted">
          A few favourites:{" "}
          <Link href="/shop?category=bras" onClick={() => setSearch(false)}>
            soft bralettes
          </Link>
          ,{" "}
          <Link
            href="/shop?category=sleepwear"
            onClick={() => setSearch(false)}
          >
            silk sleepwear
          </Link>
          ,{" "}
          <Link href="/shop?category=wellness" onClick={() => setSearch(false)}>
            everyday rituals
          </Link>
        </p>
      </Dialog>
    </>
  );
}
export function Footer() {
  const { toast } = useStore();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [unsubscribeToken, setUnsubscribeToken] = useState("");
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <>
      <section className="newsletter">
        <Flower2 size={30} strokeWidth={1} />
        <span className="eyebrow">LET’S KEEP IN TOUCH</span>
        <h2>A little softness in your inbox.</h2>
        <p>New collections, thoughtful reads & little things just for you.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!consent) return;
            setBusy(true);
            setFeedback("");
            setFailed(false);
            try {
              const r = await api<{
                message: string;
                unsubscribe_token: string;
              }>("newsletter", { email, consent });
              setUnsubscribeToken(r.unsubscribe_token);
              toast(r.message);
              setFeedback(r.message);
              setEmail("");
            } catch (e) {
              toast((e as Error).message);
              setFeedback((e as Error).message);
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="newsletter-email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for newsletter"
              placeholder="Your email address"
            />
            <button aria-label="Subscribe to newsletter" disabled={busy}>
              {busy ? "…" : <ArrowRight size={19} />}
            </button>
          </div>
          <label className="newsletter-consent">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I’d like collection updates and thoughtful stories from Sky-Petal.
              I agree to the{" "}
              <Link href="/policies/privacy">privacy policy</Link> and can
              unsubscribe anytime.
            </span>
          </label>
        </form>
        {feedback && (
          <div
            className="newsletter-feedback"
            role={failed ? "alert" : "status"}
            data-error={failed}
          >
            {feedback}
          </div>
        )}
        {unsubscribeToken && (
          <button
            className="text-link"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api<{ message: string }>(
                  "newsletter/unsubscribe",
                  { token: unsubscribeToken },
                );
                setFeedback(result.message);
                setFailed(false);
                setUnsubscribeToken("");
                setConsent(false);
              } catch (error) {
                setFeedback((error as Error).message);
                setFailed(true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Unsubscribe from newsletter
          </button>
        )}
      </section>
      <footer>
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p>
              Made to feel like you.
              <br />
              Beautifully, comfortably, unapologetically.
            </p>
            <Link href="/contact" className="text-link">
              Let’s stay close <ArrowUpRight size={14} />
            </Link>
          </div>
          <div>
            <h3>EXPLORE</h3>
            <Link href="/shop">Shop all</Link>
            <Link href="/shop?new=true">New arrivals</Link>
            <Link href="/shop?category=wellness">Self-care</Link>
            <Link href="/about">Our story</Link>
          </div>
          <div>
            <h3>WE’RE HERE FOR YOU</h3>
            <Link href="/fit-guide">Size & fit guide</Link>
            <Link href="/policies/shipping">Shipping & delivery</Link>
            <Link href="/policies/returns">Returns & exchanges</Link>
            <Link href="/contact">Contact us</Link>
          </div>
          <div>
            <h3>THE LITTLE DETAILS</h3>
            <Link href="/account">My account</Link>
            <Link href="/policies/privacy">Privacy policy</Link>
            <Link href="/policies/terms">Terms of service</Link>
            <Link href="/admin">Team access</Link>
          </div>
        </div>
        <div className="footer-grand-wordmark" aria-hidden="true">
          SKY-PETAL
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Sky Petal. All things soft.</span>
          <span>Crafted with care, for every body.</span>
          <div>
            <span>INDIA / INR ₹</span>
            <Link href="/policies/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
