import { describe, expect, it } from "vitest";
import { deriveReviewWindowLifecycleTruth } from "@/lib/review-window-lifecycle";

function completedStageSession(
  asset: Partial<{
    mimeType: string;
    moderationStatus: string;
    visibilityStatus: string;
    archiveStatus: string;
  }>
) {
  return {
    vendorJobVideoStage: "COMPLETED",
    mediaAssets: [
      {
        mimeType: "video/mp4",
        moderationStatus: asset.moderationStatus ?? "approved",
        visibilityStatus: asset.visibilityStatus ?? "customer_only",
        archiveStatus: asset.archiveStatus ?? "active",
      },
    ],
  };
}

describe("deriveReviewWindowLifecycleTruth", () => {
  it("reports a review as historical when a booking has a submitted review but no eligible customer-visible completed video", () => {
    const truth = deriveReviewWindowLifecycleTruth({
      bookingStatus: "COMPLETED",
      mediaSessions: [completedStageSession({ moderationStatus: "rejected", visibilityStatus: "private" })],
      hasSubmittedReview: true,
      reviewWindows: [{ status: "active" }],
    });

    expect(truth.effectiveStatus).toBe("REVIEW_SUBMITTED_WITHOUT_ELIGIBLE_VIDEO");
    expect(truth.customerLifecycle.reviewSubmittedWithoutEligibleVideo).toBe(true);
  });

  it("keeps historical submitted-review truth visible even after the booking is archived", () => {
    const truth = deriveReviewWindowLifecycleTruth({
      bookingStatus: "ARCHIVED",
      mediaSessions: [completedStageSession({ moderationStatus: "rejected", visibilityStatus: "private" })],
      hasSubmittedReview: true,
      reviewWindows: [{ status: "active" }],
    });

    expect(truth.effectiveStatus).toBe("REVIEW_SUBMITTED_WITHOUT_ELIGIBLE_VIDEO");
  });

  it("reports video pending approval when completed work exists but no approved customer-visible completed video is ready", () => {
    const truth = deriveReviewWindowLifecycleTruth({
      bookingStatus: "COMPLETED",
      mediaSessions: [completedStageSession({ moderationStatus: "pending_review", visibilityStatus: "private" })],
      hasSubmittedReview: false,
      reviewWindows: [{ status: "active" }],
    });

    expect(truth.effectiveStatus).toBe("VIDEO_PENDING_APPROVAL");
    expect(truth.customerLifecycle.reviewWindowOpen).toBe(false);
  });

  it("reports review open only when a customer-visible approved completed-stage video exists", () => {
    const truth = deriveReviewWindowLifecycleTruth({
      bookingStatus: "COMPLETED",
      mediaSessions: [completedStageSession({ moderationStatus: "approved", visibilityStatus: "customer_only" })],
      hasSubmittedReview: false,
      reviewWindows: [{ status: "active" }],
    });

    expect(truth.effectiveStatus).toBe("REVIEW_OPEN");
    expect(truth.customerLifecycle.reviewEligible).toBe(true);
    expect(truth.customerLifecycle.reviewWindowOpen).toBe(true);
  });
});
