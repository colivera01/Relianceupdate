import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPublicEmailBaseUrl, normalizePublicEmailBaseUrl } from './reliance-template';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('public email URL hardening', () => {
  it('rejects untrusted, insecure, and lookalike origins', () => {
    expect(normalizePublicEmailBaseUrl('https://attacker.example')).toBe('');
    expect(normalizePublicEmailBaseUrl('http://beta.relianceonline.org')).toBe('');
    expect(normalizePublicEmailBaseUrl('https://beta.relianceonline.org:444')).toBe('');
    expect(normalizePublicEmailBaseUrl('https://relianceonline.org.attacker.example')).toBe('');
  });

  it('accepts only HTTPS Reliance public hosts', () => {
    expect(normalizePublicEmailBaseUrl('https://beta.relianceonline.org/path')).toBe('https://beta.relianceonline.org');
    expect(normalizePublicEmailBaseUrl('https://relianceonline.org/')).toBe('https://relianceonline.org');
  });

  it('prefers the configured canonical host over a caller-provided origin', () => {
    vi.stubEnv('APP_BASE_URL', 'https://beta.relianceonline.org');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');

    expect(getPublicEmailBaseUrl('https://attacker.example')).toBe('https://beta.relianceonline.org');
  });

  it('falls back to the beta canonical host when no trusted configuration or caller exists', () => {
    vi.stubEnv('APP_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');

    expect(getPublicEmailBaseUrl('https://attacker.example')).toBe('https://beta.relianceonline.org');
  });
});
