import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  assessmentFindFirst: vi.fn(),
  membershipFindFirst: vi.fn(),
  locationAttemptFindFirst: vi.fn(),
  locationExceptionFindFirst: vi.fn(),
  safetyFindFirst: vi.fn(),
  safetyFindMany: vi.fn(),
  safetyCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    employeeRecordingSafetyEvidence: { findFirst: db.safetyFindFirst },
    $transaction: db.transaction,
  },
}));

import {
  appendEmployeeRecordingSafetyEvidence,
  EmployeeRecordingSafetyServiceError,
} from "./employee-safety-service";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
} from "./assessment-v2";

function buildLocationMetadata() {
  const verifiedAt = "2026-08-27T18:00:00.000Z";
  const evidenceWithoutHash = {
    version: 2,
    provider: "azure_maps",
    providerApiVersion: "2025-01-01",
    providerResultId: "phase2-service-test",
    inputAddress: "2555 S Kirkman Rd, Orlando, FL 32811",
    normalizedAddress: "2555 S Kirkman Rd, Orlando, FL 32811",
    resultType: "Address",
    precision: "ROOFTOP",
    confidence: "HIGH",
    matchCodes: ["GOOD"],
    fallbackUsed: false,
    verifiedAt,
  };
  const evidenceHash = createHash("sha256")
    .update(JSON.stringify(evidenceWithoutHash))
    .digest("hex");
  const providerEvidence = {
    ...evidenceWithoutHash,
    evidenceHash,
    sourceLocationType: "business",
  };
  const snapshot = {
    type: "business",
    source: "vendor_profile",
    status: "verified_coordinates",
    address: "2555 S Kirkman Rd",
    city: "Orlando",
    state: "FL",
    zip_code: "32811",
    latitude: 28.51,
    longitude: -81.46,
    geocoded_at: verifiedAt,
    captured_at: "2026-08-27T18:01:00.000Z",
    evidence_version: 2,
    geocoding_evidence: providerEvidence,
  } as Record<string, unknown>;
  const snapshotHash = createHash("sha256")
    .update(
      JSON.stringify({
        type: "business",
        source: "vendor_profile",
        address: snapshot.address,
        city: snapshot.city,
        state: snapshot.state,
        zipCode: snapshot.zip_code,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        providerEvidence,
      }),
    )
    .digest("hex");
  snapshot.snapshot_evidence_hash = snapshotHash;
  return {
    snapshotHash,
    customerMetadata: JSON.stringify({
      vendor_job_assigned_membership_ids: ["membership-1"],
      vendor_job_assignment_generation: 4,
      vendor_job_recording_location: "business",
      vendor_job_recording_location_snapshot: snapshot,
    }),
  };
}

const location = buildLocationMetadata();
const canonicalAssessment = parseRecordingAssessmentV2({
  contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  location: { type: "VENDOR_BUSINESS", snapshotEvidenceHash: location.snapshotHash },
  intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
  expectedPeople: ["NO_IDENTIFIABLE_PEOPLE"],
  recordingFormat: "VIDEO_ONLY",
  recordingArea: { boundary: "SERVICE_AREA_ONLY" },
});

const assessment = {
  id: "assessment-1",
  bookingId: "booking-1",
  vendorId: "vendor-1",
  generation: 2,
  isCurrent: true,
  status: "COMPLETE",
  contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  locationType: "business",
  subjectJson: canonicalAssessment.subjectJson,
  scopeJson: canonicalAssessment.scopeJson,
  scopeHash: canonicalAssessment.scopeHash,
};

const tx = {
  booking: { findFirst: db.bookingFindFirst },
  recordingScopeAssessment: { findFirst: db.assessmentFindFirst },
  vendorMembership: { findFirst: db.membershipFindFirst },
  recordingLocationAttempt: { findFirst: db.locationAttemptFindFirst },
  recordingLocationException: { findFirst: db.locationExceptionFindFirst },
  employeeRecordingSafetyEvidence: {
    findFirst: db.safetyFindFirst,
    findMany: db.safetyFindMany,
    create: db.safetyCreate,
  },
};

function append(overrides: Record<string, unknown> = {}) {
  return appendEmployeeRecordingSafetyEvidence({
    bookingId: "booking-1",
    vendorId: "vendor-1",
    membershipId: "membership-1",
    checkType: "INITIAL",
    stage: "STARTING_CONDITION",
    result: "READY",
    issues: [],
    now: new Date("2026-08-27T20:00:00.000Z"),
    ...overrides,
  } as any);
}

