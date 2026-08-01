export type AssignmentMetadata = {
  assignedMembershipIds: string[];
  assignedEmployees: string[];
  primaryMembershipId: string | null;
  primaryEmployeeName: string | null;
};

export type RecordingLocationChoice = "business" | "residence" | "customer-business";

export type RecordingComplianceMetadata = {
  location: RecordingLocationChoice | null;
  consentAccepted: boolean;
  locationVerified: boolean;
  locationVerifiedAt: string | null;
  serviceOrderReleasedAt: string | null;
  releasedMembershipIds: string[];
  addressSnapshot: {
    type: RecordingLocationChoice | null;
    source: string | null;
    status: string | null;
    formattedAddress: string | null;
    capturedAt: string | null;
  } | null;
};

export function parseCustomerMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseAssignmentMetadata(value: string | null | undefined): AssignmentMetadata {
  const parsed = parseCustomerMetadata(value);
  const assignedMembershipIds = Array.isArray(parsed.vendor_job_assigned_membership_ids)
    ? parsed.vendor_job_assigned_membership_ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    : [];
  const assignedEmployees = Array.isArray(parsed.vendor_job_assigned_employees)
    ? parsed.vendor_job_assigned_employees
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    : [];
  const primaryMembershipId =
    String(parsed.vendor_job_primary_membership_id || "").trim() ||
    assignedMembershipIds[0] ||
    null;
  const primaryEmployeeName =
    String(parsed.vendor_job_primary_employee || "").trim() ||
    assignedEmployees[0] ||
    null;
  return { assignedMembershipIds, assignedEmployees, primaryMembershipId, primaryEmployeeName };
}

export function normalizeRecordingLocationChoice(value: unknown): RecordingLocationChoice | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "business") return "business";
  if (normalized === "residence") return "residence";
  if (normalized === "customer-business" || normalized === "customer_business") {
    return "customer-business";
  }
  return null;
}

export function parseRecordingComplianceMetadata(
  value: string | null | undefined
): RecordingComplianceMetadata {
  const parsed = parseCustomerMetadata(value);
  const releasedMembershipIds = Array.isArray(parsed.vendor_job_service_order_released_membership_ids)
    ? parsed.vendor_job_service_order_released_membership_ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    : [];
  const rawSnapshot = parsed.vendor_job_recording_location_snapshot;
  const snapshot =
    rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot)
      ? (rawSnapshot as Record<string, unknown>)
      : null;
  const snapshotAddress = snapshot
    ? [
        String(snapshot.address || "").trim(),
        String(snapshot.city || "").trim(),
        String(snapshot.state || "").trim(),
        String(snapshot.zip_code || snapshot.zipCode || "").trim(),
      ].filter(Boolean)
    : [];

  return {
    location: normalizeRecordingLocationChoice(parsed.vendor_job_recording_location),
    consentAccepted: parsed.vendor_job_consent_accepted === true,
    locationVerified: parsed.vendor_job_location_verified === true,
    locationVerifiedAt: String(parsed.vendor_job_location_verified_at || "").trim() || null,
    serviceOrderReleasedAt:
      String(parsed.vendor_job_service_order_released_at || "").trim() || null,
    releasedMembershipIds: Array.from(new Set(releasedMembershipIds)),
    addressSnapshot: snapshot
      ? {
          type: normalizeRecordingLocationChoice(snapshot.type),
          source: String(snapshot.source || "").trim() || null,
          status: String(snapshot.status || "").trim() || null,
          formattedAddress: snapshotAddress.length ? snapshotAddress.join(", ") : null,
          capturedAt: String(snapshot.captured_at || "").trim() || null,
        }
      : null,
  };
}

export function isServiceOrderReleasedForMembership(
  value: string | null | undefined,
  membershipId: string | null | undefined
): boolean {
  const normalizedMembershipId = String(membershipId || "").trim();
  if (!normalizedMembershipId) return false;
  const compliance = parseRecordingComplianceMetadata(value);
  return compliance.releasedMembershipIds.includes(normalizedMembershipId);
}

export function setStageProgressMetadata(
  value: string | null | undefined,
  stage: "INTRO" | "IN_PROGRESS" | "COMPLETED"
): string {
  const parsed = parseCustomerMetadata(value);
  const current = parsed.vendor_job_stage_progress;
  const normalizedCurrent =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  parsed.vendor_job_stage_progress = {
    ...normalizedCurrent,
    [stage]: "uploaded",
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(parsed);
}
