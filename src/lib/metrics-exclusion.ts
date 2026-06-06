import {
  internalUserNotClauses,
  internalVendorNotClauses,
} from "@/lib/internal-identities";

const INTERNAL_EMAIL_EXCLUSIONS = [
  { email: { contains: "@reliance.test" } },
  { email: { contains: "@reliance.local" } },
  { email: { startsWith: "e2e-" } },
  { email: { startsWith: "test+" } },
  { email: { equals: "test@example.com" } },
  { email: { contains: ".verify." } },
  { email: { contains: "vendor.fallback." } },
  { email: { contains: "template.verify." } },
];

function mergeNotClauses(...groups: Record<string, unknown>[][]): Record<string, unknown>[] {
  return groups.flat();
}

export function countableUserWhere(extra: Record<string, unknown> = {}) {
  return {
    demo: false,
    NOT: mergeNotClauses(INTERNAL_EMAIL_EXCLUSIONS, internalUserNotClauses()),
    ...extra,
  };
}

export function countableVendorWhere(extra: Record<string, unknown> = {}) {
  // Vendor rows are segregated by `demo` + internal demo vendor ids — not by vendor.email,
  // so production-like seeded vendors (e.g. Metro with an e2e-smoke contact email) still count.
  return {
    demo: false,
    NOT: internalVendorNotClauses(),
    ...extra,
  };
}

export function countableServiceWhere(extra: Record<string, unknown> = {}) {
  return {
    demo: false,
    vendor: countableVendorWhere(),
    ...extra,
  };
}

export function countableBookingWhere(extra: Record<string, unknown> = {}) {
  return {
    demo: false,
    user: { is: countableUserWhere() },
    vendor: countableVendorWhere(),
    service: { is: countableServiceWhere() },
    ...extra,
  };
}

/**
 * Vendor portal job lists: include bookings for this vendor's operations even when the
 * linked customer user is a test/dev address (@reliance.test, e2e-*, etc.). Still excludes
 * demo rows and internal/demo vendors (e.g. Sparkle shell).
 */
export function vendorOperationalBookingWhere(extra: Record<string, unknown> = {}) {
  return {
    demo: false,
    vendor: countableVendorWhere(),
    service: { is: { demo: false, vendor: countableVendorWhere() } },
    ...extra,
  };
}

export function countableReviewWhere(extra: Record<string, unknown> = {}) {
  return {
    demo: false,
    user: { is: countableUserWhere() },
    vendor: countableVendorWhere(),
    ...extra,
  };
}

/**
 * Admin operational review queues should see real platform reviews even when the
 * reviewer is an internal/test account. Demo rows and internal/demo vendors still stay hidden.
 */
export function operationalReviewWhere(extra: Record<string, unknown> = {}) {
  return {
    demo: false,
    vendor: countableVendorWhere(),
    ...extra,
  };
}

export function countableMediaAssetWhere(extra: Record<string, unknown> = {}) {
  return {
    deletedAt: null,
    archiveStatus: "active",
    vendor: countableVendorWhere(),
    ...extra,
  };
}

export function countablePromotionCampaignWhere(extra: Record<string, unknown> = {}) {
  return {
    vendor: countableVendorWhere(),
    status: { notIn: ["cancelled", "rejected", "expired", "draft"] },
    ...extra,
  };
}
