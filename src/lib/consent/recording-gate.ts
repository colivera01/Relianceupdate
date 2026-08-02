import { prisma } from "@/server/db";
import {
  normalizeRecordingLocationChoice,
  parseRecordingComplianceMetadata,
  type RecordingLocationChoice,
} from "@/lib/job-assignment";
import { derivePermissionState, type PermissionState } from "./state-machine";

export type RecordingPermissionRecord = {
  id?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  verifiedDecision?: boolean | null;
  isCurrent?: boolean | null;
  scopeJson?: string | null;
  expiresAt?: Date | string | null;
  decisionEvidence?: { id?: string | null } | null;
  recipientMismatch?: boolean | null;
};

export type RecordingPermissionGate = {
  location: RecordingLocationChoice | null;
  permissionRequired: boolean;
  permissionState: PermissionState | "not_required";
  recordingUnlocked: boolean;
  verifiedAllowed: boolean;
  consentRecordId: string | null;
  recipientNeedsCorrection: boolean;
  blockCode: "RECORDING_LOCATION_REQUIRED" | "VERIFIED_PERMISSION_REQUIRED" | null;
  blockMessage: string | null;
};

function locationFromScope(scopeJson: string | null | undefined): RecordingLocationChoice | null {
  if (!scopeJson) return null;
  try {
    const scope = JSON.parse(scopeJson) as Record<string, unknown>;
    return normalizeRecordingLocationChoice(scope?.recordingLocation);
  } catch {
    return null;
  }
}

function stateFromRecord(
  record: RecordingPermissionRecord,
  verifiedAllowed: boolean,
  now: Date
): PermissionState {
  const lifecycle = String(record.lifecycleStatus || "").trim().toLowerCase();
  const status = String(record.status || "").trim().toLowerCase();
  const normalizedStatus =
    lifecycle === "allowed"
      ? "accepted"
      : lifecycle || status || "pending";

  return derivePermissionState({
    status: normalizedStatus,
    expiresAt: record.expiresAt,
    now,
    verifiedDecision: verifiedAllowed,
  });
}

/**
 * Canonical server-side decision for whether a work record may begin recording.
 * A current permission record proves that permission is required; its immutable
 * scope takes precedence over mutable booking metadata.
 */
export function resolveRecordingPermissionGate(input: {
  customerMetadata: string | null | undefined;
  consentRecord?: RecordingPermissionRecord | null;
  now?: Date;
}): RecordingPermissionGate {
  const compliance = parseRecordingComplianceMetadata(input.customerMetadata);
  const currentRecord = input.consentRecord?.isCurrent === false ? null : input.consentRecord || null;
  const scopedLocation = locationFromScope(currentRecord?.scopeJson);
  const location = scopedLocation || compliance.location;
  const permissionRequired =
    Boolean(currentRecord) || location === "residence" || location === "customer-business";
  const verifiedAllowed = Boolean(
    currentRecord &&
      currentRecord.verifiedDecision === true &&
      String(currentRecord.lifecycleStatus || "").trim().toUpperCase() === "ALLOWED" &&
      String(currentRecord.status || "").trim().toLowerCase() === "accepted" &&
      currentRecord.decisionEvidence?.id
  );
  const permissionState = permissionRequired
    ? currentRecord
      ? stateFromRecord(currentRecord, verifiedAllowed, input.now ?? new Date())
      : "not_sent"
    : "not_required";
  const recordingUnlocked = permissionRequired ? verifiedAllowed : Boolean(location);
  const blockCode = !location
    ? "RECORDING_LOCATION_REQUIRED"
    : permissionRequired && !recordingUnlocked
      ? "VERIFIED_PERMISSION_REQUIRED"
      : null;

  return {
    location,
    permissionRequired,
    permissionState,
    recordingUnlocked,
    verifiedAllowed,
    consentRecordId: currentRecord?.id || null,
    recipientNeedsCorrection: Boolean(currentRecord?.recipientMismatch),
    blockCode,
    blockMessage:
      blockCode === "RECORDING_LOCATION_REQUIRED"
        ? "Choose where the service recording will happen before sending the employee service order."
        : blockCode === "VERIFIED_PERMISSION_REQUIRED"
          ? "Verified recording permission is required before the employee service order or recording can proceed."
          : null,
  };
}

export async function loadRecordingPermissionGate(input: {
  bookingId: string;
  vendorId?: string;
  customerMetadata: string | null | undefined;
  now?: Date;
}): Promise<RecordingPermissionGate> {
  const consentRecord = await (prisma as any).consentRecord.findFirst({
    where: {
      bookingId: input.bookingId,
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      isCurrent: true,
    },
    orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
    select: {
      id: true,
      status: true,
      lifecycleStatus: true,
      verifiedDecision: true,
      isCurrent: true,
      scopeJson: true,
      expiresAt: true,
      recipientMismatch: true,
      decisionEvidence: { select: { id: true } },
    },
  });

  return resolveRecordingPermissionGate({
    customerMetadata: input.customerMetadata,
    consentRecord,
    now: input.now,
  });
}
