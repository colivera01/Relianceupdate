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
    return "This booking is not ready for the video-based review flow because no customer-visible approved completed-service video is attached.";
  }

  if (!canShowInlineReview) {
    return "Switch to the Completed stage to submit your review.";
  }

  if (!consentAllowsInlineReview) {
    return "Approve video access before leaving your review.";
  }

  return null;
}
