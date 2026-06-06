import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import {
  buildCompleteMediaModerationPackages,
  countPendingMediaModerationPackages,
} from "@/lib/admin-media-moderation-packages";
import { resolveVendorJobVideoStageFromSession } from "@/lib/vendor-job-video-stages";
import {
  countableMediaAssetWhere,
  countableReviewWhere,
  countableUserWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";

/**
 * GET /api/admin/stats
 * Focused admin dashboard counts. This intentionally exposes only the
 * aggregate metrics needed by /admin/dashboard.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const [
      totalUsers,
      totalVendors,
      totalReviews,
      pendingReviewModeration,
      mediaAssets,
    ] = await Promise.all([
        prisma.user.count({ where: countableUserWhere() }),
        prisma.vendor.count({ where: countableVendorWhere() }),
        prisma.review.count({ where: countableReviewWhere() }),
        prisma.review.count({
          where: countableReviewWhere({
            moderationStatus: "pending_review",
          }),
        }),
        (prisma as any).mediaAsset.findMany({
          where: countableMediaAssetWhere(),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            vendorId: true,
            moderationStatus: true,
            visibilityStatus: true,
            createdAt: true,
            uploadedByMembershipId: true,
            vendor: {
              select: {
                name: true,
                businessName: true,
              },
            },
            mediaSession: {
              select: {
                title: true,
                vendorJobVideoStage: true,
                sessionType: true,
                booking: {
                  select: {
                    id: true,
                    title: true,
                    clientName: true,
                    status: true,
                  },
                },
                service: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const mediaModerationItems = mediaAssets.map((asset: any) => {
      const session = asset.mediaSession;
      const stageKey = resolveVendorJobVideoStageFromSession({
        vendorJobVideoStage: session?.vendorJobVideoStage,
        sessionType: session?.sessionType,
      });

      return {
        title: session?.title || session?.booking?.title || "Untitled Media",
        vendorId: asset.vendorId,
        vendorName: asset.vendor?.businessName || asset.vendor?.name || null,
        bookingId: session?.booking?.id || null,
        jobTitle: session?.booking?.title || null,
        bookingStatus: session?.booking?.status || null,
        clientName: session?.booking?.clientName || null,
        serviceName: session?.service?.name || null,
        uploadedByMembershipId: asset.uploadedByMembershipId || null,
        vendorJobVideoStageKey: stageKey,
        moderationStatus: asset.moderationStatus,
        visibilityStatus: asset.visibilityStatus,
        createdAt: asset.createdAt,
      };
    });

    const pendingMediaPackageModeration = countPendingMediaModerationPackages(
      buildCompleteMediaModerationPackages(mediaModerationItems)
    );
    const pendingModeration =
      pendingReviewModeration + pendingMediaPackageModeration;

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalVendors,
        totalReviews,
        pendingModeration,
        pendingModerationBreakdown: {
          reviews: pendingReviewModeration,
          mediaPackages: pendingMediaPackageModeration,
        },
      },
      definitions: {
        pendingModeration:
          "Reviews with moderationStatus=pending_review plus complete service video packages whose latest required-stage videos include moderationStatus=pending_review.",
        pendingModerationBreakdown: {
          reviews:
            "Review rows with moderationStatus=pending_review awaiting admin review.",
          mediaPackages:
            "Complete INTRO/IN_PROGRESS/COMPLETED service video packages with at least one latest stage video still pending_review.",
        },
      },
    });
  } catch (error: any) {
    console.error("[admin/stats] GET error:", error);
    if (
      error.message === "Unauthorized" ||
      String(error.message).includes("Forbidden")
    ) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch admin stats",
        message: "Failed to fetch admin stats",
      },
      { status: 500 }
    );
  }
}
