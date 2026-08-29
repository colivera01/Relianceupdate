import { createHash } from "node:crypto";

export type AssignmentMetadata = {
  assignedMembershipIds: string[];
  assignedEmployees: string[];
  primaryMembershipId: string | null;
  primaryEmployeeName: string | null;
};

export type RecordingLocationChoice = "business" | "residence" | "customer-business";

export type RecordingLocationSnapshot = {
  type: RecordingLocationChoice;
  source: "vendor_profile" | "customer_profile" | "customer_supplied";
  status: "verified_coordinates";
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  geocodedAt: string;
  capturedAt: string;
  formattedAddress: string;
  evidenceVersion: 1 | 2;
  snapshotEvidenceHash: string | null;
  geocodingEvidence: {
    provider: "azure_maps" | "census";
    providerApiVersion: string;
    normalizedAddress: string;
    precision: string;
    confidence: string;
    matchCodes: string[];
    fallbackUsed: boolean;
    evidenceHash: string;
  } | null;
};

export type RecordingLocationSnapshotValidation =
  | { ok: true; snapshot: RecordingLocationSnapshot }
  | { ok: false; code: string };

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

function finiteCoordinate(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const APPROVED_LOCATION_SOURCES: Record<RecordingLocationChoice, Set<string>> = {
  business: new Set(["vendor_profile"]),
  residence: new Set(["customer_profile", "customer_supplied"]),
  "customer-business": new Set(["customer_supplied"]),
};

export function validateRecordingLocationSnapshot(
  value: string | null | undefined,
  expectedLocation?: RecordingLocationChoice | null,
): RecordingLocationSnapshotValidation {
  const parsed = parseCustomerMetadata(value);
  const configuredLocation = normalizeRecordingLocationChoice(
    parsed.vendor_job_recording_location,
  );
  const expected = expectedLocation || configuredLocation;
  if (!expected || configuredLocation !== expected) {
    return { ok: false, code: "RECORDING_LOCATION_TYPE_MISMATCH" };
  }

  const raw = parsed.vendor_job_recording_location_snapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_MISSING" };
  }
  const snapshot = raw as Record<string, unknown>;
  const type = normalizeRecordingLocationChoice(snapshot.type);
  if (type !== expected) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_TYPE_MISMATCH" };
  }

  const source = String(snapshot.source || "").trim();
  if (!APPROVED_LOCATION_SOURCES[expected].has(source)) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_SOURCE_MISMATCH" };
  }
  if (String(snapshot.status || "").trim() !== "verified_coordinates") {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_UNVERIFIED" };
  }

  const address = String(snapshot.address || "").trim();
  const city = String(snapshot.city || "").trim();
  const state = String(snapshot.state || "").trim();
  const zipCode = String(snapshot.zip_code || snapshot.zipCode || "").trim();
  const latitude = finiteCoordinate(snapshot.latitude);
  const longitude = finiteCoordinate(snapshot.longitude);
  const geocodedAt = String(snapshot.geocoded_at || snapshot.geocodedAt || "").trim();
  const capturedAt = String(snapshot.captured_at || "").trim();
  const evidenceVersion = Number(snapshot.evidence_version || 1) === 2 ? 2 : 1;
  if (!address || !city || !state || !zipCode || !capturedAt) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_INCOMPLETE" };
  }
  if (
    latitude == null ||
    longitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_COORDINATES_INVALID" };
  }
  if (latitude === 0 && longitude === 0) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_ZERO_COORDINATES" };
  }
  if (!geocodedAt || !Number.isFinite(Date.parse(geocodedAt))) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_GEOCODING_EVIDENCE_MISSING" };
  }
  if (!Number.isFinite(Date.parse(capturedAt))) {
    return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_CAPTURE_EVIDENCE_INVALID" };
  }

  let geocodingEvidence: RecordingLocationSnapshot["geocodingEvidence"] = null;
  let snapshotEvidenceHash: string | null = null;
  if (evidenceVersion === 2) {
    const rawEvidence = snapshot.geocoding_evidence;
    if (!rawEvidence || typeof rawEvidence !== "object" || Array.isArray(rawEvidence)) {
      return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_PROVIDER_EVIDENCE_MISSING" };
    }
    const evidence = rawEvidence as Record<string, unknown>;
    const provider = String(evidence.provider || "").trim();
    const evidenceRecordVersion = Number(evidence.version);
    const providerApiVersion = String(evidence.providerApiVersion || "").trim();
    const providerResultId = evidence.providerResultId == null ? null : String(evidence.providerResultId).trim();
    const inputAddress = String(evidence.inputAddress || "").trim();
    const normalizedAddress = String(evidence.normalizedAddress || "").trim();
    const resultType = String(evidence.resultType || "").trim();
    const precision = String(evidence.precision || "").trim();
    const confidence = String(evidence.confidence || "").trim();
    const evidenceHash = String(evidence.evidenceHash || "").trim();
    snapshotEvidenceHash = String(snapshot.snapshot_evidence_hash || "").trim() || null;
    const sourceLocationType = normalizeRecordingLocationChoice(evidence.sourceLocationType);
    const verifiedAt = String(evidence.verifiedAt || "").trim();
    const matchCodes = Array.isArray(evidence.matchCodes)
      ? evidence.matchCodes.map((code) => String(code || "").trim()).filter(Boolean)
      : [];
    if (
      !["azure_maps", "census"].includes(provider) ||
      evidenceRecordVersion !== 2 ||
      !providerApiVersion ||
      !inputAddress ||
      !normalizedAddress ||
      resultType !== "Address" ||
      !precision ||
      !confidence ||
      matchCodes.length === 0 ||
      sourceLocationType !== expected ||
      verifiedAt !== geocodedAt ||
      !/^[a-f0-9]{64}$/i.test(evidenceHash) ||
      !snapshotEvidenceHash ||
      !/^[a-f0-9]{64}$/i.test(snapshotEvidenceHash) ||
      typeof evidence.fallbackUsed !== "boolean"
    ) {
      return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_PROVIDER_EVIDENCE_INVALID" };
    }
    const expectedEvidenceHash = createHash("sha256")
      .update(
        JSON.stringify({
          version: 2,
          provider,
          providerApiVersion,
          providerResultId,
          inputAddress,
          normalizedAddress,
          resultType: "Address",
          precision,
          confidence,
          matchCodes,
          fallbackUsed: evidence.fallbackUsed,
          verifiedAt,
        }),
      )
      .digest("hex");
    if (expectedEvidenceHash !== evidenceHash) {
      return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_PROVIDER_EVIDENCE_INVALID" };
    }
    const expectedSnapshotHash = createHash("sha256")
      .update(
        JSON.stringify({
          type: expected,
          source,
          address,
          city,
          state,
          zipCode,
          latitude,
          longitude,
          providerEvidence: evidence,
        }),
      )
      .digest("hex");
    if (expectedSnapshotHash !== snapshotEvidenceHash) {
      return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_PROVIDER_EVIDENCE_INVALID" };
    }
    geocodingEvidence = {
      provider: provider as "azure_maps" | "census",
      providerApiVersion,
      normalizedAddress,
      precision,
      confidence,
      matchCodes,
      fallbackUsed: evidence.fallbackUsed,
      evidenceHash,
    };
  } else {
    const storedSnapshotHash = String(snapshot.snapshot_evidence_hash || "").trim() || null;
    if (storedSnapshotHash) {
      const expectedSnapshotHash = createHash("sha256")
        .update(
          JSON.stringify({
            type: expected,
            source,
            address,
            city,
            state,
            zipCode,
            latitude,
            longitude,
            providerEvidence: null,
          }),
        )
        .digest("hex");
      if (storedSnapshotHash !== expectedSnapshotHash) {
        return { ok: false, code: "RECORDING_LOCATION_SNAPSHOT_EVIDENCE_HASH_INVALID" };
      }
      snapshotEvidenceHash = storedSnapshotHash;
    }
  }

  return {
    ok: true,
    snapshot: {
      type,
      source: source as RecordingLocationSnapshot["source"],
      status: "verified_coordinates",
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      geocodedAt,
      capturedAt,
      formattedAddress: [address, city, state, zipCode].join(", "),
      evidenceVersion,
      snapshotEvidenceHash,
      geocodingEvidence,
    },
  };
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
  const location = normalizeRecordingLocationChoice(parsed.vendor_job_recording_location);
  const snapshotValidation = validateRecordingLocationSnapshot(value, location);
  const snapshot = snapshotValidation.ok ? snapshotValidation.snapshot : null;

  return {
    location,
    consentAccepted: parsed.vendor_job_consent_accepted === true,
    locationVerified: parsed.vendor_job_location_verified === true,
    locationVerifiedAt: String(parsed.vendor_job_location_verified_at || "").trim() || null,
    serviceOrderReleasedAt:
      String(parsed.vendor_job_service_order_released_at || "").trim() || null,
    releasedMembershipIds: Array.from(new Set(releasedMembershipIds)),
    addressSnapshot: snapshot
      ? {
          type: snapshot.type,
          source: snapshot.source,
          status: snapshot.status,
          formattedAddress: snapshot.formattedAddress,
          capturedAt: snapshot.capturedAt,
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
