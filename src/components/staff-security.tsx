"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, useStore } from "./store-provider";
type Status = {
  enabled: boolean;
  required: boolean;
  verified: boolean;
  recent: boolean;
  password_required: boolean;
  needs_primary_reauth: boolean;
};
export function StaffSecurity() {
  const { user } = useStore();
  const [status, setStatus] = useState<Status | null>(null),
    [secret, setSecret] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setStatus(await api<Status>("security/mfa"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (user && user.role !== "customer") void load();
  }, [user]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (!status?.enabled && !secret) {
        const result = await api<{ secret: string }>(
          "security/mfa/enroll",
          values,
        );
        setSecret(result.secret);
      } else {
        const result = await api<{ recovery_codes?: string[] }>(
          "security/mfa/verify",
          { code: values.code, enroll: !!secret },
        );
        setCodes(result.recovery_codes || []);
        setSecret("");
        await load();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user || user.role === "customer")
    return (
      <div className="page-shell">
        <h1>Team security</h1>
        <p>Sign in with a team account to manage an authenticator.</p>
        <Link href="/account?next=/account/security">Team sign in</Link>
      </div>
    );
  return (
    <div className="page-shell" style={{ maxWidth: 720 }}>
      <span className="eyebrow">SKY PETAL / TEAM SECURITY</span>
      <h1>Protect your Studio access.</h1>
      <p>
        Use a six-digit code from your authenticator. Recovery codes work once
        each. Financial actions require verification within the last ten
        minutes.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {status && (
        <p role="status">
          {status.verified
            ? "This session is verified."
            : status.enabled
              ? "Verify this session to access the Studio."
              : "Enroll an authenticator before using protected team access."}
        </p>
      )}
      {secret && (
        <div className="panel">
          <p>
            Add a manual account in your authenticator: issuer{" "}
            <strong>Sky Petal</strong>, account <strong>{user.email}</strong>,
            time-based, six digits, 30 seconds.
          </p>
          <p>Setup key (shown only during enrollment):</p>
          <code style={{ overflowWrap: "anywhere" }}>{secret}</code>
        </div>
      )}
      <form className="panel" onSubmit={submit}>
        {!status?.enabled && !secret && status?.password_required === false ? (
          <p>
            {status.needs_primary_reauth
              ? "Sign in again with your identity provider, then enroll within five minutes."
              : "Your recent identity-provider sign-in can authorize enrollment."}
          </p>
        ) : (
          <label>
            {!status?.enabled && !secret
              ? "Current password"
              : "Authenticator or unused recovery code"}
            <input
              name={!status?.enabled && !secret ? "password" : "code"}
              type={!status?.enabled && !secret ? "password" : "text"}
              autoComplete={
                !status?.enabled && !secret
                  ? "current-password"
                  : "one-time-code"
              }
              required
              maxLength={128}
            />
          </label>
        )}
        {!status?.enabled && !secret && status?.needs_primary_reauth && (
          <button
            type="button"
            className="button outline"
            onClick={() =>
              void api("logout", {}).then(() =>
                window.location.assign("/account?next=/account/security"),
              )
            }
          >
            Sign in again
          </button>
        )}
        <button
          className="button dark"
          disabled={
            busy ||
            !status ||
            (!status.enabled && !secret && status.needs_primary_reauth)
          }
        >
          {busy
            ? "Checking…"
            : !status?.enabled && !secret
              ? "Set up authenticator"
              : "Verify code"}
        </button>
      </form>
      {codes.length > 0 && (
        <section className="panel" aria-label="Recovery codes">
          <h2>Save your recovery codes now.</h2>
          <p>
            Store these securely. Each code can be used once; they cannot be
            displayed again.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {codes.join("\n")}
          </pre>
          <button
            className="button outline"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(["Sky Petal recovery codes\n" + codes.join("\n")], {
                  type: "text/plain",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "sky-petal-recovery-codes.txt";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download recovery codes
          </button>
        </section>
      )}
      <Link className="text-link" href="/admin">
        Return to Studio
      </Link>
    </div>
  );
}
