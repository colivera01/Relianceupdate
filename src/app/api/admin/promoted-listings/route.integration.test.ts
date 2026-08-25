import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./route";
import { requireAdmin } from "@/lib/admin-auth";
import { PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE } from "@/lib/promoted-listings";

const hoisted = vi.hoisted(() => {
  const promotionPackageFindMany = vi.fn();
  const promotionPackageUpdate = vi.fn();
  const promotionCampaignFindMany = vi.fn();
  const serviceFindMany = vi.fn();
  const prisma = {
    promotionPackage: {
      findMany: promotionPackageFindMany,
      update: promotionPackageUpdate,
    },
    promotionCampaign: {
      findMany: promotionCampaignFindMany,
    },
    service: {
      findMany: serviceFindMany,
    },
  };
  return {
    prisma,
    promotionPackageFindMany,
    promotionPackageUpdate,
    promotionCampaignFindMany,
    serviceFindMany,
  };
});

vi.mock("@/server/db", () => ({
  prisma: hoisted.prisma,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/ai/promotion-readiness-review-store", () => ({
  getLatestPromotionReadinessAiStoredResults: vi.fn().mockResolvedValue({}),
}));

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

describe("admin promoted listings route", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    hoisted.promotionPackageFindMany.mockReset();
    hoisted.promotionPackageUpdate.mockReset();
    hoisted.promotionCampaignFindMany.mockReset();
    hoisted.serviceFindMany.mockReset();
  });

  it("GET returns live browse render readiness in the meta payload", async () => {
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
    hoisted.promotionCampaignFindMany.mockResolvedValue([]);
    hoisted.serviceFindMany.mockResolvedValue([
      { id: "svc-1", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-2", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-3", vendor: { category: "Cleaning", businessType: "Cleaning" } },
    ]);

    const res = await GET(new Request("http://localhost/api/admin/promoted-listings"));

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.meta?.browseReadiness).toEqual({
      organicBrowseCount: 3,
      desktopMinimumOrganicCount: 4,
      categoryMinimumOrganicCount: 3,
      desktopBrowseEligible: false,
      categoriesMeetingMinimum: 1,
      totalCategoriesWithListings: 1,
    });
  });

  it("POST rejects the homepage package before campaign creation", async () => {
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

    const res = await POST(
      new Request("http://localhost/api/admin/promoted-listings", {
        method: "POST",
        body: JSON.stringify({
          vendorId: "vendor-1",
          serviceId: "service-1",
          name: "Homepage launch push",
          packageKey: "home-spotlight-7-day",
          startAt: "2026-06-10T00:00:00.000Z",
          endAt: "2026-06-17T00:00:00.000Z",
        }),
      })
    );

    expect(res.status).toBe(422);
    const json = await readJson(res);
    expect(json.error).toBe(PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE);
  });

  it("PATCH rejects attempts to reactivate the deferred homepage package", async () => {
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
        isActive: false,
        isFoundingRate: true,
        pricingLabel: "Founding / intro rate",
      },
    ]);

    const res = await PATCH(
      new Request("http://localhost/api/admin/promoted-listings", {
        method: "PATCH",
        body: JSON.stringify({
          entityType: "promotion_package",
          packageKey: "home-spotlight-7-day",
          isActive: true,
        }),
      })
    );

    expect(res.status).toBe(422);
    const json = await readJson(res);
    expect(json.error).toBe(PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE);
    expect(hoisted.promotionPackageUpdate).not.toHaveBeenCalled();
  });

  it("GET keeps category-targeted browse campaigns honest when full browse is suppressed", async () => {
    const campaignStartAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const campaignEndAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
    hoisted.promotionCampaignFindMany
      .mockResolvedValueOnce([
        {
          id: "campaign-1",
          name: "Metro category push",
          packageKey: "browse-local-7-day",
          packageSnapshotJson: null,
          packageSnapshotAt: null,
          placementType: "BROWSE_FEATURED",
          status: "active",
          paymentStatus: "paid",
          startAt: campaignStartAt,
          endAt: campaignEndAt,
          targetCategory: "Cleaning",
          targetCity: null,
          targetState: null,
          targetZip: null,
          targetRadiusMiles: 10,
          rankPriority: 100,
          adminNotes: null,
          amountDueCents: 2900,
          stripePaymentLinkUrl: null,
          paymentReference: "AUDIT-PAID-001",
          paidAt: new Date("2026-06-01T00:00:00.000Z"),
          paymentNotes: null,
          approvedAt: new Date("2026-06-01T00:00:00.000Z"),
          pausedAt: null,
          endedAt: null,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          updatedAt: new Date("2026-06-01T00:00:00.000Z"),
          vendor: {
            id: "vendor-1",
            businessName: "Metro Home Care Pros",
            name: "Metro Home Care Pros",
            accountStatus: "active",
            isPubliclyListed: true,
            category: "Cleaning",
            city: "New York",
            state: "NY",
          },
          service: {
            id: "svc-1",
            name: "Metro Apartment Deep Clean",
            isPublished: true,
            price: 199,
            vendor: {
              isPubliclyListed: true,
              accountStatus: "active",
            },
          },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    hoisted.serviceFindMany.mockResolvedValue([
      { id: "svc-1", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-2", vendor: { category: "Cleaning", businessType: "Cleaning" } },
      { id: "svc-3", vendor: { category: "Cleaning", businessType: "Cleaning" } },
    ]);

    const res = await GET(new Request("http://localhost/api/admin/promoted-listings"));

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.campaigns?.[0]?.eligibility?.renderable).toBe(true);
    expect(json.campaigns?.[0]?.eligibility?.note).toContain(
      "can still render inside eligible Cleaning browse results"
    );
    expect(json.meta?.browseReadiness).toEqual({
      organicBrowseCount: 3,
      desktopMinimumOrganicCount: 4,
      categoryMinimumOrganicCount: 3,
      desktopBrowseEligible: false,
      categoriesMeetingMinimum: 1,
      totalCategoriesWithListings: 1,
    });
  });
});
