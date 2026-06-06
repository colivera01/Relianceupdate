/**
 * Pure display helpers for the admin-only Trust Score panel. Kept framework-free so the
 * "scored vs not-yet-scored" decision is unit-testable without a DOM. Never touches `Review`.
 */

export interface AdminTrustScoreData {
  scored?: boolean;
  snapshot?: {
    totalScorePct?: number | null;
  } | null;
}

/**
 * A snapshot is "meaningful" only when it exists AND has a non-null total (which, per the
 * calculator, means at least one component metric was measurable from finalized data).
 * When false, the admin UI must honestly render "not yet scored".
 */
export function isMeaningfulTrustScore(data: AdminTrustScoreData | null | undefined): boolean {
  if (!data || !data.scored) return false;
  const snapshot = data.snapshot;
  if (!snapshot) return false;
  return snapshot.totalScorePct !== null && snapshot.totalScorePct !== undefined;
}

export function formatTrustPct(pct: number | null | undefined): string {
  return pct === null || pct === undefined ? 'Not yet measurable' : `${pct}%`;
}
