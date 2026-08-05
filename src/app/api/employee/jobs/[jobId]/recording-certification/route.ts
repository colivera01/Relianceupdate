import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata, parseCustomerMetadata } from "@/lib/job-assignment";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  const { jobId } = await context.params;
  const userId = await getUserIdFromRequest(request);
  const tokenAccess = await resolveEmployeeCaptureAccess(request, { bookingId: jobId });
  if (!userId && !tokenAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.accepted !== true) {
    return NextResponse.json(
      {
        error: "Review and accept the current recording scope before camera access can be prepared.",
        code: "EMPLOYEE_CERTIFICATION_REQUIRED",
      },
      { status: 422 },
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: jobId },
    select: { id: true, vendorId: true, customerMetadata: true },
  });
  if (!booking) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const memberships = tokenAccess
    ? [{ id: tokenAccess.membershipId, vendorId: tokenAccess.vendorId, userId: tokenAccess.userId }]
    : await prisma.vendorMembership.findMany({
        where: { userId: userId!, vendorId: booking.vendorId, status: "ACTIVE", role: "EMPLOYEE" },
        select: { id: true, vendorId: true, userId: true },
      });
  const assigned = parseAssignmentMetadata(booking.customerMetadata);
  const membership = memberships.find(
    (item) => item.vendorId === booking.vendorId && assigned.assignedMembershipIds.includes(item.id),
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden: this job is not assigned to you" }, { status: 403 });
  }

  const preCertificationGate = await loadRecordingPermissionGate({
    bookingId: booking.id,
    vendorId: booking.vendorId,
    customerMetadata: booking.customerMetadata,
    membershipId: membership.id,
    surface: "employee_jobs",
    capability: "observe",
    actorKind: "EMPLOYEE",
  });
  if (
    preCertificationGate.block &&
    !["EMPLOYEE_CERTIFICATION_REQUIRED", "LOCATION_VERIFICATION_REQUIRED"].includes(
      preCertificationGate.block.code,
    )
  ) {
    return NextResponse.json(recordingGateErrorBody(preCertificationGate), { status: 409 });
  }
  if (!preCertificationGate.assessmentId) {
    return NextResponse.json(recordingGateErrorBody(preCertificationGate), { status: 409 });
  }

  const assessment = await prisma.recordingScopeAssessment.findUnique({
    where: { id: preCertificationGate.assessmentId },
    select: { id: true, scopeHash: true, scopeJson: true },
  });
  if (!assessment) {
    return NextResponse.json({ error: "The current recording assessment is unavailable." }, { status: 409 });
  }
  const metadata = parseCustomerMetadata(booking.customerMetadata);
  const assignmentGeneration = Number(metadata.vendor_job_assignment_generation || 1);

  const certification = await prisma.$transaction(async (tx) => {
    await tx.employeeRecordingCertification.updateMany({
      where: {
        bookingId: booking.id,
        membershipId: membership.id,
        status: "ACTIVE",
        invalidatedAt: null,
      },
      data: {
        status: "INVALIDATED",
        invalidatedAt: new Date(),
        invalidationReason: "REPLACED_BY_CURRENT_CERTIFICATION",
      },
    });
    const created = await tx.employeeRecordingCertification.create({
      data: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        membershipId: membership.id,
        assessmentId: assessment.id,
        assignmentGeneration,
        scopeHash: assessment.scopeHash,
        certifiedByUserId: membership.userId,
      },
    });
    await tx.recordingAuthorityRequirement.updateMany({
      where: {
        assessmentId: assessment.id,
        authorityType: "EMPLOYEE_LIKENESS",
        status: { not: "VERIFIED" },
      },
      data: {
        status: "VERIFIED",
        actorUserId: membership.userId,
        evidenceReference: created.id,
        verifiedAt: created.certifiedAt,
      },
    });
    return created;
  });

  await recordLifecycleAudit({
    actionType: "employee_recording_scope_certified",
    entityType: "booking",
    entityId: booking.id,
    actorUserId: membership.userId,
    newValue: {
      assessmentId: assessment.id,
      scopeHash: assessment.scopeHash,
      assignmentGeneration,
      certificationVersion: "EPIC4_EMPLOYEE_CERTIFICATION_V1",
      certificationId: certification.id,
    },
    metadata: { vendorId: booking.vendorId, membershipId: membership.id },
  });

  const gate = await loadRecordingPermissionGate({
    bookingId: booking.id,
    vendorId: booking.vendorId,
    customerMetadata: booking.customerMetadata,
    membershipId: membership.id,
    surface: "employee_jobs",
    capability: "record",
    actorKind: "EMPLOYEE",
  });
  return NextResponse.json({ success: true, recordingGate: gate });
}
