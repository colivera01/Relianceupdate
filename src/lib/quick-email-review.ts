import { prisma } from "@/server/db";
import { createAdminNotificationWithEmail } from "@/lib/admin-notifications";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { verifyReviewEmailToken } from "@/lib/review-email-token";
import { getVisibilityStatusesForAudience } from "@/lib/media-visibility";
import { isCompletedStatus, normalizeBookingStatusKey } from "@/lib/my-bookings";

export type QuickEmailReviewResult =
  | {
      status: "created";
      reviewId: string;
      rating: number;
      bookingId: string;
      vendorId: string;
      vendorName: string;
      serviceName: string;
      canAddComment: true;
    }
  | {
      status: "already_submitted";
      reviewId: string | null;
      rating: number | null;
      bookingId: string | null;
      vendorId: string | null;
      vendorName: string;
      serviceName: string;
      canAddComment: boolean;
    }
  | {
      status: "invalid" | "not_ready";
      message: string;
    };

export type QuickEmailCommentResult =
  | {
      status: "saved";
      reviewId: string;
      rating: number;
      vendorName: string;
      serviceName: string;
    }
  | {
      status: "already_submitted" | "invalid";
      message: string;
    };

function normalizeRating(value: unknown): number | null {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return rating;
}

function normalizeComment(value: unknown): string {
  return String(value || "").trim().slice(0, 2000);
}

function publicVendorName(vendor: { businessName?: string | null; name?: string | null } | null | undefined) {
  return String(vendor?.businessName || vendor?.name || "the service provider").trim();
}

function serviceLabel(booking: { title?: string | null; service?: { name?: string | null } | null } | null | undefined) {
  return String(booking?.service?.name || booking?.title || "your recent service").trim();
}

async function loadReviewWindow(reviewWindowId: string) {
  return (prisma as any).reviewWindow.findUnique({
    where: { id: reviewWindowId },
    include: {
      booking: {
        select: {
          id: true,
          userId: true,
          vendorId: true,
          status: true,
          title: true,
          customerMetadata: true,
          service: { select: { name: true } },
          vendor: { select: { businessName: true, name: true } },
        },
      },
      review: { select: { id: true, rating: true, comment: true } },
    },
  });
}

