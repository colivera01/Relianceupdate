import { describe, expect, it } from "vitest";
import {
  classifySubmittedReviewMediaState,
  getReviewsHubUnavailableMessage,
  isCustomerReviewEligibleMediaSession,
} from "./reviews-hub-state";

describe("reviews-hub-state", () => {
  it("only treats completed-stage job service videos as customer review evidence", () => {
    expect(
      isCustomerReviewEligibleMediaSession({
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "COMPLETED",
      })
    ).toBe(true);

    expect(
      isCustomerReviewEligibleMediaSession({
        sessionType: "SERVICE_RECORD",
        vendorJobVideoStage: null,
      })
    ).toBe(false);

    expect(
      isCustomerReviewEligibleMediaSession({
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
      })
    ).toBe(false);
  });

  it("returns truthful unavailable copy for pending, private, rejected, and legacy reviewed states", () => {
    expect(
      getReviewsHubUnavailableMessage({
        videoState: "pending_approval",
        reviewSubmitted: false,
        reviewSubmittedWithoutEligibleVideo: false,
        videoSubmitted: true,
        videoPendingApproval: true,
      })
    ).toContain("pending approval");

    expect(
      getReviewsHubUnavailableMessage({
        videoState: "approved_not_customer_visible",
        reviewSubmitted: false,
        reviewSubmittedWithoutEligibleVideo: false,
        videoSubmitted: true,
        videoPendingApproval: false,
      })
    ).toContain("not customer-visible");

    expect(
      getReviewsHubUnavailableMessage({
        videoState: "rejected",
        reviewSubmitted: false,
        reviewSubmittedWithoutEligibleVideo: false,
        videoSubmitted: true,
        videoPendingApproval: false,
      })
    ).toContain("not customer-visible");

    expect(
      getReviewsHubUnavailableMessage({
        videoState: "rejected",
        reviewSubmitted: true,
        reviewSubmittedWithoutEligibleVideo: true,
        videoSubmitted: true,
        videoPendingApproval: false,
      })
    ).toContain("review is already on file");
  });

  it("only marks submitted reviews as verified when customer-visible completed media is available", () => {
    expect(
      classifySubmittedReviewMediaState({
        hasCustomerVisibleVideo: true,
        hasLinkedMediaRecord: true,
      })
    ).toMatchObject({
      hasProof: true,
      state: "customer_visible_video",
      message: null,
    });

    expect(
      classifySubmittedReviewMediaState({
        hasCustomerVisibleVideo: false,
        hasLinkedMediaRecord: true,
      })
    ).toMatchObject({
      hasProof: false,
      state: "linked_media_unavailable",
    });
  });
});
