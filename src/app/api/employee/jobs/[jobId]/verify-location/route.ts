import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { assertV2EmployeeServiceOrderEntry } from "@/lib/recording/employee-v2-service-order-entry";
import {
  parseAssignmentMetadata,
  validateRecordingLocationSnapshot,
} from "@/lib/job-assignment";
import {
  parseRecordingLocationProof,
  recordJobRecordingLocationAttempt,
  verifyJobRecordingLocation,
} from "@/lib/job-recording-location";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "@/lib/recording/assessment-v2";
import { isEmployeeStageSafetyResolvableBlock } from "@/lib/recording/employee-stage-safety-contract";
import {
  requiredSafetyCheckForStage,
  serviceOrderSafetyRequirement,
} from "@/lib/recording/employee-safety";
import {
  persistV2StageLocationAttempt,
  SERVICE_ORDER_LOCATION_EVIDENCE_VERSION,
} from "@/lib/recording/v2-safety-location";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const recordingStage = String(body.recordingStage || "").trim().toUpperCase();
    const safetyRequirement = requiredSafetyCheckForStage(recordingStage);
    if (!safetyRequirement) {
      return NextResponse.json(
        { success: false, code: "RECORDING_STAGE_REQUIRED", message: "Choose a valid Service Video stage." },
        { status: 422 },
      );
    }
    const evidenceRequirement = serviceOrderSafetyRequirement();
    const booking = await prisma.booking.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        vendorId: true,
        customerMetadata: true,
        vendor: {
          select: {
            address: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
            geocodedAt: true,
          },
        },
      },
    });
    if (!booking) {
      return NextResponse.json({ success: false, code: "JOB_NOT_FOUND", message: "Service order not found." }, { status: 404 });
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
          message: "Open and complete the current secure Service Order requirements before verifying location.",
        },
        { status: 403 },
      );
    }
    const membership = tokenAccess || (await requireVendorMembership(request, booking.vendorId));
    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    if (!assignment.assignedMembershipIds.includes(membership.membershipId)) {
      return NextResponse.json(
        { success: false, code: "JOB_CAPTURE_FORBIDDEN", message: "This service order is not assigned to this employee." },
        { status: 403 }
      );
    }

    const gateBeforeVerification = await loadRecordingPermissionGate({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: membership.membershipId,
      surface: "location_verify",
      capability: "record",
      actorKind: "EMPLOYEE",
      recordingStage,
    });
    if (
      gateBeforeVerification.blockCode &&
      !["LOCATION_VERIFICATION_REQUIRED", "LOCATION_EXCEPTION_PENDING"].includes(gateBeforeVerification.blockCode) &&
      !isEmployeeStageSafetyResolvableBlock(gateBeforeVerification.blockCode)
    ) {
      return NextResponse.json(recordingGateErrorBody(gateBeforeVerification), { status: 409 });
    }
    if (!gateBeforeVerification.assessmentId) {
      return NextResponse.json(recordingGateErrorBody(gateBeforeVerification), { status: 409 });
    }

    const proof = parseRecordingLocationProof(body);
    const result = await verifyJobRecordingLocation({
      vendorId: booking.vendorId,
      metadata: booking.customerMetadata,
      vendorLocation: booking.vendor,
      proof,
    });
    let locationAttempt;
    if (gateBeforeVerification.serviceOrderSafetyRequired) {
      const locationSnapshot = validateRecordingLocationSnapshot(
        booking.customerMetadata,
        gateBeforeVerification.location,
      );
      if (
        !locationSnapshot.ok ||
        !locationSnapshot.snapshot.snapshotEvidenceHash ||
        !gateBeforeVerification.assessmentGeneration ||
        !gateBeforeVerification.assignmentGeneration
      ) {
        return NextResponse.json(recordingGateErrorBody(gateBeforeVerification), { status: 409 });
      }
      locationAttempt = await persistV2StageLocationAttempt({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        membershipId: membership.membershipId,
        assessmentId: gateBeforeVerification.assessmentId,
        assessmentGeneration: gateBeforeVerification.assessmentGeneration,
        assignmentGeneration: gateBeforeVerification.assignmentGeneration,
        stage: evidenceRequirement.stage,
        evidenceVersion:
          gateBeforeVerification.assessmentContractVersion ===
          RECORDING_ASSESSMENT_V2_CONTRACT_VERSION
            ? undefined
            : SERVICE_ORDER_LOCATION_EVIDENCE_VERSION,
        snapshotEvidenceHash: locationSnapshot.snapshot.snapshotEvidenceHash,
        actorUserId: membership.userId || tokenAccess?.userId || null,
        proof,
        result,
      });
    } else {
      locationAttempt = await recordJobRecordingLocationAttempt({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        membershipId: membership.membershipId,
        assessmentId: gateBeforeVerification.assessmentId,
        actorUserId: membership.userId || tokenAccess?.userId || null,
        proof,
        result,
      });
    }
    if (!result.ok) {
      const blockedGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        customerMetadata: booking.customerMetadata,
        membershipId: membership.membershipId,
        surface: "location_verify",
        capability: "record",
        actorKind: "EMPLOYEE",
        recordingStage,
      });
      return NextResponse.json(
        { success: false, ...result, recordingGate: blockedGate, blocked: blockedGate.block },
        { status: result.status },
      );
    }
    const recordingGate = await loadRecordingPermissionGate({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: membership.membershipId,
      surface: "location_verify",
      capability: "record",
      actorKind: "EMPLOYEE",
      recordingStage,
    });
    return NextResponse.json({
      success: true,
      verified: true,
      location: result.location,
      distanceMeters: Math.round(result.distanceMeters),
      locationAttemptId: locationAttempt.id,
      recordingGate,
    });
  } catch (error) {
    console.error("[employee/jobs/verify-location] POST error", error);
    return NextResponse.json(
      { success: false, code: "LOCATION_VERIFICATION_FAILED", message: "Location verification could not be completed. Try again." },
      { status: 500 }
    );
  }
}
