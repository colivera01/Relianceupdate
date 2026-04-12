export type MediaAudience = "public" | "customer" | "vendor_internal";

export const MODERATION_APPROVED = "approved";
export const ARCHIVE_ACTIVE = "active";

export const VISIBILITY_PUBLIC = "public";
export const VISIBILITY_CUSTOMER_ONLY = "customer_only";
export const VISIBILITY_VENDOR_ARCHIVE_ONLY = "vendor_archive_only";
export const VISIBILITY_PRIVATE = "private";

export function getApprovedActiveBaseWhere() {
  return {
    deletedAt: null,
    moderationStatus: MODERATION_APPROVED,
    archiveStatus: ARCHIVE_ACTIVE,
  };
}

export function getVisibilityStatusesForAudience(audience: MediaAudience): string[] {
  if (audience === "public") {
    return [VISIBILITY_PUBLIC];
  }
  if (audience === "customer") {
    return [VISIBILITY_PUBLIC, VISIBILITY_CUSTOMER_ONLY];
  }
  // vendor_internal should be caller-scoped elsewhere and not forcibly narrowed.
  return [VISIBILITY_PUBLIC, VISIBILITY_CUSTOMER_ONLY, VISIBILITY_VENDOR_ARCHIVE_ONLY, VISIBILITY_PRIVATE];
}

export function normalizeAudience(value: string | null | undefined): MediaAudience {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "customer") return "customer";
  if (normalized === "vendor_internal") return "vendor_internal";
  return "public";
}
