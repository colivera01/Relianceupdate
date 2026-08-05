import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  getApprovedActiveBaseWhere,
  getVisibilityStatusesForAudience,
  normalizeAudience,
} from "@/lib/media-visibility";
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from "@/lib/proof-media-policy";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/services/[id]/media
 * Audience-aware media read route.
 * - public: approved + public + active
 * - customer: approved + (customer_only|public) + active + customer booking auth
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: serviceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const audience = normalizeAudience(searchParams.get("audience"));
    const bookingId = searchParams.get("bookingId");

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        isPublished: true,
        vendor: {
          select: {
            isPubliclyListed: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    if (audience === "public" && (!service.isPublished || !service.vendor?.isPubliclyListed)) {
      return NextResponse.json(
        { success: false, error: "Service is not publicly available" },
        { status: 404 }
      );
    }

    let requestingUserId: string | null = null;
    if (audience === "customer") {
      requestingUserId = await getUserIdFromRequest(request);
      if (!requestingUserId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized customer request" },
          { status: 401 }
        );
      }

      // Customer must be authorized for this service context.
      const customerBookingWhere: any = {
        userId: requestingUserId,
        serviceId,
      };
      if (bookingId) {
        customerBookingWhere.id = bookingId;
      }

      const authorizedBooking = await prisma.booking.findFirst({
        where: customerBookingWhere,
        select: { id: true },
      });

      if (!authorizedBooking) {
        return NextResponse.json(
          { success: false, error: "Forbidden: customer is not authorized for this service media" },
          { status: 403 }
        );
      }
    }

    const where: any = {
      ...getApprovedActiveBaseWhere(),
      visibilityStatus: {
        in: getVisibilityStatusesForAudience(audience),
      },
      mediaSession: {
        serviceId,
        ...(audience === "customer" && bookingId ? { bookingId } : {}),
      },
    };
    if (audience === "public") {
      where.id = { in: await resolveCanonicalPublicAssetIds({ serviceId }) };
    }

    const assets = await (prisma as any).mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        vendorId: true,
        mediaSessionId: true,
        bytes: true,
        mimeType: true,
        blobKey: true,
        blobUrl: true,
        moderationStatus: true,
        visibilityStatus: true,
        archiveStatus: true,
        moderationReason: true,
        moderatedAt: true,
        createdAt: true,
        mediaSession: {
          select: {
            id: true,
            title: true,
            description: true,
            bookingId: true,
            serviceId: true,
            vendorJobVideoStage: true,
            sessionType: true,
          },
        },
      },
    });

    const proofSafeAssets = assets.filter((asset: any) =>
      shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)
    );

    const normalized = proofSafeAssets.map((asset: any) => ({
      id: asset.id,
      vendorId: asset.vendorId,
      mediaSessionId: asset.mediaSessionId,
      bytes: typeof asset.bytes === "bigint" ? asset.bytes.toString() : String(asset.bytes || "0"),
      mimeType: asset.mimeType,
      blobKey: asset.blobKey,
      blobUrl: audience === "public" ? `/api/public/media/${asset.id}` : asset.blobUrl,
      moderationStatus: asset.moderationStatus,
      visibilityStatus: asset.visibilityStatus,
      archiveStatus: asset.archiveStatus,
      moderationReason: asset.moderationReason,
      moderatedAt: asset.moderatedAt,
      createdAt: asset.createdAt,
      title: asset.mediaSession?.title || "Service Media",
      description: asset.mediaSession?.description || "",
      bookingId: asset.mediaSession?.bookingId || null,
      serviceId: asset.mediaSession?.serviceId || null,
      isPrimaryProofVideo: isCompletedStageProofVideo(asset?.mediaSession || null),
    }));

    return NextResponse.json({
      success: true,
      audience,
      assets: normalized,
      images: normalized.filter((a: any) => String(a.mimeType || "").startsWith("image/")),
      videos: normalized.filter((a: any) => String(a.mimeType || "").startsWith("video/")),
    });
  } catch (error: any) {
    console.error("[services/:id/media] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch service media", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
