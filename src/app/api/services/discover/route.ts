import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from "@/lib/proof-media-policy";
import { getGeocodingProvider } from "@/lib/geocoding";
import { distanceMiles, hasValidCoordinates, roundDistanceMiles, type Coordinates } from "@/lib/distance";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    const category = String(searchParams.get("category") || "").trim();
    const sortBy = normalizeSortBy(searchParams.get("sortBy"));
    const latitude = parseOptionalNumber(searchParams.get("lat"));
    const longitude = parseOptionalNumber(searchParams.get("lng"));
    const zipCode = String(searchParams.get("zipCode") || "").trim();
    const radiusMiles = parseOptionalNumber(searchParams.get("radiusMiles"));
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

    const where: any = {
      isPublished: true,
      vendor: {
        isPubliclyListed: true,
      },
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
      ...(category
        ? {
            OR: [{ vendor: { category } }, { vendor: { businessType: category } }],
          }
        : {}),
    };

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

    const [total, services] = await Promise.all([
      distanceProcessingRequested ? Promise.resolve(0) : prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        orderBy,
        ...(distanceProcessingRequested ? {} : { skip, take: limit }),
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
              isPubliclyListed: true,
            },
          },
        },
      }),
    ]);

    const serviceIds = services.map((s) => s.id);
    const publicAssets = serviceIds.length
      ? await (prisma as any).mediaAsset.findMany({
          where: {
            ...getApprovedActiveBaseWhere(),
            visibilityStatus: {
              in: getVisibilityStatusesForAudience("public"),
            },
            mediaSession: {
              serviceId: { in: serviceIds },
            },
          },
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
      : [];

    const proofSafePublicAssets = publicAssets.filter((asset: any) =>
      shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)
    );

    const previewByServiceId = new Map<string, string>();
    const primaryProofPreviewByServiceId = new Map<string, string>();
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const blobUrl = String(asset?.blobUrl || "").trim();
      if (!serviceId || !blobUrl || primaryProofPreviewByServiceId.has(serviceId)) continue;
      if (!String(asset?.mimeType || "").startsWith("video/")) continue;
      if (!isCompletedStageProofVideo(asset?.mediaSession || null)) continue;
      primaryProofPreviewByServiceId.set(serviceId, blobUrl);
    }
    for (const asset of proofSafePublicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const blobUrl = String(asset?.blobUrl || "").trim();
      if (!serviceId || !blobUrl || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, blobUrl);
    }

    const vendorIds = Array.from(new Set(services.map((s) => s.vendorId)));
    const vendorReviewAggregates = await getVendorReviewAggregatesForPublic(vendorIds);
    const geocodedVendorCount = services.filter(
      (service) =>
        typeof (service.vendor as any).latitude === "number" &&
        typeof (service.vendor as any).longitude === "number" &&
        Boolean((service.vendor as any).geocodedAt)
    ).length;

    const mappedResults = services.map((service) => {
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

      return {
        serviceId: service.id,
        serviceName: service.name,
        serviceDescription: service.description || "",
        vendorId: service.vendorId,
        vendorName: service.vendor.businessName || service.vendor.name || "Unknown Vendor",
        vendorCategory: service.vendor.category || null,
        vendorBusinessType: service.vendor.businessType || null,
        location:
          [service.vendor.city, service.vendor.state].filter(Boolean).join(", ") || null,
        distanceMiles: distance,
        previewMediaUrl:
          primaryProofPreviewByServiceId.get(service.id) || previewByServiceId.get(service.id) || null,
        price: Number(service.price),
        rating: vendorReviewAggregates.get(service.vendorId)?.rating ?? null,
        reviewCount: vendorReviewAggregates.get(service.vendorId)?.reviewCount ?? null,
        badges: {
          verified: null,
          featured: null,
        },
        publicListing: {
          serviceEligible: Boolean(service.isPublished && service.vendor?.isPubliclyListed),
          hasPublicMedia: Boolean(previewByServiceId.get(service.id)),
        },
      };
    });
    const radiusFilteredResults =
      origin && radiusFilterRequested
        ? mappedResults.filter(
            (result) =>
              typeof result.distanceMiles === "number" && result.distanceMiles <= radiusMiles
          )
        : mappedResults;
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
    const results = distanceProcessingRequested
      ? distanceSortedResults.slice(skip, skip + limit)
      : distanceSortedResults;
    const responseTotal = distanceProcessingRequested ? distanceSortedResults.length : total;
    const distanceFilteringApplied = Boolean(origin && radiusFilterRequested);
    const distanceSortingApplied = Boolean(origin && distanceSortRequested && distanceResultCount > 0);

    return NextResponse.json({
      success: true,
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
      },
    });
  } catch (error: any) {
    console.error("[services/discover] GET error:", error);
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
