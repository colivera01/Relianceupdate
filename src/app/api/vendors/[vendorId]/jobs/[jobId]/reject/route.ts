import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { requestServiceVideoCorrection, REQUIRED_SERVICE_VIDEO_STAGES, type ServiceVideoStage } from "@/lib/service-video-evidence";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import { sendJobRejectionNotification } from "@/lib/notifications/send-job-rejection";

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
    const body = await request.json().catch(() => ({}));
    const correctionReason = String(body?.correctionReason || body?.rejectionReason || "").trim();
    const expectedPackageId = String(body?.packageId || "").trim();
    const expectedPackageVersion = Number(body?.packageVersion);
    const requestedStages = Array.isArray(body?.stages) ? body.stages : [];
    const stages: ServiceVideoStage[] = Array.from(
      new Set(
        requestedStages
          .map((stage: unknown) => String(stage || "").trim().toUpperCase())
          .filter((stage: string): stage is ServiceVideoStage =>
            REQUIRED_SERVICE_VIDEO_STAGES.includes(stage as ServiceVideoStage)
          )
      ) as Set<ServiceVideoStage>
    );

    if (!correctionReason) {
      return NextResponse.json(
        {
          error: "A correction reason is required.",
          code: "CORRECTION_REASON_REQUIRED",
        },
        { status: 400 }
      );
    }
    if (stages.length === 0) {
      return NextResponse.json(
        { error: "At least one stage must be selected.", code: "CORRECTION_STAGE_REQUIRED" },
        { status: 400 }
      );
    }
    if (!expectedPackageId || !Number.isInteger(expectedPackageVersion) || expectedPackageVersion < 1) {
      return NextResponse.json(
        {
          error: "The exact current Service Video package context is required.",
          code: "CORRECTION_PACKAGE_CONTEXT_REQUIRED",
        },
        { status: 400 },
      );
    }

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: {
        id: true,
        status: true,
        title: true,
        clientName: true,
        customerMetadata: true,
        service: { select: { name: true } },
        vendor: { select: { name: true, businessName: true } },
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Job not found for this vendor." }, { status: 404 });
    }

    const currentStatus = normalizeBookingStatus(booking.status);
    if (currentStatus !== "AWAITING_REVIEW") {
      return NextResponse.json(
        {
          error: "Only work records awaiting Manager review can receive a correction request.",
          code: "INVALID_CORRECTION_STATUS",
          status: currentStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const requestedAt = new Date();
    await requestServiceVideoCorrection({
      bookingId: booking.id,
      vendorId,
      managerUserId: manager.userId,
      managerMembershipId: manager.membershipId,
      expectedPackageId,
      expectedPackageVersion,
      stages,
      reason: correctionReason,
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "IN_PROGRESS",
        customerMetadata: setOperationalPhaseOnMetadataJson(booking.customerMetadata, "IN_PROGRESS"),
        rejectionReason: correctionReason,
        rejectedAt: null,
        rejectedBy: manager.userId,
      },
    });

    await recordLifecycleAudit({
      actionType: "service_video_correction_requested",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: manager.userId,
      previousValue: { status: currentStatus },
      newValue: { status: "IN_PROGRESS", correctionRequestedAt: requestedAt.toISOString() },
      metadata: {
        vendorId,
        correctionReason,
        stages,
      },
    });

    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    const assignedMembers = assignment.assignedMembershipIds.length
      ? await prisma.vendorMembership.findMany({
          where: {
            vendorId,
            id: { in: assignment.assignedMembershipIds },
            status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
          },
          include: { user: { select: { name: true, email: true, phone: true } } },
        })
      : [];
    const baseUrl = String(process.env.APP_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
    const notifications = [];
    for (const member of assignedMembers) {
      const token = createEmployeeCaptureToken({ vendorId, bookingId: booking.id, membershipId: member.id });
      const employeeJobLink = appendEmployeeCaptureToken(
        `${baseUrl}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
        token
      );
      const result = await sendJobRejectionNotification({
        bookingId: booking.id,
        actorUserId: manager.userId,
        employeeName: member.user?.name || null,
        employeeEmail: member.user?.email || null,
        employeePhone: member.user?.phone || null,
        employeeJobLink,
        vendorName: String(booking.vendor?.businessName || booking.vendor?.name || "Reliance Vendor"),
        jobTitle: String(booking.title || booking.service?.name || "Service order"),
        rejectionReason: `${correctionReason} Stages: ${stages.join(", ")}.`,
      });
      notifications.push({ membershipId: member.id, ...result });
    }

    return NextResponse.json({
      success: true,
      code: "SERVICE_VIDEO_CORRECTION_REQUESTED",
      message: "Changes requested for the selected video stage or stages.",
      details: {
        correctionReason,
        stages,
        notifications: {
          sentCount: notifications.filter((result) => result.anySuccess).length,
          results: notifications,
        },
      },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error?.message === "SERVICE_VIDEO_PACKAGE_VERSION_MISMATCH") {
      return NextResponse.json(
        {
          error: "This review page no longer matches the current Service Video package. Reload before requesting a correction.",
          code: "SERVICE_VIDEO_PACKAGE_VERSION_MISMATCH",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to request stage correction",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
