import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn(),
  buildPackages: vi.fn(),
  loadCandidate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { mediaAsset: { findMany: hoisted.findMany } },
}));
vi.mock("@/lib/admin-media-moderation-packages", () => ({
  REQUIRED_MEDIA_MODERATION_STAGE_KEYS: ["INTRO", "IN_PROGRESS", "COMPLETED"],
  buildCompleteMediaModerationPackages: hoisted.buildPackages,
}));
vi.mock("@/lib/internal-identities", () => ({ launchExcludedVendorIds: () => [] }));
vi.mock("@/lib/service-video-admin-audit", () => ({
  loadCoreAdminAuditCandidate: hoisted.loadCandidate,
}));

const queuePackage = {
  bookingId: "booking-1",
  vendorId: "vendor-1",
  bookingStatus: "COMPLETED",
  moderationStatuses: ["pending_review"],
  videosByStage: {
    INTRO: { assetId: "asset-1", bookingOperationalPhase: "AWAITING_ADMIN_REVIEW" },
    IN_PROGRESS: { assetId: "asset-2", bookingOperationalPhase: "AWAITING_ADMIN_REVIEW" },
    COMPLETED: { assetId: "asset-3", bookingOperationalPhase: "AWAITING_ADMIN_REVIEW" },
  },
};

describe("core Admin Audit queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.findMany.mockResolvedValue([]);
    hoisted.buildPackages.mockReturnValue([queuePackage]);
  });

  it("includes only a canonically eligible exact manager-submitted package", async () => {
    hoisted.loadCandidate.mockResolvedValue({
      package: {
        id: "package-1",
        version: 2,
        packageHash: "package-hash",
        auditEvidenceVersion: 1,
      },
      managerDecision: { id: "manager-decision-1" },
      packageStages: [
        { mediaAssetId: "asset-1" },
        { mediaAssetId: "asset-2" },
        { mediaAssetId: "asset-3" },
      ],
    });
    const { getAdminMediaModerationQueue } = await import("./admin-media-moderation-queue");

    const result = await getAdminMediaModerationQueue({ includeInternal: true });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bookingId: "booking-1",
      packageId: "package-1",
      packageVersion: 2,
      packageHash: "package-hash",
      managerDecisionId: "manager-decision-1",
      adminAuditEvidenceVersion: 1,
    });
    expect(hoisted.loadCandidate).toHaveBeenCalledWith(expect.anything(), "booking-1");
  });

  it("excludes stranded or otherwise ineligible historical package rows", async () => {
    hoisted.loadCandidate.mockRejectedValue(new Error("ADMIN_AUDIT_PACKAGE_NOT_ELIGIBLE"));
    const { getAdminMediaModerationQueue } = await import("./admin-media-moderation-queue");

    await expect(getAdminMediaModerationQueue({ includeInternal: true })).resolves.toEqual([]);
  });

  it("excludes a display package that does not match the exact attested media identities", async () => {
    hoisted.loadCandidate.mockResolvedValue({
      package: { id: "package-1", version: 2, packageHash: "package-hash" },
      managerDecision: { id: "manager-decision-1" },
      packageStages: [
        { mediaAssetId: "asset-1" },
        { mediaAssetId: "asset-2" },
        { mediaAssetId: "different-asset" },
      ],
    });
    const { getAdminMediaModerationQueue } = await import("./admin-media-moderation-queue");

    await expect(getAdminMediaModerationQueue({ includeInternal: true })).resolves.toEqual([]);
  });
});
