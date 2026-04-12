import { describe, expect, it } from 'vitest';
import { hashConsentDocument } from './consent-flow';

describe('hashConsentDocument', () => {
  it('is deterministic for same input', () => {
    const a = hashConsentDocument('terms-v1|privacy-v1|tok');
    const b = hashConsentDocument('terms-v1|privacy-v1|tok');
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });

  it('changes when input changes', () => {
    const a = hashConsentDocument('a');
    const b = hashConsentDocument('b');
    expect(a).not.toBe(b);
  });
});
