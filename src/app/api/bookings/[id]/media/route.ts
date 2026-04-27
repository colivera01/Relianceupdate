import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from "@/lib/proof-media-policy";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bookings/[id]/media
 * Customer-facing authorized media for a specific booking.
 * Returns approved + active media where visibility is public/customer_only.
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: bookingId } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        vendorId: true,
        serviceId: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    if (String(booking.userId) !== String(userId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: booking does not belong to this user" },
        { status: 403 }
      );
    }

    const assets = await (prisma as any).mediaAsset.findMany({
      where: {
        ...getApprovedActiveBaseWhere(),
        visibilityStatus: {
          in: getVisibilityStatusesForAudience("customer"),
        },
        mediaSession: {
          bookingId,
        },
      },
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

    const normalized = proofSafeAssets.map((asset: any) => {
      const mimeType = String(asset.mimeType || "");
      const isVideo = mimeType.startsWith("video/");
      const rawStage = String(asset?.mediaSession?.vendorJobVideoStage || "").trim().toUpperCase();
      const proofStage =
        rawStage === "INTRO"
          ? "before"
          : rawStage === "IN_PROGRESS"
            ? "during"
            : rawStage === "COMPLETED"
              ? "after"
              : null;
      return {
        id: asset.id,
        type: isVideo ? "video" : "image",
        moderationStatus: asset.moderationStatus,
        visibilityStatus: asset.visibilityStatus,
        mediaSessionId: asset.mediaSessionId || null,
        downloadUrl: `/api/bookings/${bookingId}/media/${asset.id}/download`,
        vendorId: asset.vendorId,
        bytes: typeof asset.bytes === "bigint" ? asset.bytes.toString() : String(asset.bytes || "0"),
        mimeType,
        blobKey: asset.blobKey,
        blobUrl: asset.blobUrl,
        archiveStatus: asset.archiveStatus,
        moderationReason: asset.moderationReason,
        moderatedAt: asset.moderatedAt,
        createdAt: asset.createdAt,
        title: asset.mediaSession?.title || "Service Media",
        description: asset.mediaSession?.description || "",
        bookingId: asset.mediaSession?.bookingId || null,
        serviceId: asset.mediaSession?.serviceId || null,
        proofStage,
        isPrimaryProofVideo: isCompletedStageProofVideo(asset?.mediaSession || null),
      };
    });

    return NextResponse.json({
      success: true,
      bookingId,
      assets: normalized,
      images: normalized.filter((a: any) => a.type === "image"),
      videos: normalized.filter((a: any) => a.type === "video"),
    });
  } catch (error: any) {
    console.error("[bookings/:id/media] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch booking media", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
