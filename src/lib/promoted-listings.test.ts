import { describe, expect, it } from "vitest";
import {
  applyPromotionInventoryRules,
  campaignMatchesTargetRadius,
  createPromotionPackageSnapshot,
  doesPromotionPaymentNeedReference,
  getPromotionPackageDefinition,
  isCampaignCurrentlyRenderable,
  isPromotionPaymentAcceptable,
  PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE,
  isServicePromotionEligible,
  isVendorPromotionEligible,
  normalizePromotionTargetRadiusMiles,
  parsePromotionPackageSnapshot,
  PROMOTION_PUBLIC_EXPLAINER,
  PROMOTION_PUBLIC_LABEL,
  resolvePromotionZoneLimits,
  serializePromotionPackageSnapshot,
  validatePromotionPackageRules,
} from "./promoted-listings";

describe("promoted listing eligibility", () => {
  it("requires vendors to be active and publicly listed", () => {
    expect(isVendorPromotionEligible({ isPubliclyListed: true, accountStatus: "active" })).toBe(true);
    expect(isVendorPromotionEligible({ isPubliclyListed: false, accountStatus: "active" })).toBe(false);
    expect(isVendorPromotionEligible({ isPubliclyListed: true, accountStatus: "suspended" })).toBe(false);
    expect(isVendorPromotionEligible({ isPubliclyListed: true, accountStatus: "pending_approval" })).toBe(false);
  });

  it("requires promoted services to be published under an eligible vendor", () => {
    const eligibleVendor = { isPubliclyListed: true, accountStatus: "active" };
    expect(isServicePromotionEligible({ isPublished: true, vendor: eligibleVendor })).toBe(true);
    expect(isServicePromotionEligible({ isPublished: false, vendor: eligibleVendor })).toBe(false);
    expect(
      isServicePromotionEligible({
        isPublished: true,
        vendor: { isPubliclyListed: true, accountStatus: "banned" },
      })
    ).toBe(false);
  });

  it("only renders active in-window campaigns with eligible services", () => {
    const now = new Date("2026-05-27T12:00:00.000Z");
    const eligibleService = {
      isPublished: true,
      vendor: { isPubliclyListed: true, accountStatus: "active" },
    };

    expect(
      isCampaignCurrentlyRenderable(
        {
          status: "active",
          paymentStatus: "paid",
          startAt: "2026-05-27T00:00:00.000Z",
          endAt: "2026-05-28T00:00:00.000Z",
          service: eligibleService,
        },
        now
      )
    ).toBe(true);

    expect(
      isCampaignCurrentlyRenderable(
        {
          status: "paused",
          paymentStatus: "paid",
          startAt: "2026-05-27T00:00:00.000Z",
          endAt: "2026-05-28T00:00:00.000Z",
          service: eligibleService,
        },
        now
      )
    ).toBe(false);

    expect(
      isCampaignCurrentlyRenderable(
        {
          status: "active",
          paymentStatus: "paid",
          startAt: "2026-05-27T00:00:00.000Z",
          endAt: "2026-05-28T00:00:00.000Z",
          service: {
            isPublished: true,
            vendor: { isPubliclyListed: true, accountStatus: "suspended" },
          },
        },
        now
      )
    ).toBe(false);
  });

  it("requires paid or waived payment before rendering", () => {
    const now = new Date("2026-05-27T12:00:00.000Z");
    const eligibleService = {
      isPublished: true,
      vendor: { isPubliclyListed: true, accountStatus: "active" },
    };

    expect(isPromotionPaymentAcceptable("paid")).toBe(true);
    expect(isPromotionPaymentAcceptable("waived")).toBe(true);
    expect(isPromotionPaymentAcceptable("pending_payment")).toBe(false);
    expect(doesPromotionPaymentNeedReference("paid")).toBe(true);
    expect(doesPromotionPaymentNeedReference("waived")).toBe(false);
    expect(doesPromotionPaymentNeedReference("pending_payment")).toBe(false);
    expect(
      isCampaignCurrentlyRenderable(
        {
          status: "active",
          paymentStatus: "pending_payment",
          startAt: "2026-05-27T00:00:00.000Z",
          endAt: "2026-05-28T00:00:00.000Z",
          service: eligibleService,
        },
        now
      )
    ).toBe(false);
  });

  it("uses clear public paid-placement disclosure copy", () => {
    expect(PROMOTION_PUBLIC_LABEL).toBe("Promoted");
    expect(PROMOTION_PUBLIC_EXPLAINER).toBe("Paid placement from an approved local provider.");
  });
});

