import { hashOpaqueSecret } from "./token";

export const PERMISSION_CONTENT_VERSION = "recording-permission-v2-simplified-v1";
export const PERMISSION_SCOPE_SCHEMA_VERSION = "recording-scope-v2-simplified-v1";
export const AUDIO_PERMISSION_SCOPE_SCHEMA_VERSION = "recording-scope-v3-package-audio-v1";

export function isSimplifiedV1PermissionVersion(value: unknown): boolean {
  const version = String(value || "").trim();
  return version === PERMISSION_CONTENT_VERSION || version.startsWith("recording-permission-v3-");
}

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
    "You may allow recording, decline recording, or report that this request was sent to the wrong person. If you take no action, recording remains blocked.",
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

export function permissionContentForAudio(audioEnabled: boolean) {
  const content = {
    ...PERMISSION_CONTENT,
    audio: audioEnabled
      ? "This Service Video will include sound because audio is part of documenting the service. Conversations and unrelated private information should not be intentionally recorded."
      : "Audio will not be recorded.",
  };
  const contentJson = stableJson(content);
  return {
    version: audioEnabled
      ? "recording-permission-v3-video-audio"
      : "recording-permission-v3-video-only",
    scopeSchemaVersion: AUDIO_PERMISSION_SCOPE_SCHEMA_VERSION,
    content,
    contentJson,
    contentHash: hashOpaqueSecret(contentJson),
  };
}

export function buildPermissionScope(input: {
  recordingLocation: string;
  customerName?: string | null;
  recordingAssessmentId?: string | null;
  recordingAssessmentScopeHash?: string | null;
  audioEnabled?: boolean;
}) {
  return {
    schemaVersion: AUDIO_PERMISSION_SCOPE_SCHEMA_VERSION,
    recordingLocation: String(input.recordingLocation || "")
      .trim()
      .toLowerCase(),
    stages: [...PERMISSION_CONTENT.stages],
    audioEnabled: input.audioEnabled === true,
    initialAudience: "private",
    customerLabel: String(input.customerName || "").trim() || null,
    publicSharingIncluded: false,
    recordingAssessmentId: input.recordingAssessmentId || null,
    recordingAssessmentScopeHash: input.recordingAssessmentScopeHash || null,
  };
}
