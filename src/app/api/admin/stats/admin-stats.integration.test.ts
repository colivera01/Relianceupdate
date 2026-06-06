import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as statsGET } from "./route";
import { requireAdmin } from "@/lib/admin-auth";

const hoisted = vi.hoisted(() => {
  const userCount = vi.fn();
  const vendorCount = vi.fn();
  const reviewCount = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const prisma = {
    user: { count: userCount },
    vendor: { count: vendorCount },
    review: { count: reviewCount },
    mediaAsset: { findMany: mediaAssetFindMany },
  };
  return { prisma, userCount, vendorCount, reviewCount, mediaAssetFindMany };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1" } as any);
    hoisted.userCount.mockReset();
    hoisted.vendorCount.mockReset();
    hoisted.reviewCount.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));

    const req = new Request("http://localhost/api/admin/stats", { method: "GET" });
    const res = await statsGET(req);

    expect(res.status).toBe(403);
    expect(hoisted.userCount).not.toHaveBeenCalled();
    expect(hoisted.vendorCount).not.toHaveBeenCalled();
    expect(hoisted.reviewCount).not.toHaveBeenCalled();
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
  });

  it("returns dashboard stats with combined pending moderation breakdown", async () => {
    hoisted.userCount.mockResolvedValue(12);
    hoisted.vendorCount.mockResolvedValue(3);
    hoisted.reviewCount
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1);
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        id: "asset-intro",
        vendorId: "vendor-1",
        uploadedByMembershipId: "membership-1",
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        createdAt: new Date("2026-04-15T09:00:00.000Z"),
        vendor: { name: "Vendor One", businessName: "Vendor One LLC" },
        mediaSession: {
          title: "Intro proof",
          vendorJobVideoStage: "INTRO",
          sessionType: "JOB_SERVICE_VIDEO",
          booking: {
            id: "booking-1",
            title: "Kitchen repair",
            clientName: "Alex Johnson",
            status: "CONFIRMED",
          },
          service: { name: "Repair" },
        },
      },
      {
        id: "asset-progress",
        vendorId: "vendor-1",
        uploadedByMembershipId: "membership-2",
        moderationStatus: "approved",
        visibilityStatus: "customer_only",
        createdAt: new Date("2026-04-15T09:10:00.000Z"),
        vendor: { name: "Vendor One", businessName: "Vendor One LLC" },
        mediaSession: {
          title: "Progress proof",
          vendorJobVideoStage: "IN_PROGRESS",
          sessionType: "JOB_SERVICE_VIDEO",
          booking: {
            id: "booking-1",
            title: "Kitchen repair",
            clientName: "Alex Johnson",
            status: "CONFIRMED",
          },
          service: { name: "Repair" },
        },
      },
      {
        id: "asset-completed",
        vendorId: "vendor-1",
        uploadedByMembershipId: "membership-3",
        moderationStatus: "approved",
        visibilityStatus: "customer_only",
        createdAt: new Date("2026-04-15T09:20:00.000Z"),
        vendor: { name: "Vendor One", businessName: "Vendor One LLC" },
        mediaSession: {
          title: "Completion proof",
          vendorJobVideoStage: "COMPLETED",
          sessionType: "JOB_SERVICE_VIDEO",
          booking: {
            id: "booking-1",
            title: "Kitchen repair",
            clientName: "Alex Johnson",
            status: "CONFIRMED",
          },
          service: { name: "Repair" },
        },
      },
    ]);

    const req = new Request("http://localhost/api/admin/stats", { method: "GET" });
    const res = await statsGET(req);

    expect(res.status).toBe(200);
    const j = await readJson(res);

    expect(j.success).toBe(true);
    expect(j.stats).toEqual({
      totalUsers: 12,
      totalVendors: 3,
      totalReviews: 7,
      pendingModeration: 2,
      pendingModerationBreakdown: {
        reviews: 1,
        mediaPackages: 1,
      },
    });
    expect(hoisted.userCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ demo: false }),
    });
    expect(hoisted.vendorCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ demo: false }),
    });
    expect(hoisted.reviewCount).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({ demo: false }),
    });
    expect(hoisted.reviewCount).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        demo: false,
        moderationStatus: "pending_review",
      }),
    });
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null, archiveStatus: "active" }),
      })
    );
  });
});
