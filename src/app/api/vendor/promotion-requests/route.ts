import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { createAdminNotificationWithEmail } from "@/lib/admin-notifications";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import {
  createPromotionPackageSnapshot,
  getPromotionPackageDefinition,
  isPromotionPlacementLaunched,
  isServicePromotionEligible,
  normalizePromotionPackageKey,
  normalizePromotionPlacementType,
  normalizePromotionTargetRadiusMiles,
  PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE,
  PROMOTION_PACKAGES,
  serializePromotionPackageSnapshot,
  type PromotionPackageDefinition,
} from "@/lib/promoted-listings";
import { requireVerifiedEmailForAction } from "@/lib/email-verification-enforcement";
import {
  getBrowsePromotionRenderReadiness,
  serializeBrowsePromotionRenderReadiness,
} from "@/lib/promotion-browse-readiness";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoneyCents(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : Math.max(0, Math.round(fallback || 0));
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
    isActive: row.isActive === true && isPromotionPlacementLaunched(row.placementType),
    isFoundingRate: row.isFoundingRate === true,
    pricingLabel: String(row.pricingLabel || ""),
  };
}

async function getActivePackages(): Promise<PromotionPackageDefinition[]> {
  try {
    const rows = await (prisma as any).promotionPackage.findMany({
      where: { isActive: true },
      orderBy: [{ placementType: "asc" }, { durationDays: "asc" }, { packageKey: "asc" }],
    });
    const active = rows
      .map(toPromotionPackageDefinition)
      .filter((definition: PromotionPackageDefinition) => definition.isActive);
    return active.length
      ? active
      : [...PROMOTION_PACKAGES].filter((definition) => definition.isActive);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (error?.code === "P2021" || message.includes("promotion_packages") || message.includes("PromotionPackage")) {
      return [...PROMOTION_PACKAGES].filter((definition) => definition.isActive);
    }
    throw error;
  }
}

