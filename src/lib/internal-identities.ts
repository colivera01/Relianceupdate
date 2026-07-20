/**
 * Platform owner + internal/demo shells that must not pollute launch-facing
 * metrics, trust reporting, browse/discover, or production-like audits.
 *
 * Owner/admin login and vendor tooling remain available; segregation is via
 * `demo` flags (DB), `isPubliclyListed`, and shared query helpers in
 * `metrics-exclusion.ts`.
 */

/** Owner/admin — internal-only for business metrics and customer reporting. */
export const OWNER_ADMIN_EMAIL = "colivera080124@gmail.com";

/** Owner/admin phone (Admin toggle + identity match). */
export const OWNER_ADMIN_PHONE = "4079148888";

/** Prisma `users.id` for the owner account in the primary database. */
export const OWNER_ADMIN_USER_ID = "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0";

/** Prisma `users.id` for the same owner account in the isolated beta database. */
export const OWNER_ADMIN_BETA_USER_ID = "cmqwvc0gp0003so84j1ckab1p";

export const OWNER_ADMIN_USER_IDS = [
  OWNER_ADMIN_USER_ID,
  OWNER_ADMIN_BETA_USER_ID,
] as const;

/** Sparkle Clean Pro — internal/demo vendor shell for building vendor UX. */
export const SPARKLE_CLEAN_VENDOR_ID = "cmipm4d6v0000sosgqvb8tp63";

export const INTERNAL_DEMO_VENDOR_IDS = [SPARKLE_CLEAN_VENDOR_ID] as const;

/**
 * Internal/audit-only user ids that should stay out of launch-facing admin
 * queues and reporting by default. These identities are still valid for live
 * testing and role-specific audits.
 */
export const INTERNAL_AUDIT_USER_IDS = [
  "e2e-smoke-customer",
  "e2e-trust-employee",
  "cmohivpc60000sorokbuehp94",
  ...OWNER_ADMIN_USER_IDS,
] as const;

/** Production-like vendors for future audits (non-exhaustive; see handoff report). */
export const AUDIT_VENDOR_METRO_ID = "cmnvdegk60000sop8sj18nud2";
export const AUDIT_VENDOR_MIDTOWN_ID = "cmpggaky40000soc0il005lwi";
export const AUDIT_VENDOR_BROOKLYN_ID = "cmpggam0w0003soc0z4ezfhth";

/** Vendors that should remain `demo: false` for launch-facing metrics and audits. */
export const PRODUCTION_LIKE_VENDOR_IDS = [
  AUDIT_VENDOR_METRO_ID,
  AUDIT_VENDOR_MIDTOWN_ID,
  AUDIT_VENDOR_BROOKLYN_ID,
] as const;

export const AUDIT_ACCOUNTS = {
  vendorOnlyManager: {
    email: "e2e-trust-manager@reliance.test",
    password: "E2E_Smoke_dev_only_9!",
    vendorId: AUDIT_VENDOR_METRO_ID,
    vendorName: "Metro Home Care Pros",
  },
  productionLikeVendors: [
    { id: AUDIT_VENDOR_METRO_ID, name: "Metro Home Care Pros" },
    { id: AUDIT_VENDOR_MIDTOWN_ID, name: "Midtown Home Detailers" },
    { id: AUDIT_VENDOR_BROOKLYN_ID, name: "Brooklyn Home Care Studio" },
  ],
  ownerAdmin: {
    email: OWNER_ADMIN_EMAIL,
    note: "Admin/platform management only — not a production-like customer or vendor for metrics.",
  },
  sparkleShell: {
    vendorId: SPARKLE_CLEAN_VENDOR_ID,
    note: "Internal demo vendor shell — use Metro + e2e-trust-manager for vendor audits.",
  },
} as const;

const OWNER_PHONE_VARIANTS = [
  OWNER_ADMIN_PHONE,
  `+1${OWNER_ADMIN_PHONE}`,
  `+1 (${OWNER_ADMIN_PHONE.slice(0, 3)}) ${OWNER_ADMIN_PHONE.slice(3, 6)}-${OWNER_ADMIN_PHONE.slice(6)}`,
];

export function normalizeIdentityEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function normalizeIdentityPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isOwnerAdminEmail(email: unknown): boolean {
  return normalizeIdentityEmail(email) === normalizeIdentityEmail(OWNER_ADMIN_EMAIL);
}

export function isOwnerAdminPhone(phone: unknown): boolean {
  const digits = normalizeIdentityPhone(phone);
  return digits === OWNER_ADMIN_PHONE || digits === `1${OWNER_ADMIN_PHONE}`;
}

export function isOwnerAdminUserId(userId: unknown): boolean {
  const normalized = String(userId ?? "").trim().toUpperCase();
  return OWNER_ADMIN_USER_IDS.some((id) => id.toUpperCase() === normalized);
}

export function isOwnerAdminIdentity(identity: {
  id?: unknown;
  email?: unknown;
  phone?: unknown;
} | null | undefined): boolean {
  if (!identity) return false;
  return (
    isOwnerAdminUserId(identity.id) ||
    isOwnerAdminEmail(identity.email) ||
    isOwnerAdminPhone(identity.phone)
  );
}

export function isInternalDemoVendorId(vendorId: unknown): boolean {
  const id = String(vendorId ?? "").trim();
  return INTERNAL_DEMO_VENDOR_IDS.includes(id as (typeof INTERNAL_DEMO_VENDOR_IDS)[number]);
}

export function isInternalDemoVendorRecord(vendor: {
  id?: unknown;
  demo?: boolean | null;
} | null | undefined): boolean {
  if (!vendor) return false;
  if (vendor.demo === true) return true;
  return isInternalDemoVendorId(vendor.id);
}

export function isInternalDemoUserRecord(user: {
  id?: unknown;
  email?: unknown;
  phone?: unknown;
  demo?: boolean | null;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.demo === true) return true;
  if (isOwnerAdminIdentity(user)) return true;
  return false;
}

/** Prisma `NOT` clauses merged into countable user queries. */
export function internalUserNotClauses(): Record<string, unknown>[] {
  return [
    { id: OWNER_ADMIN_USER_ID },
    { id: OWNER_ADMIN_BETA_USER_ID },
    { email: { equals: OWNER_ADMIN_EMAIL } },
    { phone: { in: OWNER_PHONE_VARIANTS } },
  ];
}

/** Prisma `NOT` clauses merged into countable vendor queries. */
export function internalVendorNotClauses(): Record<string, unknown>[] {
  return [{ id: { in: [...INTERNAL_DEMO_VENDOR_IDS] } }];
}

export function launchExcludedUserIds(): string[] {
  return [...INTERNAL_AUDIT_USER_IDS];
}

export function launchExcludedVendorIds(): string[] {
  return [...INTERNAL_DEMO_VENDOR_IDS];
}
