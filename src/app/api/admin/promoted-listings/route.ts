import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";
import {
  createPromotionPackageSnapshot,
  doesPromotionPaymentNeedReference,
  doesPromotionReserveInventory,
  getPromotionPackageDefinition,
  getPromotionReservationLimit,
  isCampaignCurrentlyRenderable,
  isPromotionPaymentAcceptable,
  isPromotionPlacementLaunched,
  isServicePromotionEligible,
  isVendorPromotionEligible,
  normalizePromotionPackageKey,
  normalizePromotionPaymentStatus,
  normalizePromotionPlacementType,
  normalizePromotionStatus,
  normalizePromotionTargetRadiusMiles,
  parsePromotionPackageSnapshot,
  PROMOTION_PACKAGES,
  PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE,
  PROMOTION_PAYMENT_STATUSES,
  PROMOTION_TARGET_RADIUS_OPTIONS_MILES,
  PROMOTION_ZONE_INVENTORY,
  promotionEligibilityNote,
  serializePromotionPackageSnapshot,
  type PromotionPackageDefinition,
  validatePromotionPackageRules,
} from "@/lib/promoted-listings";
import { countablePromotionCampaignWhere } from "@/lib/metrics-exclusion";
import { getLatestPromotionReadinessAiStoredResults } from "@/lib/ai/promotion-readiness-review-store";
import {
  doesBrowseReadinessMeetCategoryFloor,
  getBrowsePromotionRenderReadiness,
  serializeBrowsePromotionRenderReadiness,
  type BrowsePromotionRenderReadiness,
} from "@/lib/promotion-browse-readiness";

const MUTABLE_STATUSES = new Set([
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
  "rejected",
  "expired",
  "cancelled",
]);
const MUTABLE_PAYMENT_STATUSES = new Set(PROMOTION_PAYMENT_STATUSES);

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown): Date | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMoneyCents(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed);
  }
  return Math.max(0, Math.round(fallback || 0));
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function toPromotionPackageDefinition(row: any): PromotionPackageDefinition {
  return {
    packageKey: String(row.packageKey),
    name: String(row.name),
    publicSummary: String(row.publicSummary || ""),
    adminDescription: String(row.adminDescription || ""),
    bestFor: String(row.bestFor || ""),
    placementExplanation: String(row.placementExplanation || ""),
    audience: String(row.audience || ""),
    placementType: normalizePromotionPlacementType(row.placementType),
    durationDays: Math.max(1, Math.round(Number(row.durationDays) || 1)),
    defaultRadiusMiles: normalizePromotionTargetRadiusMiles(row.defaultRadiusMiles),
    maxRadiusMiles: normalizePromotionTargetRadiusMiles(row.maxRadiusMiles),
    allowCategoryTargeting: row.allowCategoryTargeting === true,
    maxConcurrentInZone: Math.max(1, Math.round(Number(row.maxConcurrentInZone) || 1)),
    defaultPriceCents: normalizeMoneyCents(row.defaultPriceCents, 0),
    isActive:
      row.isActive === true && isPromotionPlacementLaunched(row.placementType),
    isFoundingRate: row.isFoundingRate === true,
    pricingLabel: String(row.pricingLabel || ""),
  };
}

async function ensurePromotionPackages(): Promise<PromotionPackageDefinition[]> {
  try {
    const existing = await (prisma as any).promotionPackage.findMany({
      orderBy: [{ isActive: "desc" }, { placementType: "asc" }, { durationDays: "asc" }, { packageKey: "asc" }],
    });
    if (existing.length) {
      return existing.map(toPromotionPackageDefinition);
    }

    for (const definition of PROMOTION_PACKAGES) {
      await (prisma as any).promotionPackage.upsert({
        where: { packageKey: definition.packageKey },
        update: {},
        create: {
          packageKey: definition.packageKey,
          name: definition.name,
          publicSummary: definition.publicSummary,
          adminDescription: definition.adminDescription,
          bestFor: definition.bestFor,
          placementExplanation: definition.placementExplanation,
          audience: definition.audience,
          placementType: definition.placementType,
          durationDays: definition.durationDays,
          defaultRadiusMiles: definition.defaultRadiusMiles,
          maxRadiusMiles: definition.maxRadiusMiles,
          allowCategoryTargeting: definition.allowCategoryTargeting,
          maxConcurrentInZone: definition.maxConcurrentInZone,
          defaultPriceCents: definition.defaultPriceCents,
          isActive: definition.isActive,
          isFoundingRate: definition.isFoundingRate,
          pricingLabel: definition.pricingLabel,
        },
      });
    }

    const seeded = await (prisma as any).promotionPackage.findMany({
      orderBy: [{ isActive: "desc" }, { placementType: "asc" }, { durationDays: "asc" }, { packageKey: "asc" }],
    });
    return seeded.map(toPromotionPackageDefinition);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (error?.code === "P2021" || message.includes("promotion_packages") || message.includes("PromotionPackage")) {
      return [...PROMOTION_PACKAGES];
    }
    throw error;
  }
}

function activePackages(packages: readonly PromotionPackageDefinition[]): PromotionPackageDefinition[] {
  const active = packages.filter((definition) => definition.isActive);
  return active.length ? active : [...PROMOTION_PACKAGES];
}

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

