import { describe, expect, it } from "vitest";

import { getCustomerReviewGateMessage, partitionBookingsByVideoAvailability } from "./customer-reviews";

describe("partitionBookingsByVideoAvailability", () => {
  it("splits ready bookings from awaiting-video bookings", () => {
    const bookings = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const result = partitionBookingsByVideoAvailability(bookings, new Set(["b", "c"]));

    expect(result.ready).toEqual([{ id: "b" }, { id: "c" }]);
    expect(result.awaitingVideo).toEqual([{ id: "a" }]);
  });
});

describe("getCustomerReviewGateMessage", () => {
  it("prioritizes missing video over missing consent", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: false,
        canShowInlineReview: false,
        consentAllowsInlineReview: false,
      })
    ).toContain("no customer-visible approved completed-service video");
  });

  it("prompts the customer to switch to the completed stage when review video exists but is not selected", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: true,
        canShowInlineReview: false,
        consentAllowsInlineReview: false,
      })
    ).toBe("Switch to the Completed stage to submit your review.");
  });

  it("returns consent guidance once the completed review stage is active", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: true,
        canShowInlineReview: true,
        consentAllowsInlineReview: false,
      })
    ).toBe("Approve video access before leaving your review.");
  });

  it("returns null when review can proceed", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: true,
        canShowInlineReview: true,
        consentAllowsInlineReview: true,
      })
    ).toBeNull();
  });
});
