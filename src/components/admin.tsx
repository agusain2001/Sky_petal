"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Download,
  RefreshCw,
  Upload,
  Flower2,
} from "lucide-react";
import { api, useStore, Dialog } from "./store-provider";
import { money, type Product, type Variant, type Order } from "@/lib/types";
import { PaymentOperations } from "./payment-operations";
import { CommerceSettings } from "./commerce-settings";
import { CodOperations } from "./cod-operations";
import { SupportCenter } from "./support-center";
import { ReturnsCenter, RefundOperations } from "./returns-center";
import { BackgroundOperations } from "./background-operations";
import { ShippingOperations } from "./shipping-operations";
import { InvoiceDocuments } from "./invoice-documents";
import { PrivacyRequests } from "./privacy-requests";
import { ReleaseChecks } from "./release-checks";
type Data = {
  products: Product[];
  orders: Order[];
  revenue: number;
  customers: string;
  home: Record<string, string>;
};
const categories = [
  "bras",
  "lingerie",
  "sleepwear",
  "panties",
  "loungewear",
  "bodysuits",
  "shapewear",
  "accessories",
  "wellness",
];
export function Admin() {
  const { user, toast } = useStore();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Catalog");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [variant, setVariant] = useState<Partial<Variant> | null>(null);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState("/images/bralette.webp");
  async function load() {
    try {
      setData(await api<Data>("admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, [user]);
  useEffect(() => {
    if (user?.role === "finance") setTab("COD");
  }, [user?.role]);
  const allowed =
    user &&
    [
      "owner",
      "administrator",
      "catalog_editor",
      "fulfillment",
      "support",
      "finance",
      "marketing",
    ].includes(user.role);
  if (!allowed)
    return (
      <div className="empty-state page-shell">
        <Flower2 size={38} strokeWidth={1} />
        <span className="eyebrow">SKY PETAL / TEAM ACCESS</span>
        <h1>A space for our team.</h1>
        <p>
          Sign in with a team account to manage your store. Customer accounts
          cannot access store administration.
        </p>
        <Link className="button dark" href="/account?next=/admin">
          Team sign in <ArrowUpRight size={15} />
        </Link>
        <p className="dev-note">
          The local store owner is provisioned with the setup command documented
          in README.md.
        </p>
      </div>
    );
  const canEdit = ["owner", "administrator", "catalog_editor"].includes(
    user.role,
  );
  const canFulfill = ["owner", "administrator", "fulfillment"].includes(
    user.role,
  );
  return (
    <div className="admin-shell">
      <div className="admin-header">
        <div>
          <span className="eyebrow">SKY PETAL / THE STUDIO</span>
          <h1>A lovely day to grow.</h1>
          <p>
            Welcome, {user.name}. Your role: {user.role.replaceAll("_", " ")}.
          </p>
        </div>
        <Link href="/" className="button outline">
          Visit storefront <ArrowUpRight size={14} />
        </Link>
      </div>
      {error && (
        <div className="form-error">
          {error}
          {error.includes("MFA") && (
            <Link href="/account/security"> Verify team access</Link>
          )}
          <button onClick={load}> Retry</button>
        </div>
      )}
      {!data ? (
        <div className="skeleton" style={{ height: 250 }} />
      ) : (
        <>
          {user.role !== "finance" && (
            <div className="admin-metrics">
              {[
                ["Captured prepaid (all time)", money(data.revenue)],
                ["Recent orders (up to 100)", String(data.orders.length)],
                ["Customers", data.customers],
                [
                  "Low-stock SKUs",
                  String(
                    data.products
                      .flatMap((p) => p.variants)
                      .filter((v) => v.stock < 5).length,
                  ),
                ],
              ].map(([title, value]) => (
                <div className="metric" key={title}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          <div
            className="admin-tabs"
            role="tablist"
            aria-label="Administration"
          >
            {(user.role === "finance"
              ? ["COD", "Refunds", "Invoices"]
              : [
                  "Catalog",
                  "Inventory",
                  "Orders",
                  ...(canFulfill ? ["Shipping"] : []),
                  "Homepage",
                  "Offers",
                  ...([
                    "owner",
                    "administrator",
                    "support",
                    "fulfillment",
                  ].includes(user.role)
                    ? ["Returns"]
                    : []),
                  ...(["owner", "administrator"].includes(user.role)
                    ? ["Refunds", "Background work"]
                    : []),
                  ...(canEdit ? ["Commerce"] : []),
                  ...(["owner", "administrator", "finance"].includes(user.role)
                    ? ["COD"]
                    : []),
                  ...(["owner", "administrator", "support"].includes(user.role)
                    ? ["Support"]
                    : []),
                  ...(["owner", "administrator"].includes(user.role)
                    ? ["Payments", "Invoices", "Privacy", "Release checks"]
                    : []),
                ]
            ).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={t === tab}
                className={t === tab ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Payments" && <PaymentOperations />}
          {tab === "Invoices" && <InvoiceDocuments />}
          {tab === "Privacy" && <PrivacyRequests staff />}
          {tab === "Release checks" && <ReleaseChecks />}
          {tab === "Returns" && <ReturnsCenter staff />}
          {tab === "Refunds" && <RefundOperations />}
          {tab === "Background work" && <BackgroundOperations />}
          {tab === "Shipping" && <ShippingOperations />}
          {tab === "Commerce" && (
            <CommerceSettings
              products={data.products}
              canConfigure={["owner", "administrator"].includes(user.role)}
            />
          )}
          {tab === "COD" && <CodOperations />}
          {tab === "Support" && <SupportCenter staff embedded />}
          {tab === "Catalog" && (
            <>
              <div className="toolbar">
                <input
                  aria-label="Search catalog"
                  placeholder="Find a product…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    className="icon-button"
                    aria-label="Export catalog CSV"
                    onClick={() => {
                      const rows = [
                        ["id", "title", "slug", "category", "published"],
                        ...data.products.map((p) => [
                          p.id,
                          p.title,
                          p.slug,
                          p.category,
                          String(p.published),
                        ]),
                      ];
                      const csv = rows
                        .map((r) =>
                          r
                            .map(
                              (s) =>
                                '"' + String(s).replaceAll('"', '""') + '"',
                            )
                            .join(","),
                        )
                        .join("\n");
                      const url = URL.createObjectURL(
                        new Blob([csv], { type: "text/csv" }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "sky-petal-catalog.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={17} />
                  </button>
                  {canEdit && (
                    <button
                      className="button dark"
                      onClick={() => {
                        setImage("/images/bralette.webp");
                        setEditing({
                          category: "bras",
                          featured: false,
                          is_new: true,
                          published: false,
                        });
                      }}
                    >
                      <Plus size={15} />
                      Add product
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>CATEGORY</th>
                      <th>PRICE FROM</th>
                      <th>SKUS</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products
                      .filter((p) =>
                        p.title.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="table-product">
                              <img src={p.image} alt="" />
                              <span>{p.title}</span>
                            </div>
                          </td>
                          <td>{p.category}</td>
                          <td>
                            {p.variants.length
                              ? money(
                                  Math.min(...p.variants.map((v) => v.price)),
                                )
                              : "Add variants"}
                          </td>
                          <td>{p.variants.length}</td>
                          <td>
                            <span className="status">
                              {p.published ? "Published" : "Archived / draft"}
                            </span>
                          </td>
                          <td>
                            {canEdit ? (
                              <button
                                onClick={() => {
                                  setEditing(p);
                                  setImage(p.image);
                                }}
                              >
                                Edit product
                              </button>
                            ) : (
                              <span>View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "Inventory" && (
            <>
              <div className="toolbar">
                <p>Available stock excludes active checkout reservations.</p>
                <button
                  aria-label="Refresh inventory"
                  className="icon-button"
                  onClick={load}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PRODUCT / SKU</th>
                      <th>COLOUR</th>
                      <th>SIZE</th>
                      <th>PRICE</th>
                      <th>AVAILABLE</th>
                      <th>RESERVED</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.flatMap((p) =>
                      p.variants.map((v) => (
                        <tr key={v.id}>
                          <td>
                            {p.title}
                            <br />
                            <small className="muted">{v.sku}</small>
                          </td>
                          <td>{v.color}</td>
                          <td>{v.size}</td>
                          <td>{money(v.price)}</td>
                          <td
                            style={{
                              color: v.stock < 5 ? "#ae5d65" : undefined,
                            }}
                          >
                            {v.stock}
                          </td>
                          <td>{v.reserved}</td>
                          <td>
                            {canEdit && (
                              <button onClick={() => setVariant(v)}>
                                Edit SKU
                              </button>
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "Orders" &&
            (data.orders.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ORDER</th>
                      <th>PLACED</th>
                      <th>TOTAL</th>
                      <th>STATUS</th>
                      <th>PAYMENT / REFUND</th>
                      <th>FULFILLMENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id.slice(0, 8).toUpperCase()}</td>
                        <td>
                          {new Date(o.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td>{money(o.total)}</td>
                        <td>
                          <span className="status">
                            {o.order_state.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>
                          {o.payment_state} / {o.refund_state}
                          <br />
                          <small>Fulfillment: {o.fulfillment_state}</small>
                        </td>
                        <td>
                          {canFulfill &&
                            [
                              "paid",
                              "confirmed",
                              "processing",
                              "shipped",
                            ].includes(o.status) && (
                              <button
                                onClick={async () => {
                                  const next = {
                                    paid: "processing",
                                    confirmed: "processing",
                                    processing: "shipped",
                                    shipped: "delivered",
                                  }[o.status];
                                  const tracking =
                                    next === "shipped"
                                      ? window.prompt("Tracking reference:") ||
                                        ""
                                      : "";
                                  if (next === "shipped" && !tracking) return;
                                  try {
                                    await api("admin/order", {
                                      id: o.id,
                                      status: next,
                                      tracking,
                                      carrier: "Standard delivery",
                                    });
                                    await load();
                                    toast("Order updated.");
                                  } catch (e) {
                                    toast((e as Error).message);
                                  }
                                }}
                              >
                                {o.status === "paid" || o.status === "confirmed"
                                  ? "Start processing"
                                  : o.status === "processing"
                                    ? "Mark shipped"
                                    : "Mark delivered"}
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel empty-state">
                <h2>Your first order is on its way.</h2>
                <p>
                  Real orders and payment states will appear here. Revenue uses
                  captured payments only.
                </p>
              </div>
            ))}
          {tab === "Homepage" && (
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(
                    "admin/cms",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  await load();
                  toast("Your homepage is updated.");
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2 style={{ fontSize: 33, marginBottom: 25 }}>
                The words that welcome them.
              </h2>
              <div className="form-grid">
                {Object.entries(data.home).map(([key, value]) => (
                  <label
                    className={
                      "field " +
                      (["description", "storyBody", "announcement"].includes(
                        key,
                      )
                        ? "wide"
                        : "")
                    }
                    key={key}
                  >
                    {key.replace(/([A-Z])/g, " $1")}
                    <textarea
                      name={key}
                      defaultValue={value}
                      readOnly={!canEdit}
                    />
                  </label>
                ))}
              </div>
              {canEdit && (
                <button
                  className="button dark"
                  style={{ marginTop: 25 }}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Publish homepage updates"}
                </button>
              )}
            </form>
          )}
          {tab === "Offers" && (
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                try {
                  await api("admin/coupon", {
                    code: String(values.code).toUpperCase(),
                    percent: Number(values.percent),
                    active: values.active === "on",
                  });
                  toast("Offer saved.");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <h2 style={{ fontSize: 33, marginBottom: 25 }}>
                A little something extra.
              </h2>
              <div className="form-grid">
                <label className="field">
                  Offer code
                  <input
                    name="code"
                    required
                    pattern="[A-Za-z0-9]{3,30}"
                    placeholder="SOFT10"
                  />
                </label>
                <label className="field">
                  Discount (%)
                  <input
                    type="number"
                    name="percent"
                    min="1"
                    max="50"
                    required
                    defaultValue={10}
                  />
                </label>
              </div>
              <div className="inline-checks">
                <label>
                  <input type="checkbox" name="active" defaultChecked />
                  Active
                </label>
              </div>
              <button
                className="button dark"
                disabled={!["owner", "administrator"].includes(user.role)}
              >
                Save offer
              </button>
            </form>
          )}
        </>
      )}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "A little refinement." : "A new little luxury."}
      >
        {editing && (
          <>
            <form
              onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                setBusy(true);
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                try {
                  const r = await api<{ id: string }>("admin/product", {
                    ...values,
                    id: editing.id || undefined,
                    image,
                    images: String(values.gallery || "")
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                    featured: values.featured === "on",
                    is_new: values.is_new === "on",
                    published: values.published === "on",
                  });
                  await load();
                  const latest = await api<Data>("admin");
                  setData(latest);
                  setEditing(
                    latest.products.find((p) => p.id === r.id) || null,
                  );
                  toast("Product saved. Add or edit SKUs below.");
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                {[
                  ["title", "Product name"],
                  ["slug", "URL slug"],
                  ["material", "Material"],
                ].map(([key, label]) => (
                  <label key={key} className="field">
                    {label}
                    <input
                      name={key}
                      defaultValue={String(editing[key as keyof Product] || "")}
                      required
                    />
                  </label>
                ))}
                <label className="field">
                  Category
                  <select name="category" defaultValue={editing.category}>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="field wide">
                  Description
                  <textarea
                    name="description"
                    defaultValue={editing.description}
                    minLength={10}
                    required
                  />
                </label>
                <label className="field wide">
                  Care instructions
                  <textarea
                    name="care"
                    defaultValue={
                      editing.care ||
                      "Hand wash gently in cool water. Dry flat in shade."
                    }
                    required
                  />
                </label>
                <label className="field wide">
                  Image URL
                  <input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    required
                  />
                </label>
                <label className="field wide">
                  Gallery image URLs (one per line)
                  <textarea
                    name="gallery"
                    defaultValue={editing.images?.join("\n") || ""}
                  />
                </label>
                <label className="field wide">
                  Upload a product image (JPEG, PNG or WebP; max 5 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const form = new FormData();
                      form.set("file", f);
                      try {
                        const r = await fetch("/api/admin/media", {
                          method: "POST",
                          body: form,
                        });
                        const data = await r.json();
                        if (!r.ok) throw new Error(data.error);
                        setImage(data.url);
                        toast(
                          "Image uploaded. Save the product to publish it.",
                        );
                      } catch (e) {
                        toast((e as Error).message);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="inline-checks">
                {[
                  ["featured", "Featured"],
                  ["is_new", "New arrival"],
                  ["published", "Published"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      name={key}
                      defaultChecked={Boolean(editing[key as keyof Product])}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button className="button dark" disabled={busy}>
                {busy ? "Saving…" : "Save product"}
              </button>
            </form>
            {editing.id && (
              <div className="variant-editor">
                <div className="toolbar">
                  <h3>Sizes, colours & stock.</h3>
                  <button
                    className="button outline"
                    onClick={() =>
                      setVariant({
                        product_id: editing.id,
                        color: "Petal Rose",
                        color_hex: "#c99897",
                        size: "M",
                        stock: 0,
                        price: 189000,
                      })
                    }
                  >
                    <Plus size={14} />
                    Add SKU
                  </button>
                </div>
                {editing.variants?.map((v) => (
                  <div className="checkout-line" key={v.id}>
                    <span>
                      {v.color} / {v.size} · {money(v.price)} · {v.stock}{" "}
                      available
                    </span>
                    <button className="text-link" onClick={() => setVariant(v)}>
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Dialog>
      <Dialog
        open={variant !== null}
        onClose={() => setVariant(null)}
        title="Every lovely detail."
      >
        {variant && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              try {
                await api("admin/variant", {
                  ...values,
                  id: variant.id || undefined,
                  product_id: variant.product_id,
                  price: Math.round(Number(values.price) * 100),
                  stock: Number(values.stock),
                  weight_grams: values.weight_grams
                    ? Number(values.weight_grams)
                    : null,
                  compare_price: values.compare_price
                    ? Math.round(Number(values.compare_price) * 100)
                    : null,
                });
                await load();
                if (editing?.id) {
                  const latest = await api<Data>("admin");
                  setEditing(
                    latest.products.find((p) => p.id === editing.id) || null,
                  );
                }
                setVariant(null);
                toast("SKU and stock updated.");
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              {[
                ["sku", "SKU", "text", variant.sku || ""],
                ["color", "Colour name", "text", variant.color || ""],
                [
                  "color_hex",
                  "Colour hex",
                  "text",
                  variant.color_hex || "#c99897",
                ],
                ["size", "Size", "text", variant.size || ""],
                [
                  "price",
                  "Price (₹)",
                  "number",
                  String((variant.price || 0) / 100),
                ],
                [
                  "compare_price",
                  "Compare-at price (₹)",
                  "number",
                  variant.compare_price
                    ? String(variant.compare_price / 100)
                    : "",
                ],
                [
                  "stock",
                  "Available stock",
                  "number",
                  String(variant.stock || 0),
                ],
                [
                  "weight_grams",
                  "SKU weight (grams)",
                  "number",
                  variant.weight_grams ? String(variant.weight_grams) : "",
                ],
              ].map(([name, label, type, value]) => (
                <label className="field" key={name}>
                  {label}
                  <input
                    name={name}
                    type={type}
                    defaultValue={value}
                    min={0}
                    step={
                      type === "number" &&
                      ["price", "compare_price"].includes(name)
                        ? "0.01"
                        : "1"
                    }
                    required={
                      name !== "compare_price" && name !== "weight_grams"
                    }
                  />
                </label>
              ))}
            </div>
            <button
              className="button dark"
              style={{ marginTop: 25 }}
              disabled={busy}
            >
              Save SKU
            </button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
