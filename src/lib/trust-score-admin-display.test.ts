import { describe, expect, it } from 'vitest';
import { formatTrustPct, isMeaningfulTrustScore } from './trust-score-admin-display';

describe('isMeaningfulTrustScore (admin panel not-yet-scored decision)', () => {
  it('is false when there is no data', () => {
    expect(isMeaningfulTrustScore(null)).toBe(false);
    expect(isMeaningfulTrustScore(undefined)).toBe(false);
  });

  it('is false when scored is false / no snapshot exists', () => {
    expect(isMeaningfulTrustScore({ scored: false, snapshot: null })).toBe(false);
    expect(isMeaningfulTrustScore({ scored: true, snapshot: null })).toBe(false);
  });

  it('is false when a snapshot exists but the total is null (live backfill baseline)', () => {
    expect(isMeaningfulTrustScore({ scored: true, snapshot: { totalScorePct: null } })).toBe(false);
  });

  it('is true only when a snapshot has a non-null total score', () => {
    expect(isMeaningfulTrustScore({ scored: true, snapshot: { totalScorePct: 0 } })).toBe(true);
    expect(isMeaningfulTrustScore({ scored: true, snapshot: { totalScorePct: 88 } })).toBe(true);
  });
});

describe('formatTrustPct', () => {
  it('renders "Not yet measurable" for null/undefined and percent otherwise', () => {
    expect(formatTrustPct(null)).toBe('Not yet measurable');
    expect(formatTrustPct(undefined)).toBe('Not yet measurable');
    expect(formatTrustPct(0)).toBe('0%');
    expect(formatTrustPct(91)).toBe('91%');
  });
});
