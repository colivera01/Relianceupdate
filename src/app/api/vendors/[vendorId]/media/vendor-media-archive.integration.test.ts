import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as mediaListGET } from "./route";
import { DELETE as mediaDelete, PATCH as mediaPatch } from "./[assetId]/route";
import { requireVendorMembership } from "@/lib/membership-auth";
import { calculateStorageUsage } from "@/lib/storage-helpers";
import { ARCHIVE_ACTIVE, ARCHIVE_ARCHIVED } from "@/lib/media-visibility";

const hoisted = vi.hoisted(() => {
  const mediaAssetFindMany = vi.fn();
  const mediaAssetAggregate = vi.fn();
  const mediaAssetFindUnique = vi.fn();
  const mediaAssetUpdate = vi.fn();
  const prisma = {
    mediaAsset: {
      findMany: mediaAssetFindMany,
      aggregate: mediaAssetAggregate,
      findUnique: mediaAssetFindUnique,
      update: mediaAssetUpdate,
    },
  };
  return {
    prisma,
    mediaAssetFindMany,
    mediaAssetAggregate,
    mediaAssetFindUnique,
    mediaAssetUpdate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/storage-helpers", () => ({
  calculateStorageUsage: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/vendors/[vendorId]/media", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({} as any);
    hoisted.mediaAssetFindMany.mockReset();
    hoisted.mediaAssetAggregate.mockReset();
  });

  it("returns 403 when vendor auth fails", async () => {
    vi.mocked(requireVendorMembership).mockRejectedValue(new Error("Forbidden"));
    const req = new Request("http://localhost/api/vendors/v1/media", { method: "GET" });
    const res = await mediaListGET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(403);
  });

  it("returns empty media archive payload", async () => {
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    hoisted.mediaAssetAggregate.mockResolvedValue({ _sum: { bytes: BigInt(0) } });
    const req = new Request("http://localhost/api/vendors/v1/media?includeDeleted=true", { method: "GET" });
    const res = await mediaListGET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.assets).toEqual([]);
    expect(j.storage).toMatchObject({
      totalBytes: "0",
      totalMB: "0.00",
      totalGB: "0.00",
    });
  });

  it("maps canonical statuses and enriches content-archive metadata", async () => {
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: "asset-1",
        vendorId: "v1",
        mediaSessionId: "ms-1",
        membershipId: "m1",
        uploadedByMembershipId: "m1",
        deviceId: null,
        bytes: BigInt(100),
        mimeType: "video/mp4",
        blobKey: "k1",
        blobUrl: "https://cdn/1",
        moderationStatus: "approved",
        visibilityStatus: "vendor_archive_only",
        archiveStatus: "active",
        moderationReason: null,
        moderatedAt: null,
        createdAt: new Date("2026-04-15T11:00:00.000Z"),
        deletedAt: null,
        mediaSession: {
          booking: { id: "b1", title: "Pipe fix", clientName: "Casey" },
          service: { id: "s1", name: "Plumbing" },
          employee: { id: "e1", name: "Tech One" },
        },
      },
      {
        id: "asset-2",
        vendorId: "v1",
        mediaSessionId: "ms-2",
        membershipId: null,
        uploadedByMembershipId: null,
        deviceId: null,
        bytes: BigInt(30),
        mimeType: "image/png",
        blobKey: "k2",
        blobUrl: "https://cdn/2",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
        moderationReason: null,
        moderatedAt: null,
        createdAt: new Date("2026-04-15T11:10:00.000Z"),
        deletedAt: new Date("2026-04-15T12:00:00.000Z"),
        mediaSession: {
          booking: { id: "b2", title: "HVAC", clientName: "Jordan" },
          service: { id: "s2", name: "HVAC" },
          employee: null,
        },
      },
    ]);
    hoisted.mediaAssetAggregate.mockResolvedValue({ _sum: { bytes: BigInt(130) } });
    const req = new Request("http://localhost/api/vendors/v1/media?includeDeleted=true", { method: "GET" });
    const res = await mediaListGET(req, { params: Promise.resolve({ vendorId: "v1" }) });
    expect(res.status).toBe(200);
    const j = await readJson(res);
    const assets = j.assets as Array<Record<string, unknown>>;
    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({
      assetId: "asset-1",
      title: "Pipe fix",
      jobTitle: "Pipe fix",
      serviceName: "Plumbing",
      moderationStatus: "approved",
      visibilityStatus: "vendor_archive_only",
      archiveStatus: ARCHIVE_ACTIVE,
    });
    expect(assets[1].archiveStatus).toBe(ARCHIVE_ARCHIVED);
  });
});

