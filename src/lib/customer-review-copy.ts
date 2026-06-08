type CustomerReviewCopyInput = {
  rating: number | null | undefined;
  reviewCount: number | null | undefined;
};

export type CustomerReviewCopy = {
  headline: string;
  detail: string;
};

export function getCustomerReviewCopy(
  input: CustomerReviewCopyInput
): CustomerReviewCopy {
  const reviewCount = typeof input.reviewCount === "number" ? input.reviewCount : 0;

  if (reviewCount > 0 && typeof input.rating === "number") {
    return {
      headline: `${input.rating.toFixed(1)} stars`,
      detail: `${reviewCount} public review${reviewCount === 1 ? "" : "s"}`,
    };
  }

  if (reviewCount > 0) {
    return {
      headline: "Customer reviews",
      detail: `${reviewCount} public review${reviewCount === 1 ? "" : "s"}`,
    };
  }

  return {
    headline: "Customer reviews",
    detail: "No public reviews yet",
  };
}
