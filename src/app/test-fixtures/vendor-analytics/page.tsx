import { notFound } from "next/navigation";

import VendorAnalyticsPage from "@/app/vendor/analytics/page";

export default function VendorAnalyticsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <VendorAnalyticsPage />;
}
