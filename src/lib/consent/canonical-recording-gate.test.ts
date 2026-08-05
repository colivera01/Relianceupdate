import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  assessmentFindFirst: vi.fn(),
  consentFindFirst: vi.fn(),
  certificationFindFirst: vi.fn(),
  locationAttemptFindFirst: vi.fn(),
  locationExceptionFindFirst: vi.fn(),
  metricCreate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    recordingScopeAssessment: { findFirst: db.assessmentFindFirst },
    consentRecord: { findFirst: db.consentFindFirst },
    employeeRecordingCertification: { findFirst: db.certificationFindFirst },
    recordingLocationAttempt: { findFirst: db.locationAttemptFindFirst },
    recordingLocationException: { findFirst: db.locationExceptionFindFirst },
    recordingGateMetric: { create: db.metricCreate },
  },
}));

import { loadCanonicalRecordingGate } from "./recording-gate";

const metadata = JSON.stringify({
  vendor_job_assigned_membership_ids: ["member-1"],
  vendor_job_service_order_released_membership_ids: ["member-1"],
  vendor_job_service_order_released_at: "2026-08-04T12:00:00.000Z",
  vendor_job_assignment_generation: 1,
});

const assessment = {
  id: "assessment-1",
  vendorId: "vendor-1",
  status: "COMPLETE",
  locationType: "residence",
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
  permissionRequired: true,
  serviceCanContinueWithoutRecording: true,
  audioRequested: false,
  audioAllowed: false,
  authorities: [
    { authorityType: "VENDOR_MANAGER", required: true, status: "VERIFIED" },
    { authorityType: "CUSTOMER_OR_REPRESENTATIVE", required: true, status: "VERIFIED" },
  ],
};

const allowed = {
  id: "permission-1",
  status: "accepted",
  lifecycleStatus: "ALLOWED",
  verifiedDecision: true,
  isCurrent: true,
  scopeJson: JSON.stringify({ recordingLocation: "residence" }),
  expiresAt: null,
  recipientMismatch: false,
  decisionEvidence: { id: "evidence-1" },
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

  it("requires employee certification for the current assignment and scope", async () => {
    db.certificationFindFirst.mockResolvedValue(null);
    const gate = await load();
    expect(gate.blockCode).toBe("EMPLOYEE_CERTIFICATION_REQUIRED");
    expect(gate.releaseAllowed).toBe(true);
    expect(gate.recordingUnlocked).toBe(false);
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
