import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  assertV2EmployeeServiceOrderEntry: vi.fn(),
  requireVendorMembership: vi.fn(),
  parseAssignmentMetadata: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  appendEmployeeRecordingSafetyEvidence: vi.fn(),
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

vi.mock("@/lib/recording/employee-safety-service", () => ({
  EmployeeRecordingSafetyServiceError: class EmployeeRecordingSafetyServiceError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  },
  appendEmployeeRecordingSafetyEvidence: mocks.appendEmployeeRecordingSafetyEvidence,
}));

vi.mock("@/lib/recording/v2-safety-location", () => ({
  V2SafetyLocationError: class V2SafetyLocationError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  },
}));

import { EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS } from "@/lib/recording/employee-stage-safety-contract";

function acknowledgments() {
  return Object.fromEntries(
    EMPLOYEE_STAGE_SAFETY_ACKNOWLEDGMENTS.map((item) => [item.id, true]),
  );
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/employee/jobs/booking-1/safety-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("employee V2 stage safety-check route", () => {
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
    mocks.parseAssignmentMetadata.mockReturnValue({
      assignedMembershipIds: ["membership-1"],
    });
    mocks.loadRecordingPermissionGate
      .mockResolvedValueOnce({
        blockCode: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
        block: { resolution: "Complete this stage check." },
      })
      .mockResolvedValueOnce({
        recordingUnlocked: true,
        blockCode: null,
        block: null,
      });
    mocks.appendEmployeeRecordingSafetyEvidence.mockResolvedValue({
      id: "safety-1",
      result: "READY",
      stage: "SERVICE_ORDER",
    });
  });

  it("binds one READY check to the exact current Employee and Service Order, then re-evaluates the gate", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({
        recordingStage: "INTRO",
        locationAttemptId: "location-attempt-1",
        requestId: "safety-request-id-0001",
        acknowledgments: acknowledgments(),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.assertV2EmployeeServiceOrderEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        vendorId: "vendor-1",
        tokenAccess: expect.objectContaining({ membershipId: "membership-1" }),
      }),
    );
    expect(mocks.appendEmployeeRecordingSafetyEvidence).toHaveBeenCalledWith({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      locationAttemptId: "location-attempt-1",
      requestId: "safety-request-id-0001",
      checkType: "INITIAL",
      stage: "SERVICE_ORDER",
      result: "READY",
      issues: [],
    });
    expect(mocks.loadRecordingPermissionGate).toHaveBeenLastCalledWith(
      expect.objectContaining({ recordingStage: "INTRO", membershipId: "membership-1" }),
    );
    expect(body).toMatchObject({
      success: true,
      evidence: { id: "safety-1", result: "READY", stage: "SERVICE_ORDER" },
      recordingGate: { recordingUnlocked: true },
    });
  });

  it("requires every displayed acknowledgment before reading or writing Work Record state", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request({
        recordingStage: "INTRO",
        locationAttemptId: "location-attempt-1",
        requestId: "safety-request-id-0001",
        acknowledgments: { approved_people_only: true },
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );

    expect(response.status).toBe(422);
    expect(mocks.bookingFindUnique).not.toHaveBeenCalled();
    expect(mocks.appendEmployeeRecordingSafetyEvidence).not.toHaveBeenCalled();
  });

  it("fails closed when another current gate requirement supersedes the safety step", async () => {
    mocks.loadRecordingPermissionGate.mockReset();
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: "EMPLOYEE_ASSIGNMENT_REQUIRED",
      blockMessage: "The assignment changed.",
      block: { resolution: "Open the current Service Order." },
    });
    const { POST } = await import("./route");
    const response = await POST(
      request({
        recordingStage: "INTRO",
        locationAttemptId: "location-attempt-1",
        requestId: "safety-request-id-0001",
        acknowledgments: acknowledgments(),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.appendEmployeeRecordingSafetyEvidence).not.toHaveBeenCalled();
  });

  it("does not let a different or reassigned Employee submit the check", async () => {
    mocks.parseAssignmentMetadata.mockReturnValue({
      assignedMembershipIds: ["membership-2"],
    });
    const { POST } = await import("./route");
    const response = await POST(
      request({
        recordingStage: "IN_PROGRESS",
        locationAttemptId: "location-attempt-1",
        requestId: "safety-request-id-0001",
        acknowledgments: acknowledgments(),
      }),
      { params: Promise.resolve({ jobId: "booking-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.loadRecordingPermissionGate).not.toHaveBeenCalled();
    expect(mocks.appendEmployeeRecordingSafetyEvidence).not.toHaveBeenCalled();
  });
});
