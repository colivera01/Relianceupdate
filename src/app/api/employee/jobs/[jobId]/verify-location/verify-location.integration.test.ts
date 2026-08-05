import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  verifyJobRecordingLocation: vi.fn(),
  recordJobRecordingLocationAttempt: vi.fn(),
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
    mocks.loadRecordingPermissionGate
      .mockResolvedValueOnce({
        assessmentId: "assessment-1",
        blockCode: "LOCATION_VERIFICATION_REQUIRED",
        block: {
          why: "The employee device has not verified the saved service location.",
          responsibleParticipant: "EMPLOYEE",
          resolution: "Allow precise location and verify the saved service address.",
        },
      })
      .mockResolvedValueOnce({
        assessmentId: "assessment-1",
        blockCode: null,
        block: null,
        recordingUnlocked: true,
      });
  });

  it("persists successful evidence and returns the re-evaluated canonical gate", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/booking-1/verify-location", {
        method: "POST",
        body: JSON.stringify({ latitude: 28.7, longitude: -81.3, accuracyMeters: 20 }),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.recordJobRecordingLocationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        assessmentId: "assessment-1",
        membershipId: "membership-1",
        actorUserId: "employee-1",
      }),
    );
    expect(json.recordingGate).toMatchObject({ recordingUnlocked: true, blockCode: null });
  });
});
