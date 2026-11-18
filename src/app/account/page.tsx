import { Suspense } from "react";
import { Account } from "@/components/account";
export const metadata = { title: "Your account" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="page-shell">Opening your little corner…</div>}
    >
      <Account />
    </Suspense>
  );
}