describe("DELETE/PATCH /api/vendors/[vendorId]/media/[assetId]", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({} as any);
    vi.mocked(calculateStorageUsage).mockReset();
    vi.mocked(calculateStorageUsage).mockResolvedValue({
      usedBytes: BigInt(1024),
      limitBytes: BigInt(4096),
      percentUsed: 25,
      isOverLimit: false,
    } as any);
    hoisted.mediaAssetFindUnique.mockReset();
    hoisted.mediaAssetUpdate.mockReset();
  });

  it("DELETE rejects asset owned by a different vendor", async () => {
    hoisted.mediaAssetFindUnique.mockResolvedValue({
      id: "asset-1",
      vendorId: "other-vendor",
      deletedAt: null,
    });
    const req = new Request("http://localhost/api/vendors/v1/media/asset-1", { method: "DELETE" });
    const res = await mediaDelete(req, {
      params: Promise.resolve({ vendorId: "v1", assetId: "asset-1" }),
    });
    expect(res.status).toBe(403);
    expect(hoisted.mediaAssetUpdate).not.toHaveBeenCalled();
  });

  it("DELETE sets archiveStatus=archived and returns storage payload", async () => {
    hoisted.mediaAssetFindUnique.mockResolvedValue({
      id: "asset-1",
      vendorId: "v1",
      deletedAt: null,
    });
    hoisted.mediaAssetUpdate.mockResolvedValue({
      id: "asset-1",
      deletedAt: new Date("2026-04-15T12:00:00.000Z"),
    });
    const req = new Request("http://localhost/api/vendors/v1/media/asset-1", { method: "DELETE" });
    const res = await mediaDelete(req, {
      params: Promise.resolve({ vendorId: "v1", assetId: "asset-1" }),
    });
    expect(res.status).toBe(200);
    expect(hoisted.mediaAssetUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { deletedAt: expect.any(Date), archiveStatus: ARCHIVE_ARCHIVED },
    });
    const j = await readJson(res);
    expect((j.storage as Record<string, unknown>).usedBytes).toBe("1024");
  });

  it("PATCH returns 422 for unsupported action", async () => {
    const req = new Request("http://localhost/api/vendors/v1/media/asset-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UNKNOWN" }),
    });
    const res = await mediaPatch(req, {
      params: Promise.resolve({ vendorId: "v1", assetId: "asset-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("PATCH RESTORE reactivates archiveStatus=active", async () => {
    hoisted.mediaAssetFindUnique.mockResolvedValue({
      id: "asset-1",
      vendorId: "v1",
      deletedAt: new Date("2026-04-14T12:00:00.000Z"),
    });
    hoisted.mediaAssetUpdate.mockResolvedValue({
      id: "asset-1",
      deletedAt: null,
    });
    const req = new Request("http://localhost/api/vendors/v1/media/asset-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESTORE" }),
    });
    const res = await mediaPatch(req, {
      params: Promise.resolve({ vendorId: "v1", assetId: "asset-1" }),
    });
    expect(res.status).toBe(200);
    expect(hoisted.mediaAssetUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { deletedAt: null, archiveStatus: ARCHIVE_ACTIVE },
    });
  });
});
