"use client";
import { useEffect, useState } from "react";
import type { InboxRecord } from "@/lib/payment-inbox";
import type { PaymentAttempt } from "@/lib/payment-attempts";
import { money } from "@/lib/types";
import { api } from "./store-provider";

export function PaymentOperations() {
  const [events, setEvents] = useState<InboxRecord[]>([]);
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const [captures, checkouts] = await Promise.all([
      api<InboxRecord[]>("admin/payments"),
      api<PaymentAttempt[]>("admin/payment-attempts"),
    ]);
    setEvents(captures);
    setAttempts(checkouts);
    setLoaded(true);
  }
  useEffect(() => {
    load().catch((error: Error) => setError(error.message));
  }, []);
  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>Payment recovery</h2>
          <p>
            Latest 100 verified capture events. Failed events require review; a
            retry never forces a payment or inventory override.
          </p>
        </div>
        <button
          className="button outline"
          disabled={Boolean(busy)}
          onClick={() =>
            load().catch((error: Error) => setError(error.message))
          }
        >
          Refresh payments
        </button>
      </div>
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
      {loaded && (
        <section className="panel" style={{ marginBlock: 20 }}>
          <h3>Checkout attempts</h3>
          <p>
            Unknown outcomes are checked against the original provider receipt.
            Reconciliation does not create a new charge. Authorized payments are
            not captured payments.
          </p>
          {!attempts.length ? (
            <p>No payment attempts recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <caption>Latest 100 durable checkout attempts</caption>
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>AMOUNT</th>
                    <th>STATE</th>
                    <th>CHECKS</th>
                    <th>EXCEPTION</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>
                        {attempt.order_id}
                        <br />
                        <small>
                          {attempt.provider_order_id ||
                            "Provider response unresolved"}
                        </small>
                      </td>
                      <td>{money(attempt.amount)}</td>
                      <td>{attempt.state.replaceAll("_", " ")}</td>
                      <td>{attempt.checks}</td>
                      <td>{attempt.last_error || "None"}</td>
                      <td>
                        {attempt.state !== "captured" && (
                          <button
                            disabled={Boolean(busy)}
                            onClick={async () => {
                              setBusy(attempt.id);
                              setError("");
                              setMessage("");
                              try {
                                await api("admin/payment-attempts/reconcile", {
                                  id: attempt.id,
                                });
                                setMessage(
                                  "Reconciliation queued for the maintenance worker. No payment or inventory override was made.",
                                );
                              } catch (error) {
                                setError((error as Error).message);
                              } finally {
                                await load().catch((error: Error) =>
                                  setError(error.message),
                                );
                                setBusy("");
                              }
                            }}
                          >
                            Queue reconciliation
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {!loaded && !error && <p role="status">Loading payment events…</p>}
      {loaded && !events.length && (
        <div className="panel">
          <h3>No verified capture events recorded.</h3>
          <p>
            Payment events appear after a signed webhook or a provider-verified
            callback is received.
          </p>
        </div>
      )}
      {events.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <caption>Verified Razorpay capture event processing</caption>
            <thead>
              <tr>
                <th>EVENT / PAYMENT</th>
                <th>AMOUNT</th>
                <th>PROCESSING</th>
                <th>ATTEMPTS</th>
                <th>EXCEPTION</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    {event.id}
                    <br />
                    <small>
                      {event.provider_order_id} / {event.payment_id}
                    </small>
                  </td>
                  <td>
                    {event.currency === "INR"
                      ? money(event.amount)
                      : `${event.amount} minor units ${event.currency}`}
                  </td>
                  <td>{event.status}</td>
                  <td>
                    {event.attempts}
                    {event.attempts >= 10 && (
                      <p>Automatic retry limit reached</p>
                    )}
                  </td>
                  <td>{event.last_error || "—"}</td>
                  <td>
                    {event.status !== "processed" && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={async () => {
                          setBusy(event.id);
                          setError("");
                          setMessage("");
                          try {
                            const result = await api<{ lost?: boolean }>(
                              "admin/payments/retry",
                              { id: event.id },
                            );
                            setMessage(
                              result.lost
                                ? "Processing lease changed. Refresh to check the current worker outcome."
                                : "Payment event processed.",
                            );
                          } catch (error) {
                            setError((error as Error).message);
                          } finally {
                            await load().catch((error: Error) =>
                              setError(error.message),
                            );
                            setBusy("");
                          }
                        }}
                      >
                        {busy === event.id ? "Retrying…" : "Retry processing"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
