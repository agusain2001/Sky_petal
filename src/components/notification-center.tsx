"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./store-provider";
type Notice = {
  id: string;
  order_id: string | null;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};
export function NotificationCenter() {
  const [rows, setRows] = useState<Notice[]>([]),
    [error, setError] = useState("");
  async function load() {
    setRows(await api<Notice[]>("notifications"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <h1>Your updates</h1>
      <p>Private updates about your orders and customer-care requests.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!rows.length && !error && <p>No updates recorded.</p>}
      {rows.map((row) => (
        <article className="panel" key={row.id} style={{ marginTop: 16 }}>
          <h2>{row.title}</h2>
          <p>{row.message}</p>
          <p>
            <time dateTime={row.created_at}>
              {new Date(row.created_at).toLocaleString("en-IN")}
            </time>{" "}
            · {row.read_at ? "Read" : "Unread"}
          </p>
          {row.order_id && (
            <Link
              className="text-link"
              href={`/account/orders/${row.order_id}`}
            >
              View order
            </Link>
          )}
          {!row.read_at && (
            <button
              className="text-link"
              onClick={async () => {
                try {
                  await api("notifications/read", { id: row.id });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Mark as read
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
