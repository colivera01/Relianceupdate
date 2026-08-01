const SECRET_KEYS = new Set([
  "token",
  "otp",
  "code",
  "secret",
  "secretHash",
  "codeHash",
  "absoluteFallbackLink",
  "consentUrl",
]);

export function redactPermissionAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPermissionAuditValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_KEYS.has(key))
      .map(([key, nested]) => [key, redactPermissionAuditValue(nested)])
  );
}

export function parseRedactedPermissionMetadata(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return redactPermissionAuditValue(JSON.parse(value));
  } catch {
    return "[unstructured metadata withheld]";
  }
}
