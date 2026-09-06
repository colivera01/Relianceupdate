import { notFound } from "next/navigation";

import VendorDashboard from "@/app/vendor/dashboard/page";

export default function Rv8VendorDashboardFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <div className="reliance-operator-shell min-h-screen p-4"><VendorDashboard /></div>;
}
