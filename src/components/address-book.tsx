"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Address, SavedAddress } from "@/lib/types";
import { api } from "./store-provider";

export function AddressFields({
  value,
  prefix = "",
}: {
  value?: Address;
  prefix?: string;
}) {
  return (
    <div className="form-grid">
      {[
        ["name", "Full name", "name", true],
        ["phone", "Mobile number", "tel", true],
        ["line1", "Street address", "address-line1", true],
        ["line2", "Apartment / floor (optional)", "address-line2", false],
        ["landmark", "Landmark (optional)", "off", false],
        ["city", "City", "address-level2", true],
        ["state", "State / union territory", "address-level1", true],
        ["postal", "PIN code", "postal-code", true],
      ].map(([key, label, autoComplete, required]) => {
        const name = String(key) as keyof Address;
        return (
          <label
            className={`field ${name === "line1" ? "wide" : ""}`}
            key={name}
          >
            {label}
            <input
              name={prefix + name}
              defaultValue={value?.[name] || ""}
              autoComplete={
                autoComplete === "off"
                  ? "off"
                  : `${prefix ? "billing" : "shipping"} ${autoComplete}`
              }
              required={Boolean(required)}
              minLength={
                required
                  ? name === "line1"
                    ? 5
                    : name === "postal"
                      ? 6
                      : name === "phone"
                        ? 10
                        : 2
                  : undefined
              }
              maxLength={
                name === "postal"
                  ? 6
                  : name === "phone"
                    ? 10
                    : name === "name" || name === "city" || name === "state"
                      ? 100
                      : name === "landmark"
                        ? 150
                        : 200
              }
              pattern={
                name === "postal"
                  ? "[1-9][0-9]{5}"
                  : name === "phone"
                    ? "[6-9][0-9]{9}"
                    : undefined
              }
              inputMode={
                name === "postal" || name === "phone" ? "numeric" : undefined
              }
            />
          </label>
        );
      })}
      <label className="field">
        Country
        <input value="India" readOnly aria-readonly="true" />
      </label>
      <input type="hidden" name={prefix + "country"} value="IN" />
    </div>
  );
}

export function AddressBook() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<SavedAddress["kind"]>("both");
  async function load() {
    setAddresses(await api<SavedAddress[]>("addresses"));
    setLoaded(true);
  }
  useEffect(() => {
    load().catch((error: Error) => setError(error.message));
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        editing ? `addresses/${editing.id}` : "addresses",
        {
          ...data,
          default_shipping: data.default_shipping === "on",
          default_billing: data.default_billing === "on",
        },
        editing ? "PATCH" : "POST",
      );
      await load();
      setEditing(null);
      setKind("both");
      form.reset();
      setMessage("Your address is saved.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
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
      {!loaded && !error && <p role="status">Loading your addresses…</p>}
      {loaded && !addresses.length && (
        <p>Your address book is ready for your first address.</p>
      )}
      {addresses.map((address) => (
        <article className="panel" key={address.id}>
          <strong>
            {address.label} · {address.content.name}
          </strong>
          <p>
            {address.content.line1}
            {address.content.line2 && `, ${address.content.line2}`}
            <br />
            {address.content.city}, {address.content.state}{" "}
            {address.content.postal}
            <br />
            {address.content.landmark && (
              <>
                {address.content.landmark}
                <br />
              </>
            )}
            India · {address.content.phone}
          </p>
          <p>
            {address.kind === "both"
              ? "Shipping & billing"
              : address.kind === "shipping"
                ? "Shipping"
                : "Billing"}
            {address.default_shipping && " · Default shipping"}
            {address.default_billing && " · Default billing"}
          </p>
          <div className="inline-checks">
            <button
              type="button"
              className="text-link"
              disabled={busy}
              aria-label={`Edit ${address.label} address`}
              onClick={() => {
                setEditing(address);
                setKind(address.kind);
                setError("");
                setMessage("");
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              aria-label={`Delete ${address.label} address`}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Delete your ${address.label} address? Existing orders retain their original address.`,
                  )
                )
                  return;
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  await api(`addresses/${address.id}`, {}, "DELETE");
                  await load();
                  if (editing?.id === address.id) {
                    setEditing(null);
                    setKind("both");
                  }
                  setMessage("Address deleted.");
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete
            </button>
            {(["shipping", "billing"] as const).map(
              (purpose) =>
                address.kind !==
                  (purpose === "shipping" ? "billing" : "shipping") &&
                !address[`default_${purpose}`] && (
                  <button
                    key={purpose}
                    type="button"
                    className="text-link"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      setMessage("");
                      try {
                        await api(
                          `addresses/${address.id}`,
                          {
                            ...address.content,
                            label: address.label,
                            kind: address.kind,
                            default_shipping: address.default_shipping,
                            default_billing: address.default_billing,
                            [`default_${purpose}`]: true,
                          },
                          "PATCH",
                        );
                        await load();
                        setMessage(`Default ${purpose} address updated.`);
                      } catch (error) {
                        setError((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Use for {purpose}
                  </button>
                ),
            )}
          </div>
        </article>
      ))}
      <form className="panel" key={editing?.id || "new"} onSubmit={save}>
        <h3>{editing ? `Edit ${editing.label}` : "Add an address"}</h3>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <label className="field">
              Address label
              <input
                name="label"
                required
                maxLength={50}
                defaultValue={editing?.label || "Home"}
              />
            </label>
            <label className="field">
              Use for
              <select
                name="kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as SavedAddress["kind"])
                }
              >
                <option value="both">Shipping & billing</option>
                <option value="shipping">Shipping only</option>
                <option value="billing">Billing only</option>
              </select>
            </label>
          </div>
          <AddressFields value={editing?.content} />
          <div className="inline-checks">
            {kind !== "billing" && (
              <label>
                <input
                  type="checkbox"
                  name="default_shipping"
                  defaultChecked={editing?.default_shipping}
                />
                Default shipping
              </label>
            )}
            {kind !== "shipping" && (
              <label>
                <input
                  type="checkbox"
                  name="default_billing"
                  defaultChecked={editing?.default_billing}
                />
                Default billing
              </label>
            )}
          </div>
          <button className="button dark" disabled={!loaded || busy}>
            {busy ? "Saving…" : "Save this address"}
          </button>
          {editing && (
            <button
              type="button"
              className="button outline"
              onClick={() => {
                setEditing(null);
                setKind("both");
              }}
            >
              Cancel editing
            </button>
          )}
        </fieldset>
      </form>
    </>
  );
}
