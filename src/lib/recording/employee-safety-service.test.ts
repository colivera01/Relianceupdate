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
import {
  buildV2StageLocationEvidence,
  V2_STAGE_LOCATION_EVIDENCE_VERSION,
} from "./v2-safety-location";

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

const locationAttemptBase = {
  id: "location-attempt-1",
  bookingId: "booking-1",
  vendorId: "vendor-1",
  assessmentId: "assessment-1",
  assessmentGeneration: 2,
  membershipId: "membership-1",
  assignmentGeneration: 4,
  stage: "STARTING_CONDITION",
  snapshotEvidenceHash: location.snapshotHash,
  status: "VERIFIED",
  resultCode: "LOCATION_VERIFIED",
  method: "DEVICE_GEOLOCATION",
  distanceMeters: 12,
  accuracyMeters: 5,
  latitude: 28.51,
  longitude: -81.46,
  capturedAt: new Date("2026-08-27T19:59:00.000Z"),
  attemptedAt: new Date("2026-08-27T20:00:00.000Z"),
};
const locationAttemptEvidence = buildV2StageLocationEvidence({
  attemptId: locationAttemptBase.id,
  bookingId: locationAttemptBase.bookingId,
  vendorId: locationAttemptBase.vendorId,
  assessmentId: locationAttemptBase.assessmentId,
  assessmentGeneration: locationAttemptBase.assessmentGeneration,
  membershipId: locationAttemptBase.membershipId,
  assignmentGeneration: locationAttemptBase.assignmentGeneration,
  stage: locationAttemptBase.stage as "STARTING_CONDITION",
  snapshotEvidenceHash: locationAttemptBase.snapshotEvidenceHash,
  status: locationAttemptBase.status,
  resultCode: locationAttemptBase.resultCode,
  method: locationAttemptBase.method,
  distanceMeters: locationAttemptBase.distanceMeters,
  accuracyMeters: locationAttemptBase.accuracyMeters,
  latitude: locationAttemptBase.latitude,
  longitude: locationAttemptBase.longitude,
  capturedAt: locationAttemptBase.capturedAt,
  attemptedAt: locationAttemptBase.attemptedAt,
});
const locationAttempt = {
  ...locationAttemptBase,
  evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_VERSION,
  canonicalJson: locationAttemptEvidence.canonicalJson,
  evidenceHash: locationAttemptEvidence.evidenceHash,
};
const secondLocationAttemptBase = {
  ...locationAttemptBase,
  id: "location-attempt-2",
  capturedAt: new Date("2026-08-27T20:03:00.000Z"),
  attemptedAt: new Date("2026-08-27T20:04:00.000Z"),
};
const secondLocationAttemptEvidence = buildV2StageLocationEvidence({
  attemptId: secondLocationAttemptBase.id,
  bookingId: secondLocationAttemptBase.bookingId,
  vendorId: secondLocationAttemptBase.vendorId,
  assessmentId: secondLocationAttemptBase.assessmentId,
  assessmentGeneration: secondLocationAttemptBase.assessmentGeneration,
  membershipId: secondLocationAttemptBase.membershipId,
  assignmentGeneration: secondLocationAttemptBase.assignmentGeneration,
  stage: secondLocationAttemptBase.stage as "STARTING_CONDITION",
  snapshotEvidenceHash: secondLocationAttemptBase.snapshotEvidenceHash,
  status: secondLocationAttemptBase.status,
  resultCode: secondLocationAttemptBase.resultCode,
  method: secondLocationAttemptBase.method,
  distanceMeters: secondLocationAttemptBase.distanceMeters,
  accuracyMeters: secondLocationAttemptBase.accuracyMeters,
  latitude: secondLocationAttemptBase.latitude,
  longitude: secondLocationAttemptBase.longitude,
  capturedAt: secondLocationAttemptBase.capturedAt,
  attemptedAt: secondLocationAttemptBase.attemptedAt,
});
const secondLocationAttempt = {
  ...secondLocationAttemptBase,
  evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_VERSION,
  canonicalJson: secondLocationAttemptEvidence.canonicalJson,
  evidenceHash: secondLocationAttemptEvidence.evidenceHash,
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
    locationAttemptId: "location-attempt-1",
    requestId: "phase3a-safety-request-0001",
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
    db.locationAttemptFindFirst.mockImplementation(async ({ where }: any) =>
      where.id === secondLocationAttempt.id ? secondLocationAttempt : locationAttempt,
    );
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
        locationAttemptId: "location-attempt-1",
        locationAttemptEvidenceHash: locationAttemptEvidence.evidenceHash,
        safetyContractVersion: "employee-pre-recording-safety-v2",
        checkType: "INITIAL",
        stage: "STARTING_CONDITION",
        result: "READY",
        issueCodesJson: "[]",
        sequence: 1,
        predecessorEvidenceId: null,
        predecessorEvidenceHash: null,
        submissionRequestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        submissionBodyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
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

    const second = await append({
      locationAttemptId: "location-attempt-2",
      requestId: "phase3a-safety-request-0002",
      now: new Date("2026-08-27T20:04:00.000Z"),
    });

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
      append({
        requestId: "phase3a-safety-request-0002",
        now: new Date("2026-08-27T20:04:00.000Z"),
      }),
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
    db.locationAttemptFindFirst.mockResolvedValue({ ...locationAttempt, status: "FAILED" });
    await expect(append()).rejects.toMatchObject({ code: "V2_LOCATION_NOT_VERIFIED" });
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
    ).rejects.toMatchObject({ code: "V2_SAFETY_ISSUE_INVALID" });
    expect(db.safetyCreate).not.toHaveBeenCalled();
  });

  it("returns the original evidence for an identical idempotent retry", async () => {
    const first = await append();
    db.safetyFindFirst.mockResolvedValue(first);

    const retried = await append();

    expect(retried).toBe(first);
    expect(db.safetyCreate).toHaveBeenCalledOnce();
  });

  it("returns an idempotent result after the original GPS freshness window", async () => {
    const first = await append();
    db.safetyFindFirst.mockResolvedValue(first);
    db.locationAttemptFindFirst.mockResolvedValue({ ...locationAttempt, status: "FAILED" });

    const retried = await append({ now: new Date("2026-08-27T21:00:00.000Z") });

    expect(retried).toBe(first);
    expect(db.safetyCreate).toHaveBeenCalledOnce();
  });

  it("fails closed when an idempotency key is reused with different content", async () => {
    const first = await append();
    db.safetyFindFirst.mockResolvedValue(first);

    await expect(
      append({ result: "BLOCKED", issues: ["PRIVATE_DOCUMENT_OR_SCREEN"] }),
    ).rejects.toMatchObject({ code: "V2_SAFETY_IDEMPOTENCY_CONFLICT" });
    expect(db.safetyCreate).toHaveBeenCalledOnce();
  });

  it("does not let a different submission reuse one physical location attempt", async () => {
    const first = await append();
    db.safetyFindFirst.mockImplementation(async ({ where }: any) =>
      where.locationAttemptId === first.locationAttemptId ? first : null,
    );

    await expect(append({ requestId: "phase3a-safety-request-0002" })).rejects.toMatchObject({
      code: "V2_SAFETY_LOCATION_ATTEMPT_ALREADY_USED",
    });
    expect(db.safetyCreate).toHaveBeenCalledOnce();
  });

  it("collapses concurrent duplicate retries into one canonical evidence row", async () => {
    let storedRow: any = null;
    db.safetyFindFirst.mockImplementation(async ({ where }: any) => {
      if (!storedRow) return null;
      if (where.submissionRequestHash === storedRow.submissionRequestHash) return storedRow;
      if (where.locationAttemptId === storedRow.locationAttemptId) return storedRow;
      return null;
    });
    db.safetyFindMany.mockImplementation(async () => (storedRow ? [storedRow] : []));
    db.safetyCreate.mockImplementation(async ({ data }: any) => {
      await Promise.resolve();
      if (storedRow) {
        const conflict: any = new Error("unique conflict");
        conflict.code = "P2002";
        throw conflict;
      }
      storedRow = { id: "safety-concurrent", ...data };
      return storedRow;
    });

    const [first, second] = await Promise.all([append(), append()]);

    expect(first.id).toBe("safety-concurrent");
    expect(second.id).toBe("safety-concurrent");
    expect(first.evidenceHash).toBe(second.evidenceHash);
    expect(first.sequence).toBe(1);
    expect(db.safetyCreate).toHaveBeenCalledTimes(2);
  });

  it("serializes a concurrent READY versus BLOCKED race so the newer server event wins", async () => {
    const rows: any[] = [];
    let initialReads = 0;
    let releaseInitialReads!: () => void;
    const initialReadBarrier = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });
    db.safetyFindFirst.mockImplementation(async ({ where }: any) => {
      if (where.submissionRequestHash) {
        return rows.find((row) => row.submissionRequestHash === where.submissionRequestHash) || null;
      }
      if (where.locationAttemptId) {
        return rows.find((row) => row.locationAttemptId === where.locationAttemptId) || null;
      }
      return null;
    });
    db.safetyFindMany.mockImplementation(async () => {
      initialReads += 1;
      if (initialReads <= 2) {
        if (initialReads === 2) releaseInitialReads();
        await initialReadBarrier;
        return [];
      }
      return [...rows].sort((left, right) => left.sequence - right.sequence);
    });
    db.safetyCreate.mockImplementation(async ({ data }: any) => {
      if (data.result === "BLOCKED") {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      if (rows.some((row) => row.chainKey === data.chainKey && row.sequence === data.sequence)) {
        const conflict: any = new Error("chain sequence conflict");
        conflict.code = "P2002";
        throw conflict;
      }
      const row = { id: `safety-race-${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    });

    const [ready, blocked] = await Promise.all([
      append(),
      append({
        locationAttemptId: "location-attempt-2",
        requestId: "phase3a-safety-request-0002",
        result: "BLOCKED",
        issues: ["PRIVATE_DOCUMENT_OR_SCREEN"],
        now: new Date("2026-08-27T20:04:00.000Z"),
      }),
    ]);

    expect(ready).toMatchObject({ result: "READY", sequence: 1 });
    expect(blocked).toMatchObject({
      result: "BLOCKED",
      sequence: 2,
      predecessorEvidenceId: ready.id,
      predecessorEvidenceHash: ready.evidenceHash,
    });
    expect(rows).toHaveLength(2);
  });
});
