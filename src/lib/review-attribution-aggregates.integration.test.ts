import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEmployeeRatingStats,
  getEmployeeRatingsForVendor,
  getVendorRatingStats,
} from "./review-attribution-aggregates";

const hoisted = vi.hoisted(() => {
  const reviewFindMany = vi.fn();
  const reviewGroupBy = vi.fn();
  const employeeRatingFindMany = vi.fn();
  return {
    prisma: {
      review: {
        findMany: reviewFindMany,
        groupBy: reviewGroupBy,
      },
      employeeCustomerRatingEvidence: {
        findMany: employeeRatingFindMany,
      },
    },
    reviewFindMany,
    reviewGroupBy,
    employeeRatingFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

describe("review attribution aggregates", () => {
  beforeEach(() => {
    hoisted.reviewFindMany.mockReset();
    hoisted.reviewGroupBy.mockReset();
    hoisted.employeeRatingFindMany.mockReset();
    hoisted.employeeRatingFindMany.mockResolvedValue([]);
  });

  it("getVendorRatingStats includes all eligible vendor reviews", async () => {
    hoisted.reviewGroupBy.mockResolvedValue([
      { vendorId: "v1", rating: 5, _count: { _all: 1 } },
      { vendorId: "v1", rating: 4, _count: { _all: 1 } },
      { vendorId: "v1", rating: 3, _count: { _all: 1 } },
    ]);
    const stats = await getVendorRatingStats("v1");
    expect(stats).toEqual({
      averageRating: 4,
      reviewCount: 3,
      ratingSum: 12,
      distribution: [
        { rating: 5, count: 1, percentage: 33.3 },
        { rating: 4, count: 1, percentage: 33.3 },
        { rating: 3, count: 1, percentage: 33.3 },
        { rating: 2, count: 0, percentage: 0 },
        { rating: 1, count: 0, percentage: 0 },
      ],
    });
    expect(hoisted.reviewGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["vendorId", "rating"],
        where: expect.objectContaining({
          vendorId: { in: ["v1"] },
          source: "customer",
          OR: expect.arrayContaining([
            expect.objectContaining({ contractVersion: { gte: 2 }, ratingValidityStatus: "verified" }),
            expect.objectContaining({ contractVersion: null, moderationStatus: "approved" }),
          ]),
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
          OR: expect.any(Array),
        }),
      })
    );
  });

  it("keeps the optional employee rating separate from the vendor review rating", async () => {
    hoisted.reviewFindMany.mockResolvedValue([]);
    hoisted.employeeRatingFindMany.mockResolvedValue([{ rating: 2 }]);
    const stats = await getEmployeeRatingStats("v1", "m1");
    expect(stats).toEqual({ averageRating: 2, reviewCount: 1, ratingSum: 2 });
    expect(hoisted.employeeRatingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: "v1",
          employeeMembershipId: "m1",
        }),
      })
    );
  });

  it("counts pending written comments and stars-only reviews in the same verified distribution", async () => {
    hoisted.reviewGroupBy.mockResolvedValue([
      { vendorId: "v1", rating: 5, _count: { _all: 1 } },
      { vendorId: "v1", rating: 4, _count: { _all: 1 } },
    ]);

    const stats = await getVendorRatingStats("v1");

    expect(stats).toMatchObject({ averageRating: 4.5, reviewCount: 2, ratingSum: 9 });
    expect(stats.distribution).toEqual([
      { rating: 5, count: 1, percentage: 50 },
      { rating: 4, count: 1, percentage: 50 },
      { rating: 3, count: 0, percentage: 0 },
      { rating: 2, count: 0, percentage: 0 },
      { rating: 1, count: 0, percentage: 0 },
    ]);
    expect(hoisted.reviewGroupBy.mock.calls[0][0].where).not.toHaveProperty("comment");
    expect(hoisted.reviewGroupBy.mock.calls[0][0].where).not.toHaveProperty("visibilityStatus");
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