function resolveCampaignRenderabilityReason(
  campaign: any,
  options?: { browseReadiness?: BrowsePromotionRenderReadiness | null }
): string {
  const vendorEligible = isVendorPromotionEligible(campaign.vendor);
  if (!vendorEligible) {
    return "Vendor is not currently active and publicly listed.";
  }

  const serviceEligible = isServicePromotionEligible(campaign.service);
  if (!serviceEligible) {
    return "Service is not currently published under an eligible public vendor.";
  }

  const paymentEligible = isPromotionPaymentAcceptable(campaign.paymentStatus);
  if (!paymentEligible) {
    return "Payment must be marked paid or waived before this campaign can render publicly.";
  }

  if (normalizePromotionStatus(campaign.status) !== "active") {
    return "Campaign must be active before it can render publicly.";
  }

  const now = new Date();
  const startAt = campaign.startAt ? new Date(campaign.startAt) : null;
  const endAt = campaign.endAt ? new Date(campaign.endAt) : null;
  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return "Campaign timing is incomplete.";
  }
  if (startAt > now) {
    return "Campaign start date is still in the future.";
  }
  if (endAt < now) {
    return "Campaign window has already ended.";
  }

  const browseReadiness = options?.browseReadiness;
  if (
    normalizePromotionPlacementType(campaign.placementType) === "BROWSE_FEATURED" &&
    browseReadiness &&
    !browseReadiness.desktopBrowseEligible
  ) {
    if (
      normalizeString(campaign.targetCategory) &&
      doesBrowseReadinessMeetCategoryFloor(browseReadiness, campaign.targetCategory)
    ) {
      return `Suppressed on the full desktop browse page: ${browseReadiness.organicBrowseCount}/${browseReadiness.desktopMinimumOrganicCount} organic listings are live there, but this category-targeted campaign can still render inside eligible ${normalizeString(campaign.targetCategory)} browse results.`;
    }
    return `Suppressed by the current browse floor: ${browseReadiness.organicBrowseCount}/${browseReadiness.desktopMinimumOrganicCount} organic desktop listings available.`;
  }

  if (isCampaignCurrentlyRenderable(campaign)) {
    return "Campaign currently meets the public browse render rules.";
  }

  return promotionEligibilityNote();
}

function serializeCampaign(
  campaign: any,
  packages: readonly PromotionPackageDefinition[] = PROMOTION_PACKAGES,
  options?: { browseReadiness?: BrowsePromotionRenderReadiness | null }
) {
  const serviceEligible = isServicePromotionEligible(campaign.service);
  const vendorEligible = isVendorPromotionEligible(campaign.vendor);
  const paymentEligible = isPromotionPaymentAcceptable(campaign.paymentStatus);
  const renderable = isCampaignCurrentlyRenderable(campaign);
  const packageDefinition = getPromotionPackageDefinition(campaign.packageKey, packages);
  const packageSnapshot = parsePromotionPackageSnapshot(campaign.packageSnapshotJson);
  return {
    id: campaign.id,
    name: campaign.name,
    packageKey: campaign.packageKey,
    package: packageDefinition,
    packageSnapshot,
    packageSnapshotAt: serializeDate(campaign.packageSnapshotAt),
    placementType: campaign.placementType,
    status: campaign.status,
    paymentStatus: campaign.paymentStatus,
    startAt: serializeDate(campaign.startAt),
    endAt: serializeDate(campaign.endAt),
    targetCategory: campaign.targetCategory,
    targetCity: campaign.targetCity,
    targetState: campaign.targetState,
    targetZip: campaign.targetZip,
    targetRadiusMiles: campaign.targetRadiusMiles,
    rankPriority: campaign.rankPriority,
    adminNotes: campaign.adminNotes,
    amountDueCents: Number(campaign.amountDueCents || 0),
    stripePaymentLinkUrl: campaign.stripePaymentLinkUrl,
    paymentReference: campaign.paymentReference,
    paidAt: serializeDate(campaign.paidAt),
    paymentNotes: campaign.paymentNotes,
    approvedAt: serializeDate(campaign.approvedAt),
    pausedAt: serializeDate(campaign.pausedAt),
    endedAt: serializeDate(campaign.endedAt),
    createdAt: serializeDate(campaign.createdAt),
    updatedAt: serializeDate(campaign.updatedAt),
    vendor: campaign.vendor
      ? {
          id: campaign.vendor.id,
          name: campaign.vendor.businessName || campaign.vendor.name,
          businessName: campaign.vendor.businessName,
          accountStatus: campaign.vendor.accountStatus,
          isPubliclyListed: campaign.vendor.isPubliclyListed,
          category: campaign.vendor.category,
          city: campaign.vendor.city,
          state: campaign.vendor.state,
        }
      : null,
    service: campaign.service
      ? {
          id: campaign.service.id,
          name: campaign.service.name,
          isPublished: campaign.service.isPublished,
          price: Number(campaign.service.price),
        }
      : null,
    eligibility: {
      vendorEligible,
      serviceEligible,
      paymentEligible,
      renderable,
      note: resolveCampaignRenderabilityReason(campaign, options),
    },
  };
}