export async function submitQuickEmailReviewRating(input: {
  token: string | null | undefined;
  rating: unknown;
}): Promise<QuickEmailReviewResult> {
  const claims = verifyReviewEmailToken(input.token);
  if (!claims) {
    return {
      status: "invalid",
      message: "This review link is invalid. Sign in to Reliance to leave an optional review.",
    };
  }
  const rating = normalizeRating(input.rating);
  if (!rating) return { status: "invalid", message: "Choose a rating from 1 to 5 stars." };

  const window = await loadReviewWindow(claims.reviewWindowId);
  if (!window || !window.booking) {
    return { status: "invalid", message: "This review opportunity could not be found." };
  }

  const vendorName = publicVendorName(window.booking.vendor);
  const currentServiceLabel = serviceLabel(window.booking);

  const existingReview = await (prisma as any).review.findFirst({
    where: { bookingId: window.bookingId },
    select: { id: true, rating: true, comment: true },
  });
  if (existingReview || window.reviewId || String(window.status || '').toLowerCase() === 'submitted') {
    const review = existingReview || window.review || null;
    return {
      status: "already_submitted",
      reviewId: review?.id || window.reviewId || null,
      rating: typeof review?.rating === "number" ? review.rating : null,
      bookingId: window.bookingId || null,
      vendorId: window.vendorId || null,
      vendorName,
      serviceName: currentServiceLabel,
      canAddComment: Boolean(review?.id && !review?.comment),
    };
  }

  if (!isCompletedStatus(normalizeBookingStatusKey(window.booking.status))) {
    return { status: 'not_ready', message: 'This service is not complete yet.' };
  }
  const customerVisibleFinalProof = await (prisma as any).mediaAsset.findFirst({
    where: {
      mediaSessionId: String(window.mediaSessionId),
      deletedAt: null,
      moderationStatus: 'approved',
      archiveStatus: 'active',
      visibilityStatus: { in: getVisibilityStatusesForAudience('customer') },
      mediaSession: {
        sessionType: 'JOB_SERVICE_VIDEO',
        vendorJobVideoStage: 'COMPLETED',
      },
    },
    select: { id: true },
  });
  if (!customerVisibleFinalProof) {
    return {
      status: 'not_ready',
      message: 'An approved customer-visible final service video is required before reviewing.',
    };
  }

  const created = await (prisma as any).$transaction(async (tx: any) => {
    const review = await tx.review.create({
      data: {
        userId: String(window.booking.userId),
        vendorId: String(window.vendorId),
        bookingId: String(window.bookingId),
        mediaSessionId: String(window.mediaSessionId),
        rating,
        comment: null,
        source: "customer",
        submittedVia: "email_link",
        assignedMembershipId: null,
        assignedEmployeeName: null,
        assignedUserId: null,
        attributionVersion: 2,
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        date: new Date(),
      },
    });

    await tx.reviewWindow.update({
      where: { id: String(window.id) },
      data: { status: "submitted", reviewId: review.id, closedAt: new Date() },
    });

    await tx.reviewPromptEvent.create({
      data: {
        reviewWindowId: String(window.id),
        eventType: "quick_review_submitted",
        metadata: JSON.stringify({
          rating,
          submittedVia: "email_link",
          source: "email_star_click",
          reviewCountsAfterAdminModeration: true,
        }),
      },
    });

    return review;
  });

  await createAdminAuditLog({
    actionType: "review_capture_submitted",
    entityType: "review",
    entityId: created.id,
    actorUserId: String(window.booking.userId),
    metadata: {
      source: "email_quick_review",
      bookingId: window.bookingId,
      vendorId: window.vendorId,
      reviewWindowId: window.id,
      rating,
      moderationStatus: "pending_review",
      visibilityStatus: "private",
    },
  });

  try {
    await createAdminNotificationWithEmail({
      vendorId: String(window.vendorId),
      type: "REVIEW_MODERATION_REQUIRED",
      title: "Customer quick review waiting for moderation",
      message: `A customer submitted a ${rating}-star quick review from email. It needs admin review before it affects public review metrics or Trust Score.`,
      metadata: {
        reviewId: created.id,
        bookingId: window.bookingId,
        vendorId: window.vendorId,
        reviewWindowId: window.id,
        rating,
        submittedVia: "email_link",
        source: "email_star_click",
      },
      surfaceHref: "/admin/reviews",
      actorUserId: String(window.booking.userId),
    });
  } catch (error) {
    console.error("[quick-email-review] admin moderation notification failed:", error);
  }

  return {
    status: "created",
    reviewId: created.id,
    rating,
    bookingId: String(window.bookingId),
    vendorId: String(window.vendorId),
    vendorName,
    serviceName: currentServiceLabel,
    canAddComment: true,
  };
}

export async function saveQuickEmailReviewComment(input: {
  token: string | null | undefined;
  comment: unknown;
}): Promise<QuickEmailCommentResult> {
  const claims = verifyReviewEmailToken(input.token);
  if (!claims) return { status: 'invalid', message: 'This review link is invalid.' };
  const comment = normalizeComment(input.comment);
  if (!comment) return { status: "invalid", message: "Enter a comment before saving." };

  const window = await loadReviewWindow(claims.reviewWindowId);
  if (!window?.reviewId || !window.booking) {
    return { status: "invalid", message: "A saved review was not found for this link." };
  }

  const existing = await (prisma as any).review.findUnique({
    where: { id: String(window.reviewId) },
    select: { id: true, rating: true, comment: true, bookingId: true },
  });
  if (!existing || String(existing.bookingId || "") !== String(window.bookingId || "")) {
    return { status: "invalid", message: "A saved review was not found for this link." };
  }
  if (existing.comment) {
    return { status: "already_submitted", message: "A comment has already been saved for this review." };
  }

  const updated = await (prisma as any).review.update({
    where: { id: existing.id },
    data: { comment },
    select: { id: true, rating: true },
  });

  await createAdminAuditLog({
    actionType: "review_comment_added",
    entityType: "review",
    entityId: existing.id,
    actorUserId: String(window.booking.userId),
    metadata: {
      source: "email_quick_review_comment",
      bookingId: window.bookingId,
      vendorId: window.vendorId,
      reviewWindowId: window.id,
    },
  });

  return {
    status: "saved",
    reviewId: updated.id,
    rating: updated.rating,
    vendorName: publicVendorName(window.booking.vendor),
    serviceName: serviceLabel(window.booking),
  };
}
