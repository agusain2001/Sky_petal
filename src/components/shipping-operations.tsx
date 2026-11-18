"use client";
import { useEffect, useState } from "react";
import { api } from "./store-provider";
type Booking = {
  id: string;
  order_id: string;
  stage: string;
  awb: string | null;
  carrier: string | null;
  label_url: string | null;
  manifest_url: string | null;
  delivery_state: string;
  last_error: string | null;
  pickup_reference: string | null;
};
export function ShippingOperations() {
  const [rows, setRows] = useState<Booking[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setRows(await api<Booking[]>("admin/shipments"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <h2>Courier execution</h2>
      <p>
        Begin with a packed order and a pickup location already approved in the
        courier account. Background processing verifies the provider amount,
        destination and method before assigning its quoted courier. Unknown
        create, AWB or pickup outcomes require reconciliation.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <button
        className="text-link"
        disabled={busy}
        onClick={() => void load().catch((e) => setError(e.message))}
      >
        Refresh shipments
      </button>
      <form
        className="panel"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api("admin/shipments", {
              order_id: data.get("order_id"),
              pickup_location: data.get("pickup_location"),
              length: Number(data.get("length")),
              breadth: Number(data.get("breadth")),
              height: Number(data.get("height")),
            });
            await load();
            setMessage(
              "Shipment request recorded. Courier processing runs through the protected maintenance worker.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend>Book a packed order</legend>
          <label className="field">
            Order ID
            <input name="order_id" required />
          </label>
          <label className="field">
            Approved courier pickup location name
            <input name="pickup_location" required maxLength={100} />
          </label>
          <div className="form-grid">
            {["length", "breadth", "height"].map((field) => (
              <label className="field" key={field}>
                Packed {field} in centimetres
                <input
                  name={field}
                  type="number"
                  required
                  step="0.01"
                  min="0.51"
                  max={500}
                />
              </label>
            ))}
          </div>
          <button className="button dark">Queue courier booking</button>
        </fieldset>
      </form>
      {!rows.length && <p>No courier bookings recorded.</p>}
      {rows.map((row) => (
        <article
          key={row.id}
          className="panel"
          style={{ marginTop: 16, overflowWrap: "anywhere" }}
        >
          <h3>
            {row.stage.replaceAll("_", " ")} ·{" "}
            {row.delivery_state.replaceAll("_", " ")}
          </h3>
          <p>
            Order {row.order_id}
            <br />
            {row.carrier || "Courier assignment pending"} {row.awb || ""}
          </p>
          {row.pickup_reference && (
            <p>Pickup reference: {row.pickup_reference}</p>
          )}
          {row.last_error && <p className="form-error">{row.last_error}</p>}
          {row.label_url && (
            <a
              className="button outline"
              target="_blank"
              rel="noopener noreferrer"
              href={row.label_url}
            >
              Open shipping label
            </a>
          )}{" "}
          {row.manifest_url && (
            <a
              className="button outline"
              target="_blank"
              rel="noopener noreferrer"
              href={row.manifest_url}
            >
              Open handover manifest
            </a>
          )}
          <p>
            Courier documents contain customer delivery information. Share only
            with authorized fulfillment staff.
          </p>
        </article>
      ))}
    </section>
  );
}
