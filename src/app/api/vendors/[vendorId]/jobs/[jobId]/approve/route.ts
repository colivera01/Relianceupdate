import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import {
  CoreAdminAuditError,
  submitPackageForCoreAdminAudit,
} from "@/lib/service-video-admin-audit";
import { sendCoreAdminAuditReadyNotification } from "@/lib/service-video-admin-audit-notifications";
import { ensureRetentionSchedulesForBooking } from "@/lib/media-lifecycle";

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
      select: {
        id: true,
        userId: true,
        status: true,
        title: true,
        clientName: true,
        customerMetadata: true,
        date: true,
        updatedAt: true,
        user: { select: { name: true, email: true, phone: true } },
        service: { select: { name: true } },
        vendor: { select: { name: true, businessName: true } },
      },
    });
    if (!booking) return NextResponse.json({ error: "Job not found for this vendor." }, { status: 404 });

    const currentStatus = normalizeBookingStatus(booking.status);
    if (!['AWAITING_REVIEW', 'COMPLETED'].includes(currentStatus)) {
      return NextResponse.json(
        {
          error: "Only work records awaiting manager review can be approved.",
          code: "INVALID_APPROVAL_STATUS",
          status: currentStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    let submission;
    try {
      submission = await submitPackageForCoreAdminAudit({
        bookingId: booking.id,
        vendorId,
        managerUserId: manager.userId,
        managerMembershipId: manager.membershipId,
      });
    } catch (approvalError: any) {
      return NextResponse.json(
        {
          error: "The Service Video package cannot be submitted for Reliance Audit because its evidence chain is incomplete.",
          code: approvalError instanceof CoreAdminAuditError
            ? approvalError.code
            : "ADMIN_AUDIT_EVIDENCE_CHAIN_INCOMPLETE",
          details: approvalError?.message || "Required evidence is missing.",
        },
        { status: 409 }
      );
    }

    await ensureRetentionSchedulesForBooking(booking.id);

    await recordLifecycleAudit({
      actionType: "service_video_submitted_for_admin_audit",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: manager.userId,
      previousValue: { status: currentStatus },
      newValue: {
        status: "COMPLETED",
        operationalPhase: "AWAITING_ADMIN_REVIEW",
        packageId: submission.package.id,
      },
      metadata: {
        vendorId,
        packageHash: submission.package.packageHash,
        managerDecisionId: submission.managerDecision.id,
      },
    });

    const notification = await sendCoreAdminAuditReadyNotification({
      notificationId: submission.adminNotificationId,
      bookingNotificationId: submission.adminEmailNotificationId,
      bookingId: booking.id,
      vendorId,
      packageId: submission.package.id,
      packageVersion: submission.package.version,
      actorUserId: manager.userId,
      baseUrl: new URL(request.url).origin,
    });

    return NextResponse.json({
      success: true,
      alreadySubmitted: !submission.firstTransition,
      message: "Service Videos submitted for Reliance Audit. Customer access remains locked until Admin PASS.",
      job: submission.booking,
      adminAudit: {
        packageId: submission.package.id,
        packageVersion: submission.package.version,
        status: submission.package.status,
      },
      notification,
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to submit Service Videos for Reliance Audit", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
