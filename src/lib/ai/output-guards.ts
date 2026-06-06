import { AiSchemaValidationError } from "./errors";
import type {
  DisputeSummaryResult,
  ModerationAssistantResult,
  VendorCoachingSummaryResult,
} from "./schemas";

const VIDEO_REVIEW_CLAIM_PATTERNS = [
  /\b(i|we)\s+(watched|viewed|reviewed|inspected|saw)\b/i,
  /\bafter\s+(watching|viewing|reviewing|inspecting)\b/i,
  /\b(the video|the footage|the clip|the recording)\s+(shows|showed|proves|proved|confirms|confirmed)\b/i,
  /\bi can see\b/i,
  /\bvisually verified\b/i,
];

const INTERVIEW_CLAIM_PATTERNS = [
  /\b(i|we)\s+interviewed\b/i,
  /\bspoke with (the )?(customer|vendor|employee|parties)\b/i,
  /\bafter speaking with\b/i,
];

function flattenStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenStrings(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenStrings(item));
  }
  return [];
}

function findUnsupportedClaim(
  strings: string[],
  patterns: RegExp[]
): { phrase: string; sourceText: string } | null {
  for (const text of strings) {
    const normalized = String(text || "").trim();
    if (!normalized) continue;
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return {
          phrase: match[0],
          sourceText: normalized,
        };
      }
    }
  }
  return null;
}

function assertNoUnsupportedClaim(
  strings: string[],
  patterns: RegExp[],
  message: string
) {
  const violation = findUnsupportedClaim(strings, patterns);
  if (!violation) return;
  throw new AiSchemaValidationError(`${message} Unsupported phrase: "${violation.phrase}".`, {
    sourceText: violation.sourceText,
  });
}

export function assertModerationAssistantOutputSafe(result: ModerationAssistantResult) {
  const strings = flattenStrings(result);
  assertNoUnsupportedClaim(
    strings,
    VIDEO_REVIEW_CLAIM_PATTERNS,
    "Moderation assistant output claimed unsupported video review evidence."
  );
}

export function assertDisputeSummaryOutputSafe(result: DisputeSummaryResult) {
  const strings = flattenStrings(result);
  assertNoUnsupportedClaim(
    strings,
    VIDEO_REVIEW_CLAIM_PATTERNS,
    "Dispute summary output claimed unsupported video review evidence."
  );
  assertNoUnsupportedClaim(
    strings,
    INTERVIEW_CLAIM_PATTERNS,
    "Dispute summary output claimed unsupported interview evidence."
  );
}

export function assertVendorCoachingSummaryOutputSafe(result: VendorCoachingSummaryResult) {
  const strings = flattenStrings(result);
  assertNoUnsupportedClaim(
    strings,
    VIDEO_REVIEW_CLAIM_PATTERNS,
    "Vendor coaching summary output claimed unsupported video review evidence."
  );
  assertNoUnsupportedClaim(
    strings,
    INTERVIEW_CLAIM_PATTERNS,
    "Vendor coaching summary output claimed unsupported interview evidence."
  );
}
