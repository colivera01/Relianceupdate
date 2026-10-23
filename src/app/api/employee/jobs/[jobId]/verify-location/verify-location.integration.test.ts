import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  verifyJobRecordingLocation: vi.fn(),
  recordJobRecordingLocationAttempt: vi.fn(),
  persistV2StageLocationAttempt: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { booking: { findUnique: mocks.bookingFindUnique } },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: mocks.resolveEmployeeCaptureAccess,
}));

vi.mock("@/lib/job-assignment", () => ({
  parseAssignmentMetadata: vi.fn(() => ({ assignedMembershipIds: ["membership-1"] })),
  parseRecordingComplianceMetadata: vi.fn(() => ({ releasedMembershipIds: ["membership-1"] })),
  validateRecordingLocationSnapshot: vi.fn(() => ({
    ok: true,
    snapshot: { snapshotEvidenceHash: "a".repeat(64) },
  })),
}));

vi.mock("@/lib/job-recording-location", () => ({
  parseRecordingLocationProof: vi.fn(() => ({
    latitude: 28.7,
    longitude: -81.3,
    accuracyMeters: 20,
    capturedAt: null,
  })),
  verifyJobRecordingLocation: mocks.verifyJobRecordingLocation,
  recordJobRecordingLocationAttempt: mocks.recordJobRecordingLocationAttempt,
}));

vi.mock("@/lib/recording/v2-safety-location", () => ({
  persistV2StageLocationAttempt: mocks.persistV2StageLocationAttempt,
  SERVICE_ORDER_LOCATION_EVIDENCE_VERSION:
    "recording-location-attempt-service-order-safety-v2",
}));

vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: vi.fn((gate) => ({ error: gate.blockMessage, code: gate.blockCode, blocked: gate.block })),
}));

describe("employee recording location verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue({
      membershipId: "membership-1",
      vendorId: "vendor-1",
      bookingId: "booking-1",
      userId: "employee-1",
    });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: "{}",
      vendor: {},
    });
    mocks.verifyJobRecordingLocation.mockResolvedValue({
      ok: true,
      location: "residence",
      distanceMeters: 12,
    });
    mocks.recordJobRecordingLocationAttempt.mockResolvedValue({ id: "attempt-1" });
    mocks.persistV2StageLocationAttempt.mockResolvedValue({ id: "attempt-v2-1" });
    mocks.loadRecordingPermissionGate
      .mockResolvedValueOnce({
        assessmentId: "assessment-1",
        assessmentGeneration: 2,
        assessmentContractVersion: "recording-assessment-v4-multiscope-safety-v1",
        assignmentGeneration: 4,
        serviceOrderSafetyRequired: true,
        location: "residence",
        blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
        block: {
          why: "A current matching employee runtime-safety check is required.",
          responsibleParticipant: "EMPLOYEE",
          resolution: "Complete a fresh safety and location check for this stage.",
        },
      })
      .mockResolvedValueOnce({
        assessmentId: "assessment-1",
        blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
        block: { resolution: "Complete a fresh safety and location check for this stage." },
        recordingUnlocked: false,
      });
  });

  it("uses the shared Service Order location evidence for a simplified assessment", async () => {
    mocks.loadRecordingPermissionGate.mockReset();
    mocks.loadRecordingPermissionGate
      .mockResolvedValueOnce({
        assessmentId: "assessment-simplified-1",
        assessmentGeneration: 1,
        assessmentContractVersion:
          "recording-assessment-v3-simplified-work-scope-v2",
        assignmentGeneration: 4,
        serviceOrderSafetyRequired: true,
        location: "residence",
        blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
        block: { resolution: "Complete one safety and location check." },
      })
      .mockResolvedValueOnce({
        assessmentId: "assessment-simplified-1",
        blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
        recordingUnlocked: false,
      });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/booking-1/verify-location", {
        method: "POST",
        body: JSON.stringify({ recordingStage: "INTRO" }),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.persistV2StageLocationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: "assessment-simplified-1",
        stage: "SERVICE_ORDER",
        evidenceVersion: "recording-location-attempt-service-order-safety-v2",
      }),
    );
    expect(mocks.recordJobRecordingLocationAttempt).not.toHaveBeenCalled();
  });

  it("persists successful evidence and returns the re-evaluated canonical gate", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/booking-1/verify-location", {
        method: "POST",
        body: JSON.stringify({
          latitude: 28.7,
          longitude: -81.3,
          accuracyMeters: 20,
          recordingStage: "INTRO",
        }),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.persistV2StageLocationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        assessmentId: "assessment-1",
        assessmentGeneration: 2,
        assignmentGeneration: 4,
        membershipId: "membership-1",
        actorUserId: "employee-1",
        stage: "SERVICE_ORDER",
        snapshotEvidenceHash: "a".repeat(64),
      }),
    );
    expect(mocks.recordJobRecordingLocationAttempt).not.toHaveBeenCalled();
    expect(json.locationAttemptId).toBe("attempt-v2-1");
    expect(json.recordingGate).toMatchObject({
      recordingUnlocked: false,
      blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
    });
    expect(mocks.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({ recordingStage: "INTRO" }),
    );
  });

  it("does not create new location evidence after submission to manager review", async () => {
    mocks.loadRecordingPermissionGate.mockReset();
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      assessmentId: "assessment-1",
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      blockMessage: "The completed Service Videos were submitted for manager review.",
      block: {
        why: "The completed Service Videos were submitted for manager review.",
        responsibleParticipant: "VENDOR_MANAGER",
        resolution: "Wait for manager review.",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/booking-1/verify-location", {
        method: "POST",
        body: JSON.stringify({
          latitude: 28.7,
          longitude: -81.3,
          accuracyMeters: 20,
          recordingStage: "INTRO",
        }),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(mocks.verifyJobRecordingLocation).not.toHaveBeenCalled();
    expect(mocks.recordJobRecordingLocationAttempt).not.toHaveBeenCalled();
    expect(mocks.persistV2StageLocationAttempt).not.toHaveBeenCalled();
  });

  it("rejects a missing or unsupported stage before creating location evidence", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/booking-1/verify-location", {
        method: "POST",
        body: JSON.stringify({ latitude: 28.7, longitude: -81.3, accuracyMeters: 20 }),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );

    expect(response.status).toBe(422);
    expect(mocks.bookingFindUnique).not.toHaveBeenCalled();
    expect(mocks.persistV2StageLocationAttempt).not.toHaveBeenCalled();
  });
});
