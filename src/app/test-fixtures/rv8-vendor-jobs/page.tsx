import { notFound } from "next/navigation";

import VendorJobs from "@/app/vendor/jobs/page";
import VendorSessionGuard from "@/components/vendor/VendorSessionGuard";

export default function Rv8VendorJobsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return (
    <>
      <VendorSessionGuard />
      <VendorJobs />
    </>
  );
}
