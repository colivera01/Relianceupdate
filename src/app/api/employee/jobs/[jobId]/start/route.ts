import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { getEmployeeRuntimeErrorResponse } from "@/lib/employee-runtime-errors";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { jobId } = await context.params;
    const userId = await getUserIdFromRequest(request);
    const tokenAccess = await resolveEmployeeCaptureAccess(request, { bookingId: jobId });
    if (!userId && !tokenAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const memberships = tokenAccess
      ? [{ id: tokenAccess.membershipId, vendorId: tokenAccess.vendorId }]
      : await prisma.vendorMembership.findMany({
          where: { userId: userId!, status: "ACTIVE", role: "EMPLOYEE" },
          select: { id: true, vendorId: true },
        });
    const booking = await prisma.booking.findUnique({
      where: { id: jobId },
      select: { id: true, vendorId: true, status: true, customerMetadata: true },
    });
    if (!booking) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const vendorMembershipIds = memberships.filter((m) => m.vendorId === booking.vendorId).map((m) => m.id);
    if (vendorMembershipIds.length === 0) {
      return NextResponse.json({ error: "Forbidden: active employee membership required" }, { status: 403 });
    }
    const assigned = parseAssignmentMetadata(booking.customerMetadata);
    if (!assigned.assignedMembershipIds.some((id) => vendorMembershipIds.includes(id))) {
      return NextResponse.json({ error: "Forbidden: this job is not assigned to you" }, { status: 403 });
    }

    const previousStatus = String(booking.status || "").toUpperCase();
    if (previousStatus !== "PENDING") {
      return NextResponse.json(
        {
          error: "Only pending jobs can be started.",
          code: "INVALID_START_STATUS",
          status: previousStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const nextStatus = "CONFIRMED";
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: nextStatus || "CONFIRMED" },
      select: { id: true, status: true },
    });

    await recordLifecycleAudit({
      actionType: "job_started",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: userId || tokenAccess!.userId,
      previousValue: { status: previousStatus },
      newValue: { status: updated.status },
      metadata: {
        vendorId: booking.vendorId,
        membershipIds: vendorMembershipIds,
      },
    });

    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    const runtimeError = getEmployeeRuntimeErrorResponse("start", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
