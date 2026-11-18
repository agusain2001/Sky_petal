import type { Metadata } from "next";
import { OrderDetail } from "@/components/order-card";
export const metadata: Metadata = {
  title: "Your order | Sky Petal",
  robots: { index: false, follow: false },
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}
