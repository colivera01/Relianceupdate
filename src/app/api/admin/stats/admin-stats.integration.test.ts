import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as statsGET } from "./route";
import { requireAdmin } from "@/lib/admin-auth";

const hoisted = vi.hoisted(() => {
  const userCount = vi.fn();
  const vendorCount = vi.fn();
  const reviewCount = vi.fn();
  const getAdminMediaModerationQueueResult = vi.fn();
  const prisma = {
    user: { count: userCount },
    vendor: { count: vendorCount },
    review: { count: reviewCount },
  };
  return { prisma, userCount, vendorCount, reviewCount, getAdminMediaModerationQueueResult };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-media-moderation-queue", () => ({
  getAdminMediaModerationQueueResult: hoisted.getAdminMediaModerationQueueResult,
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
    hoisted.getAdminMediaModerationQueueResult.mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));

    const req = new Request("http://localhost/api/admin/stats", { method: "GET" });
    const res = await statsGET(req);

    expect(res.status).toBe(403);
    expect(hoisted.userCount).not.toHaveBeenCalled();
    expect(hoisted.vendorCount).not.toHaveBeenCalled();
    expect(hoisted.reviewCount).not.toHaveBeenCalled();
    expect(hoisted.getAdminMediaModerationQueueResult).not.toHaveBeenCalled();
  });

  it("excludes media packages that are not actionable in Reliance Audit", async () => {
    hoisted.userCount.mockResolvedValue(12);
    hoisted.vendorCount.mockResolvedValue(3);
    hoisted.reviewCount
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1);
    hoisted.getAdminMediaModerationQueueResult.mockResolvedValue({
      packages: [],
      diagnostics: [],
      totalPending: 0,
    });

    const req = new Request("http://localhost/api/admin/stats", { method: "GET" });
    const res = await statsGET(req);

    expect(res.status).toBe(200);
    const j = await readJson(res);

    expect(j.success).toBe(true);
    expect(j.stats).toEqual({
      totalUsers: 12,
      totalVendors: 3,
      totalReviews: 7,
      pendingModeration: 1,
      pendingModerationBreakdown: {
        reviews: 1,
        mediaPackages: 0,
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
    expect(hoisted.getAdminMediaModerationQueueResult).toHaveBeenCalledWith({ limit: 200 });
  });
});
