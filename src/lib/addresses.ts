import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import type { SavedAddress } from "./types";

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  line1: z.string().trim().min(5).max(200),
  line2: z.string().trim().max(200).default(""),
  landmark: z.string().trim().max(150).default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postal: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid six-digit Indian PIN code"),
  country: z.literal("IN").default("IN"),
});
export const savedAddressSchema = addressSchema
  .extend({
    label: z.string().trim().min(1).max(50).default("Home"),
    kind: z.enum(["shipping", "billing", "both"]).default("both"),
    default_shipping: z.boolean().default(false),
    default_billing: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "billing" && value.default_shipping)
      ctx.addIssue({
        code: "custom",
        message: "A billing address cannot be your shipping default",
        path: ["default_shipping"],
      });
    if (value.kind === "shipping" && value.default_billing)
      ctx.addIssue({
        code: "custom",
        message: "A shipping address cannot be your billing default",
        path: ["default_billing"],
      });
  });

export async function listAddresses(userId: string) {
  const db = await getDB();
  return (
    await db.query<SavedAddress>(
      "SELECT id,content,label,kind,default_shipping,default_billing,created_at,updated_at FROM addresses WHERE user_id=$1 ORDER BY default_shipping DESC,created_at,id",
      [userId],
    )
  ).rows;
}

export async function saveAddress(
  userId: string,
  body: unknown,
  addressId?: string,
) {
  const input = savedAddressSchema.parse(body);
  const { label, kind, default_shipping, default_billing, ...content } = input;
  const db = await getDB();
  return db.transaction(async (tx) => {
    // Serializes create/edit/delete/default changes for one customer, including empty books.
    const user = await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      userId,
    ]);
    if (!user.rows.length) throw new Error("Sign in to manage your addresses");
    const existing = (
      await tx.query<SavedAddress>(
        "SELECT * FROM addresses WHERE user_id=$1 ORDER BY created_at,id",
        [userId],
      )
    ).rows;
    if (addressId && !existing.some((address) => address.id === addressId))
      throw new Error("Address not found");
    const id = addressId || randomUUID();
    // Preserve a current default unless the address becomes ineligible. First eligible address defaults automatically.
    const previous = existing.find((address) => address.id === id);
    const shipping =
      kind !== "billing" &&
      (default_shipping ||
        previous?.default_shipping ||
        !existing.some(
          (address) => address.id !== id && address.default_shipping,
        ));
    const billing =
      kind !== "shipping" &&
      (default_billing ||
        previous?.default_billing ||
        !existing.some(
          (address) => address.id !== id && address.default_billing,
        ));
    if (shipping)
      await tx.query(
        "UPDATE addresses SET default_shipping=false WHERE user_id=$1 AND default_shipping",
        [userId],
      );
    if (billing)
      await tx.query(
        "UPDATE addresses SET default_billing=false WHERE user_id=$1 AND default_billing",
        [userId],
      );
    const result = await tx.query<SavedAddress>(
      `INSERT INTO addresses(id,user_id,content,label,kind,default_shipping,default_billing)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET
       content=excluded.content,label=excluded.label,kind=excluded.kind,
       default_shipping=excluded.default_shipping,default_billing=excluded.default_billing,updated_at=now()
       RETURNING id,content,label,kind,default_shipping,default_billing,created_at,updated_at`,
      [
        id,
        userId,
        JSON.stringify(content),
        label,
        kind,
        Boolean(shipping),
        Boolean(billing),
      ],
    );
    await repairDefaults(tx, userId);
    return result.rows[0];
  });
}

type Transaction = Parameters<
  Parameters<Awaited<ReturnType<typeof getDB>>["transaction"]>[0]
>[0];
async function repairDefaults(tx: Transaction, userId: string) {
  for (const [column, excludedKind] of [
    ["default_shipping", "billing"],
    ["default_billing", "shipping"],
  ] as const) {
    await tx.query(
      `UPDATE addresses SET ${column}=true,updated_at=now()
      WHERE id=(SELECT id FROM addresses WHERE user_id=$1 AND kind<>$2 ORDER BY created_at,id LIMIT 1)
      AND NOT EXISTS(SELECT 1 FROM addresses WHERE user_id=$1 AND ${column})`,
      [userId, excludedKind],
    );
  }
}

export async function deleteAddress(userId: string, addressId: string) {
  const db = await getDB();
  await db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const result = await tx.query(
      "DELETE FROM addresses WHERE id=$1 AND user_id=$2 RETURNING id",
      [addressId, userId],
    );
    if (!result.rows.length) throw new Error("Address not found");
    await repairDefaults(tx, userId);
  });
}

export async function checkoutAddress(
  userId: string,
  addressId: string,
  purpose: "shipping" | "billing",
) {
  const db = await getDB();
  const result = await db.query<SavedAddress>(
    "SELECT content,kind FROM addresses WHERE id=$1 AND user_id=$2",
    [addressId, userId],
  );
  const address = result.rows[0];
  if (!address || (address.kind !== "both" && address.kind !== purpose))
    throw new Error(`Choose one of your saved ${purpose} addresses`);
  return addressSchema.parse(address.content);
}
