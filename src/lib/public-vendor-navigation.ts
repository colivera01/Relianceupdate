import { sanitizeAuthNextPath } from './auth-next';

export const CUSTOMER_EXPLORE_RETURN_PATH = '/discover';
export const CUSTOMER_EXPLORE_RETURN_LABEL = 'Back to Explore Work';

const CUSTOMER_WORKSPACE_PATHS = new Set([
  '/discover',
  '/favorites',
  '/my-bookings',
  '/profile-settings',
  '/reviews',
  '/secure-account',
  '/user-dashboard',
]);

export function buildVendorProfileHref(
  vendorId: string,
  returnTo: string,
  returnLabel: string
): string {
  const params = new URLSearchParams({
    returnTo,
    returnLabel,
  });

  return `/vendors/${encodeURIComponent(vendorId)}?${params.toString()}`;
}

export function buildCustomerVendorProfileHref(vendorId: string): string {
  return buildVendorProfileHref(
    vendorId,
    CUSTOMER_EXPLORE_RETURN_PATH,
    CUSTOMER_EXPLORE_RETURN_LABEL
  );
}

export function buildVendorSubpageHref(
  vendorId: string,
  subpage: 'services' | 'reviews',
  returnTo: string,
  returnLabel: string
): string {
  const profileHref = buildVendorProfileHref(vendorId, returnTo, returnLabel);
  return profileHref.replace(`/vendors/${encodeURIComponent(vendorId)}`, `/vendors/${encodeURIComponent(vendorId)}/${subpage}`);
}

export function buildVendorServiceDetailHref(
  serviceId: string,
  vendorId: string,
  returnTo: string,
  returnLabel: string
): string {
  const profileHref = buildVendorProfileHref(vendorId, returnTo, returnLabel);
  const params = new URLSearchParams({
    returnTo: profileHref,
    returnLabel: 'Back to Vendor Page',
  });

  return `/service/${encodeURIComponent(serviceId)}?${params.toString()}`;
}

export function sanitizePublicReturnPath(value: string | null | undefined): string | null {
  return sanitizeAuthNextPath(value);
}

export function sanitizeVendorReturnPath(value: string | null | undefined): string | null {
  return sanitizePublicReturnPath(value);
}

export function sanitizeVendorReturnLabel(value: string | null | undefined): string | null {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/Explore Proof/gi, 'Explore Work') : null;
}

export function isCustomerWorkspaceReturnPath(value: string | null | undefined): boolean {
  const safeValue = sanitizePublicReturnPath(value);
  if (!safeValue) return false;
  const pathname = safeValue.split(/[?#]/, 1)[0];
  return (
    CUSTOMER_WORKSPACE_PATHS.has(pathname) ||
    pathname.startsWith('/customer/') ||
    pathname.startsWith('/my-bookings/')
  );
}

export function isPublicBrowseReturnPath(value: string | null | undefined): boolean {
  const safeValue = sanitizePublicReturnPath(value);
  return safeValue?.split(/[?#]/, 1)[0] === '/browse';
}

function hasNestedReturnContext(
  value: string | null | undefined,
  matchesPath: (path: string) => boolean
): boolean {
  let current = sanitizePublicReturnPath(value);

  for (let depth = 0; current && depth < 4; depth += 1) {
    if (matchesPath(current)) return true;

    try {
      const nested = new URL(current, 'http://reliance.local').searchParams.get('returnTo');
      current = sanitizePublicReturnPath(nested);
    } catch {
      return false;
    }
  }

  return false;
}

export function hasCustomerWorkspaceReturnContext(value: string | null | undefined): boolean {
  return hasNestedReturnContext(value, isCustomerWorkspaceReturnPath);
}

export function hasPublicBrowseReturnContext(value: string | null | undefined): boolean {
  return hasNestedReturnContext(value, isPublicBrowseReturnPath);
}
