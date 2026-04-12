import { describe, expect, it } from 'vitest';
import { evaluateConsentRespondable } from './consent-record-state';

describe('evaluateConsentRespondable', () => {
  it('allows requested consent without expiry', () => {
    expect(evaluateConsentRespondable('requested', null)).toEqual({ respondable: true });
  });

  it('blocks when not requested', () => {
    expect(evaluateConsentRespondable('accepted', null)).toEqual({
      respondable: false,
      reason: 'already_resolved',
    });
  });

  it('blocks when expiry is in the past', () => {
    const past = new Date(Date.now() - 60_000);
    expect(evaluateConsentRespondable('requested', past)).toEqual({
      respondable: false,
      reason: 'expired',
    });
  });

  it('allows when expiry is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(evaluateConsentRespondable('requested', future)).toEqual({ respondable: true });
  });
});
