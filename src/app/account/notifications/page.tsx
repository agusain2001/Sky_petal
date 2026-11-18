import { NotificationCenter } from "@/components/notification-center";
export const metadata = {
  title: "Your updates | Sky Petal",
  robots: { index: false, follow: false },
};
export default function NotificationsPage() {
  return (
    <main className="page-shell">
      <NotificationCenter />
    </main>
  );
}
