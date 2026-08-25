"use client";

import { useSearchParams } from "next/navigation";

import { PackageVisibilityCard } from "@/components/service-video/PackageVisibilityCard";

export default function Rv8PackageVisibilityFixture() {
  const role = useSearchParams()?.get("role") === "vendor" ? "vendor" : "customer";
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PackageVisibilityCard role={role} bookingId="rv8-package-visibility-booking" />
      </div>
    </main>
  );
}
