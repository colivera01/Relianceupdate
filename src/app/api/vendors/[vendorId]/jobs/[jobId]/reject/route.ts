import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { sendJobRejectionNotification } from "@/lib/notifications/send-job-rejection";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
}

function displayNameForMembershipUser(
  user: { name: string | null; email: string | null } | null | undefined
) {
  if (!user) return "Team member";
  const name = String(user.name || "").trim();
  const email = String(user.email || "").trim();
  return name || email || "Team member";
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
    const { vendorId, jobId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const rejectionReason = String(body?.rejectionReason || "").trim();

    if (!rejectionReason) {
      return NextResponse.json(
        {
          error: "rejectionReason is required.",
          code: "REJECTION_REASON_REQUIRED",
        },
        { status: 400 }
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
          error: "Only jobs in AWAITING_REVIEW can be rejected.",
          code: "INVALID_REJECTION_STATUS",
          status: currentStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const rejectedAt = new Date();
    await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        status: "IN_PROGRESS",
        rejectionReason,
        rejectedAt,
        rejectedBy: manager.userId,
      },
    });

    await recordLifecycleAudit({
      actionType: "job_rejected",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: manager.userId,
      previousValue: { status: currentStatus },
      newValue: { status: "IN_PROGRESS", rejectedAt: rejectedAt.toISOString() },
      metadata: {
        vendorId,
        rejectionReason,
      },
    });

    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    const assignedMembershipIds = Array.from(new Set(assignment.assignedMembershipIds));
    const notificationResults: Array<{
      membershipId: string;
      employeeName: string;
      anySuccess: boolean;
      phoneNumberUsed?: string | null;
      channels: unknown[];
      errorMessage?: string;
    }> = [];
    if (assignedMembershipIds.length > 0) {
      const members = await prisma.vendorMembership.findMany({
        where: {
          vendorId,
          id: { in: assignedMembershipIds },
          status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
        },
        include: {
          user: { select: { name: true, email: true, phone: true } },
        },
      });
      const byId = new Map(members.map((member) => [String(member.id), member]));
      const baseUrl = resolveJobLinkBaseUrl(request);
      const vendorName = String(booking.vendor?.businessName || booking.vendor?.name || "Reliance Vendor");
      const jobTitle = String(booking.title || booking.service?.name || "Assigned job");

      for (const membershipId of assignedMembershipIds) {
        const member = byId.get(membershipId);
        if (!member) {
          notificationResults.push({
            membershipId,
            employeeName: assignment.assignedEmployees[assignedMembershipIds.indexOf(membershipId)] || "Team member",
            anySuccess: false,
            errorMessage: "assigned_membership_not_found",
            channels: [],
          });
          continue;
        }
        try {
          const employeeJobLink = appendEmployeeCaptureToken(
            `${baseUrl}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
            createEmployeeCaptureToken({
              vendorId,
              bookingId: booking.id,
              membershipId,
            })
          );
          const notification = await sendJobRejectionNotification({
            bookingId: booking.id,
            actorUserId: manager.userId,
            employeeName: displayNameForMembershipUser(member.user),
            employeeEmail: member.user?.email || null,
            employeePhone: member.user?.phone || null,
            employeeJobLink,
            vendorName,
            jobTitle,
            rejectionReason,
          });
          notificationResults.push({
            membershipId,
            employeeName: displayNameForMembershipUser(member.user),
            anySuccess: notification.anySuccess,
            phoneNumberUsed: notification.phoneNumberUsed,
            channels: notification.channels,
          });
        } catch (error) {
          notificationResults.push({
            membershipId,
            employeeName: displayNameForMembershipUser(member.user),
            anySuccess: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            channels: [],
          });
        }
      }

      await recordLifecycleAudit({
        actionType: "employee_video_rejection_notified",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: manager.userId,
        newValue: { notificationResults },
        metadata: { vendorId },
      });
    }

    return NextResponse.json({
      success: true,
      code: "JOB_REJECTED",
      message: "Job returned to in-progress for corrections",
      details: {
        rejectionReason,
        notifications: {
          sentCount: notificationResults.filter((result) => result.anySuccess).length,
          results: notificationResults,
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
    return NextResponse.json(
      {
        error: "Failed to reject job completion",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
