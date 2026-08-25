import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  userCount: vi.fn(),
  vendorCount: vi.fn(),
  reviewCount: vi.fn(),
  queue: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn(async () => ({ userId: "admin-1" })) }));
vi.mock("@/server/db", () => ({
  prisma: {
    user: { count: hoisted.userCount },
    vendor: { count: hoisted.vendorCount },
    review: { count: hoisted.reviewCount },
  },
}));
vi.mock("@/lib/admin-media-moderation-queue", () => ({
  getAdminMediaModerationQueue: hoisted.queue,
}));

describe("admin dashboard core audit count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.userCount.mockResolvedValue(5);
    hoisted.vendorCount.mockResolvedValue(2);
    hoisted.reviewCount.mockResolvedValue(1);
    hoisted.queue.mockResolvedValue([{ packageId: "package-1" }, { packageId: "package-2" }]);
  });

  it("derives pending package count from the same canonical queue resolver", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/admin/stats"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      stats: {
        pendingModeration: 3,
        pendingModerationBreakdown: { reviews: 1, mediaPackages: 2 },
      },
    });
    expect(hoisted.queue).toHaveBeenCalledWith({ limit: 200 });
  });
});
