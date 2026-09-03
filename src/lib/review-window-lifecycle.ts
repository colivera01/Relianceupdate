import {
  deriveCustomerBookingLifecycle,
  type CustomerBookingLifecycle,
} from "@/lib/customer-booking-lifecycle";

export type ReviewWindowLifecycleStatus =
  | "REVIEW_OPEN"
  | "REVIEW_SUBMITTED"
  | "REVIEW_SUBMITTED_WITHOUT_ELIGIBLE_VIDEO"
  | "VIDEO_PENDING_APPROVAL"
  | "VIDEO_APPROVED_NOT_CUSTOMER_VISIBLE"
  | "VIDEO_REJECTED"
  | "NO_COMPLETED_VIDEO_SUBMITTED"
  | "BOOKING_NOT_COMPLETED";

export type ReviewWindowLifecycleTruth = {
  effectiveStatus: ReviewWindowLifecycleStatus;
  lifecycleNote: string;
  customerLifecycle: CustomerBookingLifecycle;
};

export function deriveReviewWindowLifecycleTruth(input: {
  bookingStatus: string | null | undefined;
  mediaSessions?: Array<{
    vendorJobVideoStage?: string | null;
    mediaAssets?: Array<{
      mimeType?: string | null;
      moderationStatus?: string | null;
      visibilityStatus?: string | null;
      archiveStatus?: string | null;
    }> | null;
  }> | null;
  hasSubmittedReview: boolean;
  reviewWindows?: Array<{ status?: string | null }> | null;
}): ReviewWindowLifecycleTruth {
  const customerLifecycle = deriveCustomerBookingLifecycle({
    bookingStatus: input.bookingStatus,
    mediaSessions: input.mediaSessions,
    hasSubmittedReview: input.hasSubmittedReview,
    reviewWindows: input.reviewWindows,
  });

  if (customerLifecycle.reviewSubmitted) {
    if (customerLifecycle.videoAvailableToCustomer) {
      return {
        effectiveStatus: "REVIEW_SUBMITTED",
        lifecycleNote:
          "A valid customer review is already on file for this completed booking.",
        customerLifecycle,
      };
    }
    return {
      effectiveStatus: "REVIEW_SUBMITTED_WITHOUT_ELIGIBLE_VIDEO",
      lifecycleNote:
        "A historical review is on file, but an approved Private Proof package is not currently available.",
      customerLifecycle,
    };
  }

  if (!customerLifecycle.completedWorkMarked) {
    return {
      effectiveStatus: "BOOKING_NOT_COMPLETED",
      lifecycleNote:
        "The booking is not in a completed state, so customer review availability has not begun.",
      customerLifecycle,
    };
  }

  if (customerLifecycle.reviewWindowOpen) {
    return {
      effectiveStatus: "REVIEW_OPEN",
      lifecycleNote:
        "An approved Private Proof package is available, so an optional customer review is open.",
      customerLifecycle,
    };
  }

  switch (customerLifecycle.videoState) {
    case "pending_approval":
      return {
        effectiveStatus: "VIDEO_PENDING_APPROVAL",
        lifecycleNote:
          "Service work is complete, but the Service Video package is still awaiting Reliance Audit.",
        customerLifecycle,
      };
    case "approved_not_customer_visible":
      return {
        effectiveStatus: "VIDEO_APPROVED_NOT_CUSTOMER_VISIBLE",
        lifecycleNote:
          "The Service Video package is approved internally, but Private Proof is not currently available.",
        customerLifecycle,
      };
    case "rejected":
      return {
        effectiveStatus: "VIDEO_REJECTED",
        lifecycleNote:
          "The submitted Service Video package did not pass Reliance Audit, so playback and review are unavailable.",
        customerLifecycle,
      };
    default:
      return {
        effectiveStatus: "NO_COMPLETED_VIDEO_SUBMITTED",
        lifecycleNote:
          "The service is complete, but an approved Private Proof package is not available.",
        customerLifecycle,
      };
  }
}
