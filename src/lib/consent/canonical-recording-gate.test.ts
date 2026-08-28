import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  assessmentFindFirst: vi.fn(),
  consentFindFirst: vi.fn(),
  certificationFindFirst: vi.fn(),
  locationAttemptFindFirst: vi.fn(),
  locationExceptionFindFirst: vi.fn(),
  safetyFindMany: vi.fn(),
  bookingFindUnique: vi.fn(),
  packageFindFirst: vi.fn(),
  managerDecisionFindFirst: vi.fn(),
  metricCreate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    recordingScopeAssessment: { findFirst: db.assessmentFindFirst },
    consentRecord: { findFirst: db.consentFindFirst },
    employeeRecordingCertification: { findFirst: db.certificationFindFirst },
    recordingLocationAttempt: { findFirst: db.locationAttemptFindFirst },
    recordingLocationException: { findFirst: db.locationExceptionFindFirst },
    employeeRecordingSafetyEvidence: { findMany: db.safetyFindMany },
    booking: { findUnique: db.bookingFindUnique },
    serviceVideoPackageEvidence: { findFirst: db.packageFindFirst },
    serviceVideoManagerDecisionEvidence: { findFirst: db.managerDecisionFindFirst },
    recordingGateMetric: { create: db.metricCreate },
  },
}));

import { loadCanonicalRecordingGate } from "./recording-gate";
import { buildStoredAuthorityEvidence, evaluatePermissionAuthority } from "./authority-validation";
import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
} from "@/lib/recording/assessment-v2";
import {
  EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION,
  parseEmployeeRecordingSafetyEvidence,
} from "@/lib/recording/employee-safety";
import {
  buildV2StageLocationEvidence,
  V2_STAGE_LOCATION_EVIDENCE_VERSION,
} from "@/lib/recording/v2-safety-location";

const metadata = JSON.stringify({
  vendor_job_assigned_membership_ids: ["member-1"],
  vendor_job_service_order_released_membership_ids: ["member-1"],
  vendor_job_service_order_released_at: "2026-08-04T12:00:00.000Z",
  vendor_job_assignment_generation: 1,
  vendor_job_recording_location: "residence",
  vendor_job_recording_location_snapshot: {
    type: "residence",
    source: "customer_profile",
    status: "verified_coordinates",
    address: "407 Boxwood Circle",
    city: "Winter Springs",
    state: "FL",
    zip_code: "32708",
    latitude: 28.698,
    longitude: -81.308,
    geocoded_at: "2026-08-04T11:55:00.000Z",
    captured_at: "2026-08-04T12:00:00.000Z",
  },
});

const assessment = {
  id: "assessment-1",
  generation: 1,
  vendorId: "vendor-1",
  status: "COMPLETE",
  locationType: "residence",
  authorityHolderType: "customer",
  riskLevel: "LEVEL_2",
  propertyScope: "customer_owned",
  peopleScope: "none",
  frameControl: "controlled",
  subjectJson: JSON.stringify({
    sensitiveInformationMayAppear: false,
    minorMayAppear: false,
    protectedNonParticipantMayAppear: false,
  }),
  scopeHash: "scope-hash-1",
  scopeJson: JSON.stringify({ authorityHolderType: "customer" }),
  permissionRequired: true,
  serviceCanContinueWithoutRecording: true,
  audioRequested: false,
  audioAllowed: false,
  authorities: [
    { authorityType: "VENDOR_MANAGER", required: true, status: "VERIFIED" },
    { authorityType: "CUSTOMER_OR_REPRESENTATIVE", required: true, status: "VERIFIED" },
  ],
};

