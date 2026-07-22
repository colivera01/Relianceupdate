import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata, parseRecordingComplianceMetadata } from "@/lib/job-assignment";
import { parseRecordingLocationProof, verifyJobRecordingLocation } from "@/lib/job-recording-location";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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
    const compliance = parseRecordingComplianceMetadata(booking.customerMetadata);
    if (
      !assignment.assignedMembershipIds.includes(membership.membershipId) ||
      !compliance.releasedMembershipIds.includes(membership.membershipId)
    ) {
      return NextResponse.json(
        { success: false, code: "JOB_CAPTURE_FORBIDDEN", message: "This service order is not released to this employee." },
        { status: 403 }
      );
    }

    const result = await verifyJobRecordingLocation({
      vendorId: booking.vendorId,
      metadata: booking.customerMetadata,
      vendorLocation: booking.vendor,
      proof: parseRecordingLocationProof(body),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, ...result }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      verified: true,
      location: result.location,
      distanceMeters: Math.round(result.distanceMeters),
    });
  } catch (error) {
    console.error("[employee/jobs/verify-location] POST error", error);
    return NextResponse.json(
      { success: false, code: "LOCATION_VERIFICATION_FAILED", message: "Location verification could not be completed. Try again." },
      { status: 500 }
    );
  }
}
