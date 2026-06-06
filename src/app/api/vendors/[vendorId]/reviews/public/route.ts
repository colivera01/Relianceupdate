import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { countableReviewWhere, countableVendorWhere } from "@/lib/metrics-exclusion";
import { cleanPublicReviewComment } from "@/lib/launch-content-cleanup";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

function toPublicReviewerDisplayName(name: string | null | undefined): string | null {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

/**
 * GET /api/vendors/[vendorId]/reviews/public
 * Public-safe raw vendor review content.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;

    const vendor = await withTransientDbRetry(() =>
      prisma.vendor.findFirst({
        where: countableVendorWhere({ id: vendorId, isPubliclyListed: true, accountStatus: "active" }),
        select: { id: true },
      })
    );

    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const reviews = await withTransientDbRetry(() =>
      prisma.review.findMany({
        where: countableReviewWhere({
          vendorId: vendor.id,
          moderationStatus: "approved",
          visibilityStatus: "public",
        }),
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          vendorId: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      })
    );

    return NextResponse.json({
      success: true,
      reviews: reviews.map((review) => ({
        reviewId: review.id,
        vendorId: review.vendorId,
        rating: review.rating,
        comment: cleanPublicReviewComment(review.comment),
        createdAt: review.createdAt,
        reviewerDisplayName: toPublicReviewerDisplayName(review.user?.name) || "Verified Customer",
      })),
      meta: {
        eligibilityRule:
          "Only active publicly listed vendors and reviews where moderationStatus=approved and visibilityStatus=public are returned.",
      },
    });
  } catch (error: any) {
    console.error("[vendors/:vendorId/reviews/public] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch public vendor reviews", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
