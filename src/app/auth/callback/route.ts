import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getDB } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code)
    return NextResponse.redirect(
      new URL("/account?error=Sign-in+was+cancelled", req.url),
    );
  const sb = await supabase();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email || !data.user.email_confirmed_at)
    return NextResponse.redirect(
      new URL("/account?error=Could+not+verify+sign-in", req.url),
    );
  const u = data.user;
  const db = await getDB();
  if (
    (
      await db.query(
        "SELECT id FROM users WHERE id=$1 AND (deleted_at IS NOT NULL OR suspended_at IS NOT NULL)",
        [u.id],
      )
    ).rows.length
  )
    return NextResponse.redirect(
      new URL("/account?error=This+account+is+unavailable", req.url),
    );
  await db.query(
    "INSERT INTO users(id,email,name) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET name=excluded.name",
    [u.id, u.email, u.user_metadata.full_name || u.email!.split("@")[0]],
  );
  const local = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE email=$1",
    [u.email],
  );
  await createSession(local.rows[0].id, "supabase");
  await mergeGuestCart(local.rows[0].id);
  const next = req.nextUrl.searchParams.get("next");
  return NextResponse.redirect(
    new URL(next === "/account?view=Password" ? next : "/checkout", req.url),
  );
}
