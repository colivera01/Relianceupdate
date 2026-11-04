export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const VERIFICATION_RESEND_WINDOW_MS = 60 * 60 * 1000;
export const VERIFICATION_RESEND_MAX_PER_WINDOW = 5;

export function maySendVerificationAgain(input: {
  now?: Date;
  latestCreatedAt?: Date | string | null;
  sentInWindow: number;
}): boolean {
  const now = input.now ?? new Date();
  const latest = input.latestCreatedAt ? new Date(input.latestCreatedAt) : null;
  if (latest && Number.isFinite(latest.getTime())) {
    if (now.getTime() - latest.getTime() < VERIFICATION_RESEND_COOLDOWN_MS) return false;
  }
  return Math.max(0, Number(input.sentInWindow || 0)) < VERIFICATION_RESEND_MAX_PER_WINDOW;
}
