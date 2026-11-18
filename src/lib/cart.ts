import { z } from "zod";
import { getDB } from "./db";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
export async function mergeGuestCart(userId: string) {
  const db = await getDB();
  const guest = (await cookies()).get("sp_cart")?.value;
  if (!guest) return;
  await db.transaction(async (tx) => {
    const r = await tx.query<{ id: string }>(
      "SELECT id FROM carts WHERE user_id=$1",
      [userId],
    );
    const cid = r.rows[0]?.id || randomUUID();
    await tx.query("INSERT INTO carts VALUES($1,$2) ON CONFLICT DO NOTHING", [
      cid,
      userId,
    ]);
    await tx.query(
      "INSERT INTO cart_items(cart_id,variant_id,quantity) SELECT $1,ci.variant_id,LEAST(ci.quantity,v.stock,20) FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id WHERE ci.cart_id=$2 AND v.stock>0 ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=LEAST(cart_items.quantity+excluded.quantity,20,(SELECT stock FROM product_variants WHERE id=excluded.variant_id))",
      [cid, guest],
    );
    await tx.query("DELETE FROM carts WHERE id=$1 AND user_id IS NULL", [
      guest,
    ]);
  });
  (await cookies()).delete("sp_cart");
}

const cartMutation = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("increment"),
    variant_id: z.string().min(1).max(150),
    quantity: z.number().int().min(1).max(20),
  }),
  z.object({
    operation: z.literal("set"),
    variant_id: z.string().min(1).max(150),
    quantity: z.number().int().min(0).max(20),
  }),
]);
/** The HTTP layer resolves cart ownership. Serialize mutations with checkout on
 * that cart; Add is a delta, while quantity editing remains an explicit set. */
export async function mutateCart(cartId: string, input: unknown) {
  const data = cartMutation.parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    if (
      !(await tx.query("SELECT id FROM carts WHERE id=$1 FOR UPDATE", [cartId]))
        .rows.length
    )
      throw new Error("Your shopping bag could not be verified");
    if (data.operation === "set" && data.quantity === 0) {
      await tx.query(
        "DELETE FROM cart_items WHERE cart_id=$1 AND variant_id=$2",
        [cartId, data.variant_id],
      );
      return { ok: true };
    }
    const variant = (
      await tx.query<{ stock: number }>(
        "SELECT v.stock FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=$1 AND p.published=true FOR SHARE OF v,p",
        [data.variant_id],
      )
    ).rows[0];
    const old = (
      await tx.query<{ quantity: number }>(
        "SELECT quantity FROM cart_items WHERE cart_id=$1 AND variant_id=$2",
        [cartId, data.variant_id],
      )
    ).rows[0];
    const quantity =
      data.quantity + (data.operation === "increment" ? old?.quantity || 0 : 0);
    if (!variant || quantity > Math.min(variant.stock, 20))
      throw new Error("This quantity is not currently available");
    await tx.query(
      "INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES($1,$2,$3) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=excluded.quantity",
      [cartId, data.variant_id, quantity],
    );
    return { ok: true };
  });
}
