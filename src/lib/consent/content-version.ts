import { hashOpaqueSecret } from "./token";

export const PERMISSION_CONTENT_VERSION = "recording-permission-v1";
export const PERMISSION_SCOPE_SCHEMA_VERSION = "recording-scope-v1";

export const PERMISSION_CONTENT = {
  purpose:
    "Your service provider is asking to record proof of this service in Reliance.",
  stages: ["Starting Condition", "Work in Progress", "Final Result"],
  audio: "Audio is off.",
  initialAudience:
    "The recordings start Private and are available to you and the service provider.",
  publication:
    "Public sharing is a separate decision after the recordings exist.",
  decline:
    "You may decline or decide later. The service may continue without Reliance recording.",
} as const;

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const PERMISSION_CONTENT_JSON = stableJson(PERMISSION_CONTENT);
export const PERMISSION_CONTENT_HASH = hashOpaqueSecret(
  PERMISSION_CONTENT_JSON,
);

export function buildPermissionScope(input: {
  recordingLocation: string;
  customerName?: string | null;
  recordingAssessmentId?: string | null;
  recordingAssessmentScopeHash?: string | null;
}) {
  return {
    schemaVersion: PERMISSION_SCOPE_SCHEMA_VERSION,
    recordingLocation: String(input.recordingLocation || "")
      .trim()
      .toLowerCase(),
    stages: [...PERMISSION_CONTENT.stages],
    audioEnabled: false,
    initialAudience: "private",
    customerLabel: String(input.customerName || "").trim() || null,
    publicSharingIncluded: false,
    recordingAssessmentId: input.recordingAssessmentId || null,
    recordingAssessmentScopeHash: input.recordingAssessmentScopeHash || null,
  };
}
