import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";

function normalizePage(value: string | null): number {
  const parsed = Number.parseInt(String(value || "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value: string | null): number {
  const parsed = Number.parseInt(String(value || "20"), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 50);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = String(searchParams.get("userId") || "").trim();
    const authUserId = await getUserIdFromRequest(request);
    const userId = authUserId || requestedUserId || null;
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const page = normalizePage(searchParams.get("page"));
    const limit = normalizeLimit(searchParams.get("limit"));
    const skip = (page - 1) * limit;

    const [total, favorites] = await Promise.all([
      prisma.favorite.count({ where: { userId } }),
      prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
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
          },
        },
      }),
    ]);

    const serviceIds = favorites.map((fav) => fav.service.id);
    const media = serviceIds.length
      ? await (prisma as any).mediaAsset.findMany({
          where: {
            ...getApprovedActiveBaseWhere(),
            visibilityStatus: { in: getVisibilityStatusesForAudience("public") },
            mediaSession: {
              serviceId: { in: serviceIds },
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            blobUrl: true,
            mediaSession: { select: { serviceId: true } },
          },
        })
      : [];

    const previewByServiceId = new Map<string, string>();
    for (const item of media) {
      const serviceId = String(item?.mediaSession?.serviceId || "");
      const blobUrl = String(item?.blobUrl || "").trim();
      if (!serviceId || !blobUrl || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, blobUrl);
    }

    const vendorIds = Array.from(new Set(favorites.map((fav) => fav.service.vendorId)));
    const vendorReviewAggregates = await getVendorReviewAggregatesForPublic(vendorIds);

    return NextResponse.json({
      success: true,
      favorites: favorites.map((fav) => {
        const vendorAggregate = vendorReviewAggregates.get(fav.service.vendorId);
        const vendorName = fav.service.vendor.businessName || fav.service.vendor.name || "Unknown Vendor";
        return {
          favoriteId: fav.id,
          serviceId: fav.service.id,
          serviceName: fav.service.name,
          serviceDescription: fav.service.description || "",
          price: Number(fav.service.price),
          vendorId: fav.service.vendor.id,
          vendorName,
          vendorCategory: fav.service.vendor.category || null,
          vendorBusinessType: fav.service.vendor.businessType || null,
          location: [fav.service.vendor.city, fav.service.vendor.state].filter(Boolean).join(", ") || null,
          rating: vendorAggregate?.rating ?? null,
          reviewCount: vendorAggregate?.reviewCount ?? null,
          previewMediaUrl: previewByServiceId.get(fav.service.id) || null,
          publicListing: {
            serviceEligible: Boolean(fav.service.isPublished && fav.service.vendor.isPubliclyListed),
            hasPublicMedia: Boolean(previewByServiceId.get(fav.service.id)),
          },
          favoritedAt: fav.createdAt.toISOString(),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[users/favorites] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUserId = await getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const headerUserId = String(request.headers.get("x-user-id") || "").trim();

    const body = await request.json();
    const requestedUserId = String(body?.userId || searchParams.get("userId") || "").trim();
    const userId = authUserId || headerUserId || requestedUserId || null;
    if (!userId) {
      return NextResponse.json(
        {
          error: "Authentication required",
          ...(process.env.NODE_ENV === "development"
            ? {
                details:
                  "No user identity found from auth token/cookies, x-user-id header, or userId fallback",
              }
            : {}),
        },
        { status: 401 }
      );
    }
    const serviceId = String(body?.serviceId || body?.service_id || "").trim();
    if (!serviceId) {
      return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        vendor: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Transitional compatibility: ensure user row exists for FK-backed favorites.
    // Some signed-in customer surfaces currently operate with local auth context IDs.
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: String(body?.userName || "Customer"),
        email: String(body?.userEmail || `${userId}@reliance.local`),
      },
      select: { id: true },
    });

    const favorite = await prisma.favorite.upsert({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
      update: {},
      create: {
        userId,
        serviceId,
      },
      select: {
        id: true,
        serviceId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      favorite: {
        favoriteId: favorite.id,
        serviceId: favorite.serviceId,
        favoritedAt: favorite.createdAt.toISOString(),
      },
      message: "Added to favorites",
    });
  } catch (error: any) {
    console.error("[users/favorites] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add favorite", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}