import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";
import { getAdminMediaModerationQueueResult } from "@/lib/admin-media-moderation-queue";
import {
  countableReviewWhere,
  countableUserWhere,
  countableVendorWhere,
} from "@/lib/metrics-exclusion";
import { launchExcludedUserIds, launchExcludedVendorIds } from "@/lib/internal-identities";
import { isTransientDbConnectivityError, withTransientDbRetry } from "@/lib/transient-db-errors";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const excludedUserIds = launchExcludedUserIds();
    const excludedVendorIds = launchExcludedVendorIds();

    const [
      totalCustomers,
      totalVendors,
      totalReviews,
      pendingReviewModeration,
      pendingMediaPackages,
      reviewWindowsLast30Days,
      openContentReports,
      recentAuditEvents,
    ] = await withTransientDbRetry(() =>
      Promise.all([
        prisma.user.count({ where: countableUserWhere() }),
        prisma.vendor.count({ where: countableVendorWhere() }),
        prisma.review.count({ where: countableReviewWhere() }),
        prisma.review.count({
          where: countableReviewWhere({
            moderationStatus: "pending_review",
          }),
        }),
        getAdminMediaModerationQueueResult({
          moderationStatus: "pending_review",
          limit: 120,
        }).then((result) => result.totalPending),
        (prisma as any).reviewWindow.count({
          where: {
            createdAt: { gte: thirtyDaysAgo },
            NOT: [
              { vendorId: { in: excludedVendorIds } },
              { booking: { userId: { in: excludedUserIds } } },
            ],
          },
        }),
        (prisma as any).contentReport.count({
          where: {
            status: { in: ["open", "triaged", "under_review"] },
            NOT: [
              { vendorId: { in: excludedVendorIds } },
              { reportedVendorId: { in: excludedVendorIds } },
              { reporterVendorId: { in: excludedVendorIds } },
              { reportedUserId: { in: excludedUserIds } },
              { reporterUserId: { in: excludedUserIds } },
            ],
          },
        }),
        (prisma as any).adminAuditLog.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
          },
        }),
      ])
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalCustomers,
        totalVendors,
        totalReviews,
        pendingReviewModeration,
        pendingMediaPackages,
        reviewWindowsLast30Days,
        openContentReports,
        recentAuditEvents,
      },
    });
  } catch (error: any) {
    console.error("[admin/reports/summary] GET error:", error);
    if (
      error?.message === "Unauthorized" ||
      String(error?.message || "").includes("Forbidden")
    ) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: 403 }
      );
    }

    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: "Reports are temporarily unavailable",
          code: "DB_UNAVAILABLE",
          retryable: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load reports summary",
      },
      { status: 500 }
    );
  }
}
