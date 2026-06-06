import { describe, expect, it } from "vitest";
import { buildCompleteMediaModerationPackages } from "./admin-media-moderation-packages";

const baseVideo = {
  vendorId: "vendor-1",
  vendorName: "Metro Home Care Pros",
  bookingId: "booking-1",
  jobTitle: "Metro Apartment Deep Clean",
  bookingStatus: "COMPLETED",
  clientName: "Jordan Rivera",
  serviceName: "Metro Apartment Deep Clean",
  uploadedByMembershipId: "membership-1",
};

describe("buildCompleteMediaModerationPackages packageReadiness", () => {
  it("marks fully approved packages as APPROVED", () => {
    const packages = buildCompleteMediaModerationPackages([
      {
        ...baseVideo,
        vendorJobVideoStageKey: "INTRO",
        moderationStatus: "approved",
        visibilityStatus: "public",
        createdAt: "2026-06-05T19:53:06.953Z",
      },
      {
        ...baseVideo,
        vendorJobVideoStageKey: "IN_PROGRESS",
        moderationStatus: "approved",
        visibilityStatus: "public",
        createdAt: "2026-06-05T19:53:11.914Z",
      },
      {
        ...baseVideo,
        vendorJobVideoStageKey: "COMPLETED",
        moderationStatus: "approved",
        visibilityStatus: "public",
        createdAt: "2026-06-05T19:53:14.809Z",
      },
    ]);

    expect(packages).toHaveLength(1);
    expect(packages[0]?.packageReadiness).toBe("APPROVED");
  });

  it("marks packages with rejected or flagged stages as REJECTED_OR_FLAGGED", () => {
    const packages = buildCompleteMediaModerationPackages([
      {
        ...baseVideo,
        vendorJobVideoStageKey: "INTRO",
        moderationStatus: "approved",
        visibilityStatus: "public",
        createdAt: "2026-06-05T19:53:06.953Z",
      },
      {
        ...baseVideo,
        vendorJobVideoStageKey: "IN_PROGRESS",
        moderationStatus: "flagged",
        visibilityStatus: "private",
        createdAt: "2026-06-05T19:53:11.914Z",
      },
      {
        ...baseVideo,
        vendorJobVideoStageKey: "COMPLETED",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        createdAt: "2026-06-05T19:53:14.809Z",
      },
    ]);

    expect(packages).toHaveLength(1);
    expect(packages[0]?.packageReadiness).toBe("REJECTED_OR_FLAGGED");
  });

  it("keeps partially reviewed packages in READY_FOR_ADMIN_REVIEW", () => {
    const packages = buildCompleteMediaModerationPackages([
      {
        ...baseVideo,
        vendorJobVideoStageKey: "INTRO",
        moderationStatus: "approved",
        visibilityStatus: "public",
        createdAt: "2026-06-05T19:53:06.953Z",
      },
      {
        ...baseVideo,
        vendorJobVideoStageKey: "IN_PROGRESS",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        createdAt: "2026-06-05T19:53:11.914Z",
      },
      {
        ...baseVideo,
        vendorJobVideoStageKey: "COMPLETED",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        createdAt: "2026-06-05T19:53:14.809Z",
      },
    ]);

    expect(packages).toHaveLength(1);
    expect(packages[0]?.packageReadiness).toBe("READY_FOR_ADMIN_REVIEW");
  });
});
