import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

type SortBy = "newest" | "price_asc" | "price_desc" | "name";

function normalizeSortBy(value: string | null): SortBy {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "price_asc") return "price_asc";
  if (normalized === "price_desc") return "price_desc";
  if (normalized === "name") return "name";
  return "newest";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim();
    const category = String(searchParams.get("category") || "").trim();
    const sortBy = normalizeSortBy(searchParams.get("sortBy"));
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
      sortBy === "price_asc"
        ? { price: "asc" }
        : sortBy === "price_desc"
        ? { price: "desc" }
        : sortBy === "name"
        ? { name: "asc" }
        : { createdAt: "desc" };

    const [total, services] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
              },
            },
          },
        })
      : [];

    const previewByServiceId = new Map<string, string>();
    for (const asset of publicAssets) {
      const serviceId = String(asset?.mediaSession?.serviceId || "");
      const blobUrl = String(asset?.blobUrl || "").trim();
      if (!serviceId || !blobUrl || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, blobUrl);
    }

    const vendorIds = Array.from(new Set(services.map((s) => s.vendorId)));
    const vendorReviewAggregates = await getVendorReviewAggregatesForPublic(vendorIds);

    const results = services.map((service) => ({
      serviceId: service.id,
      serviceName: service.name,
      serviceDescription: service.description || "",
      vendorId: service.vendorId,
      vendorName: service.vendor.businessName || service.vendor.name || "Unknown Vendor",
      vendorCategory: service.vendor.category || null,
      vendorBusinessType: service.vendor.businessType || null,
      location:
        [service.vendor.city, service.vendor.state].filter(Boolean).join(", ") || null,
      previewMediaUrl: previewByServiceId.get(service.id) || null,
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
    }));

    return NextResponse.json({
      success: true,
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      appliedFilters: {
        q: q || null,
        category: category || null,
        sortBy,
      },
      notes: {
        distance: "Distance/geolocation filtering is not implemented in backend yet.",
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