function v2LocationMetadata() {
  const verifiedAt = "2026-08-27T18:00:00.000Z";
  const evidence = {
    version: 2,
    provider: "azure_maps",
    providerApiVersion: "2025-01-01",
    providerResultId: "provider-result-v2",
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
    .update(JSON.stringify(evidence))
    .digest("hex");
  const providerEvidence = { ...evidence, evidenceHash, sourceLocationType: "business" };
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
  const snapshotEvidenceHash = createHash("sha256")
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
  snapshot.snapshot_evidence_hash = snapshotEvidenceHash;
  return {
    snapshotEvidenceHash,
    metadata: JSON.stringify({
      vendor_job_assigned_membership_ids: ["member-1"],
      vendor_job_service_order_released_membership_ids: ["member-1"],
      vendor_job_service_order_released_at: "2026-08-27T18:05:00.000Z",
      vendor_job_assignment_generation: 1,
      vendor_job_recording_location: "business",
      vendor_job_recording_location_snapshot: snapshot,
    }),
  };
}

const v2Location = v2LocationMetadata();
const parsedV2Assessment = parseRecordingAssessmentV2({
  contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  location: {
    type: "VENDOR_BUSINESS",
    snapshotEvidenceHash: v2Location.snapshotEvidenceHash,
  },
  intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
  expectedPeople: ["NO_IDENTIFIABLE_PEOPLE"],
  recordingFormat: "VIDEO_ONLY",
  recordingArea: { boundary: "SERVICE_AREA_ONLY" },
});
const v2Assessment = {
  ...assessment,
  id: "assessment-v2",
  generation: 2,
  contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  locationType: "business",
  authorityHolderType: "vendor_manager",
  subjectJson: parsedV2Assessment.subjectJson,
  scopeJson: parsedV2Assessment.scopeJson,
  scopeHash: parsedV2Assessment.scopeHash,
  permissionRequired: false,
  authorities: [{ authorityType: "VENDOR_MANAGER", required: true, status: "VERIFIED" }],
};

const v2LocationAttemptBase = {
  id: "location-attempt-v2",
  bookingId: "booking-1",
  vendorId: "vendor-1",
  assessmentId: v2Assessment.id,
  assessmentGeneration: v2Assessment.generation,
  membershipId: "member-1",
  assignmentGeneration: 1,
  stage: "STARTING_CONDITION" as const,
  snapshotEvidenceHash: v2Location.snapshotEvidenceHash,
  status: "VERIFIED",
  resultCode: "LOCATION_VERIFIED",
  method: "DEVICE_GEOLOCATION",
  distanceMeters: 12,
  accuracyMeters: 5,
  latitude: 28.51,
  longitude: -81.46,
  capturedAt: new Date("2026-08-27T18:09:00.000Z"),
  attemptedAt: new Date("2026-08-27T18:10:00.000Z"),
};
const v2LocationAttemptCanonical = buildV2StageLocationEvidence({
  attemptId: v2LocationAttemptBase.id,
  bookingId: v2LocationAttemptBase.bookingId,
  vendorId: v2LocationAttemptBase.vendorId,
  assessmentId: v2LocationAttemptBase.assessmentId,
  assessmentGeneration: v2LocationAttemptBase.assessmentGeneration,
  membershipId: v2LocationAttemptBase.membershipId,
  assignmentGeneration: v2LocationAttemptBase.assignmentGeneration,
  stage: v2LocationAttemptBase.stage,
  snapshotEvidenceHash: v2LocationAttemptBase.snapshotEvidenceHash,
  status: v2LocationAttemptBase.status,
  resultCode: v2LocationAttemptBase.resultCode,
  method: v2LocationAttemptBase.method,
  distanceMeters: v2LocationAttemptBase.distanceMeters,
  accuracyMeters: v2LocationAttemptBase.accuracyMeters,
  latitude: v2LocationAttemptBase.latitude,
  longitude: v2LocationAttemptBase.longitude,
  capturedAt: v2LocationAttemptBase.capturedAt,
  attemptedAt: v2LocationAttemptBase.attemptedAt,
});
const v2LocationAttempt = {
  ...v2LocationAttemptBase,
  evidenceVersion: V2_STAGE_LOCATION_EVIDENCE_VERSION,
  canonicalJson: v2LocationAttemptCanonical.canonicalJson,
  evidenceHash: v2LocationAttemptCanonical.evidenceHash,
};

function storedV2Safety(input: {
  result?: "READY" | "BLOCKED" | "MATERIAL_SCOPE_CHANGE_REQUIRED";
  issues?: string[];
  membershipId?: string;
  locationHash?: string;
  assessmentHash?: string;
}) {
  const result = input.result || "READY";
  const parsed = parseEmployeeRecordingSafetyEvidence({
    contractVersion: EMPLOYEE_RECORDING_SAFETY_HARDENED_CONTRACT_VERSION,
    sequence: 1,
    workRecord: { bookingId: "booking-1", vendorId: "vendor-1" },
    assessment: {
      id: v2Assessment.id,
      generation: v2Assessment.generation,
      contractVersion: v2Assessment.contractVersion,
      scopeHash: input.assessmentHash || v2Assessment.scopeHash,
    },
    location: {
      snapshotEvidenceHash: input.locationHash || v2Location.snapshotEvidenceHash,
      attemptId: v2LocationAttempt.id,
      attemptEvidenceHash: v2LocationAttempt.evidenceHash,
    },
    employee: { membershipId: input.membershipId || "member-1", assignmentGeneration: 1 },
    check: { type: "INITIAL", stage: "STARTING_CONDITION" },
    issues: input.issues || [],
    result,
    submission: { requestHash: "d".repeat(64), bodyHash: "e".repeat(64) },
    predecessor: null,
    createdAt: "2026-08-27T18:10:00.000Z",
  });
  return {
    id: "safety-v2",
    bookingId: parsed.evidence.workRecord.bookingId,
    vendorId: parsed.evidence.workRecord.vendorId,
    assessmentId: parsed.evidence.assessment.id,
    assessmentGeneration: parsed.evidence.assessment.generation,
    assessmentContractVersion: parsed.evidence.assessment.contractVersion,
    assessmentScopeHash: parsed.evidence.assessment.scopeHash,
    locationSnapshotEvidenceHash: parsed.evidence.location.snapshotEvidenceHash,
    locationAttemptId: parsed.evidence.location.attemptId,
    locationAttemptEvidenceHash: parsed.evidence.location.attemptEvidenceHash,
    membershipId: parsed.evidence.employee.membershipId,
    assignmentGeneration: parsed.evidence.employee.assignmentGeneration,
    safetyContractVersion: parsed.evidence.contractVersion,
    checkType: parsed.evidence.check.type,
    stage: parsed.evidence.check.stage,
    result: parsed.evidence.result,
    issueCodesJson: parsed.issueCodesJson,
    sequence: parsed.evidence.sequence,
    predecessorEvidenceId: null,
    predecessorEvidenceHash: null,
    submissionRequestHash: parsed.evidence.submission?.requestHash || null,
    submissionBodyHash: parsed.evidence.submission?.bodyHash || null,
    canonicalJson: parsed.canonicalJson,
    evidenceHash: parsed.evidenceHash,
    createdAt: parsed.evidence.createdAt,
  };
}

const authorityValidation = evaluatePermissionAuthority({
  assessment,
  claimedRole: "customer",
  authorityScope: "self_and_property",
  verificationMethod: "email_otp",
  verifiedContactHash: "verified-contact-hash",
});
const authorityEvidence = buildStoredAuthorityEvidence({ assessment, validation: authorityValidation });

const allowed = {
  id: "permission-1",
  status: "accepted",
  lifecycleStatus: "ALLOWED",
  verifiedDecision: true,
  isCurrent: true,
  scopeJson: JSON.stringify({ recordingLocation: "residence" }),
  scopeHash: "scope-hash-1",
  expiresAt: null,
  recipientMismatch: false,
  decisionEvidence: {
    id: "evidence-1",
    claimedRole: "customer",
    authorityScope: "self_and_property",
    verificationMethod: "email_otp",
    verifiedContactHash: "verified-contact-hash",
    scopeHash: "scope-hash-1",
    metadata: JSON.stringify({ authority: authorityEvidence }),
  },
};

function load(overrides: Record<string, unknown> = {}) {
  return loadCanonicalRecordingGate({
    bookingId: "booking-1",
    vendorId: "vendor-1",
    customerMetadata: metadata,
    membershipId: "member-1",
    surface: "media_session",
    capability: "record",
    actorKind: "EMPLOYEE",
    now: new Date("2026-08-27T18:10:30.000Z"),
    ...overrides,
  } as any);
}

describe("database-backed canonical recording gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.assessmentFindFirst.mockResolvedValue(assessment);
    db.consentFindFirst.mockResolvedValue(allowed);
    db.certificationFindFirst.mockResolvedValue({ id: "cert-1" });
    db.locationAttemptFindFirst.mockResolvedValue(v2LocationAttempt);
    db.locationExceptionFindFirst.mockResolvedValue(null);
    db.safetyFindMany.mockResolvedValue([]);
    db.bookingFindUnique.mockResolvedValue({ status: "IN_PROGRESS" });
    db.packageFindFirst.mockResolvedValue(null);
    db.managerDecisionFindFirst.mockResolvedValue(null);
    db.metricCreate.mockResolvedValue({ id: "metric-1" });
  });

  it("fails closed with an actionable assessment block", async () => {
    db.assessmentFindFirst.mockResolvedValue(null);
    const gate = await load();
    expect(gate.block).toEqual(expect.objectContaining({
      code: "RECORDING_ASSESSMENT_REQUIRED",
      responsibleParticipant: "VENDOR_MANAGER",
      serviceMayContinue: true,
    }));
    expect(gate.block?.why).toBeTruthy();
    expect(gate.block?.resolution).toBeTruthy();
  });

  it("keeps protected participants locked until authority is verified", async () => {
    db.assessmentFindFirst.mockResolvedValue({
      ...assessment,
      authorities: [{ authorityType: "VERIFIED_GUARDIAN", required: true, status: "PENDING" }],
    });
    const gate = await load();
    expect(gate.blockCode).toBe("PROTECTED_PARTICIPANT_AUTHORITY_REQUIRED");
    expect(gate.recordingUnlocked).toBe(false);
  });

  it("does not allow a residence recording without verified permission", async () => {
    db.consentFindFirst.mockResolvedValue(null);
    const gate = await load();
    expect(gate.block).toMatchObject({
      code: "VERIFIED_PERMISSION_REQUIRED",
      responsibleParticipant: "CUSTOMER",
    });
    expect(gate.recordingUnlocked).toBe(false);
  });

  it("treats a permission-decline cancellation as terminal with no participant action", async () => {
    db.bookingFindUnique.mockResolvedValue({ status: "CANCELED" });
    db.consentFindFirst.mockResolvedValue({
      ...allowed,
      status: "declined",
      lifecycleStatus: "DECLINED",
      verifiedDecision: true,
      decisionEvidence: { ...allowed.decisionEvidence, decision: "DECLINED" },
    });

    const gate = await load();

    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "SERVICE_ORDER_CANCELED",
      block: {
        responsibleParticipant: "NO_PARTICIPANT",
        serviceMayContinue: false,
      },
    });
    expect(gate.block?.why).toContain("declined Reliance recording permission");
    expect(gate.block?.resolution).toContain("permanently closed");
  });

  it("locks every recording stage while the exact package awaits Admin Audit", async () => {
    db.bookingFindUnique.mockResolvedValue({ status: "COMPLETED" });
    db.packageFindFirst.mockResolvedValue({
      id: "package-1",
      status: "AWAITING_ADMIN_REVIEW",
      managerDecisionId: "manager-decision-1",
    });
    const gate = await load({ recordingStage: "INTRO" });
    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "ADMIN_AUDIT_IN_PROGRESS",
      block: { responsibleParticipant: "ADMIN" },
    });
  });

  it("keeps Admin-rejected Service Video evidence terminal", async () => {
    db.bookingFindUnique.mockResolvedValue({ status: "REJECTED" });
    db.packageFindFirst.mockResolvedValue({
      id: "package-1",
      status: "ADMIN_REJECTED",
      adminAuditDecisionId: "admin-audit-1",
    });
    const gate = await load({ recordingStage: "COMPLETED" });
    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "ADMIN_AUDIT_REJECTED_TERMINAL",
      block: { responsibleParticipant: "NO_PARTICIPANT", serviceMayContinue: false },
    });
  });

  it("fails closed when an allowed decision lacks current authority evidence", async () => {
    db.consentFindFirst.mockResolvedValue({
      ...allowed,
      decisionEvidence: { ...allowed.decisionEvidence, metadata: "{}" },
    });
    const gate = await load();
    expect(gate).toMatchObject({
      blockCode: "PERMISSION_AUTHORITY_INVALID",
      recordingUnlocked: false,
      verifiedAllowed: false,
    });
  });

  it("fails closed when authority evidence belongs to a stale assessment generation", async () => {
    db.consentFindFirst.mockResolvedValue({
      ...allowed,
      decisionEvidence: {
        ...allowed.decisionEvidence,
        metadata: JSON.stringify({
          authority: { ...authorityEvidence, assessmentGeneration: 0 },
        }),
      },
    });
    const gate = await load();
    expect(gate).toMatchObject({
      blockCode: "PERMISSION_AUTHORITY_INVALID",
      recordingUnlocked: false,
    });
  });

  it("carries an authorized package-wide audio scope through the canonical gate", async () => {
    db.assessmentFindFirst.mockResolvedValue({
      ...assessment,
      audioRequested: true,
      audioAllowed: true,
    });
    const gate = await load();
    expect(gate).toMatchObject({
      blockCode: null,
      recordingUnlocked: true,
      audioAllowed: true,
    });
    expect(db.safetyFindMany).not.toHaveBeenCalled();
  });

  it("keeps the current V3 recording gate independent of Phase 2 safety evidence", async () => {
    db.assessmentFindFirst.mockResolvedValue({
      ...assessment,
      contractVersion: null,
      scopeJson: JSON.stringify({
        schemaVersion: "recording-assessment-v3-package-audio-v1",
        authorityHolderType: "customer",
      }),
    });

    const gate = await load({ recordingStage: "INTRO" });
    expect(gate).toMatchObject({ recordingUnlocked: true, blockCode: null });
    expect(gate).not.toHaveProperty("v2Safety");
    expect(db.safetyFindMany).not.toHaveBeenCalled();
  });

  it("requires a matching READY runtime-safety check for an explicit V2 stage", async () => {
    db.assessmentFindFirst.mockResolvedValue(v2Assessment);
    db.consentFindFirst.mockResolvedValue(null);

    const missing = await load({ customerMetadata: v2Location.metadata, recordingStage: "INTRO" });
    expect(missing).toMatchObject({
      recordingUnlocked: false,
      blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
      v2Safety: { required: true, ready: false, stage: "STARTING_CONDITION" },
    });

    db.safetyFindMany.mockResolvedValue([storedV2Safety({})]);
    const ready = await load({ customerMetadata: v2Location.metadata, recordingStage: "INTRO" });
    expect(ready).toMatchObject({
      recordingUnlocked: true,
      blockCode: null,
      v2Safety: { required: true, ready: true, result: "READY" },
    });
  });

  it("keeps V2 recording blocked after the latest runtime-safety issue", async () => {
    db.assessmentFindFirst.mockResolvedValue(v2Assessment);
    db.consentFindFirst.mockResolvedValue(null);
    db.safetyFindMany.mockResolvedValue([
      storedV2Safety({ result: "BLOCKED", issues: ["PRIVATE_DOCUMENT_OR_SCREEN"] }),
    ]);

    const gate = await load({ customerMetadata: v2Location.metadata, recordingStage: "INTRO" });
    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "V2_RUNTIME_SAFETY_BLOCKED",
      block: { responsibleParticipant: "EMPLOYEE" },
    });
  });

  it("fails V2 closed for material scope expansion and stale employee evidence", async () => {
    db.assessmentFindFirst.mockResolvedValue(v2Assessment);
    db.consentFindFirst.mockResolvedValue(null);
    db.safetyFindMany.mockResolvedValue([
      storedV2Safety({
        result: "MATERIAL_SCOPE_CHANGE_REQUIRED",
        issues: ["APPROVED_AUDIO_SCOPE_MISMATCH", "MATERIAL_SCOPE_EXPANSION_REQUIRED"],
      }),
    ]);
    const material = await load({ customerMetadata: v2Location.metadata, recordingStage: "INTRO" });
    expect(material).toMatchObject({
      recordingUnlocked: false,
      blockCode: "V2_RUNTIME_SAFETY_MATERIAL_SCOPE_CHANGE_REQUIRED",
      block: { responsibleParticipant: "VENDOR_MANAGER" },
    });

    db.safetyFindMany.mockResolvedValue([storedV2Safety({ membershipId: "member-other" })]);
    const stale = await load({ customerMetadata: v2Location.metadata, recordingStage: "INTRO" });
    expect(stale).toMatchObject({
      recordingUnlocked: false,
      blockCode: "V2_RUNTIME_SAFETY_BINDING_STALE",
    });
  });

  it("fails V2 closed when canonical audio fields do not match the approved format", async () => {
    db.assessmentFindFirst.mockResolvedValue({ ...v2Assessment, audioAllowed: true });
    db.consentFindFirst.mockResolvedValue(null);
    db.safetyFindMany.mockResolvedValue([storedV2Safety({})]);

    const gate = await load({ customerMetadata: v2Location.metadata, recordingStage: "INTRO" });
    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "V2_RECORDING_AUDIO_SCOPE_INVALID",
    });
  });

  it("fails closed for an unknown explicit assessment contract", async () => {
    db.assessmentFindFirst.mockResolvedValue({
      ...assessment,
      contractVersion: "recording-assessment-unknown-v99",
    });

    const gate = await load({ recordingStage: "INTRO" });
    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "RECORDING_ASSESSMENT_CONTRACT_INVALID",
    });
    expect(db.safetyFindMany).not.toHaveBeenCalled();
  });

  it("requires employee certification for the current assignment and scope", async () => {
    db.certificationFindFirst.mockResolvedValue(null);
    const gate = await load();
    expect(gate.blockCode).toBe("EMPLOYEE_CERTIFICATION_REQUIRED");
    expect(gate.releaseAllowed).toBe(true);
    expect(gate.recordingUnlocked).toBe(false);
  });

  it("stays locked when the selected location has no immutable snapshot", async () => {
    const gate = await load({
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["member-1"],
        vendor_job_service_order_released_membership_ids: ["member-1"],
        vendor_job_service_order_released_at: "2026-08-04T12:00:00.000Z",
        vendor_job_assignment_generation: 1,
        vendor_job_recording_location: "residence",
      }),
    });
    expect(gate).toMatchObject({
      blockCode: "RECORDING_LOCATION_SNAPSHOT_MISSING",
      recordingUnlocked: false,
      releaseAllowed: false,
    });
    expect(gate.block).toMatchObject({ responsibleParticipant: "VENDOR_MANAGER" });
  });

  it("stays locked despite a verified attempt when the snapshot source is wrong", async () => {
    const invalidMetadata = JSON.parse(metadata);
    invalidMetadata.vendor_job_recording_location_snapshot.source = "vendor_profile";
    const gate = await load({ customerMetadata: JSON.stringify(invalidMetadata) });
    expect(db.locationAttemptFindFirst).toHaveBeenCalled();
    expect(gate).toMatchObject({
      locationAttemptStatus: "VERIFIED",
      blockCode: "RECORDING_LOCATION_SNAPSHOT_SOURCE_MISMATCH",
      recordingUnlocked: false,
    });
  });

  it("records the latest failed location attempt and stays locked", async () => {
    db.locationAttemptFindFirst.mockResolvedValue({ status: "FAILED", resultCode: "OUTSIDE_RADIUS" });
    const gate = await load();
    expect(gate).toMatchObject({
      locationVerified: false,
      locationAttemptStatus: "FAILED",
      locationAttemptResultCode: "OUTSIDE_RADIUS",
      blockCode: "LOCATION_VERIFICATION_REQUIRED",
      recordingUnlocked: false,
    });
  });

  it("keeps a pending exception locked under admin responsibility", async () => {
    db.locationAttemptFindFirst.mockResolvedValue({ status: "FAILED", resultCode: "POOR_ACCURACY" });
    db.locationExceptionFindFirst.mockResolvedValue({ status: "PENDING" });
    const gate = await load();
    expect(gate.block).toMatchObject({
      code: "LOCATION_EXCEPTION_PENDING",
      responsibleParticipant: "ADMIN",
    });
    expect(gate.recordingUnlocked).toBe(false);
  });

  it("unlocks only after every canonical gate passes or an admin approves the exception", async () => {
    db.locationAttemptFindFirst.mockResolvedValue({ status: "FAILED", resultCode: "POOR_ACCURACY" });
    db.locationExceptionFindFirst.mockResolvedValue({ status: "APPROVED" });
    const gate = await load();
    expect(gate).toMatchObject({
      recordingUnlocked: true,
      locationVerified: true,
      locationExceptionStatus: "APPROVED",
      block: null,
    });
  });

  it("locks every stage while the completed package awaits manager review", async () => {
    db.bookingFindUnique.mockResolvedValue({ status: "AWAITING_REVIEW" });

    for (const recordingStage of ["INTRO", "IN_PROGRESS", "COMPLETED"] as const) {
      const gate = await load({ recordingStage });
      expect(gate).toMatchObject({
        recordingUnlocked: false,
        releaseAllowed: false,
        workRecordStatus: "AWAITING_REVIEW",
        blockCode: "MANAGER_REVIEW_IN_PROGRESS",
        block: {
          why: "The completed Service Videos were submitted for manager review.",
          responsibleParticipant: "VENDOR_MANAGER",
          resolution: "Wait for manager review.",
        },
      });
    }
  });

  it("locks during the package submission transition even before the booking status update", async () => {
    db.packageFindFirst.mockResolvedValue({
      id: "package-1",
      status: "AWAITING_MANAGER_REVIEW",
      managerDecisionId: null,
    });

    const gate = await load({ recordingStage: "INTRO" });
    expect(gate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
    });
  });

  it("reopens only the exact stage named in an active manager correction request", async () => {
    db.bookingFindUnique.mockResolvedValue({ status: "REJECTED" });
    db.packageFindFirst.mockResolvedValue({
      id: "package-1",
      status: "CORRECTION_REQUESTED",
      managerDecisionId: "decision-1",
    });
    db.managerDecisionFindFirst.mockResolvedValue({
      targetedStagesJson: JSON.stringify(["COMPLETED"]),
    });

    const target = await load({ recordingStage: "COMPLETED" });
    const untouched = await load({ recordingStage: "INTRO" });
    const unspecified = await load();

    expect(target).toMatchObject({
      recordingUnlocked: true,
      correctionRequestedStages: ["COMPLETED"],
      block: null,
    });
    expect(untouched).toMatchObject({
      recordingUnlocked: false,
      blockCode: "STAGE_CORRECTION_NOT_REQUESTED",
    });
    expect(unspecified).toMatchObject({
      recordingUnlocked: false,
      blockCode: "STAGE_CORRECTION_SELECTION_REQUIRED",
    });
  });

  it("writes only stable internal diagnostic fields for a blocked gate", async () => {
    db.certificationFindFirst.mockResolvedValue(null);
    await load();
    expect(db.metricCreate).toHaveBeenCalledWith({
      data: {
        bookingId: "booking-1",
        vendorId: "vendor-1",
        surface: "media_session",
        blockReason: "EMPLOYEE_CERTIFICATION_REQUIRED",
        responsibleParticipant: "EMPLOYEE",
        actorKind: "EMPLOYEE",
      },
    });
  });
});
