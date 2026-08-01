import { describe, expect, it } from 'vitest';
import { buildPolicyDocumentHref, sanitizePolicyReturnPath } from './policy-navigation';

describe('policy document navigation', () => {
  it('preserves a registration path and its service-video continuation', () => {
    const path = '/auth/register?type=user&next=%2Fmy-bookings%2Fwork-123%3FvideoReady%3D1';

    expect(sanitizePolicyReturnPath(path)).toBe(path);
    expect(buildPolicyDocumentHref('/privacy', path)).toBe(
      '/privacy?returnTo=%2Fauth%2Fregister%3Ftype%3Duser%26next%3D%252Fmy-bookings%252Fwork-123%253FvideoReady%253D1'
    );
  });

  it('rejects external and non-registration return destinations', () => {
    expect(sanitizePolicyReturnPath('https://example.com/auth/register')).toBeNull();
    expect(sanitizePolicyReturnPath('//example.com/auth/register')).toBeNull();
    expect(sanitizePolicyReturnPath('/vendor/dashboard')).toBeNull();
    expect(sanitizePolicyReturnPath('/auth/register-extra')).toBeNull();
  });

  it('omits an unsafe return destination from the policy URL', () => {
    expect(buildPolicyDocumentHref('/terms', '/admin/dashboard')).toBe('/terms');
  });
});
