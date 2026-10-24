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
    <div className="mb-3 rounded-xl border border-white/10 bg-white/6 px-3 py-3 shadow-[0_18px_60px_rgba(4,9,20,0.18)] backdrop-blur-xl sm:mb-6 sm:rounded-[28px] sm:px-5 sm:py-4">
      <div className="flex flex-col gap-2 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/78 sm:block">
            Linked account access
          </p>
          <p className="text-xs font-medium text-white sm:text-sm">
            <span className="sm:hidden">Switch account view</span>
            <span className="hidden sm:inline">
            {customerVendorCopy
              ? "This sign-in is connected to both your customer and vendor views."
              : "This sign-in is connected to more than one Reliance view."}
            </span>
          </p>
          <p className="hidden text-sm leading-6 text-white/68 sm:block">
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
