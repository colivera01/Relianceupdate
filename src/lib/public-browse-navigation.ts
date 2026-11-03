export type PublicBrowseNavigation = {
  mode: 'public' | 'customer' | 'vendor' | 'admin' | 'authenticated';
  isSignedIn: boolean;
  hasCustomerAccount: boolean;
  accountHref: string;
  accountLabel: string;
  primaryHref: string;
  primaryLabel: string;
};

type PublicBrowseNavigationInput = {
  isAuthenticated: boolean;
  userType?: string | null;
};

export function resolvePublicBrowseNavigation({
  isAuthenticated,
  userType,
}: PublicBrowseNavigationInput): PublicBrowseNavigation {
  if (!isAuthenticated) {
    return {
      mode: 'public',
      isSignedIn: false,
      hasCustomerAccount: false,
      accountHref: '/auth/login?next=%2Fbrowse',
      accountLabel: 'Sign In',
      primaryHref: '/auth/register?type=user',
      primaryLabel: 'Create Account',
    };
  }

  if (userType === 'customer' || userType === 'both') {
    return {
      mode: 'customer',
      isSignedIn: true,
      hasCustomerAccount: true,
      accountHref: '/user-dashboard',
      accountLabel: 'My Account',
      primaryHref: '/discover',
      primaryLabel: 'Customer Explore Work',
    };
  }

  if (userType === 'vendor') {
    return {
      mode: 'vendor',
      isSignedIn: true,
      hasCustomerAccount: false,
      accountHref: '/vendor/dashboard',
      accountLabel: 'My Account',
      primaryHref: '/vendor/dashboard',
      primaryLabel: 'Vendor Workspace',
    };
  }

  if (userType === 'admin') {
    return {
      mode: 'admin',
      isSignedIn: true,
      hasCustomerAccount: false,
      accountHref: '/admin/dashboard',
      accountLabel: 'My Account',
      primaryHref: '/admin/dashboard',
      primaryLabel: 'Admin Workspace',
    };
  }

  return {
    mode: 'authenticated',
    isSignedIn: true,
    hasCustomerAccount: false,
    accountHref: '/',
    accountLabel: 'My Account',
    primaryHref: '/browse',
    primaryLabel: 'Public Browse',
  };
}
