import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  serviceFindFirst: vi.fn(),
  vendorFindFirst: vi.fn(),
  reviewFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    service: { findFirst: h.serviceFindFirst },
    vendor: { findFirst: h.vendorFindFirst },
    review: { findMany: h.reviewFindMany },
  },
}));

import { GET as getServiceReviews } from "./services/[id]/reviews/public/route";
import { GET as getVendorReviews } from "./vendors/[vendorId]/reviews/public/route";

describe("canonical Public written-review routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.serviceFindFirst.mockResolvedValue({ id: "service-1", vendorId: "vendor-1" });
    h.vendorFindFirst.mockResolvedValue({ id: "vendor-1" });
    h.reviewFindMany.mockResolvedValue([]);
  });

  it("includes approved Public written comments attached by booking or media session", async () => {
    h.reviewFindMany.mockResolvedValue([
      {
        id: "review-booking",
        vendorId: "vendor-1",
        bookingId: "booking-1",
        mediaSessionId: null,
        rating: 5,
        comment: "Excellent work",
        createdAt: new Date("2026-09-01T12:00:00Z"),
        user: { name: "Customer One" },
      },
      {
        id: "review-session",
        vendorId: "vendor-1",
        bookingId: "booking-2",
        mediaSessionId: "session-1",
        rating: 4,
        comment: "Well done",
        createdAt: new Date("2026-09-02T12:00:00Z"),
        user: { name: "Customer Two" },
      },
    ]);

    const response = await getServiceReviews(new Request("http://localhost/api/services/service-1/reviews/public"), {
      params: Promise.resolve({ id: "service-1" }),
    });

    expect(response.status).toBe(200);
    expect(h.reviewFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        demo: false,
        vendorId: "vendor-1",
        source: "customer",
        bookingId: { not: null },
        comment: { not: null },
        moderationStatus: "approved",
        visibilityStatus: "public",
        user: { is: expect.objectContaining({ demo: false }) },
        OR: [
          { booking: { is: { serviceId: "service-1" } } },
          { mediaSession: { is: { serviceId: "service-1" } } },
        ],
      }),
    }));
    expect(await response.json()).toMatchObject({
      success: true,
      reviews: [
        { reviewId: "review-booking", bookingId: "booking-1", mediaSessionId: null },
        { reviewId: "review-session", bookingId: "booking-2", mediaSessionId: "session-1" },
      ],
      meta: { eligibilityRule: expect.stringContaining("booking or media session") },
    });
  });

  it("limits Vendor public comments to the canonical written-comment and countable-identity contract", async () => {
    const response = await getVendorReviews(new Request("http://localhost/api/vendors/vendor-1/reviews/public"), {
      params: Promise.resolve({ vendorId: "vendor-1" }),
    });

    expect(response.status).toBe(200);
    expect(h.vendorFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ demo: false, id: "vendor-1", isPubliclyListed: true, accountStatus: "active" }),
    }));
    expect(h.reviewFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        demo: false,
        vendorId: "vendor-1",
        source: "customer",
        bookingId: { not: null },
        comment: { not: null },
        moderationStatus: "approved",
        visibilityStatus: "public",
        user: { is: expect.objectContaining({ demo: false }) },
      }),
    }));
  });
});
