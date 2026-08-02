import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from "@/lib/proof-media-policy";
import { buildProofCard, rankProofFirstResults, type ProofStageAvailability } from "@/lib/proof-card";
import { buildProofCardDemoDiscoverResponse } from "@/lib/proof-card-demo-fixtures";
import { resolveVendorJobVideoStageFromSession } from "@/lib/vendor-job-video-stages";
import { getGeocodingProvider } from "@/lib/geocoding";
import { distanceMiles, hasValidCoordinates, roundDistanceMiles, type Coordinates } from "@/lib/distance";
import {
  applyPromotionInventoryRules,
  campaignMatchesTargetRadius,
  isCampaignCurrentlyRenderable,
  PROMOTION_PUBLIC_EXPLAINER,
  PROMOTION_PUBLIC_LABEL,
} from "@/lib/promoted-listings";
import {
  countableMediaAssetWhere,
  countablePromotionCampaignWhere,
  countableServiceWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";
import {
  buildPublicTrustEvidenceSummary,
  buildPublicTrustPresentationSummary,
} from "@/lib/public-trust-score-presentation";
import { cleanPublicServiceDescription } from "@/lib/launch-content-cleanup";
import { getBusinessHoursStatus } from "@/lib/business-hours";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const FALLBACK_CATEGORY_LABEL = "Other Services";
const FALLBACK_CATEGORY_KEY = "other-services";
const LEGACY_FALLBACK_CATEGORY_LABEL = "Uncategorized";

type SortBy = "newest" | "price_asc" | "price_desc" | "name" | "distance";
type LocationInputSource = "none" | "coordinates" | "address";

function normalizeSortBy(value: string | null): SortBy {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "price_asc") return "price_asc";
  if (normalized === "price_desc") return "price_desc";
  if (normalized === "name") return "name";
  if (normalized === "distance") return "distance";
  return "newest";
}

function normalizeCategoryFilter(value: string | null): string {
  return String(value || "").trim();
}

function isFallbackCategoryFilter(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === FALLBACK_CATEGORY_LABEL.toLowerCase() ||
    normalized === FALLBACK_CATEGORY_KEY ||
    normalized === LEGACY_FALLBACK_CATEGORY_LABEL.toLowerCase()
  );
}

function buildServiceCategoryFilter(category: string) {
  if (isFallbackCategoryFilter(category)) {
    return {
      OR: [
        { vendor: { category: FALLBACK_CATEGORY_LABEL } },
        { vendor: { businessType: FALLBACK_CATEGORY_LABEL } },
        { vendor: { category: LEGACY_FALLBACK_CATEGORY_LABEL } },
        { vendor: { businessType: LEGACY_FALLBACK_CATEGORY_LABEL } },
        { vendor: { category: null, businessType: null } },
        { vendor: { category: "", businessType: null } },
        { vendor: { category: null, businessType: "" } },
        { vendor: { category: "", businessType: "" } },
      ],
    };
  }

  return {
    OR: [{ vendor: { category } }, { vendor: { businessType: category } }],
  };
}

