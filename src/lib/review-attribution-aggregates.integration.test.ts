import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEmployeeRatingStats,
  getEmployeeRatingsForVendor,
  getVendorRatingStats,
} from "./review-attribution-aggregates";

const hoisted = vi.hoisted(() => {
  const reviewFindMany = vi.fn();
  return {
    prisma: {
      review: {
        findMany: reviewFindMany,
      },
    },
    reviewFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

describe("review attribution aggregates", () => {
  beforeEach(() => {
    hoisted.reviewFindMany.mockReset();
  });

  it("getVendorRatingStats includes all eligible vendor reviews", async () => {
    hoisted.reviewFindMany.mockResolvedValue([{ rating: 5 }, { rating: 3 }, { rating: 4 }]);
    const stats = await getVendorRatingStats("v1");
    expect(stats).toEqual({
      averageRating: 4,
      reviewCount: 3,
      ratingSum: 12,
    });
    expect(hoisted.reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: "v1",
          source: "customer",
          moderationStatus: "approved",
        }),
      })
    );
  });

  it("getEmployeeRatingStats includes only attributed reviews for that membership", async () => {
    hoisted.reviewFindMany.mockResolvedValue([{ rating: 5 }, { rating: 4 }]);
    const stats = await getEmployeeRatingStats("v1", "m1");
    expect(stats).toEqual({
      averageRating: 4.5,
      reviewCount: 2,
      ratingSum: 9,
    });
    expect(hoisted.reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: "v1",
          assignedMembershipId: "m1",
          source: "customer",
          moderationStatus: "approved",
        }),
      })
    );
  });

  it("getEmployeeRatingsForVendor groups attributed reviews by membership", async () => {
    hoisted.reviewFindMany.mockResolvedValue([
      { assignedMembershipId: "m1", rating: 5 },
      { assignedMembershipId: "m1", rating: 3 },
      { assignedMembershipId: "m2", rating: 4 },
    ]);
    const stats = await getEmployeeRatingsForVendor("v1");
    expect(stats).toEqual(
      expect.arrayContaining([
        { membershipId: "m1", averageRating: 4, reviewCount: 2, ratingSum: 8 },
        { membershipId: "m2", averageRating: 4, reviewCount: 1, ratingSum: 4 },
      ])
    );
  });
});

