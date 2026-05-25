import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

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
      select: { id: true, status: true, customerMetadata: true },
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
          error: "Approval requires Intro, In Progress, and Completed videos.",
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
          customerMetadata: setOperationalPhaseOnMetadataJson(booking.customerMetadata, "COMPLETED"),
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