describe("promoted listing inventory rules", () => {
  const candidates = [
    { serviceId: "svc-1", vendorId: "vendor-a" },
    { serviceId: "svc-2", vendorId: "vendor-a" },
    { serviceId: "svc-3", vendorId: "vendor-b" },
    { serviceId: "svc-4", vendorId: "vendor-c" },
  ];

  it("hides browse promotions when organic inventory is too thin", () => {
    expect(
      applyPromotionInventoryRules(candidates, {
        zone: "BROWSE_FEATURED",
        organicResultCount: 3,
      })
    ).toEqual([]);
  });

  it("caps browse promotions and prevents duplicate vendors per viewport", () => {
    expect(
      applyPromotionInventoryRules(candidates, {
        zone: "BROWSE_FEATURED",
        organicResultCount: 10,
      })
    ).toEqual([
      { serviceId: "svc-1", vendorId: "vendor-a" },
      { serviceId: "svc-3", vendorId: "vendor-b" },
    ]);
  });

  it("uses tighter category-filter browse limits", () => {
    expect(resolvePromotionZoneLimits("BROWSE_FEATURED", { hasCategoryFilter: true })).toEqual({
      maxSlots: 1,
      minOrganicResults: 3,
    });
  });
});

describe("promoted listing packages and radius", () => {
  it("normalizes target radius to supported package-safe options", () => {
    expect(normalizePromotionTargetRadiusMiles(10)).toBe(10);
    expect(normalizePromotionTargetRadiusMiles("20")).toBe(20);
    expect(normalizePromotionTargetRadiusMiles(25, 30)).toBe(30);
  });

  it("defines starter packages with concrete business rules", () => {
    expect(getPromotionPackageDefinition("browse-local-7-day")).toMatchObject({
      name: "7-day local spotlight",
      placementType: "BROWSE_FEATURED",
      durationDays: 7,
      maxRadiusMiles: 10,
      defaultPriceCents: 2900,
      isFoundingRate: true,
    });
    expect(getPromotionPackageDefinition("home-spotlight-7-day")).toMatchObject({
      placementType: "HOME_FEATURED",
      maxConcurrentInZone: 1,
      allowCategoryTargeting: false,
      isActive: false,
    });
  });

  it("captures campaign package snapshots with sold price and founding-rate context", () => {
    const packageDefinition = getPromotionPackageDefinition("browse-local-30-day");
    const snapshot = createPromotionPackageSnapshot(packageDefinition, {
      targetRadiusMiles: 30,
      priceCents: 7900,
    });

    expect(snapshot).toMatchObject({
      packageKey: "browse-local-30-day",
      name: "30-day local spotlight",
      placementType: "BROWSE_FEATURED",
      durationDays: 30,
      targetRadiusMiles: 30,
      priceCents: 7900,
      isFoundingRate: true,
      pricingLabel: "Founding / intro rate",
    });
    expect(parsePromotionPackageSnapshot(serializePromotionPackageSnapshot(snapshot))).toMatchObject(snapshot);
  });

  it("rejects package windows, categories, placements, and radius values outside package rules", () => {
    expect(
      validatePromotionPackageRules({
        packageKey: "home-spotlight-7-day",
        placementType: "BROWSE_FEATURED",
        startAt: "2026-05-27T00:00:00.000Z",
        endAt: "2026-05-28T00:00:00.000Z",
        targetRadiusMiles: 20,
      })
    ).toContain("HOME_FEATURED");
    expect(
      validatePromotionPackageRules({
        packageKey: "browse-local-7-day",
        placementType: "BROWSE_FEATURED",
        startAt: "2026-05-27T00:00:00.000Z",
        endAt: "2026-06-05T00:00:00.000Z",
        targetRadiusMiles: 10,
      })
    ).toContain("at most 7 days");
    expect(
      validatePromotionPackageRules({
        packageKey: "home-spotlight-7-day",
        placementType: "HOME_FEATURED",
        startAt: "2026-05-27T00:00:00.000Z",
        endAt: "2026-05-28T00:00:00.000Z",
        targetRadiusMiles: 20,
        targetCategory: "Deep Cleaning",
      })
    ).toBe(PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE);
  });

  it("applies campaign radius only when browse coordinates are available", () => {
    const campaign = {
      targetRadiusMiles: 10,
      service: {
        vendor: {
          latitude: 40.7128,
          longitude: -74.006,
          geocodedAt: new Date(),
        },
      },
    };

    expect(campaignMatchesTargetRadius(campaign, null)).toBe(true);
    expect(campaignMatchesTargetRadius(campaign, { latitude: 40.7306, longitude: -73.9352 })).toBe(true);
    expect(campaignMatchesTargetRadius(campaign, { latitude: 41.8781, longitude: -87.6298 })).toBe(false);
    expect(
      campaignMatchesTargetRadius(
        { targetRadiusMiles: 10, service: { vendor: { latitude: null, longitude: null, geocodedAt: null } } },
        { latitude: 40.7306, longitude: -73.9352 }
      )
    ).toBe(false);
  });
});
