import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";

const hoisted = vi.hoisted(() => ({
  mediaAssetFindMany: vi.fn(),
  mediaAssetCount: vi.fn(),
  mediaAssetAggregate: vi.fn(),
  packageFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    mediaAsset: {
      findMany: hoisted.mediaAssetFindMany,
      count: hoisted.mediaAssetCount,
      aggregate: hoisted.mediaAssetAggregate,
    },
    serviceVideoPackageEvidence: {
      findMany: hoisted.packageFindMany,
    },
  },
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

function asset(id: string, createdAt: string) {
  return {
    id,
    vendorId: "vendor-1",
    mediaSessionId: `session-${id}`,
    membershipId: null,
    uploadedByMembershipId: "membership-1",
    deviceId: null,
    bytes: BigInt(100),
    mimeType: "video/webm",
    blobKey: `vendor/vendor-1/${id}.webm`,
    blobUrl: null,
    moderationStatus: "pending_review",
    visibilityStatus: "private",
    archiveStatus: "active",
    moderationReason: null,
    moderatedAt: null,
    createdAt: new Date(createdAt),
    deletedAt: null,
    mediaSession: {
      title: "Outlet Installation",
      sessionType: "JOB_SERVICE_VIDEO",
      vendorJobVideoStage: "INTRO",
      serviceId: "service-1",
      booking: {
        id: "booking-1",
        title: "Outlet Installation",
        clientName: "Customer",
      },
      service: { id: "service-1", name: "Outlet Installation" },
      employee: { id: "employee-1", name: "Employee" },
    },
  };
}

describe("GET /api/vendors/[vendorId]/media activity mode", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({} as never);
    hoisted.mediaAssetFindMany.mockReset();
    hoisted.mediaAssetCount.mockReset();
    hoisted.mediaAssetAggregate.mockReset();
    hoisted.packageFindMany.mockReset();
    hoisted.mediaAssetAggregate.mockResolvedValue({ _sum: { bytes: BigInt(200) } });
  });

  it("returns the recent window plus every active file referenced by a current package", async () => {
    hoisted.packageFindMany.mockResolvedValue([
      {
        id: "package-2",
        version: 2,
        status: "AWAITING_ADMIN_REVIEW",
        stageEvidenceJson: JSON.stringify([
          {
            mediaAssetId: "asset-old-current",
            stageEvidenceId: "stage-1",
            stageVersion: 2,
            stage: "INTRO",
          },
        ]),
      },
    ]);
    hoisted.mediaAssetCount.mockResolvedValue(150);
    hoisted.mediaAssetFindMany
      .mockResolvedValueOnce([asset("asset-recent", "2026-10-24T12:00:00.000Z")])
      .mockResolvedValueOnce([asset("asset-old-current", "2026-01-01T12:00:00.000Z")]);

    const request = new Request("http://localhost/api/vendors/vendor-1/media?activity=true");
    const response = await GET(request, { params: Promise.resolve({ vendorId: "vendor-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assets.map((row: { id: string }) => row.id)).toEqual([
      "asset-recent",
      "asset-old-current",
    ]);
    expect(body.assets[1]).toMatchObject({
      isCurrentPackageAsset: true,
      currentPackageId: "package-2",
      currentPackageVersion: 2,
      currentPackageStatus: "AWAITING_ADMIN_REVIEW",
    });
    expect(body.activitySummary).toEqual({
      totalCount: 150,
      returnedCount: 2,
      recentLimit: 100,
      truncated: true,
    });
    expect(hoisted.mediaAssetFindMany.mock.calls[0]?.[0]).toMatchObject({
      take: 100,
      where: {
        vendorId: "vendor-1",
        mediaSession: { is: { sessionType: "JOB_SERVICE_VIDEO" } },
      },
    });
    expect(hoisted.mediaAssetFindMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        AND: [
          expect.any(Object),
          { id: { in: ["asset-old-current"] } },
        ],
      },
    });
  });
});
