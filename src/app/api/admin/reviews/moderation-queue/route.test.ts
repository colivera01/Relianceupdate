import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    review: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/review-moderation-review-store", () => ({
  getLatestReviewModerationAiStoredResults: vi.fn().mockResolvedValue({}),
}));

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/admin/reviews/moderation-queue", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" } as any);
    vi.mocked((prisma as any).review.count).mockReset();
    vi.mocked((prisma as any).review.findMany).mockReset();
  });

  it("returns 403 when admin auth fails", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
    const response = await GET(
      new Request("http://localhost/api/admin/reviews/moderation-queue")
    );
    expect(response.status).toBe(403);
  });

  it("keeps internal test-account reviews visible to admin moderation", async () => {
    vi.mocked((prisma as any).review.count).mockResolvedValue(1);
    vi.mocked((prisma as any).review.findMany).mockResolvedValue([
      {
        id: "review_1",
        vendorId: "vendor_1",
        userId: "user_1",
        clientName: "Audit Customer",
        jobType: "Deep Clean",
        rating: 5,
        comment: "Great work",
        createdAt: new Date("2026-06-05T12:00:00.000Z"),
        moderationStatus: "PENDING_REVIEW",
        visibilityStatus: "private",
        moderationReason: null,
        moderatedAt: null,
        vendor: {
          id: "vendor_1",
          name: "Metro Home Care Pros",
          businessName: "Metro Home Care Pros",
        },
        user: {
          id: "user_1",
          name: "Audit Customer",
          email: "audit-customer@reliance.test",
        },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/admin/reviews/moderation-queue")
    );

    expect(response.status).toBe(200);
    const countCall = vi.mocked((prisma as any).review.count).mock.calls[0]?.[0];
    const findCall = vi.mocked((prisma as any).review.findMany).mock.calls[0]?.[0];
    expect(countCall.where.user).toBeUndefined();
    expect(findCall.where.user).toBeUndefined();

    const json = await readJson(response);
    expect(json.success).toBe(true);
    expect((json.reviews as any[])[0]?.reviewerEmail).toBe("audit-customer@reliance.test");
  });
});
