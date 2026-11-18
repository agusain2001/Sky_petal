"use client";
import { useEffect, useState } from "react";
import { api, useStore } from "./store-provider";
import { money, type Order } from "@/lib/types";
import type { RefundEvidenceCorrection } from "@/lib/refunds";
type Rma = {
  id: string;
  order_id: string;
  status: string;
  reason: string;
  resolution: string;
  review_note: string | null;
  items: {
    id: string;
    order_item_id: string;
    title: string;
    size: string;
    color: string;
    quantity: number;
    refund_cap: number;
    disposition?: string;
  }[];
  events: { id: string; status: string; message: string; created_at: string }[];
};
type Refund = {
  id: string;
  order_id: string;
  return_id: string | null;
  amount: number;
  method: string;
  status: string;
  provider_id: string | null;
  requested_by: string;
  approved_by: string | null;
  evidence_ref: string | null;
  corrections?: RefundEvidenceCorrection[];
};
const words = (s: string) => s.replaceAll("_", " ");
export function ReturnsCenter({
  order,
  staff = false,
}: {
  order?: Order;
  staff?: boolean;
}) {
  const { user } = useStore();
  const [rows, setRows] = useState<Rma[]>([]),
    [exchanges, setExchanges] = useState<
      {
        return_id: string;
        replacement_order_id: string;
        replacement_status: string;
        replacement_total: number;
        original_value: number;
        refunded: number;
        net_cost_after_original_refund: number;
      }[]
    >([]),
    [refunds, setRefunds] = useState<Refund[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [requestKey, setRequestKey] = useState("");
  async function load() {
    setExchanges(await api(`${staff ? "admin/" : ""}exchanges`));
    setRows(
      await api<Rma[]>(
        `${staff ? "admin/" : ""}returns${order ? `?order=${order.id}` : ""}`,
      ),
    );
    if (!staff)
      setRefunds(
        await api<Refund[]>(`refunds${order ? `?order=${order.id}` : ""}`),
      );
  }
  useEffect(() => {
    setRequestKey(crypto.randomUUID());
    void load().catch((e) => setError(e.message));
  }, [order?.id, staff]);
  async function run(work: () => Promise<unknown>, text: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      setMessage(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const inspectAllowed =
    user && ["owner", "administrator", "fulfillment"].includes(user.role);
  return (
    <section
      aria-label={staff ? "Return operations" : "Returns and refunds"}
      style={{ marginTop: 24 }}
    >
      <h2>{staff ? "Returns & inspections" : "Returns & refunds"}</h2>
      <p>
        Requests are reviewed against the terms recorded with the order.
        Defective, damaged, or incorrect items can be submitted for review. A
        request does not confirm a refund or replacement.
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
        onClick={() => void run(load, "Updated.")}
      >
        Refresh returns
      </button>
      {!staff && order?.fulfillment_state === "delivered" && (
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(async () => {
              await api("returns", {
                order_id: order.id,
                request_key: requestKey,
                reason: form.get("reason"),
                reason_code: form.get("reason_code"),
                resolution: form.get("resolution"),
                sealed: form.has("sealed"),
                items: order.items
                  .filter((item) => form.has(`item_${item.id}`))
                  .map((item) => ({
                    order_item_id: item.id,
                    quantity: Number(form.get(`quantity_${item.id}`)),
                  })),
              });
              setRequestKey(crypto.randomUUID());
            }, "Your return request has been recorded for review.");
          }}
        >
          <fieldset disabled={busy}>
            <legend>Request a return or exchange review</legend>
            {order.items.map((item) => (
              <div key={item.id} className="panel">
                <label>
                  <input type="checkbox" name={`item_${item.id}`} />{" "}
                  {item.title} · {item.color} / {item.size}
                </label>
                <label className="field">
                  Quantity to return
                  <input
                    name={`quantity_${item.id}`}
                    type="number"
                    min={1}
                    max={item.quantity}
                    defaultValue={1}
                  />
                </label>
                <small>
                  {item.pricing_snapshot?.return_window_days === null ||
                  item.pricing_snapshot?.return_window_days === undefined
                    ? "Contact customer care to confirm voluntary return eligibility."
                    : `Voluntary return window recorded with order: ${item.pricing_snapshot.return_window_days} days.`}
                  {item.pricing_snapshot?.sealed_return_required
                    ? " Intact hygiene seals are required for voluntary returns."
                    : ""}
                </small>
              </div>
            ))}
            <label className="field">
              Reason
              <select name="reason_code">
                <option value="defect">Defective item</option>
                <option value="damaged">Damaged item</option>
                <option value="not_as_described">
                  Incorrect or not as described
                </option>
                <option value="fit">Fit or size</option>
                <option value="change_mind">Changed my mind</option>
              </select>
            </label>
            <label className="field">
              Requested resolution
              <select name="resolution">
                <option value="refund">Refund review</option>
                <option value="exchange">Exchange review</option>
              </select>
            </label>
            <label>
              <input type="checkbox" name="sealed" /> Hygiene seals remain
              intact
            </label>
            <label className="field">
              Tell us what happened
              <textarea
                name="reason"
                required
                minLength={10}
                maxLength={2000}
              />
            </label>
            <button className="button outline" disabled={!requestKey}>
              Submit request for review
            </button>
          </fieldset>
        </form>
      )}
      {!rows.length && <p>No return requests recorded.</p>}
      {rows.map((row) => (
        <article
          className="panel"
          key={row.id}
          style={{ marginTop: 20, overflowWrap: "anywhere" }}
        >
          <h3>
            RMA {row.id.slice(0, 8).toUpperCase()} · {words(row.status)}
          </h3>
          <p>
            Order {row.order_id} · Requested: {row.resolution}
          </p>
          <p>{row.reason}</p>
          {row.resolution === "exchange" && (
            <div className="panel">
              <h4>Replacement & original refund</h4>
              <p>
                Choose the exact replacement size and colour in the shop and
                place a new order through normal checkout. Replacement stock is
                reserved there. You pay its full checkout total; the inspected
                original items are refunded separately after financial approval.
                Both charges and delivery remain visible in your orders.
              </p>
              {exchanges
                .filter((e) => e.return_id === row.id)
                .map((e) => (
                  <div key={e.return_id}>
                    <p>
                      Replacement order {e.replacement_order_id} ·{" "}
                      {words(e.replacement_status)}
                    </p>
                    <p>
                      Replacement checkout {money(e.replacement_total)} ·
                      Original eligible refund {money(e.original_value)} ·
                      Refunded {money(e.refunded)}
                    </p>
                    <p>
                      Net cost after the full eligible original refund:{" "}
                      {money(e.net_cost_after_original_refund)}. A negative
                      value means a net credit.
                    </p>
                  </div>
                ))}
              {!staff &&
                ["inspected", "completed"].includes(row.status) &&
                !exchanges.some((e) => e.return_id === row.id) && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void run(
                        () =>
                          api("exchanges", {
                            return_id: row.id,
                            replacement_order_id: form.get(
                              "replacement_order_id",
                            ),
                          }),
                        "Replacement order linked.",
                      );
                    }}
                  >
                    <label className="field">
                      Your new replacement order ID
                      <input name="replacement_order_id" required />
                    </label>
                    <button className="button outline" disabled={busy}>
                      Link replacement order
                    </button>
                  </form>
                )}
            </div>
          )}
          {row.items.map((item) => (
            <p key={item.id}>
              {item.title} · {item.color} / {item.size} · Qty {item.quantity} ·
              Net item value {money(item.refund_cap)}
              {item.disposition && ` · ${item.disposition}`}
            </p>
          ))}
          <ol>
            {row.events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString("en-IN")}
                </time>{" "}
                · {words(event.status)} · {event.message}
              </li>
            ))}
          </ol>
          {staff && row.status === "requested" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(
                  () =>
                    api("admin/returns", {
                      id: row.id,
                      action: data.get("action"),
                      note: data.get("note"),
                    }),
                  "Review saved.",
                );
              }}
            >
              <fieldset disabled={busy}>
                <label className="field">
                  Decision
                  <select name="action">
                    <option value="approve">
                      Approve for receipt and inspection
                    </option>
                    <option value="reject">Decline with explanation</option>
                  </select>
                </label>
                <label className="field">
                  Customer-visible explanation
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                <button className="button outline">Save return decision</button>
              </fieldset>
            </form>
          )}
          {staff && inspectAllowed && row.status === "approved" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(
                  () =>
                    api("admin/returns", {
                      id: row.id,
                      action: "receive",
                      note: data.get("note"),
                      reference: data.get("reference"),
                    }),
                  "Receipt recorded.",
                );
              }}
            >
              <fieldset disabled={busy}>
                <label className="field">
                  Actual return receipt / handover reference
                  <input
                    name="reference"
                    required
                    minLength={6}
                    maxLength={150}
                  />
                </label>
                <label className="field">
                  Receipt note
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                <button className="button outline">
                  Record received return
                </button>
              </fieldset>
            </form>
          )}
          {staff && inspectAllowed && row.status === "received" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(
                  () =>
                    api("admin/returns", {
                      id: row.id,
                      action: "inspect",
                      note: data.get("note"),
                      inspections: row.items.map((item) => ({
                        return_item_id: item.id,
                        disposition: data.get(`disposition_${item.id}`),
                        condition_note: data.get(`condition_${item.id}`),
                      })),
                    }),
                  "Inspection saved. Only saleable items were restocked.",
                );
              }}
            >
              <fieldset disabled={busy}>
                {row.items.map((item) => (
                  <div key={item.id}>
                    <label className="field">
                      {item.title}: disposition
                      <select name={`disposition_${item.id}`}>
                        <option value="quarantine">
                          Quarantine — keep out of available stock
                        </option>
                        <option value="restock">
                          Restock — inspected and saleable
                        </option>
                        <option value="dispose">Dispose — no restock</option>
                      </select>
                    </label>
                    <label className="field">
                      Condition findings
                      <textarea
                        name={`condition_${item.id}`}
                        required
                        minLength={5}
                        maxLength={1000}
                      />
                    </label>
                  </div>
                ))}
                <label className="field">
                  Customer-visible inspection summary
                  <textarea
                    name="note"
                    required
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                <button className="button dark">Save inspection</button>
              </fieldset>
            </form>
          )}
          {staff && row.status === "inspected" && (
            <p>
              {row.resolution === "refund"
                ? `Finance can request a reviewed refund using RMA ${row.id}.`
                : "Replacement selection and price differences require customer-care review."}
            </p>
          )}
        </article>
      ))}
      {!staff && refunds.length > 0 && (
        <>
          <h3>Refund records</h3>
          {refunds.map((refund) => (
            <p key={refund.id}>
              {money(refund.amount)} · {words(refund.status)} ·{" "}
              {refund.method === "manual_cod"
                ? "COD payout"
                : "Original payment method"}
              {refund.provider_id && ` · ${refund.provider_id}`}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
export function RefundOperations() {
  const { user } = useStore();
  const [rows, setRows] = useState<Refund[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  async function load() {
    setRows(await api<Refund[]>("admin/refunds"));
  }
  useEffect(() => {
    setKey(crypto.randomUUID());
    void load().catch((e) => setError(e.message));
  }, []);
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      setMessage(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Refund approvals & evidence</h2>
      <p>
        Requests reserve against verified captured or collected funds. Provider
        acceptance remains pending until processing is verified. COD payouts
        require approval by a second staff account and actual payout evidence.
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
        onClick={() => void run(load, "Updated.")}
        disabled={busy}
      >
        Refresh refunds
      </button>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await api("admin/refunds", {
              order_id: data.get("order_id"),
              return_id: data.get("return_id") || undefined,
              amount: Number(data.get("amount")),
              reason: data.get("reason"),
              request_key: key,
            });
            setKey(crypto.randomUUID());
          }, "Refund request recorded; approval is required.");
        }}
      >
        <fieldset disabled={busy}>
          <legend>Request a refund</legend>
          <label className="field">
            Order ID
            <input name="order_id" required />
          </label>
          <label className="field">
            Inspected RMA ID (optional for a separate adjustment)
            <input name="return_id" />
          </label>
          <label className="field">
            Amount in paise
            <input name="amount" type="number" min={1} step={1} required />
          </label>
          <label className="field">
            Reason and adjustment basis
            <textarea name="reason" required minLength={10} maxLength={2000} />
          </label>
          <button className="button outline" disabled={!key}>
            Record refund request
          </button>
        </fieldset>
      </form>
      {!rows.length && <p>No refund requests recorded.</p>}
      {rows.map((row) => (
        <article
          className="panel"
          key={row.id}
          style={{ overflowWrap: "anywhere", marginTop: 16 }}
        >
          <h3>
            {money(row.amount)} · {words(row.status)}
          </h3>
          <p>
            Refund {row.id}
            <br />
            Order {row.order_id}
            <br />
            {words(row.method)}
            {row.provider_id && ` · ${row.provider_id}`}
          </p>
          {row.status === "requested" && (
            <>
              <button
                className="button dark"
                disabled={
                  busy ||
                  (row.method === "manual_cod" && row.requested_by === user?.id)
                }
                onClick={() =>
                  void run(
                    () =>
                      api("admin/refunds/review", {
                        id: row.id,
                        approve: true,
                      }),
                    "Approval recorded. Online refunds are queued for provider processing.",
                  )
                }
              >
                Approve refund
              </button>{" "}
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      api("admin/refunds/review", {
                        id: row.id,
                        approve: false,
                      }),
                    "Refund request declined.",
                  )
                }
              >
                Decline refund
              </button>
              {row.method === "manual_cod" && row.requested_by === user?.id && (
                <p>
                  A second authorized staff account must approve this COD
                  payout.
                </p>
              )}
            </>
          )}
          {row.status === "processed" && row.method === "manual_cod" && (
            <div>
              <p>Original payout reference: {row.evidence_ref}</p>
              <p>
                Reconciliation reference:{" "}
                {row.corrections?.find((c) => c.approved_by)?.corrected_ref ||
                  row.evidence_ref}
              </p>
              {row.corrections?.map((c) => (
                <div className="panel" key={c.id}>
                  <p>
                    {c.previous_ref} → {c.corrected_ref} ·{" "}
                    {c.approved_by
                      ? "Approved"
                      : "Awaiting independent approval"}
                  </p>
                  <p>{c.reason}</p>
                  <p>Independent proof: {c.independent_proof}</p>
                  {c.reconciliation_ref && (
                    <p>Reconciliation evidence: {c.reconciliation_ref}</p>
                  )}
                  {!c.approved_by && c.requested_by !== user?.id && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void run(
                          () =>
                            api("admin/refunds/evidence-corrections/approve", {
                              id: c.id,
                              reconciliation_ref:
                                data.get("reconciliation_ref"),
                            }),
                          "Correction approved; original evidence retained.",
                        );
                      }}
                    >
                      <label className="field">
                        Independent reconciliation reference
                        <input
                          name="reconciliation_ref"
                          minLength={6}
                          maxLength={150}
                          required
                        />
                      </label>
                      <button className="button outline" disabled={busy}>
                        Approve correction
                      </button>
                    </form>
                  )}
                </div>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void run(async () => {
                    await api("admin/refunds/evidence-corrections", {
                      refund_id: row.id,
                      request_key: key,
                      previous_ref:
                        row.corrections?.find((c) => c.approved_by)
                          ?.corrected_ref || row.evidence_ref,
                      corrected_ref: data.get("corrected_ref"),
                      reason: data.get("reason"),
                      independent_proof: data.get("independent_proof"),
                    });
                    setKey(crypto.randomUUID());
                  }, "Correction requested; a second finance account must approve it.");
                }}
              >
                <fieldset disabled={busy}>
                  <legend>Append an evidence correction</legend>
                  <p>
                    This records a reconciliation correction. It does not send
                    another payout.
                  </p>
                  <label className="field">
                    Corrected statement reference
                    <input
                      name="corrected_ref"
                      minLength={6}
                      maxLength={150}
                      required
                    />
                  </label>
                  <label className="field">
                    Reason
                    <textarea
                      name="reason"
                      minLength={10}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <label className="field">
                    Independent statement proof
                    <textarea
                      name="independent_proof"
                      minLength={10}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <button className="button outline" disabled={!key}>
                    Request correction
                  </button>
                </fieldset>
              </form>
            </div>
          )}
          {row.status === "approved" && row.method === "manual_cod" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run(
                  () =>
                    api("admin/refunds/manual-confirm", {
                      id: row.id,
                      reference: data.get("reference"),
                      evidence: data.get("evidence"),
                      occurred_at: new Date(
                        String(data.get("occurred_at")),
                      ).toISOString(),
                      verified: data.has("verified"),
                    }),
                  "Verified payout evidence recorded.",
                );
              }}
            >
              <fieldset disabled={busy}>
                <label className="field">
                  Bank / payout statement reference
                  <input
                    name="reference"
                    required
                    minLength={6}
                    maxLength={150}
                  />
                </label>
                <label className="field">
                  Evidence description
                  <textarea
                    name="evidence"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                </label>
                <label className="field">
                  Payout time
                  <input
                    name="occurred_at"
                    type="datetime-local"
                    step={1}
                    required
                  />
                </label>
                <label>
                  <input name="verified" type="checkbox" required /> I checked
                  the completed payout against the actual statement
                </label>
                <button className="button outline">
                  Record completed COD payout
                </button>
              </fieldset>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
