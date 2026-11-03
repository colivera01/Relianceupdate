import { describe, expect, it } from 'vitest';
import { resolvePublicBrowseNavigation } from './public-browse-navigation';

describe('resolvePublicBrowseNavigation', () => {
  it('keeps anonymous browsing public and returns sign-in users to browse', () => {
    expect(resolvePublicBrowseNavigation({ isAuthenticated: false })).toEqual({
      mode: 'public',
      isSignedIn: false,
      hasCustomerAccount: false,
      accountHref: '/auth/login?next=%2Fbrowse',
      accountLabel: 'Sign In',
      primaryHref: '/auth/register?type=user',
      primaryLabel: 'Create Account',
    });
  });

  it.each(['customer', 'both'])('returns %s accounts to the protected customer experience', (userType) => {
    expect(resolvePublicBrowseNavigation({ isAuthenticated: true, userType })).toMatchObject({
      mode: 'customer',
      hasCustomerAccount: true,
      accountHref: '/user-dashboard',
      primaryHref: '/discover',
      primaryLabel: 'Customer Explore Work',
    });
  });

  it('returns a signed-in vendor to the vendor workspace', () => {
    expect(resolvePublicBrowseNavigation({ isAuthenticated: true, userType: 'vendor' })).toMatchObject({
      mode: 'vendor',
      hasCustomerAccount: false,
      accountHref: '/vendor/dashboard',
      primaryHref: '/vendor/dashboard',
    });
  });

  it('returns a signed-in administrator to the admin workspace', () => {
    expect(resolvePublicBrowseNavigation({ isAuthenticated: true, userType: 'admin' })).toMatchObject({
      mode: 'admin',
      hasCustomerAccount: false,
      accountHref: '/admin/dashboard',
      primaryHref: '/admin/dashboard',
    });
  });
});
