"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "./store-provider";
import type { SupportTicket, TicketMessage } from "@/lib/support";
import type { Order } from "@/lib/types";
type Queue = {
  tickets: SupportTicket[];
  members: { id: string; name: string }[];
};
type Detail = { ticket: SupportTicket; messages: TicketMessage[] };
export function SupportCenter({
  staff = false,
  embedded = false,
  initialOrder = "",
}: {
  staff?: boolean;
  embedded?: boolean;
  initialOrder?: string;
}) {
  const base = staff ? "admin/support" : "support/tickets";
  const [queue, setQueue] = useState<Queue>({ tickets: [], members: [] }),
    [detail, setDetail] = useState<Detail | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [status, setStatus] = useState("all"),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(!staff),
    [orderId, setOrderId] = useState(initialOrder);
  const selection = useRef(""),
    requestKey = useRef("");
  async function load() {
    setQueue(await api<Queue>(`${base}?status=${status}`));
    setLoaded(true);
  }
  async function select(id: string) {
    selection.current = id;
    setCreating(false);
    setError("");
    setDetail(null);
    try {
      const result = await api<Detail>(`${base}/${id}`);
      if (selection.current === id) setDetail(result);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function refreshThread() {
    await load();
    if (selection.current) await select(selection.current);
  }
  useEffect(() => {
    load().catch((error: Error) => setError(error.message));
  }, [base, status]);
  useEffect(() => {
    if (!staff)
      api<Order[]>("orders")
        .then(setOrders)
        .catch(() => {});
  }, [staff]);
  return (
    <section className={embedded ? undefined : "page-shell"}>
      {!embedded && (
        <>
          <span className="eyebrow">SKY PETAL CARE</span>
          <h1 className="page-title">A little help, always.</h1>
        </>
      )}
      {embedded && (
        <h2>{staff ? "Customer care queue" : "Your conversations"}</h2>
      )}
      <p>
        Ask about fit, an order, a return or a concern. Your conversation stays
        in your account.
      </p>
      {error && (
        <div className="form-error" role="alert">
          {error}
          {!loaded && !staff && (
            <p>
              <Link href="/account?next=/account/support" className="text-link">
                Sign in to contact care
              </Link>
            </p>
          )}
          <button
            type="button"
            onClick={() =>
              load().catch((error: Error) => setError(error.message))
            }
          >
            Retry
          </button>
        </div>
      )}
      {message && (
        <div className="form-success" role="status">
          {message}
        </div>
      )}
      <div className="toolbar">
        {staff && (
          <label className="field">
            Queue status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {[
                "all",
                "open",
                "waiting_team",
                "waiting_customer",
                "resolved",
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {!staff && loaded && (
          <button
            type="button"
            className="button outline"
            onClick={() => {
              selection.current = "";
              setDetail(null);
              setCreating(true);
              setError("");
              setMessage("");
              requestKey.current = "";
            }}
          >
            New support request
          </button>
        )}
        <button
          type="button"
          className="text-link"
          onClick={() =>
            refreshThread().catch((error: Error) => setError(error.message))
          }
        >
          Refresh conversations
        </button>
      </div>
      {!loaded && !error && <p role="status">Loading your conversations…</p>}
      <div className="account-layout" style={{ marginTop: 24 }}>
        <nav aria-label="Support conversations" style={{ minWidth: 0 }}>
          {loaded && !queue.tickets.length && (
            <div className="panel">
              <h3>No conversations yet.</h3>
              <p>Your requests and replies will appear here.</p>
            </div>
          )}
          {queue.tickets.map((ticket) => (
            <button
              type="button"
              className="panel"
              style={{ display: "block", width: "100%", textAlign: "left" }}
              key={ticket.id}
              onClick={() => void select(ticket.id)}
              aria-pressed={selection.current === ticket.id}
            >
              <strong style={{ overflowWrap: "anywhere" }}>
                {ticket.subject}
              </strong>
              <p>
                {ticket.status.replaceAll("_", " ")} · {ticket.priority}
              </p>
              <small>
                {new Date(ticket.updated_at).toLocaleString("en-IN")}
              </small>
            </button>
          ))}
        </nav>
        <div style={{ minWidth: 0 }}>
          {!staff && loaded && creating && (
            <form
              className="panel"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget,
                  values = Object.fromEntries(new FormData(form));
                requestKey.current ||= crypto.randomUUID();
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const result = await api<SupportTicket>(base, {
                    ...values,
                    order_id: orderId || null,
                    idempotency_key: requestKey.current,
                  });
                  requestKey.current = "";
                  form.reset();
                  await load();
                  await select(result.id);
                  setMessage(
                    "Your request is saved. Replies will appear in this conversation.",
                  );
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>How can we help?</h3>
              <fieldset
                disabled={busy}
                style={{ border: 0, padding: 0, margin: 0 }}
              >
                <label className="field">
                  Subject
                  <input
                    name="subject"
                    required
                    minLength={3}
                    maxLength={150}
                  />
                </label>
                <label className="field">
                  Topic
                  <select name="topic">
                    {[
                      "order",
                      "fit",
                      "return",
                      "defect",
                      "privacy",
                      "grievance",
                      "other",
                    ].map((topic) => (
                      <option value={topic} key={topic}>
                        {topic === "defect"
                          ? "Defective / not as described"
                          : topic}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Related order (optional)
                  <select
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                  >
                    <option value="">No order</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.id.slice(0, 8).toUpperCase()} ·{" "}
                        {order.status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Tell us what happened
                  <textarea
                    name="body"
                    minLength={10}
                    maxLength={4000}
                    required
                  />
                </label>
                <button className="button dark" disabled={busy}>
                  {busy ? "Saving…" : "Send support request"}
                </button>
              </fieldset>
            </form>
          )}
          {detail && (
            <article className="panel">
              <h3 style={{ overflowWrap: "anywhere" }}>
                {detail.ticket.subject}
              </h3>
              <p>
                Status: {detail.ticket.status.replaceAll("_", " ")}
                {detail.ticket.order_id &&
                  ` · Order ${detail.ticket.order_id.slice(0, 8).toUpperCase()}`}
              </p>
              <ol
                aria-label="Latest 200 conversation messages"
                style={{ listStyle: "none", padding: 0 }}
              >
                {detail.messages.map((entry) => (
                  <li className="panel" key={entry.id}>
                    <strong>
                      {entry.name}
                      {entry.visibility === "internal" && " · Team note"}
                    </strong>
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {entry.body}
                    </p>
                    <time dateTime={entry.created_at}>
                      {new Date(entry.created_at).toLocaleString("en-IN")}
                    </time>
                  </li>
                ))}
              </ol>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget,
                    values = Object.fromEntries(new FormData(form));
                  setBusy(true);
                  setError("");
                  setMessage("");
                  try {
                    await api(`${base}/${detail.ticket.id}/reply`, {
                      body: values.body,
                      visibility:
                        staff && values.internal === "on"
                          ? "internal"
                          : "public",
                    });
                    form.reset();
                    await load();
                    await select(detail.ticket.id);
                    setMessage("Reply saved.");
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="field">
                  Your reply
                  <textarea
                    name="body"
                    required
                    minLength={2}
                    maxLength={4000}
                  />
                </label>
                {staff && (
                  <div className="inline-checks">
                    <label>
                      <input name="internal" type="checkbox" />
                      Internal team note (hidden from customer)
                    </label>
                  </div>
                )}
                <p>
                  {!staff && detail.ticket.status === "resolved"
                    ? "Replying reopens this conversation for the team."
                    : ""}
                </p>
                <button className="button outline" disabled={busy}>
                  Send reply
                </button>
              </form>
              {staff && (
                <form
                  key={`${detail.ticket.id}:${detail.ticket.updated_at}`}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const values = Object.fromEntries(
                      new FormData(event.currentTarget),
                    );
                    setBusy(true);
                    setError("");
                    setMessage("");
                    try {
                      await api(`${base}/${detail.ticket.id}`, {
                        ...values,
                        assigned_to: values.assigned_to || null,
                      });
                      await load();
                      await select(detail.ticket.id);
                      setMessage("Support request updated.");
                    } catch (error) {
                      setError((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={{ marginTop: 30 }}
                >
                  <h3>Manage request</h3>
                  <label className="field">
                    Request status
                    <select name="status" defaultValue={detail.ticket.status}>
                      {[
                        "open",
                        "waiting_customer",
                        "waiting_team",
                        "resolved",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {value.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Priority
                    <select
                      name="priority"
                      defaultValue={detail.ticket.priority}
                    >
                      <option value="standard">Standard</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label className="field">
                    Assign to
                    <select
                      name="assigned_to"
                      defaultValue={detail.ticket.assigned_to || ""}
                    >
                      <option value="">Unassigned</option>
                      {queue.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Customer-visible resolution (required to resolve)
                    <textarea name="resolution" maxLength={4000} />
                  </label>
                  <button className="button dark" disabled={busy}>
                    Update support request
                  </button>
                </form>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
