import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import { getAdminMediaModerationQueue } from "@/lib/admin-media-moderation-queue";
import {
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
      adminAuditQueue,
    ] = await Promise.all([
        prisma.user.count({ where: countableUserWhere() }),
        prisma.vendor.count({ where: countableVendorWhere() }),
        prisma.review.count({ where: countableReviewWhere() }),
        prisma.review.count({
          where: countableReviewWhere({
            moderationStatus: "pending_review",
          }),
        }),
        getAdminMediaModerationQueue({ limit: 200 }),
      ]);
    const pendingMediaPackageModeration = adminAuditQueue.length;
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
          "Reviews awaiting moderation plus exact Service Video packages eligible for core Reliance Admin Audit.",
        pendingModerationBreakdown: {
          reviews:
            "Review rows with moderationStatus=pending_review awaiting admin review.",
          mediaPackages:
            "Exact manager-attested Service Video package versions whose current evidence chain is eligible for Reliance Admin Audit.",
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
