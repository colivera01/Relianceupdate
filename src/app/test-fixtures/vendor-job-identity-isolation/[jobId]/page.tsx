import { notFound } from "next/navigation";

import VendorLayout from "@/app/vendor/layout";
import VendorJobDetailPage from "@/app/vendor/jobs/[jobId]/page";

export default function VendorJobIdentityIsolationFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();

  return (
    <VendorLayout>
      <VendorJobDetailPage />
    </VendorLayout>
  );
}
