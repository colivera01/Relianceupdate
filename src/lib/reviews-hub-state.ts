import type { CustomerBookingLifecycle } from "@/lib/customer-booking-lifecycle";

export function isCustomerReviewEligibleMediaSession(input: {
  sessionType?: string | null;
  vendorJobVideoStage?: string | null;
}): boolean {
  const sessionType = String(input.sessionType || "").trim().toUpperCase();
  const stage = String(input.vendorJobVideoStage || "").trim().toUpperCase();
  return sessionType === "JOB_SERVICE_VIDEO" && stage === "COMPLETED";
}

export function getReviewsHubUnavailableMessage(
  lifecycle: Pick<
    CustomerBookingLifecycle,
    | "videoState"
    | "reviewSubmitted"
    | "reviewSubmittedWithoutEligibleVideo"
    | "videoSubmitted"
    | "videoPendingApproval"
  >
): string {
  if (lifecycle.reviewSubmittedWithoutEligibleVideo) {
    return "A review is already on file for this completed booking, but no customer-visible approved final-result video is currently available.";
  }

  if (lifecycle.videoState === "pending_approval" || lifecycle.videoPendingApproval) {
    return "Service completed. Video is pending approval.";
  }

  if (lifecycle.videoState === "approved_not_customer_visible") {
    return "Service completed. A final-result video exists, but it is not customer-visible right now.";
  }

  if (lifecycle.videoState === "rejected") {
    return "Service completed. A final-result video was submitted, but it is not customer-visible right now.";
  }

  if (lifecycle.videoSubmitted) {
    return "Service completed. A final-result video exists, but it is not customer-visible right now.";
  }

  return "Service completed, but no customer-visible approved final-result video is currently attached.";
}

export type SubmittedReviewMediaState =
  | "customer_visible_video"
  | "linked_media_unavailable"
  | "no_linked_media";

export function classifySubmittedReviewMediaState(input: {
  hasCustomerVisibleVideo: boolean;
  hasLinkedMediaRecord: boolean;
}): {
  hasProof: boolean;
  state: SubmittedReviewMediaState;
  message: string | null;
} {
  if (input.hasCustomerVisibleVideo) {
    return {
      hasProof: true,
      state: "customer_visible_video",
      message: null,
    };
  }

  if (input.hasLinkedMediaRecord) {
    return {
      hasProof: false,
      state: "linked_media_unavailable",
      message:
        "A review remains on file for this completed booking, but no customer-visible approved service media is currently available here.",
    };
  }

  return {
    hasProof: false,
    state: "no_linked_media",
    message: null,
  };
}
