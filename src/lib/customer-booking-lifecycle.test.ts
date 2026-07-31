import { describe, expect, it } from 'vitest';
import { deriveCustomerBookingLifecycle } from './customer-booking-lifecycle';

function completedSession(
  assets: Array<{
    mimeType?: string;
    moderationStatus?: string;
    visibilityStatus?: string;
    archiveStatus?: string;
  }>
) {
  return {
    vendorJobVideoStage: 'COMPLETED',
    mediaAssets: assets,
  };
}

describe('deriveCustomerBookingLifecycle', () => {
  it('treats a completed booking with an approved customer-visible completed video and no review as review-eligible', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'COMPLETED',
      hasSubmittedReview: false,
      mediaSessions: [
        completedSession([
          {
            mimeType: 'video/mp4',
            moderationStatus: 'approved',
            visibilityStatus: 'public',
            archiveStatus: 'active',
          },
        ]),
      ],
    });

    expect(lifecycle.videoState).toBe('available_to_customer');
    expect(lifecycle.reviewEligible).toBe(true);
    expect(lifecycle.reviewSubmitted).toBe(false);
  });

  it('keeps an eligible review available despite an old expired compatibility row', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'COMPLETED',
      hasSubmittedReview: false,
      mediaSessions: [
        completedSession([
          {
            mimeType: 'video/mp4',
            moderationStatus: 'approved',
            visibilityStatus: 'customer_only',
            archiveStatus: 'active',
          },
        ]),
      ],
      reviewWindows: [{ status: 'expired' }],
    });

    expect(lifecycle.reviewEligible).toBe(true);
    expect(lifecycle.reviewWindowOpen).toBe(true);
    expect(lifecycle.reviewSubmitted).toBe(false);
  });

  it('keeps a completed booking with an approved customer-visible completed video and submitted review logically consistent', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'completed',
      hasSubmittedReview: true,
      mediaSessions: [
        completedSession([
          {
            mimeType: 'video/mp4',
            moderationStatus: 'approved',
            visibilityStatus: 'customer_only',
            archiveStatus: 'active',
          },
        ]),
      ],
      reviewWindows: [{ status: 'submitted' }],
    });

    expect(lifecycle.videoState).toBe('available_to_customer');
    expect(lifecycle.reviewEligible).toBe(true);
    expect(lifecycle.reviewSubmitted).toBe(true);
    expect(lifecycle.reviewSubmittedWithoutEligibleVideo).toBe(false);
    expect(lifecycle.reviewWindowOpen).toBe(false);
  });

  it('treats a completed booking without a completed-stage approved video as not submitted when no completed-stage asset exists', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'COMPLETED',
      hasSubmittedReview: false,
      mediaSessions: [],
    });

    expect(lifecycle.videoState).toBe('not_submitted');
    expect(lifecycle.reviewEligible).toBe(false);
    expect(lifecycle.videoAvailableToCustomer).toBe(false);
  });

  it('treats a completed booking with a pending completed-stage video as pending approval', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'COMPLETED',
      hasSubmittedReview: false,
      mediaSessions: [
        completedSession([
          {
            mimeType: 'video/mp4',
            moderationStatus: 'pending_review',
            visibilityStatus: 'private',
            archiveStatus: 'active',
          },
        ]),
      ],
    });

    expect(lifecycle.videoState).toBe('pending_approval');
    expect(lifecycle.reviewEligible).toBe(false);
    expect(lifecycle.videoPendingApproval).toBe(true);
  });

  it('flags a completed booking with a rejected completed-stage video and submitted review as a legacy submitted-without-eligible-video state', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'COMPLETED',
      hasSubmittedReview: true,
      mediaSessions: [
        completedSession([
          {
            mimeType: 'video/mp4',
            moderationStatus: 'rejected',
            visibilityStatus: 'private',
            archiveStatus: 'active',
          },
        ]),
      ],
    });

    expect(lifecycle.videoState).toBe('rejected');
    expect(lifecycle.reviewEligible).toBe(false);
    expect(lifecycle.reviewSubmitted).toBe(true);
    expect(lifecycle.reviewSubmittedWithoutEligibleVideo).toBe(true);
  });

  it('does not expose a legacy active review window as open when no eligible customer-visible completed video exists', () => {
    const lifecycle = deriveCustomerBookingLifecycle({
      bookingStatus: 'ARCHIVED',
      hasSubmittedReview: true,
      mediaSessions: [
        completedSession([
          {
            mimeType: 'video/mp4',
            moderationStatus: 'rejected',
            visibilityStatus: 'private',
            archiveStatus: 'active',
          },
        ]),
      ],
      reviewWindows: [{ status: 'active' }],
    });

    expect(lifecycle.reviewEligible).toBe(false);
    expect(lifecycle.reviewSubmittedWithoutEligibleVideo).toBe(true);
    expect(lifecycle.reviewWindowOpen).toBe(false);
  });
});