describe("employee runtime-safety append service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.transaction.mockImplementation((callback) => callback(tx));
    db.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: location.customerMetadata,
    });
    db.assessmentFindFirst.mockResolvedValue(assessment);
    db.membershipFindFirst.mockResolvedValue({ id: "membership-1", userId: "employee-user-1" });
    db.locationAttemptFindFirst.mockResolvedValue({ id: "location-attempt-1", status: "VERIFIED" });
    db.locationExceptionFindFirst.mockResolvedValue(null);
    db.safetyFindFirst.mockResolvedValue(null);
    db.safetyFindMany.mockResolvedValue([]);
    db.safetyCreate.mockImplementation(({ data }) => ({ id: "safety-created", ...data }));
  });

  it("derives every authoritative binding server-side and appends sequence one", async () => {
    const created = await append();

    expect(db.safetyCreate).toHaveBeenCalledOnce();
    expect(db.safetyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "booking-1",
        vendorId: "vendor-1",
        assessmentId: "assessment-1",
        assessmentGeneration: 2,
        assessmentContractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
        assessmentScopeHash: canonicalAssessment.scopeHash,
        locationSnapshotEvidenceHash: location.snapshotHash,
        membershipId: "membership-1",
        assignmentGeneration: 4,
        safetyContractVersion: "employee-pre-recording-safety-v1",
        checkType: "INITIAL",
        stage: "STARTING_CONDITION",
        result: "READY",
        issueCodesJson: "[]",
        sequence: 1,
        predecessorEvidenceId: null,
        predecessorEvidenceHash: null,
        canonicalJson: expect.any(String),
        evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(created.id).toBe("safety-created");
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("preserves BLOCKED history and appends a linked READY recheck", async () => {
    const first = await append({
      result: "BLOCKED",
      issues: ["PRIVATE_DOCUMENT_OR_SCREEN"],
    });
    db.safetyFindMany.mockResolvedValue([first]);
    db.safetyCreate.mockImplementationOnce(({ data }) => ({ id: "safety-ready", ...data }));

    const second = await append({ now: new Date("2026-08-27T20:05:00.000Z") });

    expect(second).toMatchObject({
      id: "safety-ready",
      sequence: 2,
      predecessorEvidenceId: "safety-created",
      predecessorEvidenceHash: first.evidenceHash,
      result: "READY",
    });
    expect(db.safetyCreate).toHaveBeenCalledTimes(2);
  });

  it("requires a new assessment chain after material scope expansion", async () => {
    const material = await append({
      result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
      issues: ["MATERIAL_SCOPE_EXPANSION_REQUIRED"],
    });
    db.safetyFindMany.mockResolvedValue([material]);

    await expect(
      append({ now: new Date("2026-08-27T20:05:00.000Z") }),
    ).rejects.toMatchObject({ code: "V2_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED" });
    expect(db.safetyCreate).toHaveBeenCalledTimes(1);
  });

  it("fails closed for a non-V2 assessment without writing evidence", async () => {
    db.assessmentFindFirst.mockResolvedValue({
      ...assessment,
      contractVersion: "recording-assessment-v3-package-audio-v1",
    });

    await expect(append()).rejects.toMatchObject({
      code: "V2_SAFETY_ASSESSMENT_REQUIRED",
    });
    expect(db.safetyCreate).not.toHaveBeenCalled();
  });

  it("fails closed for inactive, reassigned, or unverified employees", async () => {
    db.membershipFindFirst.mockResolvedValue(null);
    await expect(append()).rejects.toBeInstanceOf(EmployeeRecordingSafetyServiceError);
    expect(db.safetyCreate).not.toHaveBeenCalled();

    db.membershipFindFirst.mockResolvedValue({ id: "membership-1", userId: "employee-user-1" });
    db.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: JSON.stringify({
        ...JSON.parse(location.customerMetadata),
        vendor_job_assigned_membership_ids: ["membership-other"],
      }),
    });
    await expect(append()).rejects.toMatchObject({ code: "V2_SAFETY_ASSIGNMENT_STALE" });

    db.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: location.customerMetadata,
    });
    db.locationAttemptFindFirst.mockResolvedValue({ id: "location-attempt-1", status: "FAILED" });
    await expect(append()).rejects.toMatchObject({ code: "V2_SAFETY_LOCATION_NOT_VERIFIED" });
    expect(db.safetyCreate).not.toHaveBeenCalled();
  });

  it("does not accept a stage/check mismatch or sensitive free text fields", async () => {
    await expect(
      append({ checkType: "STAGE_RECHECK", stage: "STARTING_CONDITION" }),
    ).rejects.toMatchObject({ code: "V2_SAFETY_CHECK_STAGE_MISMATCH" });

    await expect(
      append({
        issues: [{ code: "PRIVATE_DOCUMENT_OR_SCREEN", description: "account 1234" }],
        result: "BLOCKED",
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ENUM_VALUE" });
    expect(db.safetyCreate).not.toHaveBeenCalled();
  });
});
