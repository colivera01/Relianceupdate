export const CORE_ADMIN_AUDIT_REJECTION_CATEGORIES = [
  { value: "CONTENT_QUALITY", label: "Content quality" },
  { value: "EVIDENCE_MISMATCH", label: "Evidence mismatch" },
  { value: "PRIVACY_OR_SCOPE", label: "Privacy or recording scope" },
  { value: "UNVERIFIABLE", label: "Unable to verify" },
] as const;

export type CoreAdminAuditRejectionCategory =
  (typeof CORE_ADMIN_AUDIT_REJECTION_CATEGORIES)[number]["value"];

const CATEGORY_VALUES = new Set<string>(
  CORE_ADMIN_AUDIT_REJECTION_CATEGORIES.map((category) => category.value),
);

export function isCoreAdminAuditRejectionCategory(
  value: unknown,
): value is CoreAdminAuditRejectionCategory {
  return CATEGORY_VALUES.has(String(value || "").trim().toUpperCase());
}

export function coreAdminAuditRejectionCategoryLabel(value: unknown): string {
  const normalized = String(value || "").trim().toUpperCase();
  return CORE_ADMIN_AUDIT_REJECTION_CATEGORIES.find(
    (category) => category.value === normalized,
  )?.label || "Unknown";
}