function buildPromotionCategoryFilter(category: string) {
  if (isFallbackCategoryFilter(category)) {
    return {
      OR: [
        { targetCategory: null },
        { targetCategory: "" },
        { targetCategory: FALLBACK_CATEGORY_LABEL },
        { targetCategory: LEGACY_FALLBACK_CATEGORY_LABEL },
        { service: { vendor: { category: FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { businessType: FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { category: LEGACY_FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { businessType: LEGACY_FALLBACK_CATEGORY_LABEL } } },
        { service: { vendor: { category: null, businessType: null } } },
        { service: { vendor: { category: "", businessType: null } } },
        { service: { vendor: { category: null, businessType: "" } } },
        { service: { vendor: { category: "", businessType: "" } } },
      ],
    };
  }

  return {
    OR: [
      { targetCategory: null },
      { targetCategory: "" },
      { targetCategory: category },
      { service: { vendor: { category } } },
      { service: { vendor: { businessType: category } } },
    ],
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    const category = normalizeCategoryFilter(searchParams.get("category"));
    const sortBy = normalizeSortBy(searchParams.get("sortBy"));
    const latitude = parseOptionalNumber(searchParams.get("lat"));
    const longitude = parseOptionalNumber(searchParams.get("lng"));
    const zipCode = String(searchParams.get("zipCode") || "").trim();
    const radiusMiles = parseOptionalNumber(searchParams.get("radiusMiles"));
    const requestedOnlyCompletedPublicProof = parseBooleanQuery(searchParams.get("onlyCompletedPublicProof"));
    const requireCompletedPublicProof = true;
    const origin: Coordinates | null =
      latitude != null && longitude != null ? { latitude, longitude } : null;
    const locationInputSource: LocationInputSource =
      origin ? "coordinates" : zipCode ? "address" : "none";
    const distanceSortRequested = sortBy === "distance";
    const radiusFilterRequested = radiusMiles != null && radiusMiles > 0;
    const distanceProcessingRequested = Boolean(origin && (distanceSortRequested || radiusFilterRequested));
    const page = Math.max(parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const skip = (page - 1) * limit;
    const proofFirstRankingRequested = sortBy === "newest" && !distanceProcessingRequested;
    const sourceTake = proofFirstRankingRequested || requireCompletedPublicProof
      ? Math.min(Math.max(skip + limit, limit * 4, 36), 100)
      : limit;
    const sourceSkip = proofFirstRankingRequested || requireCompletedPublicProof ? 0 : skip;
    const proofDemoMode =
      process.env.NODE_ENV !== "production" && String(searchParams.get("proofDemo") || "") === "1";

    if (proofDemoMode) {
      return NextResponse.json(
        buildProofCardDemoDiscoverResponse({
          q,
          category,
          sortBy,
          page,
          limit,
        })
      );
    }

    const where: any = countableServiceWhere({
      isPublished: true,
      vendor: countableVendorWhere({
        isPubliclyListed: true,
        accountStatus: "active",
      }),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { vendor: { name: { contains: q } } },
              { vendor: { businessName: { contains: q } } },
            ],
          }
        : {}),
      ...(category ? buildServiceCategoryFilter(category) : {}),
    });

    const orderBy: any =
      sortBy === "distance"
        ? { createdAt: "desc" }
        : sortBy === "price_asc"
        ? { price: "asc" }
        : sortBy === "price_desc"
        ? { price: "desc" }
        : sortBy === "name"
        ? { name: "asc" }
        : { createdAt: "desc" };

    const now = new Date();
    const promotionWhere: any = countablePromotionCampaignWhere({
      status: "active",
      paymentStatus: { in: ["paid", "waived"] },
      placementType: "BROWSE_FEATURED",
      startAt: { lte: now },
      endAt: { gte: now },
      serviceId: { not: null },
      service: {
        isPublished: true,
        vendor: countableVendorWhere({
          isPubliclyListed: true,
          accountStatus: "active",
        }),
      },
    });
    const promotionAnd: any[] = [];
    if (q) {
      promotionAnd.push({
        OR: [
          { name: { contains: q } },
          { vendor: { name: { contains: q } } },
          { vendor: { businessName: { contains: q } } },
          { service: { name: { contains: q } } },
          { service: { description: { contains: q } } },
        ],
      });
    }
    if (category) promotionAnd.push(buildPromotionCategoryFilter(category));
    if (promotionAnd.length) promotionWhere.AND = promotionAnd;

    const [total, services] = await withTransientDbRetry(() =>
      Promise.all([
        distanceProcessingRequested ? Promise.resolve(0) : prisma.service.count({ where }),
        prisma.service.findMany({
          where,
          orderBy,
          ...(distanceProcessingRequested ? {} : { skip: sourceSkip, take: sourceTake }),
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            createdAt: true,
            vendorId: true,
            isPublished: true,
            vendor: {
              select: {
                id: true,
                name: true,
                businessName: true,
                businessType: true,
                category: true,
                city: true,
                state: true,
                latitude: true,
                longitude: true,
                geocodedAt: true,
                businessHoursJson: true,
                isPubliclyListed: true,
                accountStatus: true,
              },
            },
          },
        }),
      ])
    );

    let promotedCampaigns: any[] = [];
    try {
      promotedCampaigns = await withTransientDbRetry(() =>
        (prisma as any).promotionCampaign.findMany({
          where: promotionWhere,
          orderBy: [{ rankPriority: "asc" }, { startAt: "desc" }],
          take: 12,
          include: {
            vendor: true,
            service: {
              include: {
                vendor: true,
              },
            },
          },
        })
      );
    } catch (promotionError: any) {
      const message = String(promotionError?.message || "");
      const code = String(promotionError?.code || "");
      const tableMissing =
        code === "P2021" ||
        message.includes("promotion_campaigns") ||
        message.includes("PromotionCampaign");
      if (!tableMissing && !isTransientDbConnectivityError(promotionError)) throw promotionError;
      if (isTransientDbConnectivityError(promotionError)) {
        console.warn("[services/discover] promotions temporarily unavailable; returning organic results only");
      }
      promotedCampaigns = [];
    }

    const promotedServices = promotedCampaigns
      .filter(
        (campaign: any) =>
          campaign?.placementType === "BROWSE_FEATURED" &&
          isCampaignCurrentlyRenderable(campaign, now) &&
          campaignMatchesTargetRadius(campaign, origin) &&
          campaign.service
      )
      .map((campaign: any) => campaign.service);
    const serviceIds = Array.from(new Set([...services, ...promotedServices].map((s) => s.id)));
    let publicAssets: any[] = [];
    if (serviceIds.length) {
      try {
        publicAssets = await withTransientDbRetry<any[]>(() =>
          (prisma as any).mediaAsset.findMany({
            where: countableMediaAssetWhere({
              ...getApprovedActiveBaseWhere(),
              visibilityStatus: {
                in: getVisibilityStatusesForAudience("public"),
              },
              mediaSession: {
                serviceId: { in: serviceIds },
              },
            }),
            orderBy: { createdAt: "desc" },
            select: {
              mimeType: true,
              blobUrl: true,
              createdAt: true,
              mediaSession: {
                select: {
                  serviceId: true,
                  vendorJobVideoStage: true,
                  sessionType: true,
                },
              },
            },
          })
        );
      } catch (assetError) {
        if (!isTransientDbConnectivityError(assetError)) throw assetError;
        console.warn("[services/discover] public media preview enrichment temporarily unavailable");
      }
    }

    const proofSafePublicAssets = publicAssets.filter((asset: any) =>
      shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)
    );

    const previewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    const primaryProofPreviewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    const stageAvailabilityByServiceId = new Map<string, ProofStageAvailability>();

    const ensureStageAvailability = (serviceId: string): ProofStageAvailability => {
      const existing = stageAvailabilityByServiceId.get(serviceId);
      if (existing) return existing;
      const next = {
        startingCondition: false,
        workInProgress: false,
        finalResult: false,
      };
      stageAvailabilityByServiceId.set(serviceId, next);
      return next;
    };

    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const blobUrl = String(asset?.blobUrl || "").trim();
      if (!serviceId || !blobUrl || primaryProofPreviewByServiceId.has(serviceId)) continue;
      if (!String(asset?.mimeType || "").startsWith("video/")) continue;
      if (!isCompletedStageProofVideo(asset?.mediaSession || null)) continue;
      primaryProofPreviewByServiceId.set(serviceId, { url: blobUrl, type: "video" });
    }
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      if (!serviceId || !String(asset?.mimeType || "").startsWith("video/")) continue;
      const stage = resolveVendorJobVideoStageFromSession(asset?.mediaSession || {});
      const availability = ensureStageAvailability(serviceId);
      if (stage === "INTRO") availability.startingCondition = true;
      if (stage === "IN_PROGRESS") availability.workInProgress = true;
      if (stage === "COMPLETED") availability.finalResult = true;
    }
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const blobUrl = String(asset?.blobUrl || "").trim();
      if (!serviceId || !blobUrl || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, {
        url: blobUrl,
        type: String(asset?.mimeType || "").startsWith("video/") ? "video" : "image",
      });
    }

    const vendorIds = Array.from(new Set([...services, ...promotedServices].map((s) => s.vendorId)));
    let vendorReviewAggregates = new Map<string, { rating: number | null; reviewCount: number }>();
    try {
      vendorReviewAggregates = await withTransientDbRetry(() =>
        getVendorReviewAggregatesForPublic(vendorIds)
      );
    } catch (reviewAggregateError) {
      if (!isTransientDbConnectivityError(reviewAggregateError)) throw reviewAggregateError;
      console.warn("[services/discover] public review aggregates temporarily unavailable");
    }
    const vendorTrustScores = new Map<
      string,
      {
        scored: boolean;
        totalScorePct: number | null;
        maturityState: "not_ready" | "early_stage" | "emerging" | "established";
        maturityLabel: string;
        evidence: {
          verifiedBookings: number;
          approvedServiceVideos: number;
          validatedDisputes: number;
        };
      }
    >();
    try {
      const trustScoreDelegate = (prisma as any).vendorTrustScoreSnapshot;
      if (trustScoreDelegate?.findMany && vendorIds.length > 0) {
        const trustScoreRows = await trustScoreDelegate.findMany({
          where: {
            vendorId: { in: vendorIds },
            isCurrent: true,
          },
          select: {
            vendorId: true,
            totalScorePct: true,
            workflowCompletionNumerator: true,
            videoVerificationNumerator: true,
            disputeFreeNumerator: true,
            disputeFreeDenominator: true,
            computedAt: true,
          },
          orderBy: [{ vendorId: "asc" }, { computedAt: "desc" }],
        });
        for (const row of trustScoreRows as Array<{
          vendorId?: string;
          totalScorePct?: number | null;
          workflowCompletionNumerator?: number | null;
          videoVerificationNumerator?: number | null;
          disputeFreeNumerator?: number | null;
          disputeFreeDenominator?: number | null;
        }>) {
          const rowVendorId = String(row?.vendorId || "").trim();
          if (!rowVendorId || vendorTrustScores.has(rowVendorId)) continue;
          const evidence = buildPublicTrustEvidenceSummary(row);
          const presentation = buildPublicTrustPresentationSummary(row);
          vendorTrustScores.set(rowVendorId, {
            scored:
              typeof row?.totalScorePct === "number" && Number.isFinite(row.totalScorePct),
            totalScorePct:
              typeof row?.totalScorePct === "number" && Number.isFinite(row.totalScorePct)
                ? Math.round(row.totalScorePct)
                : null,
            maturityState: presentation.maturityState,
            maturityLabel: presentation.maturityLabel,
            evidence,
          });
        }
      }
    } catch (trustScoreReadError) {
      console.warn("[services/discover] trust score snapshot read skipped", trustScoreReadError);
    }
    const geocodedVendorCount = services.filter(
      (service) =>
        typeof (service.vendor as any).latitude === "number" &&
        typeof (service.vendor as any).longitude === "number" &&
        Boolean((service.vendor as any).geocodedAt)
    ).length;

    const mapServiceResult = (service: any) => {
      const vendorName = service.vendor.businessName || service.vendor.name || "Unknown Vendor";
      const vendorCoordinates =
        origin && (service.vendor as any).geocodedAt && hasValidCoordinates(service.vendor)
          ? {
              latitude: (service.vendor as any).latitude,
              longitude: (service.vendor as any).longitude,
            }
          : null;
      const distance =
        origin && vendorCoordinates
          ? roundDistanceMiles(distanceMiles(origin, vendorCoordinates))
          : null;

      const previewMedia = primaryProofPreviewByServiceId.get(service.id) || previewByServiceId.get(service.id) || null;

      const reviewCount = vendorReviewAggregates.get(service.vendorId)?.reviewCount ?? null;
      const trustScore =
        vendorTrustScores.get(service.vendorId) || {
          scored: false,
          totalScorePct: null,
          maturityState: "not_ready" as const,
          maturityLabel: "Building",
          evidence: {
            verifiedBookings: 0,
            approvedServiceVideos: 0,
            validatedDisputes: 0,
          },
        };
      const stageAvailability =
        stageAvailabilityByServiceId.get(service.id) || {
          startingCondition: false,
          workInProgress: false,
          finalResult: false,
        };
      const hasPublicMedia = Boolean(previewMedia);

      return {
        serviceId: service.id,
        serviceName: service.name,
        serviceDescription: cleanPublicServiceDescription(service.description || "", vendorName),
        vendorId: service.vendorId,
        vendorName,
        vendorCategory: service.vendor.category || null,
        vendorBusinessType: service.vendor.businessType || null,
        location:
          [service.vendor.city, service.vendor.state].filter(Boolean).join(", ") || null,
        distanceMiles: distance,
        businessHours: getBusinessHoursStatus((service.vendor as any).businessHoursJson || null, now),
        previewMediaUrl: previewMedia?.url || null,
        previewMediaType: previewMedia?.type || null,
        price: Number(service.price),
        rating: vendorReviewAggregates.get(service.vendorId)?.rating ?? null,
        reviewCount,
        trustScore,
        badges: {
          verified: null,
          featured: null,
        },
        publicListing: {
          serviceEligible: Boolean(
            service.isPublished &&
              service.vendor?.isPubliclyListed &&
              String((service.vendor as any)?.accountStatus || "active").toLowerCase() === "active"
          ),
          hasPublicMedia,
        },
        proofCard: buildProofCard({
          serviceName: service.name,
          vendorName,
          stageAvailability,
          hasPublicMedia,
          reviewCount,
          trustScore,
        }),
      };
    };

    const mappedResults = services.map(mapServiceResult);
    const promotedCandidates = promotedCampaigns
      .filter(
        (campaign: any) =>
          campaign?.placementType === "BROWSE_FEATURED" &&
          isCampaignCurrentlyRenderable(campaign, now) &&
          campaignMatchesTargetRadius(campaign, origin) &&
          campaign.service
      )
      .map((campaign: any) => ({
        ...mapServiceResult(campaign.service),
        badges: {
          verified: null,
          featured: true,
        },
        promotion: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          packageKey: campaign.packageKey,
          placementType: campaign.placementType,
          label: PROMOTION_PUBLIC_LABEL,
          explainer: PROMOTION_PUBLIC_EXPLAINER,
          targetCategory: campaign.targetCategory,
          targetCity: campaign.targetCity,
          targetState: campaign.targetState,
          targetRadiusMiles: campaign.targetRadiusMiles,
          endsAt: campaign.endAt instanceof Date ? campaign.endAt.toISOString() : new Date(campaign.endAt).toISOString(),
        },
      }));
    const proofEligibleResults = requireCompletedPublicProof
      ? mappedResults.filter(hasCompletedPublicProofPackage)
      : mappedResults;
    const proofRankedResults = proofFirstRankingRequested
      ? rankProofFirstResults(proofEligibleResults)
      : proofEligibleResults;
    const radiusFilteredResults =
      origin && radiusFilterRequested
        ? proofRankedResults.filter(
            (result) =>
              typeof result.distanceMiles === "number" && result.distanceMiles <= radiusMiles
          )
        : proofRankedResults;
    const distanceSortedResults =
      origin && distanceSortRequested
        ? [...radiusFilteredResults].sort((a, b) => {
            if (typeof a.distanceMiles === "number" && typeof b.distanceMiles === "number") {
              return a.distanceMiles - b.distanceMiles;
            }
            if (typeof a.distanceMiles === "number") return -1;
            if (typeof b.distanceMiles === "number") return 1;
            return a.serviceName.localeCompare(b.serviceName);
          })
        : radiusFilteredResults;
    const distanceResultCount = mappedResults.filter(
      (result) => typeof result.distanceMiles === "number"
    ).length;
    const sortedResults = distanceSortedResults;
    const results = distanceProcessingRequested || proofFirstRankingRequested || requireCompletedPublicProof
      ? distanceSortedResults.slice(skip, skip + limit)
      : sortedResults;
    const responseTotal =
      distanceProcessingRequested || proofFirstRankingRequested || requireCompletedPublicProof
        ? distanceSortedResults.length
        : total;
    const distanceFilteringApplied = Boolean(origin && radiusFilterRequested);
    const distanceSortingApplied = Boolean(origin && distanceSortRequested && distanceResultCount > 0);
    const proofEligiblePromotedCandidates = requireCompletedPublicProof
      ? promotedCandidates.filter(hasCompletedPublicProofPackage)
      : promotedCandidates;
    const promotedListings = applyPromotionInventoryRules(proofEligiblePromotedCandidates, {
      zone: "BROWSE_FEATURED",
      organicResultCount: responseTotal,
      hasCategoryFilter: Boolean(category),
    });

    return NextResponse.json({
      success: true,
      promotedListings,
      results,
      pagination: {
        page,
        limit,
        total: responseTotal,
        totalPages: Math.ceil(responseTotal / limit),
      },
      appliedFilters: {
        q: q || null,
        category: category || null,
        sortBy,
        radiusMiles: radiusFilterRequested ? radiusMiles : null,
        onlyCompletedPublicProof: requireCompletedPublicProof,
        requestedOnlyCompletedPublicProof,
      },
      location: {
        inputAccepted: locationInputSource !== "none",
        inputSource: locationInputSource,
        geocodingProvider: getGeocodingProvider(),
        geocodedVendorCount,
        distanceResultCount,
        distanceFilteringApplied,
        distanceSortingApplied,
        supportedFutureInputs: ["lat", "lng", "zipCode"],
      },
      notes: {
        distance:
          origin
            ? "Distance is calculated only for vendors with stored geocoded coordinates."
            : "Distance requires lat/lng origin coordinates; zipCode alone is accepted but not converted in this endpoint.",
        reviews:
          "rating/reviewCount are vendor-level aggregates from reviews where moderationStatus=approved and visibilityStatus=public.",
        ranking:
          proofFirstRankingRequested
            ? "Public discovery only returns completed Public Service Videos, then prioritizes Service Videos, reviews, Trust Score maturity, and provider credibility."
            : "Explicit sort and location filters preserve the selected ordering while cards still show proof context.",
      },
    });
  } catch (error: any) {
    console.error("[services/discover] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
          details: error?.message || "Transient database connectivity issue",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch discovery services", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

function parseOptionalNumber(value: string | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanQuery(value: string | null): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function hasCompletedPublicProofPackage(result: {
  previewMediaType?: "image" | "video" | null;
  publicListing?: { hasPublicMedia?: boolean | null } | null;
  proofCard?: {
    stageAvailability?: Partial<ProofStageAvailability> | null;
  } | null;
}): boolean {
  const stages = result.proofCard?.stageAvailability;
  return Boolean(
    result.publicListing?.hasPublicMedia &&
      result.previewMediaType === "video" &&
      stages?.startingCondition &&
      stages?.workInProgress &&
      stages?.finalResult
  );
}
