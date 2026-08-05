import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  isVendorAccountRestricted,
} from "@/lib/account-status";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { getVendorReviewAggregatesForPublic } from "@/lib/public-review-aggregates";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";
import { cleanPublicServiceDescription } from "@/lib/launch-content-cleanup";

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
    const countsOnly = searchParams.get("countsOnly") === "1";
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureUserAccountCanAct(userId);

    const page = normalizePage(searchParams.get("page"));
    const limit = normalizeLimit(searchParams.get("limit"));
    const skip = (page - 1) * limit;

    if (countsOnly) {
      const [total, vendorRows] = await Promise.all([
        prisma.favorite.count({ where: { userId } }),
        prisma.favorite.findMany({
          where: { userId },
          select: {
            service: {
              select: {
                vendorId: true,
              },
            },
          },
        }),
      ]);

      const uniqueVendorCount = new Set(
        vendorRows
          .map((row) => String(row?.service?.vendorId || "").trim())
          .filter(Boolean)
      ).size;

      return NextResponse.json({
        success: true,
        summary: {
          total,
          uniqueVendorCount,
        },
      });
    }

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
    const canonicalPublicAssetIds = serviceIds.length ? await resolveCanonicalPublicAssetIds() : [];
    const media = serviceIds.length
      ? await (prisma as any).mediaAsset.findMany({
          where: {
            id: { in: canonicalPublicAssetIds },
            ...getApprovedActiveBaseWhere(),
            visibilityStatus: { in: getVisibilityStatusesForAudience("public") },
            mediaSession: {
              serviceId: { in: serviceIds },
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            mimeType: true,
            mediaSession: { select: { serviceId: true } },
          },
        })
      : [];

    const previewByServiceId = new Map<string, { url: string; type: "image" | "video" }>();
    for (const item of media) {
      const serviceId = String(item?.mediaSession?.serviceId || "");
      const publicUrl = item?.id ? `/api/public/media/${item.id}` : "";
      if (!serviceId || !publicUrl || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, {
        url: publicUrl,
        type: String(item?.mimeType || "").startsWith("video/") ? "video" : "image",
      });
    }

    const vendorIds = Array.from(new Set(favorites.map((fav) => fav.service.vendorId)));
    const vendorReviewAggregates = await getVendorReviewAggregatesForPublic(vendorIds);

    return NextResponse.json({
      success: true,
      favorites: favorites.map((fav) => {
        const vendorAggregate = vendorReviewAggregates.get(fav.service.vendorId);
        const vendorName = fav.service.vendor.businessName || fav.service.vendor.name || "Unknown Vendor";
        const previewMedia = previewByServiceId.get(fav.service.id) || null;
        return {
          favoriteId: fav.id,
          serviceId: fav.service.id,
          serviceName: fav.service.name,
          serviceDescription: cleanPublicServiceDescription(
            fav.service.description || "",
            vendorName
          ),
          price: Number(fav.service.price),
          vendorId: fav.service.vendor.id,
          vendorName,
          vendorCategory: fav.service.vendor.category || null,
          vendorBusinessType: fav.service.vendor.businessType || null,
          location: [fav.service.vendor.city, fav.service.vendor.state].filter(Boolean).join(", ") || null,
          rating: vendorAggregate?.rating ?? null,
          reviewCount: vendorAggregate?.reviewCount ?? null,
          previewMediaUrl: previewMedia?.url || null,
          previewMediaType: previewMedia?.type || null,
          publicListing: {
            serviceEligible: Boolean(fav.service.isPublished && fav.service.vendor.isPubliclyListed),
            hasPublicMedia: Boolean(previewMedia),
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
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch favorites", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);

    const body = await request.json();
    const requestedUserId = String(body?.userId || searchParams.get("userId") || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureUserAccountCanAct(userId);
    const serviceId = String(body?.serviceId || body?.service_id || "").trim();
    if (!serviceId) {
      return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        isPublished: true,
        vendor: {
          select: {
            id: true,
            isPubliclyListed: true,
            accountStatus: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    if (
      !service.isPublished ||
      !service.vendor?.isPubliclyListed ||
      isVendorAccountRestricted((service.vendor as any)?.accountStatus)
    ) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 404 });
    }

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
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to add favorite", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
