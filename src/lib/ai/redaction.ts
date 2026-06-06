const EMAIL_REGEX = /\b([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})\b/gi;
const PHONE_REGEX =
  /(?<!\w)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\w)/g;
const OPENAI_KEY_REGEX = /\bsk-[a-z0-9_-]{12,}\b/gi;
const BEARER_REGEX = /\bBearer\s+[a-z0-9._-]+\b/gi;
const LONG_DIGIT_REGEX = /\b\d{8,}\b/g;

function maskEmail(value: string): string {
  return value.replace(EMAIL_REGEX, (_, local, domain) => {
    const safeLocal = String(local || "");
    const prefix = safeLocal.slice(0, 1) || "*";
    return `${prefix}***@${domain}`;
  });
}

function maskPhone(value: string): string {
  return value.replace(PHONE_REGEX, "[redacted_phone]");
}

function maskSecrets(value: string): string {
  return value
    .replace(OPENAI_KEY_REGEX, "[redacted_openai_key]")
    .replace(BEARER_REGEX, "Bearer [redacted_token]")
    .replace(LONG_DIGIT_REGEX, "[redacted_number]");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function redactTextForAiAudit(value: string, maxLength = 280): string {
  const normalized = normalizeWhitespace(maskSecrets(maskPhone(maskEmail(String(value || "")))));
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function redactValueForAiAudit(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;

  if (typeof value === "string") {
    return redactTextForAiAudit(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValueForAiAudit(item, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        redactValueForAiAudit(nestedValue, depth + 1),
      ])
    );
  }

  return String(value);
}
