import { describe, expect, it } from 'vitest';
import {
  appendAuthNext,
  getAuthContinuationPhrase,
  getAuthContinuationTarget,
  getCustomerServiceVideoIntent,
  getAuthEntryBackHref,
  getAuthEntryBackLabel,
  getAuthEntryDescription,
  resolveAuthPostLoginRedirect,
  sanitizeAuthNextPath,
} from './auth-next';

describe('auth next helpers', () => {
  it('keeps safe internal next paths', () => {
    expect(sanitizeAuthNextPath('/booking/service-123')).toBe('/booking/service-123');
  });

  it('rejects unsafe next paths', () => {
    expect(sanitizeAuthNextPath('https://example.com')).toBeNull();
    expect(sanitizeAuthNextPath('//evil.test')).toBeNull();
  });

  it('appends next to auth routes without losing existing query params', () => {
    expect(appendAuthNext('/auth/reset-password?token=abc', '/booking/service-123')).toBe(
      '/auth/reset-password?token=abc&next=%2Fbooking%2Fservice-123'
    );
  });

  it('uses a contextual auth back label for service-request flows', () => {
    expect(getAuthEntryBackLabel('/booking/service-123')).toBe('Back to Service Request');
    expect(getAuthEntryBackHref('/booking/service-123')).toBe('/booking/service-123');
  });

  it('keeps a generic auth back label for cold-start auth pages', () => {
    expect(getAuthEntryBackLabel(null)).toBe('Back to Home');
    expect(getAuthEntryBackHref(null)).toBe('/');
  });

  it('describes interrupted auth journeys honestly', () => {
    expect(getAuthEntryDescription('register', '/booking/service-123')).toBe(
      'Create your account to continue with this service request.'
    );
    expect(getAuthEntryDescription('login', '/service/service-123')).toBe(
      'Sign in to continue with this service detail.'
    );
  });

  it('maps next paths to continuation targets', () => {
    expect(getAuthContinuationTarget('/booking/service-123')).toBe('this service request');
    expect(getAuthContinuationTarget('/browse?category=cleaning')).toBe('browsing vendor services');
    expect(getAuthContinuationTarget(null)).toBeNull();
  });

  it('recognizes a video-ready work order without exposing unrelated booking routes', () => {
    expect(
      getCustomerServiceVideoIntent(
        '/my-bookings/booking-1?videoReady=1&claimToken=claim-123'
      )
    ).toEqual({
      bookingId: 'booking-1',
      claimToken: 'claim-123',
      returnPath:
        '/my-bookings/booking-1?videoReady=1&claimToken=claim-123',
    });
    expect(getCustomerServiceVideoIntent('/my-bookings/booking-1')).toBeNull();
    expect(
      getAuthEntryDescription(
        'register',
        '/my-bookings/booking-1?videoReady=1'
      )
    ).toBe(
      'Create your account to open your completed service video.'
    );
  });

  it('formats continuation phrases naturally', () => {
    expect(getAuthContinuationPhrase('/booking/service-123')).toBe('continue with this service request');
    expect(getAuthContinuationPhrase('/browse?category=cleaning')).toBe('keep browsing vendor services');
  });

  it('keeps customer booking continuations for customer accounts', () => {
    expect(resolveAuthPostLoginRedirect('/booking/service-123', 'customer')).toBe('/booking/service-123');
    expect(resolveAuthPostLoginRedirect('/booking/service-123', 'both')).toBe('/booking/service-123');
  });

  it('blocks customer-private continuations for vendor and admin accounts', () => {
    expect(resolveAuthPostLoginRedirect('/booking/service-123', 'vendor')).toBe('/vendor/dashboard');
    expect(resolveAuthPostLoginRedirect('/booking/service-123', 'admin')).toBe('/admin/dashboard');
  });

  it('still allows public continuations for operator accounts', () => {
    expect(resolveAuthPostLoginRedirect('/service/service-123', 'vendor')).toBe('/service/service-123');
    expect(resolveAuthPostLoginRedirect('/browse', 'admin')).toBe('/browse');
  });

  it('blocks operator-only destinations for customer accounts', () => {
    expect(resolveAuthPostLoginRedirect('/vendor/dashboard', 'customer')).toBe('/user-dashboard');
    expect(resolveAuthPostLoginRedirect('/admin/settings', 'customer')).toBe('/user-dashboard');
  });
});
