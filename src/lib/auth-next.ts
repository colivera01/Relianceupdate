export function sanitizeAuthNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  return trimmed;
}

export function appendAuthNext(path: string, nextPath: string | null | undefined): string {
  const safeNextPath = sanitizeAuthNextPath(nextPath);
  if (!safeNextPath) return path;

  const url = new URL(path, 'http://reliance.local');
  url.searchParams.set('next', safeNextPath);
  return `${url.pathname}${url.search}`;
}

export function getAuthContinuationTarget(nextPath: string | null | undefined): string | null {
  const safeNextPath = sanitizeAuthNextPath(nextPath);
  if (!safeNextPath) return null;

  if (safeNextPath.startsWith('/booking/')) return 'this service request';
  if (safeNextPath.startsWith('/service/')) return 'this service detail';
  if (safeNextPath.startsWith('/browse')) return 'exploring public proof';
  if (safeNextPath.startsWith('/help')) return 'the Help Center';
  return 'where you left off';
}

export function getAuthContinuationPhrase(nextPath: string | null | undefined): string | null {
  const target = getAuthContinuationTarget(nextPath);
  if (!target) return null;
  if (target === 'exploring public proof') return 'keep exploring public proof';
  if (target === 'the Help Center') return 'continue to the Help Center';
  if (target === 'where you left off') return 'continue where you left off';
  return `continue with ${target}`;
}

function isAdminPath(path: string): boolean {
  return path.startsWith('/admin');
}

function isVendorPath(path: string): boolean {
  return path.startsWith('/vendor');
}

function isCustomerPrivatePath(path: string): boolean {
  return (
    path.startsWith('/booking/') ||
    path.startsWith('/my-bookings') ||
    path.startsWith('/reviews') ||
    path.startsWith('/favorites') ||
    path.startsWith('/discover') ||
    path.startsWith('/profile-settings') ||
    path.startsWith('/customer/') ||
    path.startsWith('/user-dashboard')
  );
}

function isPublicPath(path: string): boolean {
  return !isAdminPath(path) && !isVendorPath(path) && !isCustomerPrivatePath(path);
}

export function resolveAuthPostLoginRedirect(
  nextPath: string | null | undefined,
  userType: 'customer' | 'vendor' | 'admin' | 'both'
): string {
  const safeNextPath = sanitizeAuthNextPath(nextPath);

  if (userType === 'admin') {
    if (safeNextPath && (isAdminPath(safeNextPath) || isPublicPath(safeNextPath))) {
      return safeNextPath;
    }
    return '/admin/dashboard';
  }

  if (userType === 'vendor') {
    if (safeNextPath && (isVendorPath(safeNextPath) || isPublicPath(safeNextPath))) {
      return safeNextPath;
    }
    return '/vendor/dashboard';
  }

  if (userType === 'both') {
    if (safeNextPath && !isAdminPath(safeNextPath)) {
      return safeNextPath;
    }
    return '/user-dashboard';
  }

  if (safeNextPath && !isAdminPath(safeNextPath) && !isVendorPath(safeNextPath)) {
    return safeNextPath;
  }

  return '/user-dashboard';
}

export function getAuthEntryBackHref(nextPath: string | null | undefined): string {
  return sanitizeAuthNextPath(nextPath) || '/';
}

export function getAuthEntryBackLabel(nextPath: string | null | undefined): string {
  const safeNextPath = sanitizeAuthNextPath(nextPath);
  if (!safeNextPath) return 'Back to Home';

  if (safeNextPath.startsWith('/booking/')) return 'Back to Service Request';
  if (safeNextPath.startsWith('/service/')) return 'Back to Service Detail';
  if (safeNextPath.startsWith('/vendor/')) return 'Back to Vendor Area';
  if (safeNextPath.startsWith('/browse')) return 'Back to Browse Services';
  if (safeNextPath.startsWith('/help')) return 'Back to Help Center';
  return 'Back to Requested Page';
}

export function getAuthEntryDescription(
  mode: 'login' | 'register',
  nextPath: string | null | undefined
): string | null {
  const continuationPhrase = getAuthContinuationPhrase(nextPath);
  if (!continuationPhrase) return null;
  const action = mode === 'login' ? 'Sign in' : 'Create your account';
  return `${action} to ${continuationPhrase}.`;
}
