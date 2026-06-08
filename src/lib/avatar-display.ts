export function isGeneratedAvatarUrl(value: unknown): boolean {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized.includes("randomuser.me/api/portraits/");
}

export function sanitizeCustomerFacingAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || isGeneratedAvatarUrl(normalized)) return null;
  return normalized;
}

export function initialsFromDisplayName(value: unknown): string {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "U";
}
