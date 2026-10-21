import { NextResponse } from "next/server";

import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { requireVendorMembership } from "@/lib/membership-auth";
import {
  hasAllEmployeeStageSafetyAcknowledgments,
  isEmployeeStageSafetyResolvableBlock,
} from "@/lib/recording/employee-stage-safety-contract";
import {
  appendEmployeeRecordingSafetyEvidence,
  EmployeeRecordingSafetyServiceError,
} from "@/lib/recording/employee-safety-service";
import { requiredSafetyCheckForStage } from "@/lib/recording/employee-safety";
import { assertV2EmployeeServiceOrderEntry } from "@/lib/recording/employee-v2-service-order-entry";
import { V2SafetyLocationError } from "@/lib/recording/v2-safety-location";
import { prisma } from "@/server/db";

type RouteContext = { params: Promise<{ jobId: string }> };

function safeSafetyError(error: EmployeeRecordingSafetyServiceError | V2SafetyLocationError) {
  const stale =
    error.code.includes("STALE") ||
    error.code.includes("MISMATCH") ||
    error.code.includes("ALREADY_USED");
  return {
    status: 409,
    body: {
      success: false,
      code: error.code,
      message: stale
        ? "This stage check no longer matches the current Service Order. Reload and complete a fresh safety and location check."
        : "This stage safety check could not be accepted. Reload the current Service Order and try again.",
    },
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const recordingStage = String(body.recordingStage || "").trim().toUpperCase();
    const requirement = requiredSafetyCheckForStage(recordingStage);
    if (!requirement) {
      return NextResponse.json(
        { success: false, code: "V2_SAFETY_STAGE_REQUIRED", message: "Choose a valid Service Video stage." },
        { status: 422 },
      );
    }
    if (!hasAllEmployeeStageSafetyAcknowledgments(body.acknowledgments)) {
      return NextResponse.json(
        {
          success: false,
          code: "V2_SAFETY_ACKNOWLEDGMENTS_REQUIRED",
          message: "Confirm every current stage-safety requirement before recording.",
        },
        { status: 422 },
      );
    }
    const locationAttemptId = String(body.locationAttemptId || "").trim();
    const requestId = String(body.requestId || "").trim();
    if (!locationAttemptId || !requestId) {
      return NextResponse.json(
        {
          success: false,
          code: "V2_SAFETY_SUBMISSION_CONTEXT_REQUIRED",
          message: "A fresh verified location and safety-check request are required.",
        },
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
          message: "Open and complete the current secure Service Order requirements before completing this check.",
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

    const gateBefore = await loadRecordingPermissionGate({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: membership.membershipId,
      surface: "employee_jobs",
      capability: "record",
      actorKind: "EMPLOYEE",
      recordingStage,
    });
    if (
      gateBefore.blockCode &&
      !isEmployeeStageSafetyResolvableBlock(gateBefore.blockCode)
    ) {
      return NextResponse.json(recordingGateErrorBody(gateBefore), { status: 409 });
    }

    const evidence = await appendEmployeeRecordingSafetyEvidence({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      membershipId: membership.membershipId,
      locationAttemptId,
      requestId,
      checkType: requirement.checkType,
      stage: requirement.stage,
      result: "READY",
      issues: [],
    });

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
    return NextResponse.json({
      success: true,
      evidence: { id: evidence.id, result: evidence.result, stage: evidence.stage },
      recordingGate,
      blocked: recordingGate.block,
    });
  } catch (error) {
    if (error instanceof EmployeeRecordingSafetyServiceError || error instanceof V2SafetyLocationError) {
      const failure = safeSafetyError(error);
      return NextResponse.json(failure.body, { status: failure.status });
    }
    console.error("[employee/jobs/safety-check] POST error", {
      code: error instanceof Error ? error.message : "V2_SAFETY_CHECK_FAILED",
    });
    return NextResponse.json(
      {
        success: false,
        code: "V2_SAFETY_CHECK_FAILED",
        message: "The stage safety check could not be completed. Reload and try again.",
      },
      { status: 500 },
    );
  }
}
