import { ReturnsCenter } from "@/components/returns-center";
export const metadata = {
  title: "Returns & refunds | Sky Petal",
  robots: { index: false, follow: false },
};
export default function ReturnsPage() {
  return (
    <main className="page-shell">
      <ReturnsCenter />
    </main>
  );
}
