import { StaffSecurity } from "@/components/staff-security";
export const metadata = {
  title: "Team security",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StaffSecurity />;
}
