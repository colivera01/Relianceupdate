import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { parseAssignmentMetadata } from "@/lib/job-assignment";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { jobId } = await context.params;
    console.log("[employee-complete] route hit", { jobId, userId });

    const memberships = await prisma.vendorMembership.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, vendorId: true, role: true },
    });
    const booking = await prisma.booking.findUnique({
      where: { id: jobId },
      select: { id: true, vendorId: true, status: true, customerMetadata: true },
    });
    if (!booking) return NextResponse.json({ error: "Job not found" }, { status: 404 });

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
          error: "Cannot complete job until Intro, In Progress, and Completed videos are uploaded.",
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
    return NextResponse.json({ error: "Failed to complete employee job", details: error?.message }, { status: 500 });
  }
}
