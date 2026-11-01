import { NextResponse } from "next/server";

import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { requireVendorMembership } from "@/lib/membership-auth";
import { requiredSafetyCheckForStage } from "@/lib/recording/employee-safety";
import { assertV2EmployeeServiceOrderEntry } from "@/lib/recording/employee-v2-service-order-entry";
import {
  assertServiceVideoStageMutationAllowed,
  ServiceVideoMutationBlockedError,
  type ServiceVideoStage,
} from "@/lib/service-video-evidence";
import { prisma } from "@/server/db";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const recordingStage = String(body.recordingStage || "").trim().toUpperCase();
    if (!requiredSafetyCheckForStage(recordingStage)) {
      return NextResponse.json(
        { success: false, code: "RECORDING_STAGE_REQUIRED", message: "Choose a valid Service Video stage." },
        { status: 422 },
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: jobId },
      select: { id: true, vendorId: true, customerMetadata: true },
    });
    if (!booking) {
      return NextResponse.json(
        { success: false, code: "JOB_NOT_FOUND", message: "Service Order not found." },
        { status: 404 },
      );
    }

    const tokenAccess = await resolveEmployeeCaptureAccess(request, {
      vendorId: booking.vendorId,
      bookingId: booking.id,
    });
    try {
      await assertV2EmployeeServiceOrderEntry({
        db: prisma,
        bookingId: booking.id,
        vendorId: booking.vendorId,
        tokenAccess,
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "EMPLOYEE_SERVICE_ORDER_ACCESS_REQUIRED",
          message: "Open and complete the current secure Service Order requirements before recording.",
        },
        { status: 403 },
      );
    }
    const membership = tokenAccess || (await requireVendorMembership(request, booking.vendorId));
    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    if (!assignment.assignedMembershipIds.includes(membership.membershipId)) {
      return NextResponse.json(
        {
          success: false,
          code: "JOB_CAPTURE_FORBIDDEN",
          message: "This Service Order is not assigned to this employee.",
        },
        { status: 403 },
      );
    }

    const recordingGate = await loadRecordingPermissionGate({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: membership.membershipId,
      surface: "employee_jobs",
      capability: "record",
      actorKind: "EMPLOYEE",
      recordingStage,
    });
    if (!recordingGate.recordingUnlocked || recordingGate.blockCode) {
      return NextResponse.json(recordingGateErrorBody(recordingGate), { status: 409 });
    }
    await assertServiceVideoStageMutationAllowed(prisma, {
      bookingId: booking.id,
      vendorId: booking.vendorId,
      stage: recordingStage as ServiceVideoStage,
    });
    return NextResponse.json({ success: true, recordingGate });
  } catch (error) {
    if (error instanceof ServiceVideoMutationBlockedError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          message:
            error.code === "SERVICE_VIDEO_STAGE_ORDER_REQUIRED"
              ? "Complete and save the earlier Service Video stage before starting this one."
              : "This Service Video stage is not available for recording right now.",
        },
        { status: 409 },
      );
    }
    console.error("[employee/jobs/recording-access] POST error", {
      code: error instanceof Error ? error.message : "RECORDING_ACCESS_CHECK_FAILED",
    });
    return NextResponse.json(
      {
        success: false,
        code: "RECORDING_ACCESS_CHECK_FAILED",
        message: "Reliance could not confirm recording access. Reload the current Service Order and try again.",
      },
      { status: 500 },
    );
  }
}
