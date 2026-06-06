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
        "A historical review is on file, but there is no current customer-visible approved completed-stage service video.",
      customerLifecycle,
    };
  }

  if (!customerLifecycle.completedWorkMarked) {
    return {
      effectiveStatus: "BOOKING_NOT_COMPLETED",
      lifecycleNote:
        "The booking is not in a completed state, so no customer review window should be open yet.",
      customerLifecycle,
    };
  }

  if (customerLifecycle.reviewWindowOpen) {
    return {
      effectiveStatus: "REVIEW_OPEN",
      lifecycleNote:
        "Customer-visible approved completed-stage service video exists, so the review window is legitimately open.",
      customerLifecycle,
    };
  }

  switch (customerLifecycle.videoState) {
    case "pending_approval":
      return {
        effectiveStatus: "VIDEO_PENDING_APPROVAL",
        lifecycleNote:
          "Service work is complete, but the completed-stage service video is still pending approval.",
        customerLifecycle,
      };
    case "approved_not_customer_visible":
      return {
        effectiveStatus: "VIDEO_APPROVED_NOT_CUSTOMER_VISIBLE",
        lifecycleNote:
          "A completed-stage service video is approved internally, but it is not customer-visible yet.",
        customerLifecycle,
      };
    case "rejected":
      return {
        effectiveStatus: "VIDEO_REJECTED",
        lifecycleNote:
          "Completed-stage service video exists, but the current customer-facing copy should not promise playback or review because the video was rejected.",
        customerLifecycle,
      };
    default:
      return {
        effectiveStatus: "NO_COMPLETED_VIDEO_SUBMITTED",
        lifecycleNote:
          "The booking is complete, but no completed-stage service video has been submitted for customer review access.",
        customerLifecycle,
      };
  }
}
