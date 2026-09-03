import { describe, expect, it } from 'vitest';
import { canonicalVerifiedCustomerRatingWhere, customerCommentModerationState } from './review-rating-validity';

describe('verified Customer Review rating contract', () => {
  it('counts corrected-contract verified stars independently of comment moderation', () => {
    expect(canonicalVerifiedCustomerRatingWhere()).toMatchObject({
      OR: expect.arrayContaining([
        { contractVersion: { gte: 2 }, ratingValidityStatus: 'verified' },
        { contractVersion: null, ratingValidityStatus: null, moderationStatus: 'approved' },
      ]),
    });
  });

  it.each([
    [{ comment: null, contractVersion: 2, moderationStatus: 'not_applicable' }, 'NONE'],
    [{ comment: 'Waiting', contractVersion: 2, moderationStatus: 'pending_review' }, 'CHECKING'],
    [{ comment: 'Published', contractVersion: 2, moderationStatus: 'approved', visibilityStatus: 'public' }, 'PUBLISHED'],
    [{ comment: 'Not public', contractVersion: 2, moderationStatus: 'rejected' }, 'NOT_PUBLISHED'],
    [{ comment: 'Historical', contractVersion: null, moderationStatus: 'approved' }, 'LEGACY'],
  ])('maps owner-safe written-comment state', (input, expected) => {
    expect(customerCommentModerationState(input)).toBe(expected);
  });
});
