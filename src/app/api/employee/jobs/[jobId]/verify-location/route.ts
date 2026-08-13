import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import {
  parseRecordingLocationProof,
  recordJobRecordingLocationAttempt,
  verifyJobRecordingLocation,
} from "@/lib/job-recording-location";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const recordingStage = String(body.recordingStage || "").trim().toUpperCase();
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
      !["LOCATION_VERIFICATION_REQUIRED", "LOCATION_EXCEPTION_PENDING"].includes(gateBeforeVerification.blockCode)
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
    await recordJobRecordingLocationAttempt({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      membershipId: membership.membershipId,
      assessmentId: gateBeforeVerification.assessmentId,
      actorUserId: membership.userId || tokenAccess?.userId || null,
      proof,
      result,
    });
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
