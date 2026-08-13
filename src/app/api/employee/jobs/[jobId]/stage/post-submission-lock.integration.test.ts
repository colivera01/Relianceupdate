import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  mediaSessionFindFirst: vi.fn(),
  mediaSessionFindMany: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  recordLifecycleAudit: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: {
      findUnique: mocks.bookingFindUnique,
      update: mocks.bookingUpdate,
    },
    vendorMembership: { findMany: vi.fn() },
    mediaSession: {
      findFirst: mocks.mediaSessionFindFirst,
      findMany: mocks.mediaSessionFindMany,
    },
  },
}));

vi.mock("@/lib/auth", () => ({ getUserIdFromRequest: vi.fn(async () => null) }));
vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: mocks.resolveEmployeeCaptureAccess,
}));
vi.mock("@/lib/job-assignment", () => ({
  parseAssignmentMetadata: vi.fn(() => ({ assignedMembershipIds: ["membership-1"] })),
  setStageProgressMetadata: vi.fn(() => "{}"),
}));
vi.mock("@/lib/account-status", () => ({
  ensureUserAccountCanAct: vi.fn(),
  ensureVendorAccountCanOperate: vi.fn(),
  accountStatusErrorBody: vi.fn(),
  AccountStatusError: class AccountStatusError extends Error {},
}));
vi.mock("@/lib/employee-runtime-errors", () => ({
  getEmployeeRuntimeErrorResponse: vi.fn(() => ({ status: 500, body: { error: "unexpected" } })),
}));
vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: mocks.recordLifecycleAudit,
}));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: vi.fn((gate) => ({
    error: gate.blockMessage,
    code: gate.blockCode,
    blocked: gate.block,
  })),
}));

describe("employee stage save after package submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "job-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "AWAITING_REVIEW",
      customerMetadata: "{}",
    });
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      recordingUnlocked: false,
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      blockMessage: "The completed Service Videos were submitted for manager review.",
      block: {
        why: "The completed Service Videos were submitted for manager review.",
        responsibleParticipant: "VENDOR_MANAGER",
        resolution: "Wait for manager review.",
      },
    });
  });

  it("rejects a direct save without reading media or updating progress", async () => {
    const response = await POST(
      new Request("http://localhost/api/employee/jobs/job-1/stage?ct=signed-token", {
        method: "POST",
        body: JSON.stringify({ stage: "INTRO" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(mocks.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({ recordingStage: "INTRO" }),
    );
    expect(mocks.mediaSessionFindFirst).not.toHaveBeenCalled();
    expect(mocks.mediaSessionFindMany).not.toHaveBeenCalled();
    expect(mocks.bookingUpdate).not.toHaveBeenCalled();
    expect(mocks.recordLifecycleAudit).not.toHaveBeenCalled();
  });
});
