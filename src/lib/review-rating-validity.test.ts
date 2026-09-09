import { describe, expect, it } from 'vitest';
import {
  canonicalPublicWrittenReviewWhere,
  canonicalVerifiedCustomerRatingWhere,
  customerCommentModerationState,
} from './review-rating-validity';

describe('verified Customer Review rating contract', () => {
  it('counts corrected-contract verified stars independently of comment moderation', () => {
    expect(canonicalVerifiedCustomerRatingWhere()).toMatchObject({
      OR: expect.arrayContaining([
        { contractVersion: { gte: 2 }, ratingValidityStatus: 'verified' },
        { contractVersion: null, ratingValidityStatus: null, moderationStatus: 'approved' },
      ]),
    });
  });

  it('keeps public written comments on a separate approved-and-public contract', () => {
    expect(canonicalPublicWrittenReviewWhere()).toEqual({
      source: 'customer',
      bookingId: { not: null },
      comment: { not: null },
      moderationStatus: 'approved',
      visibilityStatus: 'public',
    });
  });

  it.each([
    [{ comment: null, contractVersion: 2, moderationStatus: 'not_applicable' }, 'NONE'],
    [{ comment: 'Waiting', contractVersion: 2, moderationStatus: 'pending_review' }, 'CHECKING'],
    [{ comment: 'Published', contractVersion: 2, moderationStatus: 'approved', visibilityStatus: 'public' }, 'PUBLISHED'],
    [{ comment: 'Kept private', contractVersion: 2, moderationStatus: 'approved', visibilityStatus: 'private' }, 'NOT_PUBLISHED'],
    [{ comment: 'Not public', contractVersion: 2, moderationStatus: 'rejected' }, 'NOT_PUBLISHED'],
    [{ comment: 'Historical', contractVersion: null, moderationStatus: 'approved' }, 'LEGACY'],
  ])('maps owner-safe written-comment state', (input, expected) => {
    expect(customerCommentModerationState(input)).toBe(expected);
  });
});
