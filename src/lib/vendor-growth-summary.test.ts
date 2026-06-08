import { describe, expect, it } from "vitest";

import { buildVendorGrowthSummary } from "@/lib/vendor-growth-summary";

describe("vendor-growth-summary", () => {
  it("tells visible vendors how public proof supports growth", () => {
    const summary = buildVendorGrowthSummary({
      vendorId: "vendor-1",
      onboarding: {
        membershipStatus: "ACTIVE",
        isPubliclyListed: true,
        publiclyListedAt: "2026-06-08T00:00:00.000Z",
        serviceDraftCount: 2,
        publishedServiceCount: 1,
        missingProfileFields: [],
        hasRequiredProfileFields: true,
        readyForAdminReview: true,
        readyForPublicVisibility: true,
        vendorVisibleToPublic: true,
        approvalLabel: "Approved for vendor access",
        publicVisibilityLabel: "Publicly visible",
        nextStep: "Your vendor listing is publicly visible.",
        checklist: [],
      },
      publishedReviewCount: 3,
      approvedServiceVideoCount: 2,
      promotionServices: [{ id: "service-1", name: "Drain Cleaning", isPublished: true }],
    });

    expect(summary.visibilityTitle).toContain("visible");
    expect(summary.metrics[0].value).toBe("Publicly visible");
    expect(summary.metrics[1].value).toBe("1");
    expect(summary.promotionStatus.label).toContain("Eligible");
    expect(summary.publicProfileHref).toBe("/vendors/vendor-1");
  });

  it("pushes incomplete vendors toward the most important growth blockers first", () => {
    const summary = buildVendorGrowthSummary({
      vendorId: "vendor-2",
      onboarding: {
        membershipStatus: "PENDING",
        isPubliclyListed: false,
        publiclyListedAt: null,
        serviceDraftCount: 0,
        publishedServiceCount: 0,
        missingProfileFields: ["business description", "phone number"],
        hasRequiredProfileFields: false,
        readyForAdminReview: false,
        readyForPublicVisibility: false,
        vendorVisibleToPublic: false,
        approvalLabel: "Pending admin approval",
        publicVisibilityLabel: "Waiting for admin approval before public listing",
        nextStep: "Finish your business profile.",
        checklist: [],
      },
      publishedReviewCount: 0,
      approvedServiceVideoCount: 0,
    });

    expect(summary.visibilityTitle).toContain("not public");
    expect(summary.nextSteps[0].label).toContain("Complete the missing profile details");
    expect(summary.nextSteps.some((step) => step.href === "/vendor/services")).toBe(true);
    expect(summary.promotionStatus.label).toContain("Not ready");
  });
});
