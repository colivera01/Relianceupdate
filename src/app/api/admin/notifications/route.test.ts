import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const hoisted = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  notificationFindMany: vi.fn(),
  reviewFindMany: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: hoisted.requireAdmin }));
vi.mock("@/server/db", () => ({
  prisma: {
    adminNotification: { findMany: hoisted.notificationFindMany },
    review: { findMany: hoisted.reviewFindMany },
  },
}));

describe("GET /api/admin/notifications", () => {
  beforeEach(() => {
    hoisted.requireAdmin.mockReset().mockResolvedValue({ userId: "admin-1" });
    hoisted.notificationFindMany.mockReset();
    hoisted.reviewFindMany.mockReset();
  });

  it("returns current canonical countability for review notifications", async () => {
    hoisted.notificationFindMany.mockResolvedValue([
      {
        id: "notification-1",
        vendorId: "vendor-1",
        type: "REVIEW_MODERATION_REQUIRED",
        title: "Customer comment waiting for moderation",
        message: "Historical persisted message",
        metadata: JSON.stringify({ reviewId: "review-excluded" }),
        read: false,
        createdAt: new Date("2026-09-09T12:00:00.000Z"),
        vendor: { businessName: "Electro LLC", name: "Electro LLC" },
      },
    ]);
    hoisted.reviewFindMany.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/admin/notifications"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.notifications[0].countsInCanonicalMetrics).toBe(false);
  });
});
