export const PERMISSION_CONTENT_VERSION =
  "recording-permission-v2-simplified-v1";

export const SUPPORTED_PERMISSION_CONTENT_VERSIONS = [
  PERMISSION_CONTENT_VERSION,
  "recording-permission-v3-video-only",
  "recording-permission-v3-video-audio",
  "recording-permission-v4-simplified-work-scope-video-only",
  "recording-permission-v4-simplified-work-scope-video-audio",
] as const;

const supportedPermissionContentVersions = new Set<string>(
  SUPPORTED_PERMISSION_CONTENT_VERSIONS,
);

export const CURRENT_PERMISSION_REQUEST_REQUIRED_CODE =
  "CURRENT_PERMISSION_REQUEST_REQUIRED";

export const CURRENT_PERMISSION_REQUEST_REQUIRED_MESSAGE =
  "This recording request uses an older or unsupported permission version. Ask the service provider to send a current request. Recording remains blocked.";

export class CurrentPermissionRequestRequiredError extends Error {
  readonly code = CURRENT_PERMISSION_REQUEST_REQUIRED_CODE;

  constructor() {
    super(CURRENT_PERMISSION_REQUEST_REQUIRED_MESSAGE);
    this.name = "CurrentPermissionRequestRequiredError";
  }
}

export function isCurrentPermissionContentVersion(value: unknown): boolean {
  return supportedPermissionContentVersions.has(String(value || "").trim());
}
