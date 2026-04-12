/**
 * Pure helpers for consent UI/API validation (no DB).
 */

export type ConsentRespondableResult =
  | { respondable: true }
  | { respondable: false; reason: 'not_pending' | 'expired' | 'already_resolved' };

export function evaluateConsentRespondable(
  status: string,
  expiresAt: Date | string | null | undefined,
  now = new Date()
): ConsentRespondableResult {
  const s = String(status || '').trim().toLowerCase();
  if (s !== 'requested') {
    return { respondable: false, reason: 'already_resolved' };
  }
  if (!expiresAt) return { respondable: true };
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return { respondable: true };
  if (exp.getTime() < now.getTime()) {
    return { respondable: false, reason: 'expired' };
  }
  return { respondable: true };
}
