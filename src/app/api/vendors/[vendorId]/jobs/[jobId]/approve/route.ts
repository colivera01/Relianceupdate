import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { createAdminNotificationWithEmail } from "@/lib/admin-notifications";
import { TRUST_OUTCOME_TYPES, tryRecordFinalizedOperationalOutcome } from "@/lib/trust-score-outcome-foundation";
import { tryRecalculateVendorTrustScore } from "@/lib/trust-score-calculator";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: { id: true, status: true, customerMetadata: true, scheduledFor: true, date: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Job not found for this vendor." }, { status: 404 });
    }

    const currentStatus = normalizeBookingStatus(booking.status);
    if (currentStatus !== "AWAITING_REVIEW") {
      return NextResponse.json(
        {
          error: "Only jobs in AWAITING_REVIEW can be approved.",
          code: "INVALID_APPROVAL_STATUS",
          status: currentStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const sessions = await (prisma as any).mediaSession.findMany({
      where: { vendorId, bookingId: booking.id },
      select: {
        id: true,
        sessionType: true,
        vendorJobVideoStage: true,
        mediaAssets: {
          where: { deletedAt: null },
          select: { id: true, moderationStatus: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    const packageState = evaluateVendorJobPackageState(sessions);
    if (!packageState.hasAllRequiredStages) {
      return NextResponse.json(
        {
          error: "Approval requires Starting Condition, Work in Progress, and Final Result videos.",
          code: "COMPLETION_REQUIRES_COMPLETE_VIDEO_PACKAGE",
        },
        { status: 409 }
      );
    }

    const requiredStageSessionIds = sessions
      .filter((row: any) => {
        const sessionType = String(row?.sessionType || "").trim().toUpperCase();
        const stage = String(row?.vendorJobVideoStage || "").trim().toUpperCase();
        return sessionType === "JOB_SERVICE_VIDEO" && ["INTRO", "IN_PROGRESS", "COMPLETED"].includes(stage);
      })
      .map((row: any) => String(row.id))
      .filter(Boolean);

    const completedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "COMPLETED",
          date: completedAt,
          customerMetadata: setOperationalPhaseOnMetadataJson(booking.customerMetadata, "AWAITING_ADMIN_REVIEW"),
        },
        select: { id: true, status: true, date: true, updatedAt: true },
      });

      const moderationUpdate = requiredStageSessionIds.length
        ? await (tx as any).mediaAsset.updateMany({
            where: {
              mediaSessionId: { in: requiredStageSessionIds },
              deletedAt: null,
            },
            data: {
              moderationStatus: "pending_review",
              visibilityStatus: "private",
              moderationReason: null,
              moderatedAt: null,
              moderatedByUserId: null,
            },
          })
        : { count: 0 };

      return { updatedBooking, moderationUpdateCount: Number(moderationUpdate?.count || 0) };
    });

    await recordLifecycleAudit({
      actionType: "job_approved",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: manager.userId,
      previousValue: { status: currentStatus },
      newValue: { status: "COMPLETED", date: completedAt.toISOString() },
      metadata: {
        vendorId,
        moderationQueuedAssets: updated.moderationUpdateCount,
      },
    });

    await tryRecordFinalizedOperationalOutcome(prisma as any, {
      vendorId,
      bookingId: booking.id,
      outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
      sourceEntityType: "booking",
      sourceEntityId: booking.id,
      finalizedAt: completedAt,
      finalizedByUserId: manager.userId || null,
      metadata: {
        previousStatus: currentStatus,
        moderationQueuedAssets: updated.moderationUpdateCount,
      },
    });

    // Phase 1C: late-completion is a genuinely finalized signal (the job was approved
    // AFTER its scheduled date). Emit it as a separate operational-reliability ding;
    // the workflow still counts as completed above. Best-effort / non-blocking.
    const scheduledTime = booking.scheduledFor ? new Date(booking.scheduledFor).getTime() : NaN;
    if (Number.isFinite(scheduledTime) && completedAt.getTime() > scheduledTime) {
      await tryRecordFinalizedOperationalOutcome(prisma as any, {
        vendorId,
        bookingId: booking.id,
        outcomeType: TRUST_OUTCOME_TYPES.LATE_COMPLETION,
        sourceEntityType: "booking",
        sourceEntityId: booking.id,
        finalizedAt: completedAt,
        finalizedByUserId: manager.userId || null,
        metadata: {
          scheduledFor: new Date(scheduledTime).toISOString(),
          completedAt: completedAt.toISOString(),
          lateByMs: completedAt.getTime() - scheduledTime,
        },
      });
    }

    // Internal-only, non-blocking Trust Score recalculation.
    await tryRecalculateVendorTrustScore(prisma as any, vendorId, "job_approved", "job_approve");

    try {
      await createAdminNotificationWithEmail({
        vendorId,
        type: "MEDIA_MODERATION_REQUIRED",
        title: "Service video package waiting for admin review",
        message:
          "A manager approved a completed three-stage service video package. Admin moderation is required before customer or public visibility.",
        metadata: {
          bookingId: booking.id,
          vendorId,
          moderationQueuedAssets: updated.moderationUpdateCount,
          source: "POST /api/vendors/[vendorId]/jobs/[jobId]/approve",
        },
        surfaceHref: "/admin/media-moderation",
        baseUrl: new URL(request.url).origin,
        actorUserId: manager.userId,
      });
    } catch (notificationError) {
      console.error("[vendor/jobs/approve] admin media notification failed:", notificationError);
    }

    return NextResponse.json({
      success: true,
      message: "Job completion approved. Media package sent to moderation queue.",
      job: updated.updatedBooking,
      moderationQueuedAssets: updated.moderationUpdateCount,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to approve job completion", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
