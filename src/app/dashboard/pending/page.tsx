import { redirect } from "next/navigation";

export default function LegacyDashboardPendingPage() {
  redirect("/vendor/employees");
}
