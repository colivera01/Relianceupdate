import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";

type ReviewsMePendingItem = {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  status: string;
  proofUrl: string | null;
};

type ReviewsMeSubmittedItem = {
  reviewId: string;
  bookingId: string | null;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  rating: number;
  comment: string;
  submittedAt: string;
  hasProof: boolean;
  proofUrl: string | null;
};

function resolveVendorName(vendor: { businessName?: string | null; name?: string | null } | null | undefined): string {
  return String(vendor?.businessName || vendor?.name || "Vendor");
}

function resolveServiceName(service: { name?: string | null } | null | undefined): string {
  return String(service?.name || "Service");
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Keep customer-scoped reads sequential to avoid DB pool spikes in local dev.
    const completedBookings = await prisma.booking.findMany({
      where: {
        userId: String(userId),
        status: "COMPLETED",
      },
      select: {
        id: true,
        vendorId: true,
        status: true,
        date: true,
        scheduledFor: true,
        createdAt: true,
        service: { select: { name: true } },
        vendor: { select: { name: true, businessName: true } },
      },
      orderBy: { date: "desc" },
    });

    const submittedReviews = await prisma.review.findMany({
      where: {
        userId: String(userId),
      },
      select: {
        id: true,
        bookingId: true,
        vendorId: true,
        rating: true,
        comment: true,
        date: true,
        createdAt: true,
        mediaSessionId: true,
        vendor: { select: { name: true, businessName: true } },
        booking: {
          select: {
            id: true,
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const submittedBookingIdSet = new Set(
      submittedReviews
        .map((review) => String(review.bookingId || "").trim())
        .filter(Boolean)
    );

    const pendingCandidateBookings = completedBookings.filter(
      (booking) => !submittedBookingIdSet.has(String(booking.id))
    );

    const scopedBookingIds = Array.from(
      new Set(
        [
          ...pendingCandidateBookings.map((booking) => String(booking.id)),
          ...submittedReviews.map((review) => String(review.bookingId || "").trim()).filter(Boolean),
        ].filter(Boolean)
      )
    );

    const scopedMediaSessionIds = Array.from(
      new Set(
        submittedReviews
          .map((review) => String(review.mediaSessionId || "").trim())
          .filter(Boolean)
      )
    );

    const proofAssets = scopedBookingIds.length
      ? await (prisma as any).mediaAsset.findMany({
          where: {
            ...getApprovedActiveBaseWhere(),
            visibilityStatus: {
              in: getVisibilityStatusesForAudience("customer"),
            },
            mediaSession: {
              bookingId: { in: scopedBookingIds },
            },
          },
          select: {
            id: true,
            mediaSessionId: true,
            createdAt: true,
            mediaSession: {
              select: {
                bookingId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const proofAssetsByBookingId = new Map<string, { assetId: string; mediaSessionId: string | null }>();
    for (const asset of proofAssets) {
      const bookingId = String(asset?.mediaSession?.bookingId || "").trim();
      if (!bookingId) continue;
      if (!proofAssetsByBookingId.has(bookingId)) {
        proofAssetsByBookingId.set(bookingId, {
          assetId: String(asset.id),
          mediaSessionId: asset.mediaSessionId ? String(asset.mediaSessionId) : null,
        });
      }
    }

    const proofAssetsByMediaSessionId = new Map<string, { assetId: string; bookingId: string | null }>();
    for (const asset of proofAssets) {
      const mediaSessionId = String(asset.mediaSessionId || "").trim();
      if (!mediaSessionId || proofAssetsByMediaSessionId.has(mediaSessionId)) continue;
      const bookingId = String(asset?.mediaSession?.bookingId || "").trim() || null;
      proofAssetsByMediaSessionId.set(mediaSessionId, {
        assetId: String(asset.id),
        bookingId,
      });
    }

    if (scopedMediaSessionIds.length > 0) {
      const directSessionAssets = await (prisma as any).mediaAsset.findMany({
        where: {
          ...getApprovedActiveBaseWhere(),
          visibilityStatus: {
            in: getVisibilityStatusesForAudience("customer"),
          },
          mediaSessionId: { in: scopedMediaSessionIds },
        },
        select: {
          id: true,
          mediaSessionId: true,
          mediaSession: {
            select: {
              bookingId: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      for (const asset of directSessionAssets) {
        const mediaSessionId = String(asset.mediaSessionId || "").trim();
        if (!mediaSessionId || proofAssetsByMediaSessionId.has(mediaSessionId)) continue;
        const bookingId = String(asset?.mediaSession?.bookingId || "").trim() || null;
        proofAssetsByMediaSessionId.set(mediaSessionId, {
          assetId: String(asset.id),
          bookingId,
        });
      }
    }

    const pending: ReviewsMePendingItem[] = pendingCandidateBookings.map((booking) => {
      const proof = proofAssetsByBookingId.get(String(booking.id));
      const proofUrl = proof ? `/api/bookings/${booking.id}/media/${proof.assetId}/download` : null;

      return {
        bookingId: String(booking.id),
        vendorId: String(booking.vendorId),
        vendorName: resolveVendorName(booking.vendor),
        serviceName: resolveServiceName(booking.service),
        serviceDate: (booking.date || booking.scheduledFor || booking.createdAt)?.toISOString?.() || null,
        status: String(booking.status || "COMPLETED"),
        proofUrl,
      };
    });

    const submitted: ReviewsMeSubmittedItem[] = submittedReviews.map((review) => {
      const bookingId = review.bookingId ? String(review.bookingId) : null;
      const reviewMediaSessionId = String(review.mediaSessionId || "").trim();
      const proofFromBooking = bookingId ? proofAssetsByBookingId.get(bookingId) : null;
      const proofFromSession = reviewMediaSessionId ? proofAssetsByMediaSessionId.get(reviewMediaSessionId) : null;
      const resolvedBookingId = bookingId || proofFromSession?.bookingId || null;
      const resolvedAssetId = proofFromSession?.assetId || proofFromBooking?.assetId || null;
      const proofUrl =
        resolvedBookingId && resolvedAssetId
          ? `/api/bookings/${resolvedBookingId}/media/${resolvedAssetId}/download`
          : null;

      const hasProof = Boolean(reviewMediaSessionId) || Boolean(proofFromBooking);

      return {
        reviewId: String(review.id),
        bookingId,
        vendorId: String(review.vendorId),
        vendorName: resolveVendorName(review.vendor),
        serviceName: resolveServiceName(review.booking?.service),
        rating: Number(review.rating),
        comment: String(review.comment || ""),
        submittedAt: (review.date || review.createdAt)?.toISOString?.() || review.createdAt.toISOString(),
        hasProof,
        proofUrl,
      };
    });

    const proofBased = submitted.filter((row) => row.hasProof);

    return NextResponse.json({
      pending,
      submitted,
      proofBased,
    });
  } catch (error: any) {
    console.error("[reviews/me] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load customer reviews hub data",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
