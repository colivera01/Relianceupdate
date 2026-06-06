import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from "@/lib/account-status";
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";
import { deriveCustomerBookingLifecycle } from "@/lib/customer-booking-lifecycle";
import {
  classifySubmittedReviewMediaState,
  getReviewsHubUnavailableMessage,
  isCustomerReviewEligibleMediaSession,
} from "@/lib/reviews-hub-state";

type ReviewsMePendingItem = {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  status: string;
  videoUrl: string | null;
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
  hasVideo: boolean;
  videoUrl: string | null;
  hasProof: boolean;
  proofUrl: string | null;
  hasLinkedMediaRecord: boolean;
  mediaState: "customer_visible_video" | "linked_media_unavailable" | "no_linked_media";
  statusMessage: string | null;
};

type ReviewsMeAwaitingItem = {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceName: string;
  serviceDate: string | null;
  status: string;
  videoState: "pending_approval" | "approved_not_customer_visible" | "rejected" | "not_submitted";
  statusMessage: string;
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
    await ensureUserAccountCanAct(userId);
    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get("summaryOnly") === "1";

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
        mediaSessions: {
          where: { sessionType: 'JOB_SERVICE_VIDEO' },
          select: {
            vendorJobVideoStage: true,
            mediaAssets: {
              select: {
                mimeType: true,
                moderationStatus: true,
                visibilityStatus: true,
                archiveStatus: true,
              },
            },
          },
        },
        reviewWindows: {
          select: { status: true },
        },
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

    const completedBookingIds = completedBookings
      .map((booking) => String(booking.id || "").trim())
      .filter(Boolean);

    const reviewedBookingRows = completedBookingIds.length
      ? await prisma.review.findMany({
          where: {
            bookingId: { in: completedBookingIds },
          },
          select: {
            bookingId: true,
          },
        })
      : [];

    const reviewedBookingIdSet = new Set(
      reviewedBookingRows
        .map((review) => String(review.bookingId || "").trim())
        .filter(Boolean)
    );

    const pendingCandidateBookings = completedBookings.filter(
      (booking) =>
        !submittedBookingIdSet.has(String(booking.id)) &&
        !reviewedBookingIdSet.has(String(booking.id))
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
                sessionType: true,
                vendorJobVideoStage: true,
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
      if (
        !isCustomerReviewEligibleMediaSession({
          sessionType: asset?.mediaSession?.sessionType,
          vendorJobVideoStage: asset?.mediaSession?.vendorJobVideoStage,
        })
      ) {
        continue;
      }
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
      if (
        !isCustomerReviewEligibleMediaSession({
          sessionType: asset?.mediaSession?.sessionType,
          vendorJobVideoStage: asset?.mediaSession?.vendorJobVideoStage,
        })
      ) {
        continue;
      }
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
              sessionType: true,
              vendorJobVideoStage: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      for (const asset of directSessionAssets) {
        const mediaSessionId = String(asset.mediaSessionId || "").trim();
        if (!mediaSessionId || proofAssetsByMediaSessionId.has(mediaSessionId)) continue;
        if (
          !isCustomerReviewEligibleMediaSession({
            sessionType: asset?.mediaSession?.sessionType,
            vendorJobVideoStage: asset?.mediaSession?.vendorJobVideoStage,
          })
        ) {
          continue;
        }
        const bookingId = String(asset?.mediaSession?.bookingId || "").trim() || null;
        proofAssetsByMediaSessionId.set(mediaSessionId, {
          assetId: String(asset.id),
          bookingId,
        });
      }
    }

    const readyForReviewBookings = pendingCandidateBookings.filter((booking) =>
      deriveCustomerBookingLifecycle({
        bookingStatus: booking.status,
        mediaSessions: booking.mediaSessions || [],
        hasSubmittedReview: false,
        reviewWindows: booking.reviewWindows || [],
      }).reviewEligible
    );
    const readyBookingIdSet = new Set(readyForReviewBookings.map((booking) => String(booking.id)));
    const awaitingVideoBookings = pendingCandidateBookings.filter(
      (booking) => !readyBookingIdSet.has(String(booking.id))
    );

    const pending: ReviewsMePendingItem[] = readyForReviewBookings.map((booking) => {
      const proof = proofAssetsByBookingId.get(String(booking.id));
      const videoUrl = proof ? `/api/bookings/${booking.id}/media/${proof.assetId}/download` : null;

      return {
        bookingId: String(booking.id),
        vendorId: String(booking.vendorId),
        vendorName: resolveVendorName(booking.vendor),
        serviceName: resolveServiceName(booking.service),
        serviceDate: (booking.date || booking.scheduledFor || booking.createdAt)?.toISOString?.() || null,
        status: String(booking.status || "COMPLETED"),
        videoUrl,
        proofUrl: videoUrl,
      };
    });

    const awaiting: ReviewsMeAwaitingItem[] = awaitingVideoBookings.map((booking) => {
      const lifecycle = deriveCustomerBookingLifecycle({
        bookingStatus: booking.status,
        mediaSessions: booking.mediaSessions || [],
        hasSubmittedReview: false,
        reviewWindows: booking.reviewWindows || [],
      });

      return {
        bookingId: String(booking.id),
        vendorId: String(booking.vendorId),
        vendorName: resolveVendorName(booking.vendor),
        serviceName: resolveServiceName(booking.service),
        serviceDate: (booking.date || booking.scheduledFor || booking.createdAt)?.toISOString?.() || null,
        status: String(booking.status || "COMPLETED"),
        videoState:
          lifecycle.videoState === "available_to_customer"
            ? "not_submitted"
            : lifecycle.videoState,
        statusMessage: getReviewsHubUnavailableMessage(lifecycle),
      };
    });

    const submitted: ReviewsMeSubmittedItem[] = submittedReviews.map((review) => {
      const bookingId = review.bookingId ? String(review.bookingId) : null;
      const reviewMediaSessionId = String(review.mediaSessionId || "").trim();
      const proofFromBooking = bookingId ? proofAssetsByBookingId.get(bookingId) : null;
      const proofFromSession = reviewMediaSessionId ? proofAssetsByMediaSessionId.get(reviewMediaSessionId) : null;
      const resolvedBookingId = bookingId || proofFromSession?.bookingId || null;
      const resolvedAssetId = proofFromSession?.assetId || proofFromBooking?.assetId || null;
      const videoUrl =
        resolvedBookingId && resolvedAssetId
          ? `/api/bookings/${resolvedBookingId}/media/${resolvedAssetId}/download`
          : null;

      const hasVideo = Boolean(videoUrl);
      const mediaState = classifySubmittedReviewMediaState({
        hasCustomerVisibleVideo: hasVideo,
        hasLinkedMediaRecord: Boolean(reviewMediaSessionId),
      });

      return {
        reviewId: String(review.id),
        bookingId,
        vendorId: String(review.vendorId),
        vendorName: resolveVendorName(review.vendor),
        serviceName: resolveServiceName(review.booking?.service),
        rating: Number(review.rating),
        comment: String(review.comment || ""),
        submittedAt: (review.date || review.createdAt)?.toISOString?.() || review.createdAt.toISOString(),
        hasVideo,
        videoUrl,
        hasProof: mediaState.hasProof,
        proofUrl: videoUrl,
        hasLinkedMediaRecord: Boolean(reviewMediaSessionId),
        mediaState: mediaState.state,
        statusMessage: mediaState.message,
      };
    });

    const videoBased = submitted.filter((row) => row.hasVideo);

    if (summaryOnly) {
      return NextResponse.json({
        summary: {
          pendingTotal: pending.length,
          awaitingVideoTotal: awaiting.length,
          submittedTotal: submitted.length,
          videoBasedTotal: videoBased.length,
        },
      });
    }

    return NextResponse.json({
      pending,
      awaiting,
      submitted,
      videoBased,
      proofBased: videoBased,
    });
  } catch (error: any) {
    console.error("[reviews/me] GET error:", error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: "Your review history is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
        },
        { status: 503 }
      );
    }
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
