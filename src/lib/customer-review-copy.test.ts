import { describe, expect, it } from "vitest";

import { getCustomerReviewCopy } from "@/lib/customer-review-copy";

describe("customer-review-copy", () => {
  it("shows rating and review count when public reviews exist", () => {
    expect(
      getCustomerReviewCopy({
        rating: 4.8,
        reviewCount: 3,
      })
    ).toEqual({
      headline: "4.8 stars",
      detail: "3 public reviews",
    });
  });

  it("shows a review-count only state when the rating is unavailable", () => {
    expect(
      getCustomerReviewCopy({
        rating: null,
        reviewCount: 1,
      })
    ).toEqual({
      headline: "Customer reviews",
      detail: "1 public review",
    });
  });

  it("uses a calm empty-review state for new public listings", () => {
    expect(
      getCustomerReviewCopy({
        rating: null,
        reviewCount: 0,
      })
    ).toEqual({
      headline: "Customer reviews",
      detail: "No public reviews yet",
    });
  });
});
