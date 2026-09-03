import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminAuditLog } from "@/lib/admin-audit";

interface RouteParams {
  params: Promise<{ reviewId: string }>;
}

type ReviewModerationAction =
  | "approve_public"
  | "approve_vendor_private"
  | "reject"
  | "flag"
  | "invalidate_review";

const ACTIONS = new Set<ReviewModerationAction>([
  "approve_public",
  "approve_vendor_private",
  "reject",
  "flag",
  "invalidate_review",
]);

export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const { reviewId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "") as ReviewModerationAction;
    const moderationReason = typeof body?.moderationReason === "string" ? body.moderationReason.trim() : "";

    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: "Unsupported moderation action", message: "Unsupported moderation action" },
        { status: 422 }
      );
    }

    if ((action === "reject" || action === "invalidate_review") && !moderationReason) {
      return NextResponse.json(
        { success: false, error: "moderationReason is required for this action", message: "moderationReason is required for this action" },
        { status: 422 }
      );
    }

    const existing = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        vendorId: true,
        moderationStatus: true,
        visibilityStatus: true,
        moderationReason: true,
        moderatedAt: true,
        moderatedByUserId: true,
        contractVersion: true,
        ratingValidityStatus: true,
        ratingInvalidationReason: true,
        ratingInvalidatedAt: true,
        ratingInvalidatedByUserId: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Review not found", message: "Review not found" },
        { status: 404 }
      );
    }

    const nextState =
      action === "approve_public"
        ? { moderationStatus: "approved", visibilityStatus: "public", moderationReason: moderationReason || null }
        : action === "approve_vendor_private"
        ? { moderationStatus: "approved", visibilityStatus: "private", moderationReason: moderationReason || null }
        : action === "reject"
        ? { moderationStatus: "rejected", visibilityStatus: "private", moderationReason }
        : { moderationStatus: "flagged", visibilityStatus: "private", moderationReason: moderationReason || null };

    if (action === "invalidate_review") {
      if (!existing.contractVersion || existing.contractVersion < 2) {
        return NextResponse.json(
          { success: false, error: "Historical reviews retain their original moderation contract", message: "Historical reviews retain their original moderation contract" },
          { status: 409 }
        );
      }
      if (existing.ratingValidityStatus === "invalid") {
        return NextResponse.json({ success: true, message: "Review is already invalidated", review: existing });
      }
      const invalidatedAt = new Date();
      const updated = await prisma.review.update({
        where: { id: reviewId },
        data: {
          ratingValidityStatus: "invalid",
          ratingInvalidationReason: moderationReason,
          ratingInvalidatedAt: invalidatedAt,
          ratingInvalidatedByUserId: userId,
          visibilityStatus: "private",
        },
      });
      await createAdminAuditLog({
        actionType: "REVIEW_RATING_INVALIDATED",
        entityType: "review",
        entityId: reviewId,
        actorUserId: userId,
        previousValue: {
          ratingValidityStatus: existing.ratingValidityStatus,
          ratingInvalidationReason: existing.ratingInvalidationReason,
        },
        newValue: {
          ratingValidityStatus: "invalid",
          ratingInvalidationReason: moderationReason,
          ratingInvalidatedAt: invalidatedAt.toISOString(),
        },
        metadata: { source: "PATCH /api/admin/reviews/[reviewId]/moderate", vendorId: existing.vendorId },
      });
      return NextResponse.json({ success: true, message: "Review rating evidence invalidated", review: updated });
    }

    const noChange =
      existing.moderationStatus === nextState.moderationStatus &&
      existing.visibilityStatus === nextState.visibilityStatus &&
      (existing.moderationReason || null) === (nextState.moderationReason || null);

    if (noChange) {
      return NextResponse.json({
        success: true,
        message: "Review moderation state already matches requested action",
        review: existing,
      });
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        moderationStatus: nextState.moderationStatus,
        visibilityStatus: nextState.visibilityStatus,
        moderationReason: nextState.moderationReason,
        moderatedAt: new Date(),
        moderatedByUserId: userId,
      },
      select: {
        id: true,
        vendorId: true,
        userId: true,
        rating: true,
        comment: true,
        createdAt: true,
        moderationStatus: true,
        visibilityStatus: true,
        moderationReason: true,
        moderatedAt: true,
        moderatedByUserId: true,
      },
    });

    const auditActionType =
      action === "approve_public"
        ? "REVIEW_APPROVED_PUBLIC"
        : action === "approve_vendor_private"
        ? "REVIEW_APPROVED_PRIVATE"
        : action === "reject"
        ? "REVIEW_REJECTED"
        : "REVIEW_FLAGGED";

    await createAdminAuditLog({
      actionType: auditActionType,
      entityType: "review",
      entityId: reviewId,
      actorUserId: userId,
      previousValue: {
        moderationStatus: existing.moderationStatus,
        visibilityStatus: existing.visibilityStatus,
        moderationReason: existing.moderationReason || null,
        moderatedAt: existing.moderatedAt?.toISOString() || null,
        moderatedByUserId: existing.moderatedByUserId || null,
      },
      newValue: {
        moderationStatus: updated.moderationStatus,
        visibilityStatus: updated.visibilityStatus,
        moderationReason: updated.moderationReason || null,
        moderatedAt: updated.moderatedAt?.toISOString() || null,
        moderatedByUserId: updated.moderatedByUserId || null,
      },
      metadata: {
        source: "PATCH /api/admin/reviews/[reviewId]/moderate",
        vendorId: updated.vendorId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Review moderation action '${action}' applied successfully`,
      review: updated,
    });
  } catch (error: any) {
    console.error("[admin/reviews/:reviewId/moderate] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to moderate review", message: "Failed to moderate review" },
      { status: 500 }
    );
  }
}
