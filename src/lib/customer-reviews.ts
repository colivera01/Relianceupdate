export function partitionBookingsByVideoAvailability<T extends { id: string | number }>(
  bookings: T[],
  readyBookingIds: ReadonlySet<string>
): { ready: T[]; awaitingVideo: T[] } {
  return bookings.reduce(
    (accumulator, booking) => {
      const bookingId = String(booking.id || "").trim();
      if (bookingId && readyBookingIds.has(bookingId)) {
        accumulator.ready.push(booking);
      } else {
        accumulator.awaitingVideo.push(booking);
      }
      return accumulator;
    },
    { ready: [] as T[], awaitingVideo: [] as T[] }
  );
}

export function getCustomerReviewGateMessage({
  hasReviewableCompletedVideo,
  canShowInlineReview,
  consentAllowsInlineReview,
}: {
  hasReviewableCompletedVideo: boolean;
  canShowInlineReview: boolean;
  consentAllowsInlineReview: boolean;
}): string | null {
  if (!hasReviewableCompletedVideo) {
    return "This service record is not ready for review because an approved Private Proof package is not available.";
  }

  if (!canShowInlineReview) {
    return "Open the completed Service Record to leave your review.";
  }

  if (!consentAllowsInlineReview) {
    return "Private Proof access is required before a review can be submitted.";
  }

  return null;
}
