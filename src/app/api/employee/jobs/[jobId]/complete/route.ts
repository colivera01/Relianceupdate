import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  ensureVendorAccountCanOperate,
} from "@/lib/account-status";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { getEmployeeRuntimeErrorResponse } from "@/lib/employee-runtime-errors";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { sendJobCorrectionReadyNotification } from "@/lib/notifications/send-job-correction-ready";
import { setOperationalPhaseOnMetadataJson } from "@/lib/vendor-job-operational-phase";
import { submitServiceVideoPackage } from "@/lib/service-video-evidence";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

function resolveJobLinkBaseUrl(request: Request): string {
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (appBaseUrl) return appBaseUrl;
  const origin = String(request.headers.get("origin") || "").trim().replace(/\/+$/, "");
  if (origin) return origin;
  try {
    return new URL(request.url).origin.replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { jobId } = await context.params;
    const userId = await getUserIdFromRequest(request);
    const tokenAccess = await resolveEmployeeCaptureAccess(request, { bookingId: jobId });
    if (!userId && !tokenAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (userId && !tokenAccess) await ensureUserAccountCanAct(userId);
    console.log("[employee-complete] route hit", { jobId, userId });

    const memberships = tokenAccess
      ? [{ id: tokenAccess.membershipId, vendorId: tokenAccess.vendorId, role: "EMPLOYEE" }]
      : await prisma.vendorMembership.findMany({
          where: { userId: userId!, status: "ACTIVE" },
          select: { id: true, vendorId: true, role: true },
        });
    const booking = await prisma.booking.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        vendorId: true,
        status: true,
        title: true,
        customerMetadata: true,
        rejectionReason: true,
        service: { select: { name: true } },
        vendor: { select: { name: true, businessName: true } },
      },
    });
    if (!booking) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    await ensureVendorAccountCanOperate(booking.vendorId);

    const vendorMembershipsForJobVendor = memberships.filter((m) => m.vendorId === booking.vendorId);
    const vendorMembershipIds = vendorMembershipsForJobVendor.map((m) => m.id);
    const hasManagerMembershipForVendor = vendorMembershipsForJobVendor.some(
      (m) => String(m.role || "").trim().toUpperCase() === "MANAGER"
    );
    if (vendorMembershipIds.length === 0) {
      return NextResponse.json({ error: "Forbidden: active employee membership required" }, { status: 403 });
    }
    const assigned = parseAssignmentMetadata(booking.customerMetadata);
    const isAssignedToRequester = assigned.assignedMembershipIds.some((id) => vendorMembershipIds.includes(id));
    if (!isAssignedToRequester && !hasManagerMembershipForVendor) {
      return NextResponse.json({ error: "Forbidden: this job is not assigned to you" }, { status: 403 });
    }

    const normalizedStatus = String(booking.status || "").trim().toUpperCase();
    if (
      !["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(normalizedStatus)
    ) {
      return NextResponse.json(
        {
          error: "Only active assigned jobs can be submitted for manager review.",
          code: "INVALID_COMPLETE_STATUS",
          status: normalizedStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const submittingMembershipId = tokenAccess?.membershipId || vendorMembershipsForJobVendor[0]?.id;
    if (!submittingMembershipId) {
      return NextResponse.json({ error: "Active submitting membership is required" }, { status: 403 });
    }
    try {
      await submitServiceVideoPackage({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        submittedByUserId: tokenAccess?.userId || userId || null,
        submittedByMembershipId: submittingMembershipId,
      });
    } catch (packageError: any) {
      return NextResponse.json(
        {
          error:
            "Cannot submit until Starting Condition, Work in Progress, and Final Result are saved with complete recording evidence.",
          code: "SERVICE_VIDEO_EVIDENCE_CHAIN_INCOMPLETE",
          details: packageError?.message || "Required stage evidence is missing.",
        },
        { status: 409 }
      );
    }

    const updated = await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        status: "AWAITING_REVIEW",
        customerMetadata: setOperationalPhaseOnMetadataJson(
          booking.customerMetadata,
          "AWAITING_VENDOR_REVIEW"
        ),
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null,
      },
      select: { id: true, status: true, date: true },
    });

    const notificationResults = [];
    const managers = await prisma.vendorMembership.findMany({
      where: {
        vendorId: booking.vendorId,
        role: "MANAGER",
        status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    const reviewLink = `${resolveJobLinkBaseUrl(request)}/vendor/jobs/${encodeURIComponent(booking.id)}`;
    const vendorName = String(booking.vendor?.businessName || booking.vendor?.name || "Reliance Vendor");
    const jobTitle = String(booking.title || booking.service?.name || "Service order");
    const employeeName = tokenAccess?.employeeName || "The assigned employee";
    for (const manager of managers) {
      try {
        const notification = await sendJobCorrectionReadyNotification({
          bookingId: booking.id,
          actorUserId: tokenAccess?.userId || userId || "employee-capture-link",
          managerName: manager.user?.name || null,
          managerEmail: manager.user?.email || null,
          managerPhone: manager.user?.phone || null,
          managerReviewLink: reviewLink,
          vendorName,
          jobTitle,
          employeeName,
        });
        notificationResults.push({
          membershipId: manager.id,
          managerName: manager.user?.name || manager.user?.email || "Manager",
          anySuccess: notification.anySuccess,
          phoneNumberUsed: notification.phoneNumberUsed,
          channels: notification.channels,
        });
      } catch (error) {
        notificationResults.push({
          membershipId: manager.id,
          managerName: manager.user?.name || manager.user?.email || "Manager",
          anySuccess: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          channels: [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      job: updated,
      notifications: {
        managerReviewReady: true,
        sentCount: notificationResults.filter((result) => result.anySuccess).length,
        results: notificationResults,
      },
    });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const runtimeError = getEmployeeRuntimeErrorResponse("complete", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
