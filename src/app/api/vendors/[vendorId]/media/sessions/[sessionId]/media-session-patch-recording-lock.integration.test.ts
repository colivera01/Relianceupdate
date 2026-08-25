import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => {
  const requireVendorMembership = vi.fn();
  const mediaSessionFindFirst = vi.fn();
  const mediaSessionUpdate = vi.fn();
  const bookingFindFirst = vi.fn();
  const loadRecordingPermissionGate = vi.fn();
  const assertServiceVideoStageMutationAllowed = vi.fn();
  const corePackageFindFirst = vi.fn();
  const transaction = vi.fn();
  const prisma = {
    mediaSession: { findFirst: mediaSessionFindFirst, update: mediaSessionUpdate },
    booking: { findFirst: bookingFindFirst },
    serviceVideoPackageEvidence: { findFirst: corePackageFindFirst },
    $transaction: transaction,
  };
  return {
    requireVendorMembership,
    mediaSessionFindFirst,
    mediaSessionUpdate,
    bookingFindFirst,
    loadRecordingPermissionGate,
    assertServiceVideoStageMutationAllowed,
    corePackageFindFirst,
    transaction,
    prisma,
  };
});

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/membership-auth", () => ({ requireVendorMembership: mocks.requireVendorMembership }));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: (gate: any) => ({ code: gate.blockCode, blocked: gate.block }),
}));
vi.mock("@/lib/service-video-evidence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-video-evidence")>("@/lib/service-video-evidence");
  return { ...actual, assertServiceVideoStageMutationAllowed: mocks.assertServiceVideoStageMutationAllowed };
});

describe("employee media-session PATCH manager-review lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireVendorMembership.mockResolvedValue({
      userId: "employee-1",
      membershipId: "membership-1",
      role: "EMPLOYEE",
    });
    mocks.mediaSessionFindFirst.mockResolvedValue({
      id: "session-1",
      bookingId: "booking-1",
      sessionType: "JOB_SERVICE_VIDEO",
      vendorJobVideoStage: "INTRO",
      capturedByMembershipId: "membership-1",
    });
    mocks.bookingFindFirst.mockResolvedValue({ id: "booking-1", customerMetadata: "{}" });
    mocks.transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(mocks.prisma));
    mocks.assertServiceVideoStageMutationAllowed.mockResolvedValue(undefined);
    mocks.corePackageFindFirst.mockResolvedValue(null);
    mocks.mediaSessionUpdate.mockResolvedValue({ id: "session-1", status: "UPLOADING", mediaAssets: [] });
  });

  it("rejects PATCH during manager review before a session mutation", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      block: { responsibleParticipant: "VENDOR_MANAGER", resolution: "Wait for manager review." },
    });
    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/media/sessions/session-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UPLOADING" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", sessionId: "session-1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.mediaSessionUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates only after the exact stage passes both canonical and transaction-time checks", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({ blockCode: null, recordingUnlocked: true });
    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/media/sessions/session-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UPLOADING" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", sessionId: "session-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.loadRecordingPermissionGate).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "booking-1", recordingStage: "INTRO" }),
    );
    expect(mocks.assertServiceVideoStageMutationAllowed).toHaveBeenCalledWith(
      mocks.prisma,
      { bookingId: "booking-1", vendorId: "vendor-1", stage: "INTRO" },
    );
    expect(mocks.mediaSessionUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects a manager session PATCH after Admin PASS before durable mutation", async () => {
    mocks.requireVendorMembership.mockResolvedValue({ userId: "manager-1", membershipId: "manager-membership-1", role: "MANAGER" });
    mocks.corePackageFindFirst.mockResolvedValue({ id: "package-1", status: "PRIVATE_APPROVED", adminAuditDecisionId: "audit-1" });
    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/media/sessions/session-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", sessionId: "session-1" }) },
    );
    expect(response.status).toBe(409);
    expect(mocks.mediaSessionUpdate).not.toHaveBeenCalled();
  });
});
