import { describe, expect, it } from 'vitest';

import {
  maySendVerificationAgain,
  VERIFICATION_RESEND_COOLDOWN_MS,
  VERIFICATION_RESEND_MAX_PER_WINDOW,
} from './auth-verification-resend-policy';

describe('email verification resend policy', () => {
  const now = new Date('2026-11-03T18:00:00.000Z');

  it('allows a first send and a send after the cooldown', () => {
    expect(maySendVerificationAgain({ now, sentInWindow: 0 })).toBe(true);
    expect(maySendVerificationAgain({
      now,
      latestCreatedAt: new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS),
      sentInWindow: 1,
    })).toBe(true);
  });

  it('blocks rapid repeats and the hourly maximum', () => {
    expect(maySendVerificationAgain({ now, latestCreatedAt: now, sentInWindow: 1 })).toBe(false);
    expect(maySendVerificationAgain({
      now,
      latestCreatedAt: new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS),
      sentInWindow: VERIFICATION_RESEND_MAX_PER_WINDOW,
    })).toBe(false);
  });
});
