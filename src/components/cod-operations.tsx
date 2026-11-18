"use client";
import { useEffect, useState } from "react";
import { api } from "./store-provider";
import { money } from "@/lib/types";
type Finance = {
  orders: {
    id: string;
    total: number;
    status: string;
    payment_state: string;
    fulfillment_state: string;
    collected: string;
    remitted: string;
    fees: string;
  }[];
  ledger: {
    id: string;
    order_id: string;
    kind: string;
    amount: number;
    fees: number;
    reference: string;
    evidence: string;
    occurred_at: string;
  }[];
};
export function CodOperations() {
  const [data, setData] = useState<Finance | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(await api<Finance>("admin/cod"));
  }
  useEffect(() => {
    load().catch((error: Error) => setError(error.message));
  }, []);
  return (
    <section>
      <h2>Cash on Delivery reconciliation</h2>
      <p>
        Orders remain unpaid until courier collection evidence is reviewed and
        recorded. Remittances track gross value, courier deductions and net
        receipts separately.
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
      {!data ? (
        <p role="status">Loading COD records…</p>
      ) : (
        <>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="COD orders and reconciliation totals"
          >
            <table className="data-table">
              <caption>Latest 100 COD orders</caption>
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>ORDER / PAYMENT</th>
                  <th>ORDER TOTAL</th>
                  <th>UNCOLLECTED</th>
                  <th>COLLECTED</th>
                  <th>REMITTED GROSS</th>
                  <th>FEES / NET RECEIVED</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id.slice(0, 8).toUpperCase()}</td>
                    <td>
                      {order.status} / {order.payment_state}
                    </td>
                    <td>{money(order.total)}</td>
                    <td>
                      {money(
                        ["cancelled", "expired", "refunded"].includes(
                          order.status,
                        )
                          ? 0
                          : Math.max(0, order.total - Number(order.collected)),
                      )}
                    </td>
                    <td>{money(Number(order.collected))}</td>
                    <td>{money(Number(order.remitted))}</td>
                    <td>
                      {money(Number(order.fees))} /{" "}
                      {money(Number(order.remitted) - Number(order.fees))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="panel"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget,
                values = Object.fromEntries(new FormData(form));
              setBusy(true);
              setError("");
              setMessage("");
              try {
                await api("admin/cod", {
                  ...values,
                  amount: Math.round(Number(values.amount) * 100),
                  fees: Math.round(Number(values.fees || 0) * 100),
                  occurred_at: new Date(
                    String(values.occurred_at),
                  ).toISOString(),
                  verified: values.verified === "on",
                });
                await load();
                form.reset();
                setMessage("Verified COD evidence recorded.");
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Record verified evidence</h3>
            <fieldset
              disabled={busy}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <div className="form-grid">
                <label className="field">
                  Delivered COD order
                  <select name="order_id" required>
                    <option value="">Choose an order</option>
                    {data.orders
                      .filter(
                        (order) => order.fulfillment_state === "delivered",
                      )
                      .map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.id.slice(0, 8).toUpperCase()} /{" "}
                          {money(order.total)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  Evidence type
                  <select name="kind">
                    <option value="collection">Doorstep collection</option>
                    <option value="remittance">Courier remittance</option>
                  </select>
                </label>
                <label className="field">
                  Gross amount (INR)
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </label>
                <label className="field">
                  Remittance deductions (INR)
                  <input
                    name="fees"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
                <label className="field">
                  Statement / transaction reference
                  <input
                    name="reference"
                    required
                    minLength={6}
                    maxLength={200}
                  />
                </label>
                <label className="field">
                  Evidence date and time
                  <input name="occurred_at" type="datetime-local" required />
                </label>
                <label className="field wide">
                  Verification evidence
                  <textarea
                    name="evidence"
                    required
                    minLength={10}
                    maxLength={1000}
                    placeholder="Courier statement reference and reconciliation notes"
                  />
                </label>
              </div>
              <div className="inline-checks">
                <label>
                  <input name="verified" type="checkbox" required />I verified
                  this evidence against the courier statement or bank record.
                </label>
              </div>
              <button className="button dark" disabled={busy}>
                Record COD evidence
              </button>
            </fieldset>
          </form>
          <div className="panel">
            <h3>Collection and remittance ledger</h3>
            {data.ledger.map((entry) => (
              <div className="checkout-line" key={entry.id}>
                <span>
                  {entry.kind} · {entry.reference} · {entry.evidence}
                </span>
                <span>
                  {money(entry.amount)}
                  {entry.fees > 0 && ` (deductions ${money(entry.fees)})`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
