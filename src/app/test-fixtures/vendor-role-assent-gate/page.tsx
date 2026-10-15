import { notFound } from "next/navigation";

import VendorLayout from "@/app/vendor/layout";

export default function VendorRoleAssentGateFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();

  return (
    <VendorLayout>
      <section className="border border-emerald-300/40 bg-emerald-950/25 p-6 text-white">
        <h1 className="text-2xl font-semibold">Unlocked Vendor Workspace</h1>
        <p className="mt-2 text-sm text-white/70">
          Operational Vendor content is visible only after the current organization assent passes.
        </p>
      </section>
    </VendorLayout>
  );
}
