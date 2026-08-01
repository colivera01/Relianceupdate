import { derivePermissionState } from "./state-machine";

type PermissionSummarySource = {
  id: string;
  status: string;
  expiresAt?: Date | string | null;
  verifiedDecision?: boolean;
  vendorName: string;
  serviceName: string;
  scheduledFor?: Date | string | null;
  recordingLocation?: string | null;
  audioEnabled?: boolean;
  recipientEmailMasked?: string | null;
  recipientPhoneMasked?: string | null;
  [key: string]: unknown;
};

export function buildIdentitySafePermissionSummary(
  source: PermissionSummarySource,
) {
  return {
    id: source.id,
    state: derivePermissionState(source),
    vendorName: source.vendorName,
    serviceName: source.serviceName,
    scheduledFor: source.scheduledFor ?? null,
    recordingLocation: source.recordingLocation ?? null,
    audioEnabled: source.audioEnabled === true,
    initialAudience: "private" as const,
    recipientEmailMasked: source.recipientEmailMasked ?? null,
    recipientPhoneMasked: source.recipientPhoneMasked ?? null,
  };
}
