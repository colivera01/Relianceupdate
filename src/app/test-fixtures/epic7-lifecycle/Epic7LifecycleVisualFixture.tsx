"use client";

import { useSearchParams } from "next/navigation";

import AdminMediaLifecyclePage from "@/app/admin/media-lifecycle/page";
import { MediaLifecycleCard } from "@/components/service-video/MediaLifecycleCard";

const BOOKING_ID = "epic7-controlled-booking";

export default function Epic7LifecycleVisualFixture() {
  const role = useSearchParams()?.get("role");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        {role === "admin" ? <AdminMediaLifecyclePage /> : null}
        {role === "employee" ? <MediaLifecycleCard role="employee" bookingId={BOOKING_ID} /> : null}
      </div>
    </main>
  );
}
