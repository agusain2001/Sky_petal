"use client";
import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  UserRound,
  Package,
  MapPin,
  Shield,
  LogOut,
  Download,
  LockKeyhole,
} from "lucide-react";
import { api, useStore } from "./store-provider";
import { type Order } from "@/lib/types";
import { AddressBook } from "./address-book";
import { OrderCard } from "./order-card";
import { PrivacyRequests } from "./privacy-requests";
export function Account() {
  const { user, refresh, toast } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [error, setError] = useState(params.get("error") || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("");
  const [tab, setTab] = useState(
    ["Password", "Addresses", "Profile", "Privacy"].includes(
      params.get("view") || "",
    )
      ? params.get("view")!
      : "Orders",
  );
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    api<{ authProvider: string }>("me")
      .then((x) => setProvider(x.authProvider))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user) {
      api<Order[]>("orders")
        .then(setOrders)
        .catch((e) => toast(e.message));
    }
  }, [user, toast]);
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ message?: string }>("auth", {
        ...values,
        action: mode,
      });
      if (result.message) setMessage(result.message);
      else {
        await refresh();
        const next = params.get("next");
        if (next?.startsWith("/") && !next.startsWith("//")) router.push(next);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <span className="eyebrow">YOUR OWN LITTLE CORNER</span>
          <h1>
            {mode === "register"
              ? "Hello, lovely."
              : mode === "reset"
                ? "A fresh start."
                : "Welcome back."}
          </h1>
          <p>
            {params.get("next") === "/checkout"
              ? "Sign in to check out. Your lovely bag is right where you left it."
              : "Come on in. A little softness is waiting for you."}
          </p>
          {mode !== "reset" && (
            <div className="auth-tabs">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create an account
              </button>
            </div>
          )}
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
          <form onSubmit={auth}>
            {mode === "register" && (
              <label className="field">
                Your name
                <input name="name" autoComplete="name" required minLength={2} />
              </label>
            )}
            <label className="field">
              Email address
              <input type="email" name="email" autoComplete="email" required />
            </label>
            {mode !== "reset" && (
              <label className="field">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                />
                <small style={{ fontSize: 8, color: "var(--muted)" }}>
                  At least 8 characters
                </small>
              </label>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="text-link"
                style={{ alignSelf: "flex-end" }}
                onClick={() => setMode("reset")}
              >
                Forgot your password?
              </button>
            )}
            <button className="button dark" disabled={busy}>
              {busy
                ? "A little moment…"
                : mode === "register"
                  ? "Create your account"
                  : mode === "reset"
                    ? "Send reset email"
                    : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          {mode === "reset" ? (
            <button
              className="centered text-link"
              onClick={() => setMode("login")}
            >
              Back to sign in
            </button>
          ) : (
            <>
              <div className="or">or</div>
              <a className="google" href="/api/auth/google">
                <span>G</span>Continue with Google
              </a>
            </>
          )}
          {provider === "local-development" && (
            <p className="dev-note">
              Local development accounts are enabled for this preview. Google
              sign-in, email verification and password emails need Supabase
              configuration.
            </p>
          )}
          <p style={{ fontSize: 9, marginTop: 22 }}>
            By continuing, you agree to our{" "}
            <Link
              href="/policies/terms"
              className="text-link"
              style={{ fontSize: 9 }}
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="/policies/privacy"
              className="text-link"
              style={{ fontSize: 9 }}
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    );
  return (
    <div className="page-shell">
      <span className="eyebrow">YOUR OWN LITTLE CORNER</span>
      <h1 className="page-title">Hello, {user.name.split(" ")[0]}.</h1>
      <p className="page-intro">Your favourite things, all in one place.</p>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Account navigation">
          <Link href="/account/support" className="button outline">
            Customer care
          </Link>
          <Link href="/account/returns" className="button outline">
            Returns & refunds
          </Link>
          <Link href="/account/notifications" className="button outline">
            Updates
          </Link>
          {[
            ["Orders", Package],
            ["Profile", UserRound],
            ["Addresses", MapPin],
            ["Privacy", Shield],
            ["Password", LockKeyhole],
          ].map(([name, Icon]) => {
            const I = Icon as typeof Package;
            return (
              <button
                key={name as string}
                className={tab === name ? "active" : ""}
                onClick={() => setTab(name as string)}
              >
                <I size={15} />
                {name as string}
              </button>
            );
          })}
          <button
            onClick={async () => {
              await api("logout", {});
              await refresh();
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </nav>
        <div className="account-content">
          <h2>
            {tab === "Orders"
              ? "Your little luxuries."
              : tab === "Profile"
                ? "All about you."
                : tab === "Addresses"
                  ? "Send a little softness."
                  : tab === "Password"
                    ? "A fresh start."
                    : "Your privacy matters."}
          </h2>
          {tab === "Password" && (
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                try {
                  const r = await api<{ message: string }>(
                    "password",
                    Object.fromEntries(new FormData(form)),
                  );
                  form.reset();
                  toast(r.message);
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <p style={{ marginBottom: 20 }}>
                Choose a strong password with at least 12 characters.
              </p>
              {provider === "local-development" && (
                <label className="field">
                  Current password
                  <input
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              )}
              <label className="field" style={{ marginTop: 20 }}>
                New password
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="button dark" style={{ marginTop: 25 }}>
                Update my password
              </button>
            </form>
          )}
          {tab === "Orders" &&
            (orders.length ? (
              orders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onChange={async () => setOrders(await api<Order[]>("orders"))}
                />
              ))
            ) : (
              <div className="empty-state">
                <Package size={35} strokeWidth={1} />
                <h3>Your story is just beginning.</h3>
                <p>Orders will appear here after you check out.</p>
                <Link href="/shop" className="button outline">
                  Find your first favourite
                </Link>
              </div>
            ))}
          {tab === "Profile" && (
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                try {
                  await api("profile", data);
                  await refresh();
                  toast("Your profile is updated.");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <label className="field">
                Your name
                <input
                  name="name"
                  defaultValue={user.name}
                  minLength={2}
                  required
                />
              </label>
              <label className="field" style={{ marginTop: 20 }}>
                Email address
                <input value={user.email} readOnly />
              </label>
              <button className="button dark" style={{ marginTop: 25 }}>
                Save my details
              </button>
            </form>
          )}
          {tab === "Addresses" && <AddressBook />}
          {tab === "Privacy" && (
            <div className="panel">
              <p style={{ fontSize: 12, marginBottom: 25 }}>
                Your intimate shopping information stays private. You can export
                your data or ask our team to delete your account.
              </p>
              <button
                className="button outline"
                onClick={async () => {
                  const data = await api("privacy", { kind: "export" });
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "sky-petal-my-data.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={15} />
                Download my data
              </button>
              <button
                className="text-link"
                style={{ display: "block", marginTop: 25 }}
                onClick={async () => {
                  if (
                    window.confirm(
                      "Request account deletion? Our care team will review retained order obligations before deleting your information.",
                    )
                  ) {
                    const r = await api<{ message: string }>("privacy", {
                      kind: "delete",
                    });
                    toast(r.message);
                  }
                }}
              >
                Request account deletion
              </button>
              <PrivacyRequests />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
