"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { CommerceConfig } from "@/lib/commerce-config";
import type { Product } from "@/lib/types";
import { api } from "./store-provider";
type TaxClass = {
  id: string;
  name: string;
  hsn: string;
  rate_bps: number;
  active: boolean;
  valid_from: string;
  valid_until: string | null;
};
type Settings = { config: CommerceConfig; tax_classes: TaxClass[] };
export function CommerceSettings({
  products,
  canConfigure,
}: {
  products: Product[];
  canConfigure: boolean;
}) {
  const [data, setData] = useState<Settings | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<TaxClass | null>(null);
  async function load() {
    setData(await api<Settings>("admin/commerce"));
  }
  useEffect(() => {
    load().catch((error: Error) => setError(error.message));
  }, []);
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      await load();
      setMessage(message);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section>
        {error ? (
          <div className="form-error" role="alert">
            {error}
            <button
              onClick={() =>
                load().catch((error: Error) => setError(error.message))
              }
            >
              Retry
            </button>
          </div>
        ) : (
          <p role="status">Loading commerce settings…</p>
        )}
      </section>
    );
  return (
    <section>
      <h2>Checkout, tax & delivery</h2>
      <p>
        Set the merchant-approved tax and delivery rules. Checkout stays closed
        until its required configuration and product details are present.
      </p>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-success" role="status">
          {message}
        </div>
      )}
      {canConfigure && (
        <form
          className="panel"
          key={JSON.stringify(data.config)}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget),
            );
            const config = {
              ...data.config,
              ...Object.fromEntries(
                ["checkout_enabled", "prepaid_enabled", "cod_enabled"].map(
                  (key) => [key, values[key] === "on"],
                ),
              ),
              origin_pincode: String(values.origin_pincode),
              origin_state: String(values.origin_state),
              packaging_grams: Number(values.packaging_grams),
              shipping_tax_bps:
                values.shipping_tax_bps === ""
                  ? null
                  : Number(values.shipping_tax_bps),
              free_shipping_from_paise:
                values.free_shipping_from_paise === ""
                  ? null
                  : Math.round(Number(values.free_shipping_from_paise) * 100),
              cod_fee_paise: Math.round(Number(values.cod_fee_paise) * 100),
              cod_tax_bps:
                values.cod_tax_bps === "" ? null : Number(values.cod_tax_bps),
              cod_max_total_paise: Math.round(
                Number(values.cod_max_total_paise) * 100,
              ),
              cod_max_open_orders: Number(values.cod_max_open_orders),
              cod_allowed_pincodes: [
                ...new Set(
                  String(values.cod_allowed_pincodes)
                    .split(/[\s,]+/)
                    .filter(Boolean),
                ),
              ],
            };
            void run(
              () => api("admin/commerce", config),
              "Commerce settings saved.",
            );
          }}
        >
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <h3>Store rules</h3>
            <div className="form-grid">
              <label className="field">
                Origin PIN code
                <input
                  name="origin_pincode"
                  defaultValue={data.config.origin_pincode}
                  pattern="[1-9][0-9]{5}"
                  maxLength={6}
                />
              </label>
              <label className="field">
                Origin state / union territory
                <input
                  name="origin_state"
                  defaultValue={data.config.origin_state}
                  placeholder="Maharashtra"
                />
              </label>
              {[
                [
                  "packaging_grams",
                  "Packaging weight (grams)",
                  data.config.packaging_grams,
                  "1",
                ],
                [
                  "shipping_tax_bps",
                  "Shipping GST rate (basis points; 100 = 1%)",
                  data.config.shipping_tax_bps ?? "",
                  "1",
                ],
                [
                  "free_shipping_from_paise",
                  "Free delivery threshold (INR; blank disables)",
                  data.config.free_shipping_from_paise === null
                    ? ""
                    : data.config.free_shipping_from_paise / 100,
                  "0.01",
                ],
                [
                  "cod_fee_paise",
                  "COD customer fee (INR)",
                  data.config.cod_fee_paise / 100,
                  "0.01",
                ],
                [
                  "cod_tax_bps",
                  "COD fee GST rate (basis points)",
                  data.config.cod_tax_bps ?? "",
                  "1",
                ],
                [
                  "cod_max_total_paise",
                  "Maximum COD total (INR)",
                  data.config.cod_max_total_paise / 100,
                  "0.01",
                ],
                [
                  "cod_max_open_orders",
                  "Maximum open COD orders per customer",
                  data.config.cod_max_open_orders,
                  "1",
                ],
              ].map(([name, label, value, step]) => (
                <label className="field" key={name}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    name={String(name)}
                    step={String(step)}
                    defaultValue={value}
                  />
                </label>
              ))}
              <label className="field wide">
                Allowed COD PIN codes (comma or newline separated)
                <textarea
                  name="cod_allowed_pincodes"
                  defaultValue={data.config.cod_allowed_pincodes.join(", ")}
                />
              </label>
            </div>
            <div className="inline-checks">
              {[
                ["checkout_enabled", "Open checkout"],
                ["prepaid_enabled", "Enable prepaid"],
                ["cod_enabled", "Enable COD"],
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={Boolean(
                      data.config[key as keyof CommerceConfig],
                    )}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p>
              Courier credentials are configured on the server. Rates and
              serviceability are checked with Shiprocket; missing credentials
              never produce a successful delivery quote.
            </p>
            <button className="button dark" disabled={busy}>
              Save commerce settings
            </button>
          </fieldset>
        </form>
      )}
      <div className="panel">
        <h3>Tax classes</h3>
        <p>
          Product prices include the configured tax. No product tax rate is
          assumed.
        </p>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Configured tax classes"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>CLASS / HSN</th>
                <th>RATE</th>
                <th>ACTIVE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {data.tax_classes.map((tax) => (
                <tr key={tax.id}>
                  <td>
                    {tax.name} / {tax.hsn}
                  </td>
                  <td>{tax.rate_bps / 100}%</td>
                  <td>{tax.active ? "Yes" : "No"}</td>
                  <td>
                    {canConfigure && (
                      <button type="button" onClick={() => setEditing(tax)}>
                        Edit {tax.name}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {canConfigure && (
        <form
          className="panel"
          key={editing?.id || "new-tax"}
          onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget),
            );
            void run(async () => {
              await api("admin/tax-class", {
                ...values,
                id: editing?.id,
                rate_bps: Number(values.rate_bps),
                active: values.active === "on",
                valid_from: new Date(String(values.valid_from)).toISOString(),
                valid_until: values.valid_until
                  ? new Date(String(values.valid_until)).toISOString()
                  : null,
              });
              setEditing(null);
            }, "Tax class saved.");
          }}
        >
          <h3>{editing ? `Edit ${editing.name}` : "Add a tax class"}</h3>
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <div className="form-grid">
              <label className="field">
                Class name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={editing?.name}
                />
              </label>
              <label className="field">
                HSN
                <input
                  name="hsn"
                  required
                  pattern="[0-9]{4,8}"
                  defaultValue={editing?.hsn}
                />
              </label>
              <label className="field">
                GST rate (basis points)
                <input
                  name="rate_bps"
                  type="number"
                  required
                  min={0}
                  max={10000}
                  step={1}
                  defaultValue={editing?.rate_bps}
                />
              </label>
              <label className="field">
                Effective from
                <input
                  name="valid_from"
                  type="datetime-local"
                  required
                  defaultValue={
                    editing
                      ? new Date(
                          new Date(editing.valid_from).getTime() -
                            new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
              <label className="field">
                Effective until (optional)
                <input
                  name="valid_until"
                  type="datetime-local"
                  defaultValue={
                    editing?.valid_until
                      ? new Date(
                          new Date(editing.valid_until).getTime() -
                            new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
            </div>
            <div className="inline-checks">
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={editing?.active ?? true}
                />
                Active
              </label>
            </div>
            <button className="button dark" disabled={busy}>
              Save tax class
            </button>
            {editing && (
              <button
                type="button"
                className="button outline"
                onClick={() => setEditing(null)}
              >
                New class
              </button>
            )}
          </fieldset>
        </form>
      )}
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          void run(
            () =>
              api("admin/product-tax", {
                product_id: values.product_id,
                tax_class_id: values.tax_class_id || null,
              }),
            "Product tax mapping saved.",
          );
        }}
      >
        <h3>Assign a product tax class</h3>
        <div className="form-grid">
          <label className="field">
            Product
            <select name="product_id">
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Tax class
            <select name="tax_class_id">
              <option value="">Not configured</option>
              {data.tax_classes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} / {tax.hsn} / {tax.rate_bps / 100}%
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button outline" disabled={busy || !products.length}>
          Assign tax class
        </button>
      </form>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          void run(
            () =>
              api("admin/return-policy", {
                product_id: values.get("product_id"),
                return_window_days:
                  values.get("days") === "" ? null : Number(values.get("days")),
                sealed_return_required: values.has("sealed"),
              }),
            "Product return terms saved for future checkout quotes.",
          );
        }}
      >
        <h3>Product return terms</h3>
        <p>
          Use only merchant-approved terms. Leave the voluntary window blank
          until approved; defect and incorrect-item requests remain available
          for review. Existing order terms are preserved.
        </p>
        <label className="field">
          Product
          <select name="product_id">
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Voluntary return window in days (blank: pending; zero: excluded)
          <input name="days" type="number" min={0} max={365} />
        </label>
        <label>
          <input name="sealed" type="checkbox" /> Require intact hygiene seals
          for voluntary returns
        </label>
        <button className="button outline" disabled={busy || !products.length}>
          Save return terms
        </button>
      </form>
    </section>
  );
}