function serializePackage(definition: PromotionPackageDefinition) {
  return {
    packageKey: definition.packageKey,
    name: definition.name,
    publicSummary: definition.publicSummary,
    bestFor: definition.bestFor,
    placementExplanation: definition.placementExplanation,
    audience: definition.audience,
    placementType: definition.placementType,
    durationDays: definition.durationDays,
    defaultRadiusMiles: definition.defaultRadiusMiles,
    maxRadiusMiles: definition.maxRadiusMiles,
    allowCategoryTargeting: definition.allowCategoryTargeting,
    defaultPriceCents: definition.defaultPriceCents,
    isFoundingRate: definition.isFoundingRate,
    pricingLabel: definition.pricingLabel,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatAdminNotes(input: {
  businessName: string;
  packageName: string;
  serviceName: string;
  campaignGoal: string;
  preferredCategory: string;
  preferredStartDate: string;
  targetRadiusMiles: number;
  vendorNote: string;
  requestedByUserId: string;
}) {
  const rows = [
    "Vendor promotion request submitted from vendor dashboard.",
    `Business: ${input.businessName || "Unknown vendor"}`,
    `Requested package: ${input.packageName}`,
    `Requested service: ${input.serviceName}`,
    `Campaign goal: ${input.campaignGoal || "Not provided"}`,
    `Preferred category: ${input.preferredCategory || "Admin to confirm"}`,
    `Preferred start date: ${input.preferredStartDate || "Admin to confirm"}`,
    `Requested radius: ${input.targetRadiusMiles} miles`,
    `Vendor note: ${input.vendorNote || "None"}`,
    `Requested by user: ${input.requestedByUserId}`,
    "Admin must confirm eligibility, package, date/radius, Stripe Payment Link, payment, and activation.",
  ];
  return rows.join("\n");
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = normalizeString(searchParams.get("vendorId"));
    if (!vendorId) {
      return NextResponse.json({ success: false, error: "vendorId is required" }, { status: 400 });
    }

    await requireVendorMembership(request, vendorId);
    const [packages, services, recentRequests, browseReadiness] = await Promise.all([
      getActivePackages(),
      (prisma as any).service.findMany({
        where: { vendorId },
        select: { id: true, name: true, isPublished: true },
        orderBy: { name: "asc" },
      }),
      (prisma as any).promotionCampaign.findMany({
        where: { vendorId },
        select: { id: true, name: true, status: true, paymentStatus: true, createdAt: true, packageKey: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      getBrowsePromotionRenderReadiness(),
    ]);

    return NextResponse.json({
      success: true,
      status: "awaiting_admin_review",
      packages: packages.map(serializePackage),
      services: services.map((service: any) => ({
        id: service.id,
        name: service.name,
        isPublished: service.isPublished === true,
      })),
      recentRequests: recentRequests.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        paymentStatus: campaign.paymentStatus,
        packageKey: campaign.packageKey,
        createdAt: campaign.createdAt?.toISOString?.() || null,
      })),
      launchAvailabilityNote:
        "Only currently live promoted placements are requestable here. Homepage spotlight inventory will appear after the public homepage rollout is launched.",
      browseReadiness: serializeBrowsePromotionRenderReadiness(browseReadiness),
      adminControlNote:
        "Submitting a request creates an unpaid draft for admin review. Reliance admin confirms eligibility, payment link, payment, and activation.",
    });
  } catch (error: any) {
    console.error("[vendor/promotion-requests] GET error:", error);
    const message = String(error?.message || "Failed to load promotion request options");
    const status = message === "Unauthorized" ? 401 : message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const vendorId = normalizeString(body?.vendorId);
    const serviceId = normalizeString(body?.serviceId);
    const requestedPackageKey = normalizeString(body?.packageKey);
    const campaignGoal = normalizeString(body?.campaignGoal);
    const vendorNote = normalizeString(body?.note);
    const preferredCategory = normalizeString(body?.preferredCategory);
    const preferredStartDate = normalizeString(body?.preferredStartDate);

    if (!vendorId || !serviceId) {
      return NextResponse.json({ success: false, error: "vendorId and serviceId are required" }, { status: 400 });
    }

    const membership = await requireVendorManager(request, vendorId);
    const verificationGate = await requireVerifiedEmailForAction({
      userId: membership.userId,
      action: "submit_promotion_request",
    });
    if (verificationGate) {
      return verificationGate;
    }
    const packages = await getActivePackages();
    const requestedPackageDefinition = requestedPackageKey
      ? packages.find((definition) => definition.packageKey === requestedPackageKey) || null
      : null;
    if (requestedPackageKey && !requestedPackageDefinition) {
      const allKnownPackages = [...PROMOTION_PACKAGES];
      const blockedDefinition =
        allKnownPackages.find((definition) => definition.packageKey === requestedPackageKey) || null;
      return NextResponse.json(
        {
          success: false,
          error:
            blockedDefinition?.placementType === "HOME_FEATURED"
              ? PROMOTION_HOME_LAUNCH_BLOCK_MESSAGE
              : "That promotion package is not available for vendor requests.",
        },
        { status: 422 }
      );
    }
    const packageKey = normalizePromotionPackageKey(body?.packageKey, packages);
    const packageDefinition = getPromotionPackageDefinition(packageKey, packages);
    const targetRadiusMiles = Math.min(
      normalizePromotionTargetRadiusMiles(body?.targetRadiusMiles, packageDefinition.defaultRadiusMiles),
      packageDefinition.maxRadiusMiles
    );

    const vendor = await (prisma as any).vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        businessName: true,
        category: true,
        city: true,
        state: true,
        isPubliclyListed: true,
        accountStatus: true,
      },
    });
    const service = await (prisma as any).service.findFirst({
      where: { id: serviceId, vendorId },
      select: {
        id: true,
        name: true,
        isPublished: true,
        vendor: { select: { isPubliclyListed: true, accountStatus: true } },
      },
    });

    if (!vendor || !service) {
      return NextResponse.json({ success: false, error: "Vendor service was not found" }, { status: 404 });
    }
    if (!isServicePromotionEligible(service)) {
      return NextResponse.json(
        {
          success: false,
          error: "Promoted placement requests require a published service under an active, publicly listed vendor.",
        },
        { status: 422 }
      );
    }

    const now = new Date();
    const requestedStart = preferredStartDate ? new Date(`${preferredStartDate}T00:00:00.000Z`) : null;
    const startAt = requestedStart && !Number.isNaN(requestedStart.getTime()) ? requestedStart : now;
    const endAt = addDays(startAt, packageDefinition.durationDays);
    const packageSnapshot = createPromotionPackageSnapshot(packageDefinition, {
      targetRadiusMiles,
      priceCents: packageDefinition.defaultPriceCents,
    });
    const businessName = String(vendor.businessName || vendor.name || "Vendor");
    const adminNotes = formatAdminNotes({
      businessName,
      packageName: packageDefinition.name,
      serviceName: String(service.name || "Selected service"),
      campaignGoal,
      preferredCategory,
      preferredStartDate,
      targetRadiusMiles,
      vendorNote,
      requestedByUserId: membership.userId,
    });

    const campaign = await (prisma as any).promotionCampaign.create({
      data: {
        vendorId,
        serviceId,
        name: `Promotion request - ${businessName}`,
        packageKey,
        packageSnapshotJson: serializePromotionPackageSnapshot(packageSnapshot),
        packageSnapshotAt: now,
        placementType: packageDefinition.placementType,
        status: "draft",
        paymentStatus: "not_started",
        startAt,
        endAt,
        targetCategory: packageDefinition.allowCategoryTargeting
          ? preferredCategory || vendor.category || null
          : null,
        targetCity: vendor.city || null,
        targetState: vendor.state || null,
        targetRadiusMiles,
        rankPriority: 100,
        adminNotes,
        amountDueCents: packageDefinition.defaultPriceCents,
        createdByUserId: membership.userId,
      },
    });

    await createAdminNotificationWithEmail({
      vendorId,
      type: "PROMOTION_REQUEST",
      title: "Vendor promotion request",
      message: `${businessName} requested admin review for ${packageDefinition.name}.`,
      metadata: {
        promotionCampaignId: campaign.id,
        packageKey,
        serviceId,
        packageName: packageDefinition.name,
        source: "POST /api/vendor/promotion-requests",
      },
      surfaceHref: "/admin/promoted-listings",
      baseUrl: new URL(request.url).origin,
      actorUserId: membership.userId,
    });

    await createAdminAuditLog({
      actionType: "PROMOTION_REQUEST_SUBMITTED",
      entityType: "promotion_campaign",
      entityId: campaign.id,
      actorUserId: membership.userId,
      newValue: {
        vendorId,
        serviceId,
        packageKey,
        status: campaign.status,
        paymentStatus: campaign.paymentStatus,
        targetRadiusMiles,
        amountDueCents: campaign.amountDueCents,
      },
      metadata: { source: "POST /api/vendor/promotion-requests" },
    });

    return NextResponse.json(
      {
        success: true,
        status: "request_submitted",
        message: "Promotion request submitted. Reliance admin will review eligibility and follow up before payment or activation.",
        campaign: {
          id: campaign.id,
          status: campaign.status,
          paymentStatus: campaign.paymentStatus,
          packageKey: campaign.packageKey,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[vendor/promotion-requests] POST error:", error);
    const message = String(error?.message || "Failed to submit promotion request");
    const status = message === "Unauthorized" ? 401 : message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
