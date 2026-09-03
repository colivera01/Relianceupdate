import { describe, expect, it } from 'vitest';
import { deriveCustomerReviewEligibility } from './customer-review-eligibility';

const eligible = {
  bookingId: 'booking-1',
  vendorId: 'vendor-1',
  ownsBooking: true,
  serviceCompleted: true,
  privateProofAvailable: true,
  mediaSessionId: 'final-session-1',
};

describe('canonical customer review eligibility', () => {
  it('allows a completed Service Record with active Private Proof without playback state', () => {
    expect(deriveCustomerReviewEligibility(eligible)).toMatchObject({ eligible: true, code: 'ELIGIBLE' });
  });

  it('does not require Final Result selection, video_access, or session storage input', () => {
    const result = deriveCustomerReviewEligibility({ ...eligible });
    expect(result.eligible).toBe(true);
    expect(Object.keys(eligible)).not.toEqual(expect.arrayContaining(['selectedStage', 'videoAccess', 'sessionStorageConsent']));
  });

  it.each([
    ['wrong customer', { ownsBooking: false }, 'WRONG_CUSTOMER'],
    ['unfinished service', { serviceCompleted: false }, 'SERVICE_NOT_COMPLETED'],
    ['no active Private Proof', { privateProofAvailable: false }, 'PRIVATE_PROOF_REQUIRED'],
    ['no exact approved stage binding', { mediaSessionId: null }, 'PRIVATE_PROOF_REQUIRED'],
    ['existing review', { existingReviewId: 'review-1' }, 'REVIEW_ALREADY_EXISTS'],
  ])('fails closed for %s', (_label, override, code) => {
    expect(deriveCustomerReviewEligibility({ ...eligible, ...override })).toMatchObject({ eligible: false, code });
  });

  it('keeps an archived completed record eligible because organization does not alter service evidence', () => {
    expect(deriveCustomerReviewEligibility({ ...eligible })).toMatchObject({ eligible: true });
  });

  it('does not infer completion for a cancelled record', () => {
    expect(deriveCustomerReviewEligibility({ ...eligible, serviceCompleted: false })).toMatchObject({
      eligible: false,
      code: 'SERVICE_NOT_COMPLETED',
    });
  });
});
