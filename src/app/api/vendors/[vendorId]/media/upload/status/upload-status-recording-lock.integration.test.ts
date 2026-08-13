import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireVendorMembership: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  attemptFindFirst: vi.fn(),
  bookingFindFirst: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  setUploadAttemptState: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    mediaUploadAttempt: { findFirst: mocks.attemptFindFirst },
    booking: { findFirst: mocks.bookingFindFirst },
  },
}));
vi.mock("@/lib/membership-auth", () => ({ requireVendorMembership: mocks.requireVendorMembership }));
vi.mock("@/lib/employee-capture-token", () => ({ resolveEmployeeCaptureAccess: mocks.resolveEmployeeCaptureAccess }));
vi.mock("@/lib/service-video-evidence", () => ({ setUploadAttemptState: mocks.setUploadAttemptState }));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: (gate: any) => ({ code: gate.blockCode, blocked: gate.block }),
}));

describe("employee upload-status recording lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
      role: "EMPLOYEE",
    });
    mocks.attemptFindFirst.mockResolvedValue({ assetId: "asset-1", stage: "INTRO" });
    mocks.bookingFindFirst.mockResolvedValue({ id: "booking-1", customerMetadata: "{}" });
  });

  it("rejects status mutation during manager review", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      block: { responsibleParticipant: "VENDOR_MANAGER", resolution: "Wait for manager review." },
    });

    const response = await POST(
      new Request("http://localhost/api/vendors/vendor-1/media/upload/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: "asset-1", bookingId: "booking-1", uploadState: "RETRY_REQUIRED" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(mocks.setUploadAttemptState).not.toHaveBeenCalled();
  });
});
