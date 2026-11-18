"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowRight, LockKeyhole } from "lucide-react";
import { api, ApiError, useStore } from "@/components/store-provider";
import { AddressFields } from "@/components/address-book";
import { money, type SavedAddress } from "@/lib/types";
import type { CheckoutQuote } from "@/lib/pricing";
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (r: unknown) => void) => void;
    };
  }
}
export default function Checkout() {
  const { user, cart, refresh } = useStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [quote, setQuote] = useState<{
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
  } | null>(null);
  const [configured, setConfigured] = useState(false);
  const [commerceReady, setCommerceReady] = useState(false);
  const [codEnabled, setCodEnabled] = useState(false);
  const [prepaidEnabled, setPrepaidEnabled] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"prepaid" | "cod">(
    "prepaid",
  );
  const [deliveryQuote, setDeliveryQuote] = useState<CheckoutQuote | null>(
    null,
  );
  const [quoting, setQuoting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState("");
  const [billingId, setBillingId] = useState("");
  const [sameBilling, setSameBilling] = useState(true);
  const [addressesReady, setAddressesReady] = useState(false);
  const idempotency = useRef("");
  useEffect(() => {
    api<{
      user: { id: string } | null;
      paymentsConfigured: boolean;
      commerce: {
        checkout_enabled: boolean;
        prepaid_enabled: boolean;
        cod_enabled: boolean;
      };
    }>("me")
      .then((r) => {
        if (!r.user) router.replace("/account?next=/checkout");
        else {
          const storageKey = `sp_checkout:${r.user.id}`;
          try {
            idempotency.current =
              sessionStorage.getItem(storageKey) || crypto.randomUUID();
            sessionStorage.setItem(storageKey, idempotency.current);
          } catch {
            idempotency.current = crypto.randomUUID();
          }
          setConfigured(r.paymentsConfigured);
          setCommerceReady(r.commerce.checkout_enabled);
          setCodEnabled(r.commerce.cod_enabled);
          setPrepaidEnabled(r.commerce.prepaid_enabled);
          if (!r.commerce.prepaid_enabled && r.commerce.cod_enabled)
            setPaymentMethod("cod");
          setReady(true);
          api<SavedAddress[]>("addresses")
            .then((saved) => {
              setAddresses(saved);
              setAddressId(
                saved.find((address) => address.default_shipping)?.id || "",
              );
              setBillingId(
                saved.find((address) => address.default_billing)?.id || "",
              );
            })
            .catch((error: Error) => setError(error.message))
            .finally(() => setAddressesReady(true));
        }
      })
      .catch((e) => setError(e.message));
  }, [router]);
  useEffect(() => {
    api<{
      subtotal: number;
      discount: number;
      shipping: number;
      total: number;
    }>("quote", { coupon: applied })
      .then(setQuote)
      .catch((e) => setError(e.message));
  }, [cart, applied]);
  useEffect(() => {
    setDeliveryQuote(null);
  }, [cart, applied, addressId, billingId, sameBilling, paymentMethod]);
  function addressInput(form: HTMLFormElement) {
    const fields = Object.fromEntries(new FormData(form));
    const address = addressId
      ? addresses.find((saved) => saved.id === addressId)!.content
      : Object.fromEntries(
          Object.entries(fields).filter(([key]) => !key.startsWith("billing_")),
        );
    const billing = sameBilling
      ? {}
      : billingId
        ? { billing_address_id: billingId }
        : {
            billing_address: Object.fromEntries(
              Object.entries(fields)
                .filter(([key]) => key.startsWith("billing_"))
                .map(([key, value]) => [key.slice(8), value]),
            ),
          };
    return {
      ...(addressId ? { address_id: addressId } : { address }),
      ...billing,
      coupon: applied,
      payment_method: paymentMethod,
    };
  }
  async function checkDelivery() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    setQuoting(true);
    setError("");
    setDeliveryQuote(null);
    try {
      setDeliveryQuote(
        await api<CheckoutQuote>("checkout/quote", addressInput(form)),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setQuoting(false);
    }
  }
  const subtotal =
    deliveryQuote?.content.subtotal ??
    quote?.subtotal ??
    cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const discount = deliveryQuote?.content.discount ?? quote?.discount ?? 0;
  const shipping = deliveryQuote?.content.shipping ?? 0;
  const codFee = deliveryQuote?.content.cod_fee ?? 0;
  const total = deliveryQuote?.content.total ?? subtotal - discount;
  if (!ready)
    return (
      <div className="empty-state">
        <ShieldCheck size={30} />
        <p>Opening your secure checkout…</p>
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  if (!cart.length)
    return (
      <div className="empty-state page-shell">
        <h1>Your bag is feeling light.</h1>
        <Link href="/shop" className="button dark">
          Find something lovely
        </Link>
      </div>
    );
  return (
    <div className="page-shell">
      <div className="breadcrumbs">
        <Link href="/cart">Your bag</Link>
        <span>/</span>
        <span>Secure checkout</span>
      </div>
      <span className="eyebrow">ONE STEP CLOSER TO LOVELY</span>
      <h1 className="page-title">A little luxury, on its way.</h1>
      <p>Checking out as {user?.email}</p>
      <div className="checkout-layout">
        <form
          ref={formRef}
          onChange={() => setDeliveryQuote(null)}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!deliveryQuote)
                throw new Error(
                  "Check delivery and totals before placing your order.",
                );
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              const address = addressId
                ? addresses.find((saved) => saved.id === addressId)!.content
                : Object.fromEntries(
                    Object.entries(fields).filter(
                      ([key]) => !key.startsWith("billing_"),
                    ),
                  );
              const billing = sameBilling
                ? {}
                : billingId
                  ? { billing_address_id: billingId }
                  : {
                      billing_address: Object.fromEntries(
                        Object.entries(fields)
                          .filter(([key]) => key.startsWith("billing_"))
                          .map(([key, value]) => [key.slice(8), value]),
                      ),
                    };
              const result = await api<{
                order_id: string;
                local_order_id: string;
                amount: number;
                key: string;
                payment_method?: "prepaid" | "cod";
              }>("checkout", {
                ...(addressId ? { address_id: addressId } : { address }),
                ...billing,
                coupon: applied,
                idempotency: idempotency.current,
                quote_id: deliveryQuote.id,
                payment_method: paymentMethod,
              });
              if (result.payment_method === "cod") {
                if (user) {
                  try {
                    sessionStorage.removeItem(`sp_checkout:${user.id}`);
                  } catch {}
                }
                await refresh();
                router.push(`/account/orders/${result.local_order_id}`);
                return;
              }
              if (!window.Razorpay)
                await new Promise<void>((resolve, reject) => {
                  const s = document.createElement("script");
                  s.src = "https://checkout.razorpay.com/v1/checkout.js";
                  s.onload = () => resolve();
                  s.onerror = () =>
                    reject(
                      new Error(
                        "Could not load secure payment. Please try again.",
                      ),
                    );
                  document.body.appendChild(s);
                });
              const recordClientEvent = (
                kind: "dismissed" | "failed" | "verification_pending",
              ) => {
                void api("payments/client-event", {
                  id: crypto.randomUUID(),
                  order_id: result.local_order_id,
                  kind,
                }).catch(() => {
                  // Browser reports are advisory. Provider polling/webhooks remain authoritative.
                });
              };
              const checkout = new window.Razorpay({
                key: result.key,
                amount: result.amount,
                currency: "INR",
                name: "Sky Petal",
                description: "A little everyday luxury",
                order_id: result.order_id,
                prefill: {
                  name: address.name,
                  email: user?.email,
                  contact: address.phone,
                },
                theme: { color: "#503344" },
                handler: async (response: Record<string, string>) => {
                  try {
                    await api("payments/verify", response);
                    if (user) {
                      try {
                        sessionStorage.removeItem(`sp_checkout:${user.id}`);
                      } catch {}
                    }
                    await refresh();
                    router.push(`/account/orders/${result.local_order_id}`);
                  } catch (e) {
                    recordClientEvent("verification_pending");
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                },
                modal: {
                  ondismiss: () => {
                    recordClientEvent("dismissed");
                    setBusy(false);
                    setError(
                      "Payment window closed. Your bag is saved. Check your orders before paying again if money was debited.",
                    );
                  },
                },
              });
              checkout.on("payment.failed", () => {
                recordClientEvent("failed");
                setError(
                  "Payment was not completed in this window. Check your orders before paying again if money was debited.",
                );
                setBusy(false);
              });
              checkout.open();
            } catch (e) {
              if (e instanceof ApiError && e.code === "CHECKOUT_CLOSED") {
                idempotency.current = crypto.randomUUID();
                if (user) {
                  try {
                    sessionStorage.setItem(
                      `sp_checkout:${user.id}`,
                      idempotency.current,
                    );
                  } catch {}
                }
              }
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <h2>Where shall we send your softness?</h2>
          {!addressesReady ? (
            <p role="status">Loading your address book…</p>
          ) : (
            <>
              {addresses.some((address) => address.kind !== "billing") && (
                <label className="field" style={{ marginBottom: 20 }}>
                  Shipping address
                  <select
                    value={addressId}
                    onChange={(event) => setAddressId(event.target.value)}
                  >
                    {addresses
                      .filter((address) => address.kind !== "billing")
                      .map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} · {address.content.line1},{" "}
                          {address.content.postal}
                          {address.default_shipping ? " (default)" : ""}
                        </option>
                      ))}
                    <option value="">Use a new address</option>
                  </select>
                </label>
              )}
              {addressId ? (
                <div className="panel">
                  {(() => {
                    const address = addresses.find(
                      (saved) => saved.id === addressId,
                    )!.content;
                    return (
                      <p>
                        {address.name}
                        <br />
                        {address.line1}
                        {address.line2 && `, ${address.line2}`}
                        <br />
                        {address.city}, {address.state} {address.postal}
                        <br />
                        {address.phone}
                      </p>
                    );
                  })()}
                  <Link href="/account?view=Addresses" className="text-link">
                    Manage addresses
                  </Link>
                </div>
              ) : (
                <AddressFields />
              )}
              <div className="inline-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={sameBilling}
                    onChange={(event) => setSameBilling(event.target.checked)}
                  />
                  Billing address is the same as shipping
                </label>
              </div>
              {!sameBilling && (
                <section>
                  <h3>Billing address</h3>
                  {addresses.some((address) => address.kind !== "shipping") && (
                    <label className="field">
                      Saved billing address
                      <select
                        value={billingId}
                        onChange={(event) => setBillingId(event.target.value)}
                      >
                        {addresses
                          .filter((address) => address.kind !== "shipping")
                          .map((address) => (
                            <option key={address.id} value={address.id}>
                              {address.label} · {address.content.line1},{" "}
                              {address.content.postal}
                            </option>
                          ))}
                        <option value="">Use a new billing address</option>
                      </select>
                    </label>
                  )}
                  {!billingId && <AddressFields prefix="billing_" />}
                </section>
              )}
            </>
          )}
          <div className="panel" style={{ marginTop: 25 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend>Payment method</legend>
              {prepaidEnabled && (
                <label className="inline-checks">
                  <input
                    type="radio"
                    name="payment_method_choice"
                    checked={paymentMethod === "prepaid"}
                    onChange={() => setPaymentMethod("prepaid")}
                  />
                  Pay online
                </label>
              )}
              {codEnabled && (
                <label className="inline-checks">
                  <input
                    type="radio"
                    name="payment_method_choice"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  Cash on Delivery (subject to eligibility)
                </label>
              )}
            </fieldset>
            <button
              type="button"
              className="button outline"
              disabled={quoting || busy || !addressesReady || !commerceReady}
              onClick={checkDelivery}
            >
              {quoting ? "Checking delivery…" : "Check delivery & totals"}
            </button>
            <strong>
              {deliveryQuote
                ? `${deliveryQuote.content.shipping_option.courier_name} · ${shipping ? money(shipping) : "Complimentary"}`
                : "Delivery is calculated for your address"}
            </strong>
            <p style={{ fontSize: 10, marginTop: 8 }}>
              {deliveryQuote?.content.shipping_option.estimated_delivery
                ? `Courier estimate: ${deliveryQuote.content.shipping_option.estimated_delivery}. Estimates may change.`
                : "Check delivery to see an available courier and the final charges."}
            </p>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {(!commerceReady || (paymentMethod === "prepaid" && !configured)) && (
            <div className="form-error">
              The store is still setting up checkout. Your bag is saved.
            </div>
          )}
          <button
            className="button dark full"
            disabled={
              busy ||
              quoting ||
              !deliveryQuote ||
              !commerceReady ||
              (paymentMethod === "prepaid" && !configured) ||
              !addressesReady
            }
          >
            <LockKeyhole size={15} />
            {busy
              ? "Opening secure payment…"
              : paymentMethod === "cod"
                ? `Place COD order · ${money(total)}`
                : `Pay securely · ${money(total)}`}
            <ArrowRight size={16} />
          </button>
          <p style={{ fontSize: 9, marginTop: 15 }}>
            By placing an order, you agree to our{" "}
            <Link
              href="/policies/terms"
              className="text-link"
              style={{ fontSize: 9 }}
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="/policies/returns"
              className="text-link"
              style={{ fontSize: 9 }}
            >
              returns policy
            </Link>
            .
          </p>
        </form>
        <aside>
          <div className="panel">
            <h2>Your lovely choices.</h2>
            {cart.map((c) => (
              <div
                className="bag-item"
                key={c.variant_id}
                style={{ gridTemplateColumns: "65px 1fr" }}
              >
                <img
                  src={c.image}
                  alt={c.title}
                  style={{ width: 65, height: 87 }}
                />
                <div>
                  <h3 style={{ fontSize: 22 }}>{c.title}</h3>
                  <p>
                    {c.color} / {c.size} · Qty {c.quantity}
                  </p>
                  <strong>{money(c.price * c.quantity)}</strong>
                </div>
              </div>
            ))}
            <div className="coupon-row">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="A little offer code"
                aria-label="Offer code"
              />
              <button
                onClick={async () => {
                  try {
                    const result = await api<{
                      subtotal: number;
                      discount: number;
                      shipping: number;
                      total: number;
                    }>("quote", { coupon });
                    setQuote(result);
                    setApplied(coupon);
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Apply
              </button>
            </div>
            <div className="checkout-line">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="checkout-line">
                <span>A little treat · {applied}</span>
                <span>−{money(discount)}</span>
              </div>
            )}
            <div className="checkout-line">
              <span>Delivery</span>
              <span>
                {deliveryQuote
                  ? shipping
                    ? money(shipping)
                    : "On us"
                  : "Check delivery"}
              </span>
            </div>
            <div className="checkout-line">
              <span>Included GST</span>
              <span>
                {deliveryQuote
                  ? money(deliveryQuote.content.tax.tax_paise)
                  : "Calculated after delivery check"}
              </span>
            </div>
            {codFee > 0 && (
              <div className="checkout-line">
                <span>COD fee</span>
                <span>{money(codFee)}</span>
              </div>
            )}
            <div className="checkout-line checkout-total">
              <span>{deliveryQuote ? "Total" : "Items estimate"}</span>
              <strong>{money(total)}</strong>
            </div>
          </div>
          <p
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 10,
            }}
          >
            <ShieldCheck size={16} />
            Your details stay private. Always.
          </p>
        </aside>
      </div>
    </div>
  );
}
