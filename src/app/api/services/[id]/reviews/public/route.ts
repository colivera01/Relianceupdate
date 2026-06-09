import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { countableReviewWhere, countableServiceWhere } from "@/lib/metrics-exclusion";
import { cleanPublicReviewComment } from "@/lib/launch-content-cleanup";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function toPublicReviewerDisplayName(name: string | null | undefined): string | null {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

/**
 * GET /api/services/[id]/reviews/public
 * Public-safe reviews for a published service on a publicly listed vendor.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const serviceId = String(id || "").trim();

    const service = await withTransientDbRetry(() =>
      prisma.service.findFirst({
        where: countableServiceWhere({
          id: serviceId,
          isPublished: true,
          vendor: {
            isPubliclyListed: true,
            accountStatus: "active",
          },
        }),
        select: {
          id: true,
          vendorId: true,
        },
      })
    );

    if (!service) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    const reviews = await withTransientDbRetry(() =>
      prisma.review.findMany({
        where: countableReviewWhere({
          vendorId: service.vendorId,
          moderationStatus: "approved",
          visibilityStatus: "public",
          OR: [
            {
              booking: {
                is: {
                  serviceId: service.id,
                },
              },
            },
            {
              mediaSession: {
                is: {
                  serviceId: service.id,
                },
              },
            },
          ],
        }),
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          vendorId: true,
          bookingId: true,
          mediaSessionId: true,
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
        serviceId: service.id,
        vendorId: review.vendorId,
        bookingId: review.bookingId,
        mediaSessionId: review.mediaSessionId,
        rating: review.rating,
        comment: cleanPublicReviewComment(review.comment),
        createdAt: review.createdAt,
        reviewerDisplayName: toPublicReviewerDisplayName(review.user?.name) || "Verified Customer",
      })),
      meta: {
        eligibilityRule:
          "Only approved public reviews attached through this service's booking or media session are returned.",
      },
    });
  } catch (error: any) {
    console.error("[services/:id/reviews/public] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
          retryable: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch public service reviews", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
