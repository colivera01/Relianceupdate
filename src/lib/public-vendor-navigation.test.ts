import { describe, expect, it } from 'vitest';
import {
  buildCustomerVendorProfileHref,
  buildVendorProfileHref,
  buildVendorServiceDetailHref,
  buildVendorSubpageHref,
  hasCustomerWorkspaceReturnContext,
  hasPublicBrowseReturnContext,
  isCustomerWorkspaceReturnPath,
  isPublicBrowseReturnPath,
  sanitizePublicReturnPath,
  sanitizeVendorReturnLabel,
  sanitizeVendorReturnPath,
} from './public-vendor-navigation';

describe('public vendor navigation', () => {
  it('keeps customer Explore Work context on provider links', () => {
    expect(buildCustomerVendorProfileHref('vendor/electro')).toBe(
      '/vendors/vendor%2Felectro?returnTo=%2Fdiscover&returnLabel=Back+to+Explore+Work'
    );
  });

  it('keeps the originating customer page on other provider links', () => {
    expect(buildVendorProfileHref('vendor-1', '/favorites', 'Back to Favorites')).toBe(
      '/vendors/vendor-1?returnTo=%2Ffavorites&returnLabel=Back+to+Favorites'
    );
  });

  it('preserves return context through provider services and reviews', () => {
    expect(buildVendorSubpageHref('vendor-1', 'services', '/discover', 'Back to Explore Work')).toBe(
      '/vendors/vendor-1/services?returnTo=%2Fdiscover&returnLabel=Back+to+Explore+Work'
    );
    expect(buildVendorSubpageHref('vendor-1', 'reviews', '/favorites', 'Back to Favorites')).toBe(
      '/vendors/vendor-1/reviews?returnTo=%2Ffavorites&returnLabel=Back+to+Favorites'
    );
  });

  it('keeps the original public Browse destination through provider service details', () => {
    const serviceHref = buildVendorServiceDetailHref(
      'service-1',
      'vendor-1',
      '/browse?q=breaker',
      'Back to Public Browse'
    );
    const serviceUrl = new URL(serviceHref, 'http://reliance.local');
    const providerReturn = serviceUrl.searchParams.get('returnTo');
    const providerUrl = new URL(providerReturn!, 'http://reliance.local');

    expect(serviceUrl.pathname).toBe('/service/service-1');
    expect(serviceUrl.searchParams.get('returnLabel')).toBe('Back to Vendor Page');
    expect(providerUrl.pathname).toBe('/vendors/vendor-1');
    expect(providerUrl.searchParams.get('returnTo')).toBe('/browse?q=breaker');
    expect(providerUrl.searchParams.get('returnLabel')).toBe('Back to Public Browse');
    expect(hasPublicBrowseReturnContext(providerReturn)).toBe(true);
  });

  it('sanitizes nested public-page return context', () => {
    expect(sanitizeVendorReturnPath('/discover?category=Electrical')).toBe('/discover?category=Electrical');
    expect(sanitizeVendorReturnPath('//evil.example')).toBeNull();
    expect(sanitizeVendorReturnPath('https://evil.example')).toBeNull();
    expect(sanitizePublicReturnPath('/\\evil.example')).toBeNull();
    expect(sanitizePublicReturnPath('/%5cevil.example')).toBeNull();
    expect(sanitizePublicReturnPath('/%5Cevil.example')).toBeNull();
    expect(sanitizePublicReturnPath('/discover\nLocation: https://evil.example')).toBeNull();
    expect(sanitizeVendorReturnLabel('Back to Explore Proof')).toBe('Back to Explore Work');
  });

  it('recognizes only local customer workspace return paths', () => {
    expect(isCustomerWorkspaceReturnPath('/discover')).toBe(true);
    expect(isCustomerWorkspaceReturnPath('/favorites?view=providers')).toBe(true);
    expect(isCustomerWorkspaceReturnPath('/my-bookings/booking-1')).toBe(true);
    expect(isCustomerWorkspaceReturnPath('/customer/support')).toBe(true);
    expect(isCustomerWorkspaceReturnPath('/browse')).toBe(false);
    expect(isCustomerWorkspaceReturnPath('//evil.example/discover')).toBe(false);
    expect(isCustomerWorkspaceReturnPath('https://evil.example/discover')).toBe(false);
    expect(isPublicBrowseReturnPath('/browse?category=Electrician')).toBe(true);
    expect(isPublicBrowseReturnPath('/browse-other')).toBe(false);
    expect(isPublicBrowseReturnPath('//evil.example/browse')).toBe(false);
  });

  it('recognizes customer context nested inside local provider and service return paths', () => {
    const providerServices = buildVendorSubpageHref(
      'vendor-1',
      'services',
      '/discover',
      'Back to Explore Work'
    );
    expect(hasCustomerWorkspaceReturnContext(providerServices)).toBe(true);
    expect(
      hasCustomerWorkspaceReturnContext(
        `/service/service-1?returnTo=${encodeURIComponent(providerServices)}`
      )
    ).toBe(true);
    expect(hasCustomerWorkspaceReturnContext('/browse')).toBe(false);
    expect(hasPublicBrowseReturnContext('/browse')).toBe(true);
    expect(hasPublicBrowseReturnContext('/\\evil.example')).toBe(false);
    expect(hasCustomerWorkspaceReturnContext('/\\evil.example')).toBe(false);
  });
});
