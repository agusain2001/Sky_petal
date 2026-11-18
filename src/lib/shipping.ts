import { z } from "zod";

export type ShippingOption = {
  courier_id: number;
  courier_name: string;
  rate_paise: number;
  estimated_delivery: string | null;
  cod: boolean;
  destination_state?: string;
  destination_city?: string;
  destination_postcode?: string;
};
export type ShippingRequest = {
  origin: string;
  destination: string;
  weight_grams: number;
  cod: boolean;
  value_paise: number;
};
export type ShippingQuoteProvider = (
  request: ShippingRequest,
) => Promise<ShippingOption[]>;
/** Parse provider rupees without floating-point currency arithmetic. */
export function rupeesToPaise(value: unknown) {
  const text = String(value);
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
    throw new Error("Courier returned an invalid rate");
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
let cached: { identity: string; token: string; until: number } | undefined;
let authenticating: Promise<string> | undefined;
async function token() {
  const supplied = process.env.SHIPROCKET_TOKEN;
  if (supplied) return supplied;
  const email = process.env.SHIPROCKET_EMAIL,
    password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) throw new Error("Courier service is not configured");
  if (cached?.identity === email && cached.until > Date.now())
    return cached.token;
  return (authenticating ??= (async () => {
    try {
      const response = await fetch(
        "https://apiv2.shiprocket.in/v1/external/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
          redirect: "error",
        },
      );
      if (!response.ok)
        throw new Error("Courier authentication is unavailable");
      const result = z
        .object({ token: z.string().min(1) })
        .parse(await response.json());
      cached = {
        identity: email,
        token: result.token,
        until: Date.now() + 60 * 60 * 1000,
      };
      return result.token;
    } finally {
      authenticating = undefined;
    }
  })());
}
/** Fixed provider origin only; callers never supply a complete URL. */
export async function shiprocketRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(
    `https://apiv2.shiprocket.in/v1/external/${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok) {
    if (response.status === 401) cached = undefined;
    throw new Error(
      `Courier operation returned HTTP ${response.status}; reconciliation may be required`,
    );
  }
  return response.json();
}
export const shiprocketQuote: ShippingQuoteProvider = async (request) => {
  const url = new URL(
    "https://apiv2.shiprocket.in/v1/external/courier/serviceability/",
  );
  url.search = new URLSearchParams({
    pickup_postcode: request.origin,
    delivery_postcode: request.destination,
    weight: String(request.weight_grams / 1000),
    cod: request.cod ? "1" : "0",
    declared_value: (request.value_paise / 100).toFixed(2),
  }).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await token()}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 401) cached = undefined;
    throw new Error(
      "Courier serviceability could not be checked. Please retry.",
    );
  }
  const result = z
    .object({
      status: z.number(),
      data: z
        .object({
          available_courier_companies: z.array(
            z.object({
              courier_company_id: z.number().int().positive(),
              courier_name: z.string().min(1),
              rate: z.union([z.number(), z.string()]),
              cod: z.union([z.number(), z.boolean()]).optional(),
              etd: z.string().optional(),
              state: z.string().optional(),
              city: z.string().optional(),
              postcode: z.union([z.string(), z.number()]).optional(),
            }),
          ),
        })
        .optional(),
    })
    .parse(await response.json());
  if (result.status !== 200 || !result.data)
    throw new Error("Delivery is not currently available for this PIN code");
  return result.data.available_courier_companies
    .filter((option) => !request.cod || option.cod === 1 || option.cod === true)
    .map((option) => ({
      courier_id: option.courier_company_id,
      courier_name: option.courier_name,
      rate_paise: rupeesToPaise(option.rate),
      estimated_delivery: option.etd || null,
      cod: option.cod === 1 || option.cod === true,
      destination_state: option.state,
      destination_city: option.city,
      destination_postcode:
        option.postcode === undefined ? undefined : String(option.postcode),
    }))
    .sort((a, b) => a.rate_paise - b.rate_paise || a.courier_id - b.courier_id);
};
