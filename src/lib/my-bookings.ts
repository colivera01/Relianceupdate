/** Shared normalization helpers for booking status consumers outside My Service Records. */

/** Lowercase trimmed status; empty input becomes `unknown`. */
export function normalizeBookingStatusKey(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().toLowerCase();
  return s || 'unknown';
}

/** Service finished successfully. */
export function isCompletedStatus(key: string): boolean {
  return key === 'completed' || key === 'complete';
}
