import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH as moderatePATCH } from "./[assetId]/moderate/route";
import { GET as moderationQueueGET } from "./moderation-queue/route";
import { requireAdmin } from "@/lib/admin-auth";
import {
  MODERATION_APPROVED,
  MODERATION_REJECTED,
  VISIBILITY_PRIVATE,
  VISIBILITY_VENDOR_ARCHIVE_ONLY,
} from "@/lib/media-visibility";

const hoisted = vi.hoisted(() => {
  const mediaAssetFindUnique = vi.fn();
  const mediaAssetUpdate = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const prisma = {
    mediaAsset: {
      findUnique: mediaAssetFindUnique,
      update: mediaAssetUpdate,
      findMany: mediaAssetFindMany,
    },
  };
  return { prisma, mediaAssetFindUnique, mediaAssetUpdate, mediaAssetFindMany };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("PATCH /api/admin/media/[assetId]/moderate", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
    hoisted.mediaAssetFindUnique.mockReset();
    hoisted.mediaAssetUpdate.mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const req = new Request("http://localhost/api/admin/media/asset-1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_public" }),
    });
    const res = await moderatePATCH(req, { params: Promise.resolve({ assetId: "asset-1" }) });
    expect(res.status).toBe(403);
    expect(hoisted.mediaAssetFindUnique).not.toHaveBeenCalled();
  });

  it("returns 422 for reject without moderation reason", async () => {
    const req = new Request("http://localhost/api/admin/media/asset-1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    const res = await moderatePATCH(req, { params: Promise.resolve({ assetId: "asset-1" }) });
    expect(res.status).toBe(422);
    expect(hoisted.mediaAssetFindUnique).not.toHaveBeenCalled();
  });

  it("sets approved + vendor_archive_only on approve_vendor_archive_only", async () => {
    hoisted.mediaAssetFindUnique.mockResolvedValue({ id: "asset-1" });
    hoisted.mediaAssetUpdate.mockResolvedValue({
      id: "asset-1",
      vendorId: "v1",
      mediaSessionId: null,
      uploadedByMembershipId: null,
      moderationStatus: MODERATION_APPROVED,
      visibilityStatus: VISIBILITY_VENDOR_ARCHIVE_ONLY,
      archiveStatus: "active",
      moderationReason: null,
      moderatedAt: new Date("2026-04-15T10:00:00.000Z"),
      moderatedByUserId: "admin-1",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      mimeType: "video/mp4",
      bytes: BigInt(100),
    });
    const req = new Request("http://localhost/api/admin/media/asset-1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_vendor_archive_only" }),
    });
    const res = await moderatePATCH(req, { params: Promise.resolve({ assetId: "asset-1" }) });
    expect(res.status).toBe(200);
    expect(hoisted.mediaAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "asset-1" },
        data: expect.objectContaining({
          moderationStatus: MODERATION_APPROVED,
          visibilityStatus: VISIBILITY_VENDOR_ARCHIVE_ONLY,
        }),
      })
    );
  });

  it("applies set_visibility_private without changing moderation status", async () => {
    hoisted.mediaAssetFindUnique.mockResolvedValue({ id: "asset-2" });
    hoisted.mediaAssetUpdate.mockResolvedValue({
      id: "asset-2",
      vendorId: "v2",
      mediaSessionId: null,
      uploadedByMembershipId: null,
      moderationStatus: MODERATION_APPROVED,
      visibilityStatus: VISIBILITY_PRIVATE,
      archiveStatus: "active",
      moderationReason: null,
      moderatedAt: new Date("2026-04-15T10:00:00.000Z"),
      moderatedByUserId: "admin-1",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      mimeType: "image/png",
      bytes: BigInt(40),
    });
    const req = new Request("http://localhost/api/admin/media/asset-2/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_visibility_private" }),
    });
    const res = await moderatePATCH(req, { params: Promise.resolve({ assetId: "asset-2" }) });
    expect(res.status).toBe(200);
    const callArg = hoisted.mediaAssetUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(callArg.data.visibilityStatus).toBe(VISIBILITY_PRIVATE);
    expect(callArg.data).not.toHaveProperty("moderationStatus");
  });

  it("sets rejected + private with required reason", async () => {
    hoisted.mediaAssetFindUnique.mockResolvedValue({ id: "asset-3" });
    hoisted.mediaAssetUpdate.mockResolvedValue({
      id: "asset-3",
      vendorId: "v2",
      mediaSessionId: null,
      uploadedByMembershipId: null,
      moderationStatus: MODERATION_REJECTED,
      visibilityStatus: VISIBILITY_PRIVATE,
      archiveStatus: "active",
      moderationReason: "faces blurred incorrectly",
      moderatedAt: new Date("2026-04-15T10:00:00.000Z"),
      moderatedByUserId: "admin-1",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      mimeType: "video/mp4",
      bytes: BigInt(40),
    });
    const req = new Request("http://localhost/api/admin/media/asset-3/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", moderationReason: "faces blurred incorrectly" }),
    });
    const res = await moderatePATCH(req, { params: Promise.resolve({ assetId: "asset-3" }) });
    expect(res.status).toBe(200);
    expect(hoisted.mediaAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          moderationStatus: MODERATION_REJECTED,
          visibilityStatus: VISIBILITY_PRIVATE,
          moderationReason: "faces blurred incorrectly",
        }),
      })
    );
  });
});

