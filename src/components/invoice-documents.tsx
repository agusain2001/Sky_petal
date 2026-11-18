"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, useStore } from "./store-provider";
import { money } from "@/lib/types";
import type { InvoiceConfig, InvoiceDocument } from "@/lib/invoices";
export function InvoiceDocuments({ orderId }: { orderId?: string }) {
  const { user } = useStore(),
    [rows, setRows] = useState<InvoiceDocument[]>([]),
    [config, setConfig] = useState<InvoiceConfig | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [creditInvoice, setCreditInvoice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      if (orderId)
        setRows(await api<InvoiceDocument[]>(`orders/${orderId}/documents`));
      else {
        const data = await api<{
          documents: InvoiceDocument[];
          config: InvoiceConfig | null;
        }>("admin/invoices");
        setRows(data.documents);
        setConfig(data.config);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [orderId]);
  async function submit(event: FormEvent<HTMLFormElement>, endpoint: string) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData(event.currentTarget),
        body: Record<string, unknown> = Object.fromEntries(form);
      if (endpoint.endsWith("/credit")) {
        const allocations = [...form.entries()]
          .filter(
            ([key, value]) =>
              key.startsWith("creditamount_") && Number(value) > 0,
          )
          .map(([key, value]) => ({
            reference: key.slice("creditamount_".length),
            amount: Math.round(Number(value) * 100),
          }));
        if (allocations.length) body.allocations = allocations;
      }
      await api(endpoint, body);
      await load();
      setMessage("Saved. Issued document snapshots remain unchanged.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Invoices and credit notes">
      <h2>Invoices & credit notes</h2>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!orderId && (
        <>
          <p>
            Issue documents from the approved seller configuration and the
            order's recorded tax/pricing. A credit note requires a completed
            refund. An invoice does not prove COD collection.
          </p>
          {["owner", "administrator"].includes(user?.role || "") && (
            <details>
              <summary>Approved seller settings</summary>
              <form
                onSubmit={(e) => void submit(e, "admin/invoices/config")}
                key={JSON.stringify(config)}
              >
                {(
                  [
                    ["legal_name", "Legal seller name"],
                    ["address", "Registered seller address"],
                    ["gstin", "GSTIN (leave empty only when applicable)"],
                    ["state_code", "Two-digit issuer state code"],
                    ["prefix", "Document prefix (1–3 uppercase letters)"],
                    [
                      "approval_reference",
                      "Merchant/accountant approval reference",
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <input
                      name={key}
                      defaultValue={config?.[key] || ""}
                      required={key !== "gstin"}
                      maxLength={300}
                    />
                  </label>
                ))}
                <button className="button outline" disabled={busy}>
                  Save approved settings
                </button>
              </form>
            </details>
          )}
          <form onSubmit={(e) => void submit(e, "admin/invoices/issue")}>
            <label className="field">
              Accepted order ID
              <input name="order_id" required />
            </label>
            <button className="button outline" disabled={busy || !config}>
              Issue invoice
            </button>
          </form>
          <form onSubmit={(e) => void submit(e, "admin/invoices/credit")}>
            <label className="field">
              Completed refund ID
              <input name="refund_id" required />
            </label>
            <p>
              Inspected return refunds use their original item values and tax
              rates. For a partial refund without an item return, allocate the
              refunded amount to the original lines or charges below.
            </p>
            <label className="field">
              Original invoice for manual allocation
              <select
                value={creditInvoice}
                onChange={(e) => setCreditInvoice(e.target.value)}
              >
                <option value="">
                  Automatic item-return / full remaining credit
                </option>
                {rows
                  .filter((d) => d.kind === "invoice")
                  .map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.number}
                    </option>
                  ))}
              </select>
            </label>
            {rows
              .find((d) => d.id === creditInvoice)
              ?.snapshot.sources?.map((source) => (
                <label
                  className="field"
                  key={`${creditInvoice}:${source.reference}`}
                >
                  {source.label} · Original {money(source.net_paise)} · Credit
                  amount in INR
                  <input
                    name={`creditamount_${source.reference}`}
                    type="number"
                    min="0"
                    step="0.01"
                    max={source.net_paise / 100}
                  />
                </label>
              ))}
            <button className="button outline" disabled={busy}>
              Issue credit note
            </button>
          </form>
        </>
      )}
      {!rows.length && (
        <p>No documents issued{orderId ? " for this order" : " yet"}.</p>
      )}
      {rows.map((d) => (
        <article className="panel" key={d.id}>
          <h3>{d.number}</h3>
          <p>
            {d.kind.replaceAll("_", " ")} · {money(d.total)} ·{" "}
            {new Date(d.issued_at).toLocaleDateString("en-IN")}
          </p>
          <a className="text-link" href={`/api/documents/${d.id}.pdf`}>
            Download PDF
          </a>
          {" · "}
          <a className="text-link" href={`/api/documents/${d.id}.json`}>
            View exact snapshot
          </a>
        </article>
      ))}
    </section>
  );
}
