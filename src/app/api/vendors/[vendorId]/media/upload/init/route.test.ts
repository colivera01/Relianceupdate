import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  mediaSessionFindFirst: vi.fn(),
  resolveEmployeeCaptureAccess: vi.fn(),
  requireVendorMembership: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  calculateStorageUsage: vi.fn(),
  checkAndCreateStorageAlerts: vi.fn(),
  generateUploadUrl: vi.fn(),
  createUploadAttempt: vi.fn(),
  setUploadAttemptState: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findFirst: mocks.bookingFindFirst },
    mediaSession: { findFirst: mocks.mediaSessionFindFirst },
  },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: mocks.requireVendorMembership,
}));

vi.mock("@/lib/employee-capture-token", () => ({
  resolveEmployeeCaptureAccess: mocks.resolveEmployeeCaptureAccess,
}));

vi.mock("@/lib/storage-helpers", () => ({
  calculateStorageUsage: mocks.calculateStorageUsage,
  checkAndCreateStorageAlerts: mocks.checkAndCreateStorageAlerts,
}));

vi.mock("@/lib/azure-blob-storage", () => ({
  generateUploadUrl: mocks.generateUploadUrl,
}));

vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: vi.fn((gate) => ({
    error: gate.blockMessage,
    code: gate.blockCode,
    blocked: gate.block,
  })),
}));

vi.mock("@/lib/service-video-evidence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-video-evidence")>(
    "@/lib/service-video-evidence",
  );
  return {
    ...actual,
    createUploadAttempt: mocks.createUploadAttempt,
    setUploadAttemptState: mocks.setUploadAttemptState,
  };
});

describe("media upload initialization recording lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveEmployeeCaptureAccess.mockResolvedValue({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });
    mocks.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      customerMetadata: "{}",
    });
    mocks.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      vendorJobVideoStage: "INTRO",
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

  it("rejects a staged upload before storage or upload evidence is created", async () => {
    const response = await POST(
      new Request("http://localhost/api/vendors/vendor-1/media/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "starting-condition.webm",
          expectedBytes: 1024,
          mimeType: "video/webm",
          bookingId: "booking-1",
          mediaSessionId: "session-1",
        }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(mocks.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({ recordingStage: "INTRO" }),
    );
    expect(mocks.calculateStorageUsage).not.toHaveBeenCalled();
    expect(mocks.createUploadAttempt).not.toHaveBeenCalled();
    expect(mocks.generateUploadUrl).not.toHaveBeenCalled();
  });
});