describe("GET /api/admin/media/moderation-queue", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
    hoisted.mediaAssetFindMany.mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const req = new Request("http://localhost/api/admin/media/moderation-queue", { method: "GET" });
    const res = await moderationQueueGET(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty assets state", async () => {
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    const req = new Request("http://localhost/api/admin/media/moderation-queue", { method: "GET" });
    const res = await moderationQueueGET(req);
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j.success).toBe(true);
    expect(j.assets).toEqual([]);
  });

  it("filters response by search over title/job/client", async () => {
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: "a1",
        vendorId: "v1",
        mediaSessionId: "ms1",
        uploadedByMembershipId: "m1",
        moderationStatus: "approved",
        visibilityStatus: "public",
        archiveStatus: "active",
        moderationReason: null,
        moderatedAt: null,
        createdAt: new Date("2026-04-15T09:00:00.000Z"),
        mimeType: "video/mp4",
        bytes: BigInt(20),
        blobUrl: "https://cdn/a1",
        vendor: { id: "v1", name: "Vendor A", businessName: null },
        mediaSession: {
          booking: { id: "b1", title: "HVAC tune-up", clientName: "Alex Johnson" },
          service: { id: "s1", name: "HVAC" },
          employee: { id: "e1", name: "Tech A" },
        },
      },
      {
        id: "a2",
        vendorId: "v2",
        mediaSessionId: "ms2",
        uploadedByMembershipId: "m2",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
        moderationReason: null,
        moderatedAt: null,
        createdAt: new Date("2026-04-15T09:10:00.000Z"),
        mimeType: "image/png",
        bytes: BigInt(10),
        blobUrl: "https://cdn/a2",
        vendor: { id: "v2", name: "Vendor B", businessName: null },
        mediaSession: {
          booking: { id: "b2", title: "Plumbing", clientName: "Taylor" },
          service: { id: "s2", name: "Plumbing" },
          employee: { id: "e2", name: "Tech B" },
        },
      },
    ]);
    const req = new Request("http://localhost/api/admin/media/moderation-queue?search=alex", {
      method: "GET",
    });
    const res = await moderationQueueGET(req);
    expect(res.status).toBe(200);
    const j = await readJson(res);
    const assets = j.assets as Array<Record<string, unknown>>;
    expect(assets).toHaveLength(1);
    expect(assets[0].assetId).toBe("a1");
    expect(assets[0].archiveStatus).toBe("active");
    expect(assets[0].downloadRef).toBe("/api/vendors/v1/media/a1/download");
  });
});
