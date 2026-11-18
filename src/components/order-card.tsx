"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { money, type Order } from "@/lib/types";
import { api } from "./store-provider";
import { ReturnsCenter } from "./returns-center";
import { InvoiceDocuments } from "./invoice-documents";

const label = (value: string) => value.replaceAll("_", " ");
export function OrderCard({
  order,
  onChange,
  detail = false,
}: {
  order: Order;
  onChange?: () => Promise<void>;
  detail?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <article className="panel">
      <div className="order-row">
        <div>
          <strong>Order {order.id.slice(0, 8).toUpperCase()}</strong>
          <p>{new Date(order.created_at).toLocaleDateString("en-IN")}</p>
        </div>
        <span className="status">{label(order.order_state)}</span>
        <strong>{money(order.total)}</strong>
      </div>
      <p>
        Payment: {label(order.payment_state)} · Fulfillment:{" "}
        {label(order.fulfillment_state)} · Refund: {label(order.refund_state)}
      </p>
      {order.payment_attempt_state &&
        ["creating", "unknown", "authorized", "manual_review"].includes(
          order.payment_attempt_state,
        ) && (
          <p role="status">
            Payment check: {label(order.payment_attempt_state)}. This is not
            payment confirmation. If money was debited, contact customer care
            before paying again.
          </p>
        )}
      {detail && <InvoiceDocuments orderId={order.id} />}
      <div className="order-items">
        {order.items.map((item, index) => (
          <div key={index}>
            {item.title} · {item.color} / {item.size} · Qty {item.quantity} ·{" "}
            {money(item.price * item.quantity)}
          </div>
        ))}
      </div>
      {order.shipment && (
        <div className="panel">
          <strong>Shipment reference</strong>
          <p>
            {order.shipment.carrier} · {order.shipment.tracking}
          </p>
          <small>
            {order.courier_managed
              ? "Courier booking recorded. Movement and delivery are confirmed from authenticated courier events."
              : "Entered by our fulfillment team. Contact customer care for courier scan updates."}
          </small>
        </div>
      )}
      {order.tracking_events && order.tracking_events.length > 0 && (
        <section className="panel">
          <h3>Courier tracking</h3>
          <ol>
            {order.tracking_events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.occurred_at}>
                  {new Date(event.occurred_at).toLocaleString("en-IN")}
                </time>{" "}
                · {event.label}
                {event.scans.length > 0 && (
                  <details>
                    <summary>View courier scans</summary>
                    <ul>
                      {event.scans.map((scan, index) => (
                        <li key={index}>
                          {scan.date} · {scan.activity}
                          {scan.location && ` · ${scan.location}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {!detail && (
        <Link className="text-link" href={`/account/orders/${order.id}`}>
          View order details
        </Link>
      )}
      <Link
        className="text-link"
        style={{ display: "block", marginTop: 16 }}
        href={`/account/support?order=${order.id}`}
      >
        Get help with this order
      </Link>
      {detail && (
        <>
          <div className="checkout-line">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div className="checkout-line">
            <span>Discount</span>
            <span>−{money(order.discount)}</span>
          </div>
          <div className="checkout-line">
            <span>Delivery</span>
            <span>{money(order.shipping)}</span>
          </div>
          {order.cod_fee > 0 && (
            <div className="checkout-line">
              <span>COD fee</span>
              <span>{money(order.cod_fee)}</span>
            </div>
          )}
          {order.tax_snapshot && (
            <div className="checkout-line">
              <span>Included GST</span>
              <span>{money(order.tax_snapshot.tax_paise)}</span>
            </div>
          )}
          <div className="form-grid" style={{ marginTop: 24 }}>
            {[
              ["Shipping address", order.address],
              ["Billing address", order.billing_address],
            ].map(([heading, address]) => {
              const value = address as Record<string, string> | null;
              return (
                <section key={String(heading)}>
                  <h3>{String(heading)}</h3>
                  {value ? (
                    <p>
                      {value.name}
                      <br />
                      {value.line1}
                      {value.line2 && `, ${value.line2}`}
                      <br />
                      {value.city}, {value.state} {value.postal}
                      <br />
                      {value.phone}
                    </p>
                  ) : (
                    <p>
                      No billing snapshot was recorded for this older order.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          <h3 style={{ marginTop: 24 }}>Order history</h3>
          <ol>
            {order.events?.map((event) => (
              <li key={event.id} style={{ marginTop: 12 }}>
                <time dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString("en-IN")}
                </time>{" "}
                · {label(event.order_state)} · payment{" "}
                {label(event.payment_state)} · {label(event.fulfillment_state)}
                {event.source === "migration" &&
                  " (imported state; original transition time unavailable)"}
              </li>
            ))}
          </ol>
        </>
      )}
      {(order.status === "pending_payment" ||
        order.status === "paid" ||
        (order.status === "confirmed" && order.payment_method === "cod")) && (
        <button
          type="button"
          className="text-link"
          style={{ display: "block", marginTop: 20 }}
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                order.status === "paid"
                  ? "Cancel this order before packing and request a refund for finance review?"
                  : "Cancel this unpaid order and release its reserved items?",
              )
            )
              return;
            setBusy(true);
            setError("");
            try {
              await api(`orders/${order.id}/cancel`, {});
              try {
                const key = `sp_checkout:${order.user_id}`;
                if (sessionStorage.getItem(key) === order.idempotency_key)
                  sessionStorage.removeItem(key);
              } catch {}
              await onChange?.();
              setMessage(
                order.status === "paid"
                  ? "Order cancelled. Its refund is awaiting finance approval."
                  : "Unpaid order cancelled. No refund was issued.",
              );
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Cancelling…"
            : order.status === "paid"
              ? "Cancel order & request refund"
              : "Cancel unpaid order"}
        </button>
      )}
      {detail && <ReturnsCenter order={order} />}
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
    </article>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Order>(`orders/${id}`)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id, setOrder, setError]);
  return (
    <div className="page-shell">
      <Link className="text-link" href="/account">
        Back to your account
      </Link>
      <h1 className="page-title">Your order.</h1>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <p>
            <Link
              href={`/account?next=${encodeURIComponent(`/account/orders/${id}`)}`}
            >
              Sign in to your account
            </Link>
          </p>
        </div>
      )}
      {order ? (
        <OrderCard
          order={order}
          detail
          onChange={async () => setOrder(await api<Order>(`orders/${id}`))}
        />
      ) : (
        !error && <p role="status">Loading your order…</p>
      )}
    </div>
  );
}
