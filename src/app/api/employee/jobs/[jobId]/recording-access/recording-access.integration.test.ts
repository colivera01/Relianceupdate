import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  assertV2EmployeeServiceOrderEntry: vi.fn(),
  requireVendorMembership: vi.fn(),
  parseAssignmentMetadata: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { booking: { findUnique: mocks.bookingFindUnique } },
}));
vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: mocks.resolveEmployeeCaptureAccess,
}));
vi.mock("@/lib/recording/employee-v2-service-order-entry", () => ({
  assertV2EmployeeServiceOrderEntry: mocks.assertV2EmployeeServiceOrderEntry,
}));
vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: mocks.requireVendorMembership,
}));
vi.mock("@/lib/job-assignment", () => ({
  parseAssignmentMetadata: mocks.parseAssignmentMetadata,
}));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: vi.fn((gate) => ({
    success: false,
    code: gate.blockCode,
    error: gate.blockMessage,
    blocked: gate.block,
  })),
}));

function request(stage = "INTRO") {
  return new Request("http://localhost/api/employee/jobs/booking-1/recording-access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recordingStage: stage }),
  });
}

describe("employee stage recording-access preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      vendorId: "vendor-1",
      customerMetadata: "{}",
    });
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue({
      membershipId: "membership-1",
      vendorId: "vendor-1",
      bookingId: "booking-1",
      userId: "employee-1",
    });
    mocks.parseAssignmentMetadata.mockReturnValue({ assignedMembershipIds: ["membership-1"] });
  });

  it("revalidates the exact current stage before camera access", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      recordingUnlocked: true,
      blockCode: null,
      block: null,
    });
    const { POST } = await import("./route");
    const response = await POST(request("COMPLETED"), {
      params: Promise.resolve({ jobId: "booking-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        membershipId: "membership-1",
        recordingStage: "COMPLETED",
        capability: "record",
      }),
    );
  });

  it("blocks a stale safety/location context before the camera opens", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      recordingUnlocked: false,
      blockCode: "V2_RUNTIME_SAFETY_LOCATION_BINDING_STALE",
      blockMessage: "A fresh check is required.",
      block: { resolution: "Complete a fresh safety and location check." },
    });
    const { POST } = await import("./route");
    const response = await POST(request(), {
      params: Promise.resolve({ jobId: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("V2_RUNTIME_SAFETY_LOCATION_BINDING_STALE");
  });

  it("rejects a reassigned Employee before evaluating recording permission", async () => {
    mocks.parseAssignmentMetadata.mockReturnValue({ assignedMembershipIds: ["membership-2"] });
    const { POST } = await import("./route");
    const response = await POST(request(), {
      params: Promise.resolve({ jobId: "booking-1" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.loadRecordingPermissionGate).not.toHaveBeenCalled();
  });
});
