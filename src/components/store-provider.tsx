"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem, Product, User, Variant } from "@/lib/types";
import { money } from "@/lib/types";
import {
  X,
  Minus,
  Plus,
  ArrowRight,
  ShoppingBag,
  Check,
  Heart,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method?: "POST" | "PATCH" | "DELETE",
): Promise<T> {
  const r = await fetch("/api/" + path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new ApiError(data.error || "Please try again", r.status, data.code);
  return data;
}
type Store = {
  cart: CartItem[];
  user: User | null;
  refresh: () => Promise<void>;
  add: (variant: Variant, quantity?: number) => Promise<void>;
  setQuantity: (variant: string, quantity: number) => Promise<void>;
  bagOpen: boolean;
  setBagOpen: (v: boolean) => void;
  quick: Product | null;
  setQuick: (p: Product | null) => void;
  toast: (s: string) => void;
  wishlist: string[];
  toggleWishlist: (p: Product) => Promise<void>;
};
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const toast = useCallback((s: string) => setNotice(s), []);
  const refresh = useCallback(async () => {
    const [c, u] = await Promise.all([
      api<{ items: CartItem[] }>("cart"),
      api<{ user: User | null }>("me"),
    ]);
    setCart(c.items);
    setUser(u.user);
    if (u.user) setWishlist(await api<string[]>("wishlist"));
    else setWishlist([]);
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const setQuantity = async (variant_id: string, quantity: number) => {
    await api("cart", { variant_id, quantity });
    await refresh();
  };
  const add = async (v: Variant, q = 1) => {
    await api("cart", {
      variant_id: v.id,
      quantity: q,
      operation: "increment",
    });
    await refresh();
    setQuick(null);
    setBagOpen(true);
  };
  const toggleWishlist = async (p: Product) => {
    if (!user) {
      toast("Sign in to keep your favourites close.");
      window.location.href = "/account?next=/wishlist";
      return;
    }
    await api("wishlist", { product_id: p.id });
    setWishlist(await api<string[]>("wishlist"));
  };
  return (
    <Context.Provider
      value={{
        cart,
        user,
        refresh,
        add,
        setQuantity,
        bagOpen,
        setBagOpen,
        quick,
        setQuick,
        toast,
        wishlist,
        toggleWishlist,
      }}
    >
      <>
        {children}
        <BagDrawer />
        {quick && <ProductQuickView key={quick.id} product={quick} />}
        {notice && (
          <div role="status" className="toast">
            <Check size={17} />
            {notice}
          </div>
        )}
      </>
    </Context.Provider>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    if (!node) return;
    if (open) {
      const origin =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      node.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        node.close();
        document.body.style.overflow = previous;
        if (origin?.isConnected) origin.focus();
      };
    }
  }, [open, node]);
  if (!open) return null;
  return (
    <dialog
      ref={setNode}
      className={drawer ? "dialog drawer" : "dialog"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function BagContents({ full = false }: { full?: boolean }) {
  const { cart, setQuantity, setBagOpen, toast } = useStore();
  const router = useRouter();
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0);
  return (
    <>
      {cart.length ? (
        <>
          <div className="bag-progress">
            <p>
              {total >= 299000
                ? "Your order qualifies for complimentary shipping."
                : `You’re ${money(299000 - total)} away from complimentary shipping.`}
            </p>
            <span>
              <i
                style={{ width: `${Math.min((total / 299000) * 100, 100)}%` }}
              />
            </span>
          </div>
          <div className="bag-items">
            {cart.map((c) => (
              <div className="bag-item" key={c.variant_id}>
                <img src={c.image} alt={c.title} />
                <div>
                  <h3>{c.title}</h3>
                  <p>
                    {c.color} / {c.size}
                  </p>
                  <strong>{money(c.price)}</strong>
                  <div className="quantity">
                    <button
                      aria-label={`Decrease ${c.title}`}
                      onClick={() =>
                        setQuantity(c.variant_id, c.quantity - 1).catch((e) =>
                          toast(e.message),
                        )
                      }
                    >
                      <Minus size={13} />
                    </button>
                    <span>{c.quantity}</span>
                    <button
                      aria-label={`Increase ${c.title}`}
                      disabled={c.quantity >= c.stock}
                      onClick={() =>
                        setQuantity(c.variant_id, c.quantity + 1).catch((e) =>
                          toast(e.message),
                        )
                      }
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <button
                  className="icon-button remove"
                  aria-label={`Remove ${c.title}`}
                  onClick={() =>
                    setQuantity(c.variant_id, 0).catch((e) => toast(e.message))
                  }
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="bag-summary">
            <div>
              <span>Subtotal</span>
              <strong>{money(total)}</strong>
            </div>
            <p>
              Shipping calculated at checkout. Displayed prices are tax
              inclusive.
            </p>
            <button
              className="button dark full"
              onClick={() => {
                setBagOpen(false);
                router.push("/checkout");
              }}
            >
              Checkout securely <ArrowRight size={16} />
            </button>
            {!full && (
              <Link
                className="text-link centered"
                href="/cart"
                onClick={() => setBagOpen(false)}
              >
                View your bag
              </Link>
            )}
            <small>
              <ShieldCheck size={14} /> Secure checkout · Discreet packaging
            </small>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={42} strokeWidth={1} />
          <h3>A little room for softness.</h3>
          <p>Your next favourite is waiting to be found.</p>
          <Link
            href="/shop"
            className="button dark"
            onClick={() => setBagOpen(false)}
          >
            Explore the collection <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}
function BagDrawer() {
  const { bagOpen, setBagOpen, cart } = useStore();
  return (
    <Dialog
      open={bagOpen}
      onClose={() => setBagOpen(false)}
      title={`Your bag (${cart.reduce((s, x) => s + x.quantity, 0)})`}
      drawer
    >
      <BagContents />
    </Dialog>
  );
}
function ProductQuickView({ product: p }: { product: Product }) {
  const { setQuick } = useStore();
  return (
    <Dialog open onClose={() => setQuick(null)} title="A closer look">
      <div className="quick-grid">
        <img src={p.image} alt={p.title} />
        <div>
          <span className="eyebrow">SKY PETAL ESSENTIALS</span>
          <h2 className="serif">{p.title}</h2>
          <p>{p.description}</p>
          <VariantPicker product={p} />
          <Link
            href={"/products/" + p.slug}
            className="text-link"
            onClick={() => setQuick(null)}
          >
            All the lovely details <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </Dialog>
  );
}
export function VariantPicker({ product: p }: { product: Product }) {
  const { add, toast, toggleWishlist, wishlist } = useStore();
  const [color, setColor] = useState(p.variants[0]?.color || "");
  const [size, setSize] = useState("");
  const [q, setQ] = useState(1);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState(false);
  const variant = p.variants.find((v) => v.color === color && v.size === size);
  const colors = [...new Map(p.variants.map((v) => [v.color, v])).values()];
  const sizes = [...new Set(p.variants.map((v) => v.size))].sort(
    (a, b) =>
      ["XS", "S", "M", "L", "XL", "XXL"].indexOf(a) -
      ["XS", "S", "M", "L", "XL", "XXL"].indexOf(b),
  );
  return (
    <div className="variant-picker">
      <div className="price">
        {money(variant?.price || p.variants[0]?.price || 0)}{" "}
        {p.variants[0]?.compare_price && (
          <del>{money(p.variants[0].compare_price)}</del>
        )}
      </div>
      <div className="variant-label">
        Colour <span>{color}</span>
      </div>
      <div className="swatches">
        {colors.map((v) => (
          <button
            key={v.color}
            style={{ backgroundColor: v.color_hex }}
            className={color === v.color ? "selected" : ""}
            aria-label={v.color}
            aria-pressed={color === v.color}
            onClick={() => {
              setColor(v.color);
              setSize("");
            }}
          />
        ))}
      </div>
      <div className="variant-label">
        Select your size{" "}
        <button className="text-link" onClick={() => setFit(true)}>
          Size guide
        </button>
      </div>
      <div className="sizes">
        {sizes.map((s) => {
          const v = p.variants.find((v) => v.color === color && v.size === s);
          return (
            <button
              key={s}
              disabled={!v || v.stock === 0}
              aria-pressed={size === s}
              className={size === s ? "selected" : ""}
              onClick={() => setSize(s)}
            >
              {s}
            </button>
          );
        })}
      </div>
      {variant && (
        <p className="stock-note">
          {variant.stock > 0
            ? `${variant.stock < 5 ? "Only " + variant.stock + " left" : "In stock"} · Ready for a little everyday luxury`
            : "This size is currently sold out"}
        </p>
      )}
      <div className="add-row">
        <div className="quantity">
          <button
            aria-label="Decrease quantity"
            disabled={q <= 1}
            onClick={() => setQ(q - 1)}
          >
            <Minus size={15} />
          </button>
          <span>{q}</span>
          <button
            aria-label="Increase quantity"
            disabled={q >= Math.min(variant?.stock || 20, 20)}
            onClick={() => setQ(q + 1)}
          >
            <Plus size={15} />
          </button>
        </div>
        <button
          className="button dark"
          disabled={!variant || !variant.stock || busy}
          onClick={async () => {
            if (!variant) return;
            setBusy(true);
            try {
              await add(variant, q);
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Adding…" : !size ? "Choose your size" : "Add to bag"}{" "}
          <ShoppingBag size={16} />
        </button>
        <button
          className="wishlist-button"
          aria-label="Save to wishlist"
          aria-pressed={wishlist.includes(p.id)}
          onClick={() => toggleWishlist(p).catch((e) => toast(e.message))}
        >
          <Heart
            size={20}
            fill={wishlist.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <Dialog
        open={fit}
        onClose={() => setFit(false)}
        title="Find your feel-good fit"
      >
        <p>
          Measure around the fullest part of your bust and your natural waist.
          This is a general clothing guide; product measurements may vary.
        </p>
        <table className="size-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Bust (cm)</th>
              <th>Waist (cm)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["XS", "78–83", "60–65"],
              ["S", "84–89", "66–71"],
              ["M", "90–95", "72–77"],
              ["L", "96–101", "78–83"],
              ["XL", "102–109", "84–91"],
              ["XXL", "110–117", "92–99"],
            ].map((r) => (
              <tr key={r[0]}>
                {r.map((c) => (
                  <td key={c}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p>Between sizes? Choose the larger size for a relaxed feel.</p>
      </Dialog>
    </div>
  );
}