function resolveCampaignPackageForReporting(row: any, packages: readonly PromotionPackageDefinition[]) {
  const snapshot = parsePromotionPackageSnapshot(row.packageSnapshotJson);
  if (snapshot) {
    return {
      packageKey: snapshot.packageKey,
      name: snapshot.name,
      priceCents: snapshot.priceCents,
      isFoundingRate: snapshot.isFoundingRate,
    };
  }
  const definition = getPromotionPackageDefinition(row.packageKey, packages);
  return {
    packageKey: definition.packageKey,
    name: definition.name,
    priceCents: definition.defaultPriceCents,
    isFoundingRate: definition.isFoundingRate,
  };
}

function serializePromotionTracking(rows: any[], packages: readonly PromotionPackageDefinition[] = PROMOTION_PACKAGES) {
  const packageMap = new Map<string, { packageKey: string; name: string; count: number; revenueCents: number }>();
  const paidCampaigns = rows.filter((row) => row.paymentStatus === "paid");
  const pendingPaymentCampaigns = rows.filter((row) => row.paymentStatus === "pending_payment");
  const activeCampaigns = rows.filter((row) => row.status === "active");
  const campaignsWithPaymentLinks = rows.filter((row) => normalizeString(row.stripePaymentLinkUrl));

  for (const row of rows) {
    const packageDefinition = resolveCampaignPackageForReporting(row, packages);
    const current =
      packageMap.get(packageDefinition.packageKey) || {
        packageKey: packageDefinition.packageKey,
        name: packageDefinition.name,
        count: 0,
        revenueCents: 0,
      };
    current.count += 1;
    if (row.paymentStatus === "paid") {
      current.revenueCents += Number(row.amountDueCents || 0);
    }
    packageMap.set(packageDefinition.packageKey, current);
  }

  return {
    totalRevenueCents: paidCampaigns.reduce((sum, row) => sum + Number(row.amountDueCents || 0), 0),
    pendingPaymentCount: pendingPaymentCampaigns.length,
    pendingPaymentAmountCents: pendingPaymentCampaigns.reduce((sum, row) => sum + Number(row.amountDueCents || 0), 0),
    paymentLinkReadyCount: campaignsWithPaymentLinks.length,
    paidCampaignCount: paidCampaigns.length,
    activeCampaignCount: activeCampaigns.length,
    packagePerformance: Array.from(packageMap.values()).sort((a, b) => b.revenueCents - a.revenueCents || b.count - a.count),
    recentPaymentEvents: rows
      .filter((row) => ["pending_payment", "paid", "waived", "refunded"].includes(String(row.paymentStatus)))
      .sort((a, b) => {
        const aDate = new Date(a.paidAt || a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.paidAt || b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 10)
      .map((row) => ({
        ...(() => {
          const packageDefinition = resolveCampaignPackageForReporting(row, packages);
          return {
            packageKey: packageDefinition.packageKey,
            packageName: packageDefinition.name,
            packageIsFoundingRate: packageDefinition.isFoundingRate,
          };
        })(),
        id: row.id,
        name: row.name,
        paymentStatus: row.paymentStatus,
        amountDueCents: Number(row.amountDueCents || 0),
        paidAt: serializeDate(row.paidAt),
        paymentReference: row.paymentReference,
        stripePaymentLinkUrl: row.stripePaymentLinkUrl,
        vendorName: row.vendor?.businessName || row.vendor?.name || null,
        updatedAt: serializeDate(row.updatedAt),
      })),
  };
}

function serializeZoneOccupancy(rows: any[], now = new Date()) {
  const byZone = new Map<string, { current: number; reserved: number }>();
  for (const placementType of Object.keys(PROMOTION_ZONE_INVENTORY)) {
    byZone.set(placementType, { current: 0, reserved: 0 });
  }

  for (const row of rows) {
    const placementType = normalizePromotionPlacementType(row.placementType);
    const slot = byZone.get(placementType) || { current: 0, reserved: 0 };
    if (doesPromotionReserveInventory(row)) slot.reserved += 1;
    if (
      normalizePromotionStatus(row.status) === "active" &&
      isPromotionPaymentAcceptable(row.paymentStatus) &&
      row.startAt <= now &&
      row.endAt >= now
    ) {
      slot.current += 1;
    }
    byZone.set(placementType, slot);
  }

  return Object.entries(PROMOTION_ZONE_INVENTORY).map(([placementType, policy]) => ({
    placementType,
    current: byZone.get(placementType)?.current || 0,
    reserved: byZone.get(placementType)?.reserved || 0,
    maxReservableSlots: policy.maxSlotsDesktop,
    maxRenderableDesktop: policy.maxSlotsDesktop,
    maxRenderableMobile: policy.maxSlotsMobile,
  }));
}

async function getCurrentZoneOccupancy() {
  const now = new Date();
  const rows = await (prisma as any).promotionCampaign.findMany({
    where: countablePromotionCampaignWhere({
      status: { in: ["scheduled", "active"] },
      endAt: { gte: now },
    }),
    select: {
      placementType: true,
      status: true,
      paymentStatus: true,
      startAt: true,
      endAt: true,
    },
  });
  return serializeZoneOccupancy(rows, now);
}

async function getPromotionTracking(packages: readonly PromotionPackageDefinition[]) {
  const rows = await (prisma as any).promotionCampaign.findMany({
    where: countablePromotionCampaignWhere(),
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: {
      vendor: true,
    },
  });
  return serializePromotionTracking(rows, packages);
}

async function validateInventoryAvailability(input: {
  packageKey: string;
  placementType: string;
  status: string;
  startAt: Date;
  endAt: Date;
  excludeCampaignId?: string;
  packageDefinitions?: readonly PromotionPackageDefinition[];
}): Promise<string | null> {
  if (!doesPromotionReserveInventory({ status: input.status })) {
    return null;
  }

  const placementType = normalizePromotionPlacementType(input.placementType);
  const limit = getPromotionReservationLimit(input.packageKey, placementType, input.packageDefinitions);
  const overlappingCount = await (prisma as any).promotionCampaign.count({
    where: countablePromotionCampaignWhere({
      placementType,
      status: { in: ["scheduled", "active"] },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      ...(input.excludeCampaignId ? { id: { not: input.excludeCampaignId } } : {}),
    }),
  });

  if (overlappingCount >= limit) {
    return `${placementType} is full for that campaign window (${overlappingCount}/${limit} reserved).`;
  }
  return null;
}

async function getCampaignById(campaignId: string) {
  return (prisma as any).promotionCampaign.findUnique({
    where: { id: campaignId },
    include: {
      vendor: true,
      service: {
        include: {
          vendor: true,
        },
      },
    },
  });
}

async function validateVendorAndService(vendorId: string, serviceId: string | null) {
  const vendor = await (prisma as any).vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      businessName: true,
      isPubliclyListed: true,
      accountStatus: true,
      category: true,
      city: true,
      state: true,
    },
  });
  if (!vendor) {
    return { error: "Vendor not found", status: 404 as const };
  }
  if (!isVendorPromotionEligible(vendor)) {
    return {
      error: "Vendor is not eligible for promoted placement. Vendor must be active and publicly listed.",
      status: 422 as const,
    };
  }

  if (!serviceId) {
    return { vendor, service: null };
  }

  const service = await (prisma as any).service.findUnique({
    where: { id: serviceId },
    include: {
      vendor: true,
    },
  });
  if (!service) {
    return { error: "Service not found", status: 404 as const };
  }
  if (service.vendorId !== vendorId) {
    return { error: "Service does not belong to the selected vendor", status: 422 as const };
  }
  if (!isServicePromotionEligible(service)) {
    return {
      error: "Service is not eligible for promoted placement. Service must be published and its vendor must remain active and publicly listed.",
      status: 422 as const,
    };
  }

  return { vendor, service };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const status = normalizeString(searchParams.get("status")).toLowerCase();
    const placementType = normalizeString(searchParams.get("placementType")).toUpperCase();
    const q = normalizeString(searchParams.get("q"));
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 100);
    const packages = await ensurePromotionPackages();

    const where: Record<string, unknown> = countablePromotionCampaignWhere({
      ...(MUTABLE_STATUSES.has(status) ? { status } : {}),
      ...(placementType ? { placementType: normalizePromotionPlacementType(placementType) } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { name: { contains: q } },
              { vendorId: { contains: q } },
              { serviceId: { contains: q } },
              { vendor: { name: { contains: q } } },
              { vendor: { businessName: { contains: q } } },
              { service: { name: { contains: q } } },
            ],
          }
        : {}),
    });

    const [campaigns, occupancy, tracking, browseReadiness] = await Promise.all([
      (prisma as any).promotionCampaign.findMany({
      where,
      orderBy: [{ status: "asc" }, { rankPriority: "asc" }, { startAt: "desc" }],
      take: limit,
      include: {
        vendor: true,
        service: {
          include: {
            vendor: true,
          },
        },
      },
      }),
      getCurrentZoneOccupancy(),
      getPromotionTracking(packages),
      getBrowsePromotionRenderReadiness(),
    ]);

    const serializedCampaigns = campaigns.map((campaign: any) =>
      serializeCampaign(campaign, packages, { browseReadiness })
    );
    const aiRecommendationsByCampaignId =
      await getLatestPromotionReadinessAiStoredResults(
        serializedCampaigns.map((campaign: any) => String(campaign.id))
      );

    return NextResponse.json({
      success: true,
      campaigns: serializedCampaigns.map((campaign: any) => ({
        ...campaign,
        aiRecommendation:
          aiRecommendationsByCampaignId[String(campaign.id)] || null,
      })),
      meta: {
        eligibilityRule: promotionEligibilityNote(),
        packages,
        paymentStatuses: PROMOTION_PAYMENT_STATUSES,
        radiusOptionsMiles: PROMOTION_TARGET_RADIUS_OPTIONS_MILES,
        occupancy,
        tracking,
        browseReadiness: serializeBrowsePromotionRenderReadiness(browseReadiness),
        billing: "Stripe Payment Links are admin-recorded in Phase 2C; no live Stripe verification or webhook sync is active yet.",
      },
    });
  } catch (error: any) {
    console.error("[admin/promoted-listings] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json({ success: false, error: "Failed to fetch featured proof placements" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const vendorId = normalizeString(body?.vendorId);
    const serviceId = normalizeString(body?.serviceId);
    const name = normalizeString(body?.name);
    const requestedPackageKey = normalizeString(body?.packageKey);
    const startAt = parseDate(body?.startAt);
    const endAt = parseDate(body?.endAt);
    const status = normalizePromotionStatus(body?.status || "scheduled");
    const packages = await ensurePromotionPackages();
    const creatablePackages = activePackages(packages);
    const requestedPackageDefinition = requestedPackageKey
      ? packages.find((definition) => definition.packageKey === requestedPackageKey) || null
      : null;
    if (requestedPackageDefinition && !requestedPackageDefinition.isActive) {
      return NextResponse.json(
        { success: false, error: requestedPackageDefinition.placementType === "HOME_FEATURED" ? PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE : `${requestedPackageDefinition.name} is not available for new campaigns.` },
        { status: 422 }
      );
    }
    const packageKey = normalizePromotionPackageKey(body?.packageKey, creatablePackages);
    const packageDefinition = getPromotionPackageDefinition(packageKey, creatablePackages);
    const placementType = normalizePromotionPlacementType(body?.placementType || packageDefinition.placementType);
    const paymentStatus = normalizePromotionPaymentStatus(body?.paymentStatus || "pending_payment");
    const targetRadiusMiles = normalizePromotionTargetRadiusMiles(body?.targetRadiusMiles, packageDefinition.defaultRadiusMiles);
    const targetCategory = normalizeString(body?.targetCategory) || null;
    const amountDueCents = normalizeMoneyCents(body?.amountDueCents, packageDefinition.defaultPriceCents);
    const paymentReference = normalizeString(body?.paymentReference) || null;
    const paidAt = paymentStatus === "paid" ? parseDate(body?.paidAt) || new Date() : null;

    if (!vendorId || !serviceId || !name || !startAt || !endAt) {
      return NextResponse.json(
        { success: false, error: "vendorId, serviceId, name, startAt, and endAt are required" },
        { status: 400 }
      );
    }
    if (endAt <= startAt) {
      return NextResponse.json({ success: false, error: "endAt must be after startAt" }, { status: 422 });
    }
    if (!MUTABLE_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Unsupported campaign status" }, { status: 422 });
    }
    if (!MUTABLE_PAYMENT_STATUSES.has(paymentStatus)) {
      return NextResponse.json({ success: false, error: "Unsupported payment status" }, { status: 422 });
    }
    const packageError = validatePromotionPackageRules({
      packageKey,
      placementType,
      startAt,
      endAt,
      targetRadiusMiles,
      targetCategory,
      packageDefinitions: creatablePackages,
    });
    if (packageError) {
      return NextResponse.json({ success: false, error: packageError }, { status: 422 });
    }
    if (status === "active" && !isPromotionPaymentAcceptable(paymentStatus)) {
      return NextResponse.json(
        { success: false, error: "Active featured proof placements require paid or waived payment status." },
        { status: 422 }
      );
    }
    if (doesPromotionPaymentNeedReference(paymentStatus) && !paymentReference) {
      return NextResponse.json(
        { success: false, error: "Recording paid payment requires a Stripe payment reference." },
        { status: 422 }
      );
    }

    const validation = await validateVendorAndService(vendorId, serviceId);
    if ("error" in validation) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
    }
    const inventoryError = await validateInventoryAvailability({
      packageKey,
      placementType,
      status,
      startAt,
      endAt,
      packageDefinitions: creatablePackages,
    });
    if (inventoryError) {
      return NextResponse.json({ success: false, error: inventoryError }, { status: 409 });
    }

    const packageSnapshot = createPromotionPackageSnapshot(packageDefinition, {
      targetRadiusMiles,
      priceCents: amountDueCents,
    });
    const campaign = await (prisma as any).promotionCampaign.create({
      data: {
        vendorId,
        serviceId,
        name,
        packageKey,
        packageSnapshotJson: serializePromotionPackageSnapshot(packageSnapshot),
        packageSnapshotAt: new Date(),
        placementType,
        status,
        paymentStatus,
        startAt,
        endAt,
        targetCategory: packageDefinition.allowCategoryTargeting
          ? targetCategory || validation.vendor.category || null
          : null,
        targetCity: normalizeString(body?.targetCity) || validation.vendor.city || null,
        targetState: normalizeString(body?.targetState) || validation.vendor.state || null,
        targetZip: normalizeString(body?.targetZip) || null,
        targetRadiusMiles,
        rankPriority: Number.isFinite(Number(body?.rankPriority)) ? Number(body.rankPriority) : 100,
        adminNotes: normalizeString(body?.adminNotes) || null,
        amountDueCents,
        stripePaymentLinkUrl: normalizeString(body?.stripePaymentLinkUrl) || null,
        paymentReference,
        paidAt,
        paymentNotes: normalizeString(body?.paymentNotes) || null,
        createdByUserId: userId,
        approvedByUserId: status === "active" || status === "scheduled" ? userId : null,
        approvedAt: status === "active" || status === "scheduled" ? new Date() : null,
      },
    });

    await createAdminAuditLog({
      actionType: "PROMOTION_CAMPAIGN_CREATED",
      entityType: "promotion_campaign",
      entityId: campaign.id,
      actorUserId: userId,
      newValue: {
        vendorId,
        serviceId,
        name,
        packageKey,
        packageSnapshot,
        placementType: campaign.placementType,
        status: campaign.status,
        paymentStatus: campaign.paymentStatus,
        amountDueCents: campaign.amountDueCents,
        stripePaymentLinkUrl: campaign.stripePaymentLinkUrl,
        paymentReference: campaign.paymentReference,
        paidAt: serializeDate(campaign.paidAt),
        targetRadiusMiles: campaign.targetRadiusMiles,
        startAt: campaign.startAt.toISOString(),
        endAt: campaign.endAt.toISOString(),
      },
      metadata: { source: "POST /api/admin/promoted-listings" },
    });

    const hydrated = await getCampaignById(campaign.id);
    return NextResponse.json({ success: true, campaign: serializeCampaign(hydrated, packages) }, { status: 201 });
  } catch (error: any) {
    console.error("[admin/promoted-listings] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json({ success: false, error: "Failed to create featured proof placement" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    if (body?.entityType === "promotion_package") {
      const packageKey = normalizeString(body?.packageKey);
      if (!packageKey) {
        return NextResponse.json({ success: false, error: "packageKey is required" }, { status: 400 });
      }

      const packages = await ensurePromotionPackages();
      const existingDefinition = packages.find((definition) => definition.packageKey === packageKey);
      if (!existingDefinition) {
        return NextResponse.json({ success: false, error: "Promotion package not found" }, { status: 404 });
      }

      const nextPlacementType = normalizePromotionPlacementType(body?.placementType || existingDefinition.placementType);
      const nextDefaultRadiusMiles = normalizePromotionTargetRadiusMiles(
        body?.defaultRadiusMiles,
        existingDefinition.defaultRadiusMiles
      );
      const nextMaxRadiusMiles = normalizePromotionTargetRadiusMiles(body?.maxRadiusMiles, existingDefinition.maxRadiusMiles);
      if (nextDefaultRadiusMiles > nextMaxRadiusMiles) {
        return NextResponse.json(
          { success: false, error: "Default radius cannot exceed maximum radius" },
          { status: 422 }
        );
      }

      const data = {
        name: normalizeString(body?.name) || existingDefinition.name,
        publicSummary: normalizeString(body?.publicSummary) || existingDefinition.publicSummary,
        adminDescription: normalizeString(body?.adminDescription) || existingDefinition.adminDescription,
        bestFor: normalizeString(body?.bestFor) || existingDefinition.bestFor,
        placementExplanation: normalizeString(body?.placementExplanation) || existingDefinition.placementExplanation,
        audience: normalizeString(body?.audience) || existingDefinition.audience,
        placementType: nextPlacementType,
        durationDays: Math.max(1, Math.round(Number(body?.durationDays) || existingDefinition.durationDays)),
        defaultRadiusMiles: nextDefaultRadiusMiles,
        maxRadiusMiles: nextMaxRadiusMiles,
        allowCategoryTargeting: normalizeBoolean(body?.allowCategoryTargeting, existingDefinition.allowCategoryTargeting),
        maxConcurrentInZone: Math.max(1, Math.round(Number(body?.maxConcurrentInZone) || existingDefinition.maxConcurrentInZone)),
        defaultPriceCents: normalizeMoneyCents(body?.defaultPriceCents, existingDefinition.defaultPriceCents),
        isActive:
          isPromotionPlacementLaunched(nextPlacementType) &&
          normalizeBoolean(body?.isActive, existingDefinition.isActive),
        isFoundingRate: normalizeBoolean(body?.isFoundingRate, existingDefinition.isFoundingRate),
        pricingLabel: normalizeString(body?.pricingLabel) || (normalizeBoolean(body?.isFoundingRate, existingDefinition.isFoundingRate) ? "Founding / intro rate" : ""),
      };

      if (!isPromotionPlacementLaunched(nextPlacementType) && normalizeBoolean(body?.isActive, existingDefinition.isActive)) {
        return NextResponse.json(
          { success: false, error: PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE },
          { status: 422 }
        );
      }

      const updated = await (prisma as any).promotionPackage.update({
        where: { packageKey },
        data,
      });

      await createAdminAuditLog({
        actionType: "PROMOTION_PACKAGE_UPDATED",
        entityType: "promotion_package",
        entityId: packageKey,
        actorUserId: userId,
        previousValue: existingDefinition as unknown as Record<string, unknown>,
        newValue: toPromotionPackageDefinition(updated) as unknown as Record<string, unknown>,
        metadata: { source: "PATCH /api/admin/promoted-listings" },
      });

      const refreshedPackages = await ensurePromotionPackages();
      return NextResponse.json({
        success: true,
        package: toPromotionPackageDefinition(updated),
        packages: refreshedPackages,
      });
    }

    const campaignId = normalizeString(body?.campaignId);
    if (!campaignId) {
      return NextResponse.json({ success: false, error: "campaignId is required" }, { status: 400 });
    }

    const existing = await getCampaignById(campaignId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Promotion campaign not found" }, { status: 404 });
    }
    const packages = await ensurePromotionPackages();
    const campaignPackages = activePackages(packages);

    const nextVendorId = normalizeString(body?.vendorId) || existing.vendorId;
    const nextServiceId = Object.prototype.hasOwnProperty.call(body, "serviceId")
      ? normalizeString(body?.serviceId)
      : existing.serviceId;
    const nextStatus = Object.prototype.hasOwnProperty.call(body, "status")
      ? normalizePromotionStatus(body?.status)
      : existing.status;
    const nextPaymentStatus = Object.prototype.hasOwnProperty.call(body, "paymentStatus")
      ? normalizePromotionPaymentStatus(body?.paymentStatus)
      : normalizePromotionPaymentStatus(existing.paymentStatus);
    const requestedNextPackageKey = Object.prototype.hasOwnProperty.call(body, "packageKey")
      ? normalizeString(body?.packageKey)
      : "";
    const requestedNextPackageDefinition = requestedNextPackageKey
      ? packages.find((definition) => definition.packageKey === requestedNextPackageKey) || null
      : null;
    if (requestedNextPackageDefinition && !requestedNextPackageDefinition.isActive) {
      return NextResponse.json(
        { success: false, error: requestedNextPackageDefinition.placementType === "HOME_FEATURED" ? PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE : `${requestedNextPackageDefinition.name} is not available for new campaigns.` },
        { status: 422 }
      );
    }
    const nextPackageKey = Object.prototype.hasOwnProperty.call(body, "packageKey")
      ? normalizePromotionPackageKey(body?.packageKey, campaignPackages)
      : normalizePromotionPackageKey(existing.packageKey, packages);
    const nextPackageDefinition = getPromotionPackageDefinition(nextPackageKey, packages);
    const nextPlacementType = Object.prototype.hasOwnProperty.call(body, "placementType")
      ? normalizePromotionPlacementType(body?.placementType)
      : normalizePromotionPlacementType(existing.placementType || nextPackageDefinition.placementType);
    const nextStartAt = Object.prototype.hasOwnProperty.call(body, "startAt") ? parseDate(body?.startAt) : existing.startAt;
    const nextEndAt = Object.prototype.hasOwnProperty.call(body, "endAt") ? parseDate(body?.endAt) : existing.endAt;
    const nextTargetRadiusMiles = Object.prototype.hasOwnProperty.call(body, "targetRadiusMiles")
      ? normalizePromotionTargetRadiusMiles(body?.targetRadiusMiles, nextPackageDefinition.defaultRadiusMiles)
      : normalizePromotionTargetRadiusMiles(existing.targetRadiusMiles, nextPackageDefinition.defaultRadiusMiles);
    const nextTargetCategory = Object.prototype.hasOwnProperty.call(body, "targetCategory")
      ? normalizeString(body?.targetCategory) || null
      : existing.targetCategory;
    const nextAmountDueCents = Object.prototype.hasOwnProperty.call(body, "amountDueCents")
      ? normalizeMoneyCents(body?.amountDueCents, nextPackageDefinition.defaultPriceCents)
      : Object.prototype.hasOwnProperty.call(body, "packageKey")
        ? nextPackageDefinition.defaultPriceCents
        : Number(existing.amountDueCents || nextPackageDefinition.defaultPriceCents || 0);
    const nextPaymentReference = Object.prototype.hasOwnProperty.call(body, "paymentReference")
      ? normalizeString(body?.paymentReference)
      : normalizeString(existing.paymentReference);

    if (!nextStartAt || !nextEndAt || nextEndAt <= nextStartAt) {
      return NextResponse.json({ success: false, error: "A valid startAt/endAt window is required" }, { status: 422 });
    }
    if (!MUTABLE_STATUSES.has(nextStatus)) {
      return NextResponse.json({ success: false, error: "Unsupported campaign status" }, { status: 422 });
    }
    if (!MUTABLE_PAYMENT_STATUSES.has(nextPaymentStatus)) {
      return NextResponse.json({ success: false, error: "Unsupported payment status" }, { status: 422 });
    }
    const packageError = validatePromotionPackageRules({
      packageKey: nextPackageKey,
      placementType: nextPlacementType,
      startAt: nextStartAt,
      endAt: nextEndAt,
      targetRadiusMiles: nextTargetRadiusMiles,
      targetCategory: nextTargetCategory,
      packageDefinitions: packages,
    });
    if (packageError) {
      return NextResponse.json({ success: false, error: packageError }, { status: 422 });
    }
    if (nextStatus === "active" && !isPromotionPaymentAcceptable(nextPaymentStatus)) {
      return NextResponse.json(
        { success: false, error: "Active featured proof placements require paid or waived payment status." },
        { status: 422 }
      );
    }
    if (doesPromotionPaymentNeedReference(nextPaymentStatus) && !nextPaymentReference) {
      return NextResponse.json(
        { success: false, error: "Recording paid payment requires a Stripe payment reference." },
        { status: 422 }
      );
    }

    if (nextStatus === "active" || nextStatus === "scheduled") {
      const validation = await validateVendorAndService(nextVendorId, nextServiceId || null);
      if ("error" in validation) {
        return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
      }
      const inventoryError = await validateInventoryAvailability({
        packageKey: nextPackageKey,
        placementType: nextPlacementType,
        status: nextStatus,
        startAt: nextStartAt,
        endAt: nextEndAt,
        excludeCampaignId: campaignId,
        packageDefinitions: packages,
      });
      if (inventoryError) {
        return NextResponse.json({ success: false, error: inventoryError }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {
      vendorId: nextVendorId,
      serviceId: nextServiceId || null,
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
      packageKey: nextPackageKey,
      packageSnapshotJson: serializePromotionPackageSnapshot(
        createPromotionPackageSnapshot(nextPackageDefinition, {
          targetRadiusMiles: nextTargetRadiusMiles,
          priceCents: nextAmountDueCents,
        })
      ),
      packageSnapshotAt: new Date(),
      placementType: nextPlacementType,
      amountDueCents: nextAmountDueCents,
      targetRadiusMiles: nextTargetRadiusMiles,
      startAt: nextStartAt,
      endAt: nextEndAt,
      ...(Object.prototype.hasOwnProperty.call(body, "name") ? { name: normalizeString(body?.name) || existing.name } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "targetCategory")
        ? { targetCategory: normalizeString(body?.targetCategory) || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "targetCity")
        ? { targetCity: normalizeString(body?.targetCity) || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "targetState")
        ? { targetState: normalizeString(body?.targetState) || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "targetZip")
        ? { targetZip: normalizeString(body?.targetZip) || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "rankPriority") && Number.isFinite(Number(body?.rankPriority))
        ? { rankPriority: Number(body.rankPriority) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "adminNotes")
        ? { adminNotes: normalizeString(body?.adminNotes) || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "stripePaymentLinkUrl")
        ? { stripePaymentLinkUrl: normalizeString(body?.stripePaymentLinkUrl) || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "paymentReference")
        ? { paymentReference: nextPaymentReference || null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "paymentNotes")
        ? { paymentNotes: normalizeString(body?.paymentNotes) || null }
        : {}),
    };

    if (nextPaymentStatus === "paid" && existing.paymentStatus !== "paid") {
      data.paidAt = parseDate(body?.paidAt) || new Date();
    }
    if (nextPaymentStatus !== "paid" && existing.paymentStatus === "paid") {
      data.paidAt = null;
    }

    if ((nextStatus === "active" || nextStatus === "scheduled") && existing.status !== nextStatus) {
      data.approvedByUserId = userId;
      data.approvedAt = new Date();
      data.pausedAt = null;
      data.endedAt = null;
    }
    if (nextStatus === "paused" && existing.status !== "paused") {
      data.pausedAt = new Date();
    }
    if ((nextStatus === "ended" || nextStatus === "expired" || nextStatus === "cancelled") && existing.status !== nextStatus) {
      data.endedAt = new Date();
    }

    const updated = await (prisma as any).promotionCampaign.update({
      where: { id: campaignId },
      data,
    });

    await createAdminAuditLog({
      actionType: "PROMOTION_CAMPAIGN_UPDATED",
      entityType: "promotion_campaign",
      entityId: campaignId,
      actorUserId: userId,
      previousValue: {
        status: existing.status,
        paymentStatus: existing.paymentStatus,
        amountDueCents: existing.amountDueCents,
        stripePaymentLinkUrl: existing.stripePaymentLinkUrl,
        paymentReference: existing.paymentReference,
        paidAt: serializeDate(existing.paidAt),
        packageKey: existing.packageKey,
        packageSnapshot: parsePromotionPackageSnapshot(existing.packageSnapshotJson),
        placementType: existing.placementType,
        targetRadiusMiles: existing.targetRadiusMiles,
        startAt: serializeDate(existing.startAt),
        endAt: serializeDate(existing.endAt),
        vendorId: existing.vendorId,
        serviceId: existing.serviceId,
      },
      newValue: {
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        amountDueCents: updated.amountDueCents,
        stripePaymentLinkUrl: updated.stripePaymentLinkUrl,
        paymentReference: updated.paymentReference,
        paidAt: serializeDate(updated.paidAt),
        packageKey: updated.packageKey,
        packageSnapshot: parsePromotionPackageSnapshot(updated.packageSnapshotJson),
        placementType: updated.placementType,
        targetRadiusMiles: updated.targetRadiusMiles,
        startAt: serializeDate(updated.startAt),
        endAt: serializeDate(updated.endAt),
        vendorId: updated.vendorId,
        serviceId: updated.serviceId,
      },
      metadata: { source: "PATCH /api/admin/promoted-listings" },
    });

    const hydrated = await getCampaignById(campaignId);
    return NextResponse.json({ success: true, campaign: serializeCampaign(hydrated, packages) });
  } catch (error: any) {
    console.error("[admin/promoted-listings] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json({ success: false, error: "Failed to update featured proof placement" }, { status: 500 });
  }
}
