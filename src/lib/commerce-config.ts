import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import type { User } from "./types";

export const indiaStates = {
  "Andaman and Nicobar Islands": "35",
  "Andhra Pradesh": "37",
  "Arunachal Pradesh": "12",
  Assam: "18",
  Bihar: "10",
  Chandigarh: "04",
  Chhattisgarh: "22",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Delhi: "07",
  Goa: "30",
  Gujarat: "24",
  Haryana: "06",
  "Himachal Pradesh": "02",
  "Jammu and Kashmir": "01",
  Jharkhand: "20",
  Karnataka: "29",
  Kerala: "32",
  Ladakh: "38",
  Lakshadweep: "31",
  "Madhya Pradesh": "23",
  Maharashtra: "27",
  Manipur: "14",
  Meghalaya: "17",
  Mizoram: "15",
  Nagaland: "13",
  Odisha: "21",
  Puducherry: "34",
  Punjab: "03",
  Rajasthan: "08",
  Sikkim: "11",
  "Tamil Nadu": "33",
  Telangana: "36",
  Tripura: "16",
  "Uttar Pradesh": "09",
  Uttarakhand: "05",
  "West Bengal": "19",
} as const;
export function stateCode(name: string) {
  const state = Object.entries(indiaStates).find(
    ([key, value]) =>
      key.toLowerCase() === name.trim().toLowerCase() || value === name,
  );
  if (!state)
    throw new Error("Choose a recognized Indian state or union territory");
  return state[1];
}
const paise = z.number().int().min(0).max(100_000_000);
export const commerceConfigSchema = z
  .object({
    checkout_enabled: z.boolean().default(false),
    origin_pincode: z
      .string()
      .regex(/^$|^[1-9]\d{5}$/)
      .default(""),
    origin_state: z.string().default(""),
    packaging_grams: z.number().int().min(0).max(100000).default(0),
    shipping_tax_bps: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .nullable()
      .default(null),
    free_shipping_from_paise: paise.nullable().default(null),
    prepaid_enabled: z.boolean().default(true),
    cod_enabled: z.boolean().default(false),
    cod_fee_paise: paise.default(0),
    cod_tax_bps: z.number().int().min(0).max(10000).nullable().default(null),
    cod_max_total_paise: paise.default(0),
    cod_max_open_orders: z.number().int().min(0).max(10).default(0),
    cod_allowed_pincodes: z
      .array(z.string().regex(/^[1-9]\d{5}$/))
      .max(1000)
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (
      value.checkout_enabled &&
      (!value.origin_pincode ||
        !value.origin_state ||
        value.shipping_tax_bps === null)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Configure origin pincode/state and shipping tax before enabling checkout",
      });
    if (value.origin_state) {
      try {
        stateCode(value.origin_state);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Choose a valid origin state",
        });
      }
    }
    if (
      value.cod_enabled &&
      (!value.cod_allowed_pincodes.length ||
        !value.cod_max_total_paise ||
        !value.cod_max_open_orders ||
        value.cod_tax_bps === null)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Configure COD pincodes, order cap, open-order limit and tax before enabling COD",
      });
  });
export type CommerceConfig = z.infer<typeof commerceConfigSchema>;
export const defaultCommerceConfig = commerceConfigSchema.parse({});
export function configFingerprint(config: CommerceConfig) {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}
export async function getCommerceConfig() {
  const db = await getDB();
  const result = (
    await db.query<{ value: unknown }>(
      "SELECT value FROM site_settings WHERE key='commerce'",
    )
  ).rows[0];
  return commerceConfigSchema.parse(result?.value || {});
}
export async function saveCommerceConfig(actor: User, body: unknown) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to change commerce settings");
  const value = commerceConfigSchema.parse(body),
    db = await getDB();
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO site_settings(key,value) VALUES('commerce',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [JSON.stringify(value)],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'commerce.configure','commerce',$3)",
      [randomUUID(), actor.id, JSON.stringify(value)],
    );
  });
  return value;
}
export const taxClassSchema = z
  .object({
    id: z.string().min(1).max(150).optional(),
    name: z.string().trim().min(2).max(100),
    hsn: z.string().regex(/^\d{4,8}$/),
    rate_bps: z.number().int().min(0).max(10000),
    valid_from: z.iso.datetime({ offset: true }),
    valid_until: z.iso.datetime({ offset: true }).nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine(
    (v) =>
      !v.valid_until || Date.parse(v.valid_until) > Date.parse(v.valid_from),
    "Tax end date must follow its start date",
  );
export async function saveTaxClass(actor: User, body: unknown) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to change tax settings");
  const input = taxClassSchema.parse(body),
    id = input.id || randomUUID(),
    db = await getDB();
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO tax_classes(id,name,hsn,rate_bps,valid_from,valid_until,active) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,hsn=excluded.hsn,rate_bps=excluded.rate_bps,valid_from=excluded.valid_from,valid_until=excluded.valid_until,active=excluded.active`,
      [
        id,
        input.name,
        input.hsn,
        input.rate_bps,
        input.valid_from,
        input.valid_until,
        input.active,
      ],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'tax.configure',$3,$4)",
      [randomUUID(), actor.id, id, JSON.stringify(input)],
    );
  });
  return { id };
}
