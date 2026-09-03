export const VERIFIED_RATING_STATUS = 'verified';
export const INVALID_RATING_STATUS = 'invalid';
export const REVIEW_CONTRACT_VERSION = 2;

export function canonicalVerifiedCustomerRatingWhere(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    source: 'customer',
    bookingId: { not: null },
    rating: { gte: 1, lte: 5 },
    OR: [
      { contractVersion: { gte: REVIEW_CONTRACT_VERSION }, ratingValidityStatus: VERIFIED_RATING_STATUS },
      { contractVersion: null, ratingValidityStatus: null, moderationStatus: 'approved' },
    ],
    ...extra,
  };
}

export function customerCommentModerationState(input: {
  comment?: string | null;
  contractVersion?: number | null;
  moderationStatus?: string | null;
  visibilityStatus?: string | null;
}): 'NONE' | 'CHECKING' | 'PUBLISHED' | 'NOT_PUBLISHED' | 'LEGACY' {
  if (!String(input.comment || '').trim()) return 'NONE';
  if (!input.contractVersion || input.contractVersion < REVIEW_CONTRACT_VERSION) return 'LEGACY';
  const moderation = String(input.moderationStatus || '').toLowerCase();
  const visibility = String(input.visibilityStatus || '').toLowerCase();
  if (moderation === 'approved' && visibility === 'public') return 'PUBLISHED';
  if (['rejected', 'flagged'].includes(moderation)) return 'NOT_PUBLISHED';
  return 'CHECKING';
}
