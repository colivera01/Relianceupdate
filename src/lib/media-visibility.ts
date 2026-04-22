export type MediaAudience = "public" | "customer" | "vendor_internal";

export const MODERATION_APPROVED = "approved";
export const MODERATION_PENDING_REVIEW = "pending_review";
export const MODERATION_REJECTED = "rejected";
export const MODERATION_FLAGGED = "flagged";
export const ARCHIVE_ACTIVE = "active";
export const ARCHIVE_ARCHIVED = "archived";

export const VISIBILITY_PUBLIC = "public";
export const VISIBILITY_CUSTOMER_ONLY = "customer_only";
export const VISIBILITY_VENDOR_ARCHIVE_ONLY = "vendor_archive_only";
export const VISIBILITY_PRIVATE = "private";

export const KNOWN_MODERATION_STATUSES = [
  MODERATION_PENDING_REVIEW,
  MODERATION_APPROVED,
  MODERATION_REJECTED,
  MODERATION_FLAGGED,
] as const;

export const KNOWN_VISIBILITY_STATUSES = [
  VISIBILITY_PUBLIC,
  VISIBILITY_CUSTOMER_ONLY,
  VISIBILITY_VENDOR_ARCHIVE_ONLY,
  VISIBILITY_PRIVATE,
] as const;

export const KNOWN_ARCHIVE_STATUSES = [ARCHIVE_ACTIVE, ARCHIVE_ARCHIVED] as const;

export function normalizeModerationStatus(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toLowerCase();
  if ((KNOWN_MODERATION_STATUSES as readonly string[]).includes(normalized)) return normalized;
  return MODERATION_PENDING_REVIEW;
}

export function normalizeVisibilityStatus(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toLowerCase();
  if ((KNOWN_VISIBILITY_STATUSES as readonly string[]).includes(normalized)) return normalized;
  return VISIBILITY_PRIVATE;
}

export function normalizeArchiveStatus(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toLowerCase();
  if ((KNOWN_ARCHIVE_STATUSES as readonly string[]).includes(normalized)) return normalized;
  return ARCHIVE_ACTIVE;
}

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
