import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  requireVendorMembership: vi.fn(),
  mediaAssetFindUnique: vi.fn(),
  mediaAssetUpdate: vi.fn(),
  mediaDeletionRequestFindFirst: vi.fn(),
  bookingFindFirst: vi.fn(),
  loadRecordingPermissionGate: vi.fn(),
  assertServiceVideoStageMutationAllowed: vi.fn(),
  transaction: vi.fn(),
  corePackageFindFirst: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    mediaAsset: { findUnique: mocks.mediaAssetFindUnique, update: mocks.mediaAssetUpdate },
    mediaDeletionRequest: { findFirst: mocks.mediaDeletionRequestFindFirst },
    booking: { findFirst: mocks.bookingFindFirst },
    serviceVideoPackageEvidence: { findFirst: mocks.corePackageFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/membership-auth", () => ({ requireVendorMembership: mocks.requireVendorMembership }));
vi.mock("@/lib/request-actor", () => ({
  authorizationErrorResponse: vi.fn(),
  requireActorVendorManager: vi.fn(),
  requireRequestActor: vi.fn(),
}));
vi.mock("@/lib/media-lifecycle", () => ({ requestMediaDeletion: vi.fn() }));
vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: mocks.loadRecordingPermissionGate,
  recordingGateErrorBody: (gate: any) => ({ code: gate.blockCode, blocked: gate.block }),
}));
vi.mock("@/lib/service-video-evidence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-video-evidence")>("@/lib/service-video-evidence");
  return { ...actual, assertServiceVideoStageMutationAllowed: mocks.assertServiceVideoStageMutationAllowed };
});

describe("employee Service Video restore recording lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireVendorMembership.mockResolvedValue({
      userId: "employee-1",
      membershipId: "membership-1",
      role: "EMPLOYEE",
    });
    mocks.mediaAssetFindUnique.mockResolvedValue({
      id: "asset-1",
      vendorId: "vendor-1",
      deletedAt: new Date("2026-08-12T00:00:00.000Z"),
      mediaSession: {
        bookingId: "booking-1",
        sessionType: "JOB_SERVICE_VIDEO",
        vendorJobVideoStage: "INTRO",
        capturedByMembershipId: "membership-1",
      },
    });
    mocks.bookingFindFirst.mockResolvedValue({ id: "booking-1", customerMetadata: "{}" });
    mocks.mediaDeletionRequestFindFirst.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
      mediaAsset: { update: mocks.mediaAssetUpdate },
      serviceVideoPackageEvidence: { findFirst: mocks.corePackageFindFirst },
    }));
    mocks.assertServiceVideoStageMutationAllowed.mockResolvedValue(undefined);
    mocks.corePackageFindFirst.mockResolvedValue(null);
    mocks.mediaAssetUpdate.mockResolvedValue({ id: "asset-1", deletedAt: null });
  });

  it("rejects a direct restore while manager review is authoritative", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({
      blockCode: "MANAGER_REVIEW_IN_PROGRESS",
      block: { responsibleParticipant: "VENDOR_MANAGER", resolution: "Wait for manager review." },
    });

    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/media/asset-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", assetId: "asset-1" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe("MANAGER_REVIEW_IN_PROGRESS");
    expect(mocks.mediaAssetUpdate).not.toHaveBeenCalled();
  });

  it("rejects restore after Admin REJECT before changing the archived asset", async () => {
    mocks.loadRecordingPermissionGate.mockResolvedValue({ blockCode: null, recordingUnlocked: true });
    mocks.corePackageFindFirst.mockResolvedValue({ id: "package-1", status: "ADMIN_REJECTED", adminAuditDecisionId: "audit-1" });
    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/media/asset-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", assetId: "asset-1" }) },
    );
    expect(response.status).toBe(409);
    expect(mocks.mediaAssetUpdate).not.toHaveBeenCalled();
  });
});
