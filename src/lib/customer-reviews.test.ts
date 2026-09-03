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
  it("prioritizes missing Private Proof over obsolete local display state", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: false,
        canShowInlineReview: false,
        consentAllowsInlineReview: false,
      })
    ).toContain("approved Private Proof package is not available");
  });

  it("directs the customer to the completed Service Record when inline review is unavailable", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: true,
        canShowInlineReview: false,
        consentAllowsInlineReview: false,
      })
    ).toBe("Open the completed Service Record to leave your review.");
  });

  it("requires durable Private Proof access without requesting playback consent", () => {
    expect(
      getCustomerReviewGateMessage({
        hasReviewableCompletedVideo: true,
        canShowInlineReview: true,
        consentAllowsInlineReview: false,
      })
    ).toBe("Private Proof access is required before a review can be submitted.");
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
