import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { requireVendorMembership } from "@/lib/membership-auth";
import { requireVerifiedEmailForAction } from "@/lib/email-verification-enforcement";
import { PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE } from "@/lib/promoted-listings";

const hoisted = vi.hoisted(() => {
  const promotionPackageFindMany = vi.fn();
  const serviceFindMany = vi.fn();
  const promotionCampaignFindMany = vi.fn();
  const vendorFindUnique = vi.fn();
  const serviceFindFirst = vi.fn();
  const promotionCampaignCreate = vi.fn();
  const adminNotificationCreate = vi.fn();

  const prisma = {
    promotionPackage: { findMany: promotionPackageFindMany },
    service: {
      findMany: serviceFindMany,
      findFirst: serviceFindFirst,
    },
    promotionCampaign: {
      findMany: promotionCampaignFindMany,
      create: promotionCampaignCreate,
    },
    vendor: { findUnique: vendorFindUnique },
    adminNotification: { create: adminNotificationCreate },
  };

  return {
    prisma,
    promotionPackageFindMany,
    serviceFindMany,
    promotionCampaignFindMany,
    vendorFindUnique,
    serviceFindFirst,
    promotionCampaignCreate,
    adminNotificationCreate,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
}));

vi.mock("@/lib/email-verification-enforcement", () => ({
  requireVerifiedEmailForAction: vi.fn(),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("vendor promotion request route", () => {
  beforeEach(() => {
    vi.mocked(requireVendorMembership).mockReset();
    vi.mocked(requireVendorMembership).mockResolvedValue({
      membershipId: "membership-1",
      vendorId: "vendor-1",
      userId: "user-1",
      role: "manager",
    } as any);
    vi.mocked(requireVerifiedEmailForAction).mockReset();
    vi.mocked(requireVerifiedEmailForAction).mockResolvedValue(null);

    hoisted.promotionPackageFindMany.mockReset();
    hoisted.serviceFindMany.mockReset();
    hoisted.promotionCampaignFindMany.mockReset();
    hoisted.vendorFindUnique.mockReset();
    hoisted.serviceFindFirst.mockReset();
    hoisted.promotionCampaignCreate.mockReset();
    hoisted.adminNotificationCreate.mockReset();
  });

  it("GET hides HOME_FEATURED even if a stale active package row exists", async () => {
    hoisted.promotionPackageFindMany.mockResolvedValue([
      {
        packageKey: "home-spotlight-7-day",
        name: "7-day homepage spotlight",
        publicSummary: "Premium homepage spotlight reservation for top visibility.",
        adminDescription: "Deferred home inventory",
        bestFor: "Premium visibility",
        placementExplanation: "Reserved for HOME_FEATURED inventory; public homepage rendering is still deferred.",
        audience: "High-priority vendors",
        placementType: "HOME_FEATURED",
        durationDays: 7,
        defaultRadiusMiles: 20,
        maxRadiusMiles: 30,
        allowCategoryTargeting: false,
        maxConcurrentInZone: 1,
        defaultPriceCents: 9900,
        isActive: true,
        isFoundingRate: true,
        pricingLabel: "Founding / intro rate",
      },
      {
        packageKey: "browse-local-7-day",
        name: "7-day local spotlight",
        publicSummary: "Entry-level browse feature",
        adminDescription: "Browse inventory",
        bestFor: "Local visibility",
        placementExplanation: "Appears in browse.",
        audience: "Local vendors",
        placementType: "BROWSE_FEATURED",
        durationDays: 7,
        defaultRadiusMiles: 10,
        maxRadiusMiles: 10,
        allowCategoryTargeting: true,
        maxConcurrentInZone: 2,
        defaultPriceCents: 2900,
        isActive: true,
        isFoundingRate: true,
        pricingLabel: "Founding / intro rate",
      },
    ]);
    hoisted.serviceFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "svc-1", vendor: { category: "Cleaning", businessType: "Cleaning" } },
        { id: "svc-2", vendor: { category: "Cleaning", businessType: "Cleaning" } },
        { id: "svc-3", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      ]);
    hoisted.promotionCampaignFindMany.mockResolvedValue([]);

    const res = await GET(
      new Request("http://localhost/api/vendor/promotion-requests?vendorId=vendor-1")
    );

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(Array.isArray(json.packages)).toBe(true);
    expect(json.packages).toHaveLength(1);
    expect(json.packages[0]).toMatchObject({
      packageKey: "browse-local-7-day",
      placementType: "BROWSE_FEATURED",
    });
    expect(json.browseReadiness).toEqual({
      organicBrowseCount: 3,
      desktopMinimumOrganicCount: 4,
      categoryMinimumOrganicCount: 3,
      desktopBrowseEligible: false,
      categoriesMeetingMinimum: 1,
      totalCategoriesWithListings: 1,
    });
  });

  it("POST rejects homepage spotlight requests before vendor/service lookup", async () => {
    hoisted.promotionPackageFindMany.mockResolvedValue([
      {
        packageKey: "browse-local-7-day",
        name: "7-day local spotlight",
        publicSummary: "Entry-level browse feature",
        adminDescription: "Browse inventory",
        bestFor: "Local visibility",
        placementExplanation: "Appears in browse.",
        audience: "Local vendors",
        placementType: "BROWSE_FEATURED",
        durationDays: 7,
        defaultRadiusMiles: 10,
        maxRadiusMiles: 10,
        allowCategoryTargeting: true,
        maxConcurrentInZone: 2,
        defaultPriceCents: 2900,
        isActive: true,
        isFoundingRate: true,
        pricingLabel: "Founding / intro rate",
      },
    ]);

    const res = await POST(
      new Request("http://localhost/api/vendor/promotion-requests", {
        method: "POST",
        body: JSON.stringify({
          vendorId: "vendor-1",
          serviceId: "service-1",
          packageKey: "home-spotlight-7-day",
        }),
      })
    );

    expect(res.status).toBe(422);
    const json = await readJson(res);
    expect(json.error).toBe(PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE);
    expect(hoisted.vendorFindUnique).not.toHaveBeenCalled();
    expect(hoisted.serviceFindFirst).not.toHaveBeenCalled();
  });
});
