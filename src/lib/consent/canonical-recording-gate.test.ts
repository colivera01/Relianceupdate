import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  assessmentFindFirst: vi.fn(),
  consentFindFirst: vi.fn(),
  certificationFindFirst: vi.fn(),
  locationAttemptFindFirst: vi.fn(),
  locationExceptionFindFirst: vi.fn(),
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
    booking: { findUnique: db.bookingFindUnique },
    serviceVideoPackageEvidence: { findFirst: db.packageFindFirst },
    serviceVideoManagerDecisionEvidence: { findFirst: db.managerDecisionFindFirst },
    recordingGateMetric: { create: db.metricCreate },
  },
}));

import { loadCanonicalRecordingGate } from "./recording-gate";
import { buildStoredAuthorityEvidence, evaluatePermissionAuthority } from "./authority-validation";

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
    ...overrides,
  } as any);
}

describe("database-backed canonical recording gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.assessmentFindFirst.mockResolvedValue(assessment);
    db.consentFindFirst.mockResolvedValue(allowed);
    db.certificationFindFirst.mockResolvedValue({ id: "cert-1" });
    db.locationAttemptFindFirst.mockResolvedValue({ status: "VERIFIED", resultCode: "WITHIN_RADIUS" });
    db.locationExceptionFindFirst.mockResolvedValue(null);
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
