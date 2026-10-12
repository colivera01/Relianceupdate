import { createHash } from "crypto";

const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  "apikey",
  "authorizationheader",
  "bearertoken",
  "clientsecret",
  "connectionstring",
  "databaseurl",
  "onetimecode",
  "otp",
  "otpcode",
  "password",
  "passcode",
  "rawotp",
  "rawtoken",
  "refreshtoken",
  "serviceorderurl",
  "signedurl",
  "token",
]);

const PROTECTED_VALUE_PATTERNS = [
  /(?:^|\s)bearer\s+\S+/i,
  /[?&](?:access_token|auth|code|key|otp|password|sig|signature|token)=/i,
  /(?:data source|server)\s*=.+(?:password|pwd)\s*=/i,
  /(?:postgres(?:ql)?|mysql|sqlserver):\/\/[^\s]+@/i,
];

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function valueForCanonicalJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(valueForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, valueForCanonicalJson(item)]),
    );
  }
  return value;
}

export function stableLegalEvidenceJson(value: unknown): string {
  return JSON.stringify(valueForCanonicalJson(value));
}

export function legalEvidenceSha256(value: unknown): string {
  const body = typeof value === "string" ? value : stableLegalEvidenceJson(value);
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function requireLegalEvidenceText(value: unknown, field: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`LEGAL_EVIDENCE_FIELD_REQUIRED:${field}`);
  return normalized;
}

export function assertNoProtectedCredentialMaterial(
  value: unknown,
  path = "evidenceContext",
): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProtectedCredentialMaterial(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizedKey(key);
      const explicitlyHashed = normalized.endsWith("hash") || normalized.endsWith("digest");
      if (!explicitlyHashed && FORBIDDEN_CREDENTIAL_KEYS.has(normalized)) {
        throw new Error(`LEGAL_EVIDENCE_PROTECTED_CREDENTIAL_FIELD:${path}.${key}`);
      }
      assertNoProtectedCredentialMaterial(item, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && PROTECTED_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`LEGAL_EVIDENCE_PROTECTED_CREDENTIAL_VALUE:${path}`);
  }
}

export function requireSha256(value: unknown, field: string): string {
  const normalized = requireLegalEvidenceText(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`LEGAL_EVIDENCE_SHA256_REQUIRED:${field}`);
  }
  return normalized;
}
