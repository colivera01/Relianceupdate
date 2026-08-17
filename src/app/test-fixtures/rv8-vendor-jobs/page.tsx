import { notFound } from "next/navigation";

import VendorJobs from "@/app/vendor/jobs/page";

export default function Rv8VendorJobsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <VendorJobs />;
}
