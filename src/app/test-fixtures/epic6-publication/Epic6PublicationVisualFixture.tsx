"use client";

import { useSearchParams } from "next/navigation";
import AdminPublicationModerationPage from "@/app/admin/publication-moderation/page";
import { PublicationWorkflowCard } from "@/components/service-video/PublicationWorkflowCard";

const BOOKING_ID = "epic6-controlled-booking";
const VENDOR_ID = "epic6-controlled-vendor";

export default function Epic6PublicationVisualFixture() {
  const role = useSearchParams()?.get("role");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        {role === "admin" ? <AdminPublicationModerationPage /> : null}
        {role === "vendor" || role === "customer" || role === "employee" ? (
          <PublicationWorkflowCard
            role={role}
            bookingId={BOOKING_ID}
            vendorId={role === "vendor" ? VENDOR_ID : undefined}
          />
        ) : null}
      </div>
    </main>
  );
}
