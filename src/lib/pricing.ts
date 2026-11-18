import { createHash, randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { getDB } from "./db";
import { addressSchema } from "./addresses";
import {
  commerceConfigSchema,
  configFingerprint,
  getCommerceConfig,
  stateCode,
  type CommerceConfig,
} from "./commerce-config";
import {
  shiprocketQuote,
  type ShippingOption,
  type ShippingQuoteProvider,
} from "./shipping";
import type { Address } from "./types";

export type QueryClient = Pick<PGlite, "query">;
export type PricingLine = {
  variant_id: string;
  sku: string;
  title: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  stock: number;
  weight_grams: number | null;
  tax_class_id: string | null;
  hsn: string | null;
  rate_bps: number | null;
  tax_valid: boolean | null;
  return_window_days?: number | null;
  sealed_return_required?: boolean;
};
export type TaxBreakdown = {
  taxable_paise: number;
  tax_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
};
export type QuotedLine = PricingLine &
  TaxBreakdown & {
    gross_paise: number;
    discount_paise: number;
    net_paise: number;
  };
export type CheckoutQuote = {
  id: string;
  user_id: string;
  cart_id: string;
  payment_method: "prepaid" | "cod";
  request_fingerprint: string;
  config_fingerprint: string;
  expires_at: string;
  content: {
    address: Address;
    billing_address: Address;
    coupon: string;
    lines: QuotedLine[];
    subtotal: number;
    discount: number;
    shipping: number;
    cod_fee: number;
    total: number;
    tax: TaxBreakdown;
    shipping_tax: TaxBreakdown;
    cod_tax: TaxBreakdown;
    shipping_option: ShippingOption;
    weight_grams: number;
    destination_state: string;
    origin_state: string;
  };
};
export async function readPricingLines(db: QueryClient, cartId: string) {
  return (
    await db.query<PricingLine>(
      `SELECT ci.variant_id,ci.quantity,v.price,v.stock,v.sku,v.size,v.color,v.weight_grams,p.title,p.tax_class_id,p.return_window_days,p.sealed_return_required,
    t.hsn,t.rate_bps,(t.active AND t.valid_from<=now() AND (t.valid_until IS NULL OR t.valid_until>now())) AS tax_valid
    FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id
    LEFT JOIN tax_classes t ON t.id=p.tax_class_id WHERE ci.cart_id=$1 AND p.published=true ORDER BY v.id`,
      [cartId],
    )
  ).rows;
}
export function checkoutFingerprint(
  lines: PricingLine[],
  address: Address,
  billing: Address,
  coupon: string,
  paymentMethod: string,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        address: addressSchema.parse(address),
        billing: addressSchema.parse(billing),
        coupon: coupon.toUpperCase(),
        paymentMethod,
        lines: lines.map(({ stock: _, ...line }) => line),
      }),
    )
    .digest("hex");
}
function amount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647)
    throw new Error("Order amount exceeds supported limits");
  return value;
}
export function includedTax(
  gross: number,
  rate: number,
  intra: boolean,
): TaxBreakdown {
  const divisor = 10000n + BigInt(rate),
    tax = Number((BigInt(gross) * BigInt(rate) + divisor / 2n) / divisor);
  return {
    taxable_paise: gross - tax,
    tax_paise: tax,
    cgst_paise: intra ? Math.floor(tax / 2) : 0,
    sgst_paise: intra ? tax - Math.floor(tax / 2) : 0,
    igst_paise: intra ? 0 : tax,
  };
}
/** Largest-remainder allocation keeps per-line paise equal to the order discount. */
export function allocateDiscount(gross: number[], discount: number) {
  const total = gross.reduce((a, b) => a + b, 0);
  if (!total) return gross.map(() => 0);
  const shares = gross.map((value, index) => ({
    index,
    base: Number((BigInt(value) * BigInt(discount)) / BigInt(total)),
    remainder: (BigInt(value) * BigInt(discount)) % BigInt(total),
  }));
  let left = discount - shares.reduce((sum, item) => sum + item.base, 0);
  for (const item of [...shares].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (left-- > 0) item.base++;
  }
  return shares.map((item) => item.base);
}
export async function couponPercent(db: QueryClient, coupon: string) {
  if (!coupon) return 0;
  const row = (
    await db.query<{ percent: number }>(
      "SELECT percent FROM coupons WHERE code=$1 AND active=true",
      [coupon.toUpperCase()],
    )
  ).rows[0];
  if (!row) throw new Error("This offer code is not valid");
  return row.percent;
}
function verifyDestination(option: ShippingOption, address: Address) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (
    !option.destination_state ||
    !option.destination_city ||
    option.destination_postcode !== address.postal
  )
    throw new Error(
      "The courier could not verify the city and state for this PIN code",
    );
  if (
    stateCode(option.destination_state) !== stateCode(address.state) ||
    normalize(option.destination_city) !== normalize(address.city)
  )
    throw new Error(
      `Review your address: this PIN code is listed by the courier as ${option.destination_city}, ${option.destination_state}`,
    );
}
export async function assertCodEligible(
  db: QueryClient,
  userId: string,
  config: CommerceConfig,
  address: Address,
  total: number,
) {
  if (
    !config.cod_enabled ||
    !config.cod_allowed_pincodes.includes(address.postal) ||
    total > config.cod_max_total_paise
  )
    throw new Error(
      "Cash on Delivery is not available for this address or order value",
    );
  const open = (
    await db.query<{ count: string }>(
      "SELECT count(*) FROM orders WHERE user_id=$1 AND payment_method='cod' AND status NOT IN ('cancelled','expired','refunded') AND payment_state NOT IN ('collected','remitted')",
      [userId],
    )
  ).rows[0];
  if (Number(open.count) >= config.cod_max_open_orders)
    throw new Error("Your open Cash on Delivery order limit has been reached");
}
export async function createCheckoutQuote(
  userId: string,
  cartId: string,
  input: {
    address: Address;
    billing_address?: Address;
    coupon?: string;
    payment_method: "prepaid" | "cod";
    courier_id?: number;
  },
  provider: ShippingQuoteProvider = shiprocketQuote,
) {
  const db = await getDB(),
    config = await getCommerceConfig();
  if (!config.checkout_enabled)
    throw new Error("Checkout is not open yet. Your bag is saved.");
  if (input.payment_method === "prepaid" && !config.prepaid_enabled)
    throw new Error("Prepaid checkout is not available");
  const owner = await db.query(
    "SELECT id FROM carts WHERE id=$1 AND user_id=$2",
    [cartId, userId],
  );
  if (!owner.rows.length)
    throw new Error("Your shopping bag could not be verified");
  const address = addressSchema.parse(input.address),
    billing = addressSchema.parse(input.billing_address || address);
  const destination = stateCode(address.state),
    origin = stateCode(config.origin_state);
  stateCode(billing.state);
  const lines = await readPricingLines(db, cartId);
  const count = (
    await db.query<{ count: string }>(
      "SELECT count(*) FROM cart_items WHERE cart_id=$1",
      [cartId],
    )
  ).rows[0];
  if (!lines.length) throw new Error("Your bag is empty");
  if (lines.length !== Number(count.count))
    throw new Error(
      "Some products are no longer available. Please review your bag.",
    );
  if (
    lines.some(
      (line) =>
        !line.tax_valid ||
        line.rate_bps === null ||
        !line.hsn ||
        !line.weight_grams,
    )
  )
    throw new Error(
      "Some products need tax or parcel details before they can be checked out",
    );
  if (lines.some((line) => line.stock < line.quantity))
    throw new Error(
      "Some items no longer have enough stock. Please review your bag.",
    );
  const coupon = (input.coupon || "").toUpperCase(),
    subtotal = amount(
      lines.reduce((s, line) => s + line.quantity * line.price, 0),
    );
  const discount = Number(
    (BigInt(subtotal) * BigInt(await couponPercent(db, coupon))) / 100n,
  );
  const weight = lines.reduce(
    (sum, line) => sum + line.quantity * line.weight_grams!,
    config.packaging_grams,
  );
  if (input.payment_method === "cod")
    await assertCodEligible(
      db,
      userId,
      config,
      address,
      subtotal - discount + config.cod_fee_paise,
    );
  const options = await provider({
    origin: config.origin_pincode,
    destination: address.postal,
    weight_grams: weight,
    cod: input.payment_method === "cod",
    value_paise: subtotal - discount,
  });
  const option = input.courier_id
    ? options.find((option) => option.courier_id === input.courier_id)
    : options[0];
  if (
    !option ||
    (input.payment_method === "cod" && !option.cod) ||
    !Number.isSafeInteger(option.rate_paise) ||
    option.rate_paise < 0
  )
    throw new Error("No eligible courier is available for this address");
  verifyDestination(option, address);
  const shipping =
    config.free_shipping_from_paise !== null &&
    subtotal - discount >= config.free_shipping_from_paise
      ? 0
      : option.rate_paise;
  const codFee = input.payment_method === "cod" ? config.cod_fee_paise : 0,
    total = amount(subtotal - discount + shipping + codFee);
  if (input.payment_method === "cod")
    await assertCodEligible(db, userId, config, address, total);
  const allocations = allocateDiscount(
      lines.map((line) => line.quantity * line.price),
      discount,
    ),
    intra = origin === destination;
  const quoted = lines.map((line, i) => {
    const gross = line.quantity * line.price,
      net = gross - allocations[i];
    return {
      ...line,
      gross_paise: gross,
      discount_paise: allocations[i],
      net_paise: net,
      ...includedTax(net, line.rate_bps!, intra),
    };
  });
  const shippingTax = includedTax(shipping, config.shipping_tax_bps!, intra),
    codTax = includedTax(codFee, config.cod_tax_bps || 0, intra);
  const tax = [...quoted, shippingTax, codTax].reduce(
    (sum, line) => ({
      taxable_paise: sum.taxable_paise + line.taxable_paise,
      tax_paise: sum.tax_paise + line.tax_paise,
      cgst_paise: sum.cgst_paise + line.cgst_paise,
      sgst_paise: sum.sgst_paise + line.sgst_paise,
      igst_paise: sum.igst_paise + line.igst_paise,
    }),
    {
      taxable_paise: 0,
      tax_paise: 0,
      cgst_paise: 0,
      sgst_paise: 0,
      igst_paise: 0,
    },
  );
  const quote: CheckoutQuote = {
    id: randomUUID(),
    user_id: userId,
    cart_id: cartId,
    payment_method: input.payment_method,
    request_fingerprint: checkoutFingerprint(
      lines,
      address,
      billing,
      coupon,
      input.payment_method,
    ),
    config_fingerprint: configFingerprint(config),
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    content: {
      address,
      billing_address: billing,
      coupon,
      lines: quoted,
      subtotal,
      discount,
      shipping,
      cod_fee: codFee,
      total,
      tax,
      shipping_tax: shippingTax,
      cod_tax: codTax,
      shipping_option: option,
      weight_grams: weight,
      destination_state: destination,
      origin_state: origin,
    },
  };
  await db.query(
    "INSERT INTO checkout_quotes(id,user_id,cart_id,payment_method,request_fingerprint,config_fingerprint,content,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      quote.id,
      userId,
      cartId,
      quote.payment_method,
      quote.request_fingerprint,
      quote.config_fingerprint,
      JSON.stringify(quote.content),
      quote.expires_at,
    ],
  );
  return quote;
}
export async function validateCheckoutQuote(
  tx: QueryClient,
  userId: string,
  cartId: string,
  quoteId: string,
  address: Address,
  billing: Address,
  coupon: string,
) {
  const quote = (
    await tx.query<CheckoutQuote>(
      "SELECT * FROM checkout_quotes WHERE id=$1 AND user_id=$2 AND cart_id=$3 AND expires_at>now()",
      [quoteId, userId, cartId],
    )
  ).rows[0];
  if (!quote)
    throw new Error("Your delivery quote has expired. Check delivery again.");
  const settings = (
    await tx.query<{ value: unknown }>(
      "SELECT value FROM site_settings WHERE key='commerce' FOR SHARE",
    )
  ).rows[0];
  const config = commerceConfigSchema.parse(settings?.value || {});
  if (
    !config.checkout_enabled ||
    configFingerprint(config) !== quote.config_fingerprint
  )
    throw new Error("Checkout settings changed. Check delivery again.");
  const lines = await readPricingLines(tx, cartId);
  if (
    checkoutFingerprint(
      lines,
      address,
      billing,
      coupon,
      quote.payment_method,
    ) !== quote.request_fingerprint ||
    lines.some((line) => !line.tax_valid)
  )
    throw new Error(
      "Your bag, address or tax details changed. Check delivery again.",
    );
  verifyDestination(quote.content.shipping_option, address);
  const percent = await couponPercent(tx, coupon);
  if (
    Number((BigInt(quote.content.subtotal) * BigInt(percent)) / 100n) !==
    quote.content.discount
  )
    throw new Error("Your offer changed. Check delivery again.");
  if (quote.payment_method === "cod")
    await assertCodEligible(tx, userId, config, address, quote.content.total);
  return quote;
}
