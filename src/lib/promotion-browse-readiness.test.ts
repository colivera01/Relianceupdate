import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBrowsePromotionRenderReadiness } from "./promotion-browse-readiness";

const hoisted = vi.hoisted(() => {
  const serviceFindMany = vi.fn();
  return {
    prisma: {
      service: {
        findMany: serviceFindMany,
      },
    },
    serviceFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

describe("promotion browse readiness", () => {
  beforeEach(() => {
    hoisted.serviceFindMany.mockReset();
  });

  it("reports desktop suppression when browse inventory is below the organic floor", async () => {
    hoisted.serviceFindMany.mockResolvedValue([
      { id: "svc-1", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-2", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-3", vendor: { category: "Cleaning", businessType: "Cleaning" } },
    ]);

    await expect(getBrowsePromotionRenderReadiness()).resolves.toEqual({
      organicBrowseCount: 3,
      desktopMinimumOrganicCount: 4,
      categoryMinimumOrganicCount: 3,
      desktopBrowseEligible: false,
      categoriesMeetingMinimum: 1,
      totalCategoriesWithListings: 1,
      categoryCountsByLabel: {
        cleaning: 3,
      },
    });
  });

  it("reports desktop readiness once organic browse inventory reaches the floor", async () => {
    hoisted.serviceFindMany.mockResolvedValue([
      { id: "svc-1", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-2", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-3", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-4", vendor: { category: "Repairs", businessType: "Repairs" } },
    ]);

    await expect(getBrowsePromotionRenderReadiness()).resolves.toEqual({
      organicBrowseCount: 4,
      desktopMinimumOrganicCount: 4,
      categoryMinimumOrganicCount: 3,
      desktopBrowseEligible: true,
      categoriesMeetingMinimum: 1,
      totalCategoriesWithListings: 2,
      categoryCountsByLabel: {
        cleaning: 3,
        repairs: 1,
      },
    });
  });
});
