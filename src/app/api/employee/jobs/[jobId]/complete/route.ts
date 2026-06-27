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

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    const { jobId } = await context.params;
    const tokenAccess = userId ? null : await resolveEmployeeCaptureAccess(request, { bookingId: jobId });
    if (!userId && !tokenAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (userId) await ensureUserAccountCanAct(userId);
    console.log("[employee-complete] route hit", { jobId, userId });

    const memberships = tokenAccess
      ? [{ id: tokenAccess.membershipId, vendorId: tokenAccess.vendorId, role: "EMPLOYEE" }]
      : await prisma.vendorMembership.findMany({
          where: { userId: userId!, status: "ACTIVE" },
          select: { id: true, vendorId: true, role: true },
        });
    const booking = await prisma.booking.findUnique({
      where: { id: jobId },
      select: { id: true, vendorId: true, status: true, customerMetadata: true },
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
    if (!["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(normalizedStatus)) {
      return NextResponse.json(
        {
          error: "Only active assigned jobs can be submitted for manager review.",
          code: "INVALID_COMPLETE_STATUS",
          status: normalizedStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    const sessions = await (prisma as any).mediaSession.findMany({
      where: { bookingId: booking.id, vendorId: booking.vendorId },
      select: {
        vendorJobVideoStage: true,
        mediaAssets: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      },
    });
    const stages = new Set<string>();
    for (const row of sessions) {
      if (!row.mediaAssets || row.mediaAssets.length === 0) continue;
      const stage = String(row.vendorJobVideoStage || "").trim().toUpperCase();
      if (stage) stages.add(stage);
    }

    const hasRequiredStages =
      stages.has("INTRO") && stages.has("IN_PROGRESS") && stages.has("COMPLETED");
    if (!hasRequiredStages) {
      return NextResponse.json(
        {
          error: "Cannot complete job until Starting Condition, Work in Progress, and Final Result videos are uploaded.",
          code: "REQUIRED_STAGES_MISSING",
        },
        { status: 409 }
      );
    }

    const updated = await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        status: "AWAITING_REVIEW",
      },
      select: { id: true, status: true, date: true },
    });
    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const runtimeError = getEmployeeRuntimeErrorResponse("complete", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
