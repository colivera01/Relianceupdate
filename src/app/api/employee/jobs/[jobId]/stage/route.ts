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
import { parseAssignmentMetadata, setStageProgressMetadata } from "@/lib/job-assignment";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

const STAGES = new Set(["INTRO", "IN_PROGRESS", "COMPLETED"]);

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { jobId } = await context.params;
    const userId = await getUserIdFromRequest(request);
    const tokenAccess = await resolveEmployeeCaptureAccess(request, { bookingId: jobId });
    if (!userId && !tokenAccess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (userId && !tokenAccess) await ensureUserAccountCanAct(userId);
    const body = await request.json().catch(() => ({}));
    const stage = String(body?.stage || "").trim().toUpperCase();
    if (!STAGES.has(stage)) {
      return NextResponse.json({ error: "Invalid stage. Use INTRO, IN_PROGRESS, or COMPLETED." }, { status: 422 });
    }

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
    await ensureVendorAccountCanOperate(booking.vendorId);

    const vendorMembershipIds = memberships.filter((m) => m.vendorId === booking.vendorId).map((m) => m.id);
    if (vendorMembershipIds.length === 0) {
      return NextResponse.json({ error: "Forbidden: active employee membership required" }, { status: 403 });
    }
    const assigned = parseAssignmentMetadata(booking.customerMetadata);
    if (!assigned.assignedMembershipIds.some((id) => vendorMembershipIds.includes(id))) {
      return NextResponse.json({ error: "Forbidden: this job is not assigned to you" }, { status: 403 });
    }

    const permissionGate = await loadRecordingPermissionGate({
      bookingId: booking.id,
      vendorId: booking.vendorId,
      customerMetadata: booking.customerMetadata,
      membershipId: assigned.assignedMembershipIds.find((id) => vendorMembershipIds.includes(id)) || null,
      surface: "employee_stage",
      capability: "record",
      actorKind: "EMPLOYEE",
    });
    if (permissionGate.blockCode) {
      return NextResponse.json(recordingGateErrorBody(permissionGate), { status: 409 });
    }

    const matchingSession = await (prisma as any).mediaSession.findFirst({
      where: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        vendorJobVideoStage: stage,
      },
      select: {
        id: true,
        mediaAssets: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!matchingSession || !Array.isArray(matchingSession.mediaAssets) || matchingSession.mediaAssets.length === 0) {
      return NextResponse.json(
        {
          error: `No uploaded ${stage.replace("_", " ")} video found for this job.`,
          code: "STAGE_VIDEO_REQUIRED",
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
    const uploadedStages = new Set<string>();
    for (const row of sessions) {
      if (!row.mediaAssets || row.mediaAssets.length === 0) continue;
      const s = String(row.vendorJobVideoStage || "").trim().toUpperCase();
      if (s) uploadedStages.add(s);
    }
    const hasAllRequiredStages =
      uploadedStages.has("INTRO") &&
      uploadedStages.has("IN_PROGRESS") &&
      uploadedStages.has("COMPLETED");

    const updated = await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        customerMetadata: setStageProgressMetadata(booking.customerMetadata, stage as any),
      },
      select: { id: true, status: true, customerMetadata: true, updatedAt: true },
    });

    await recordLifecycleAudit({
      actionType: "job_stage_uploaded",
      entityType: "booking",
      entityId: booking.id,
      actorUserId: userId || tokenAccess!.userId,
      newValue: {
        stage,
        readyForManagerReview: hasAllRequiredStages,
      },
      metadata: {
        vendorId: booking.vendorId,
        membershipIds: vendorMembershipIds,
        sessionId: matchingSession?.id ? String(matchingSession.id) : null,
      },
    });

    return NextResponse.json({
      success: true,
      stage,
      readyForManagerReview: hasAllRequiredStages,
      awaitingReview: false,
      job: updated,
    });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const runtimeError = getEmployeeRuntimeErrorResponse("stage", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
