"use client";

import ProfileToggle from "@/components/ProfileToggle";
import { useAvailableRoles } from "@/hooks/useAvailableRoles";

type LinkedAccountAccessBannerProps = {
  currentProfile: "customer" | "vendor" | "admin";
  customerVendorCopy?: boolean;
};

export function LinkedAccountAccessBanner({
  currentProfile,
  customerVendorCopy = false,
}: LinkedAccountAccessBannerProps) {
  const { availableRoles, userId } = useAvailableRoles(currentProfile);

  if (availableRoles.length <= 1) return null;

  return (
    <div className="mb-6 rounded-[28px] border border-white/10 bg-white/6 px-5 py-4 shadow-[0_18px_60px_rgba(4,9,20,0.18)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/78">
            Linked account access
          </p>
          <p className="text-sm font-medium text-white">
            {customerVendorCopy
              ? "This sign-in is connected to both your customer and vendor views."
              : "This sign-in is connected to more than one Reliance view."}
          </p>
          <p className="text-sm leading-6 text-white/68">
            {customerVendorCopy
              ? "Move between requesting service as a customer and managing your business as a vendor without signing out."
              : "Move between your customer account and business tools without signing out."}
          </p>
        </div>
        <ProfileToggle
          currentProfile={currentProfile}
          availableProfiles={availableRoles}
          userId={userId}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
