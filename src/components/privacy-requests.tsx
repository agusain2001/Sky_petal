"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "./store-provider";
type Request = {
  id: string;
  user_id: string;
  status: string;
  retain_until: string | null;
  decision: string | null;
  external_followup: boolean;
  policy_version: string | null;
};
type Policy = {
  financial_days: number;
  support_days: number;
  approval_reference: string;
  policy_version: string;
};
export function PrivacyRequests({ staff = false }: { staff?: boolean }) {
  const [rows, setRows] = useState<Request[]>([]),
    [policy, setPolicy] = useState<Policy | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    try {
      if (staff) {
        const data = await api<{ requests: Request[]; policy: Policy | null }>(
          "admin/privacy",
        );
        setRows(data.requests);
        setPolicy(data.policy);
      } else setRows(await api<Request[]>("privacy/requests"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [staff]);
  async function run(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ status?: string }>(path, body);
      await load();
      setMessage(
        result.status === "retained"
          ? "Account closed; records remain held for retention or open obligations."
          : "Saved. Review the recorded status and external follow-up.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    void run("admin/privacy/policy", {
      ...form,
      financial_days: Number(form.financial_days),
      support_days: Number(form.support_days),
    });
  }
  return (
    <section className="panel" aria-label="Privacy request status">
      <h2>{staff ? "Privacy operations" : "Deletion request status"}</h2>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {staff && (
        <>
          <p>
            Approval closes a customer account, revokes sessions and removes
            optional account data. Financial/support snapshots are erased after
            the recorded retention period and open-obligation checks. External
            identity, provider and backup copies need separate completion
            evidence.
          </p>
          <details>
            <summary>Approved retention policy</summary>
            <form key={JSON.stringify(policy)} onSubmit={save}>
              <label className="field">
                Financial retention days
                <input
                  name="financial_days"
                  type="number"
                  min={0}
                  max={36500}
                  defaultValue={policy?.financial_days ?? ""}
                  required
                />
              </label>
              <label className="field">
                Support retention days
                <input
                  name="support_days"
                  type="number"
                  min={0}
                  max={36500}
                  defaultValue={policy?.support_days ?? ""}
                  required
                />
              </label>
              <label className="field">
                Policy version
                <input
                  name="policy_version"
                  defaultValue={policy?.policy_version || ""}
                  required
                />
              </label>
              <label className="field">
                Approval reference
                <input
                  name="approval_reference"
                  minLength={6}
                  defaultValue={policy?.approval_reference || ""}
                  required
                />
              </label>
              <button className="button outline" disabled={busy}>
                Save approved retention policy
              </button>
            </form>
          </details>
        </>
      )}
      <button className="text-link" disabled={busy} onClick={() => void load()}>
        Refresh privacy status
      </button>
      {!rows.length && <p>No deletion requests recorded.</p>}
      {rows.map((r) => (
        <article key={r.id} className="panel">
          <strong>
            {r.status.replaceAll("_", " ")} · {r.id.slice(0, 8).toUpperCase()}
          </strong>
          {staff && <p>Customer reference: {r.user_id}</p>}
          <p>
            {r.decision ||
              "Awaiting a retention review. Your account is still active."}
          </p>
          {r.retain_until && (
            <p>
              Earliest retention review:{" "}
              {new Date(r.retain_until).toLocaleDateString("en-IN")} · Policy{" "}
              {r.policy_version}
            </p>
          )}
          {r.external_followup && (
            <p>
              External identity/provider/backup erasure is still pending; local
              completion does not certify those copies.
            </p>
          )}
          {staff && r.status === "requested" && (
            <button
              className="button outline"
              disabled={busy || !policy}
              onClick={() => {
                if (
                  window.confirm(
                    "Close this customer account, revoke sessions and apply the approved retention policy?",
                  )
                )
                  void run("admin/privacy/approve", { id: r.id });
              }}
            >
              Approve account closure
            </button>
          )}
          {staff && r.status === "retained" && (
            <button
              className="button outline"
              disabled={busy}
              onClick={() => void run("admin/privacy/process", { id: r.id })}
            >
              Check retention and process
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
