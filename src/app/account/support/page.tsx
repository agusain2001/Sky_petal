import type { Metadata } from "next";
import { SupportCenter } from "@/components/support-center";
export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  return <SupportCenter initialOrder={params.order || ""} />;
}
