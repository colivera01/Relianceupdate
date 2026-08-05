import { NextResponse } from "next/server";

import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { requireVendorManager } from "@/lib/membership-auth";
import { prisma } from "@/server/db";

type RouteContext = { params: Promise<{ vendorId: string; jobId: string }> };

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage the location exception";
  if (message.includes("Unauthorized")) return 401;
  if (message.includes("Forbidden")) return 403;
  if (message.includes("not found")) return 404;
  return 500;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorManager(request, vendorId);
    const booking = await (prisma as any).booking.findFirst({
      where: { id: jobId, vendorId },
      select: { id: true },
    });
    if (!booking) throw new Error("Work record not found");

    const exception = await (prisma as any).recordingLocationException.findFirst({
      where: { bookingId: jobId, vendorId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        reason: true,
        decisionNote: true,
        createdAt: true,
        decidedAt: true,
      },
    });
    return NextResponse.json({ success: true, exception });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the location exception";
    return NextResponse.json({ success: false, error: message }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { vendorId, jobId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim();
    if (reason.length < 20) {
      return NextResponse.json(
        { success: false, error: "Explain why the saved service location cannot be verified (at least 20 characters)." },
        { status: 400 },
      );
    }

    const booking = await (prisma as any).booking.findFirst({
      where: { id: jobId, vendorId },
      select: {
        id: true,
        recordingScopeAssessments: {
          where: { isCurrent: true },
          orderBy: { generation: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!booking) throw new Error("Work record not found");
    const assessment = booking.recordingScopeAssessments?.[0];
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: "Complete the recording assessment before requesting a location exception." },
        { status: 409 },
      );
    }

    const existing = await (prisma as any).recordingLocationException.findFirst({
      where: { bookingId: jobId, assessmentId: assessment.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({ success: true, exception: existing, alreadyPending: true });
    }

    const exception = await (prisma as any).recordingLocationException.create({
      data: {
        bookingId: jobId,
        vendorId,
        assessmentId: assessment.id,
        requestedByUserId: manager.userId,
        requestedByMembershipId: manager.membershipId,
        reason,
        evidenceJson: JSON.stringify({ source: "VENDOR_MANAGER_REQUEST", version: 1 }),
        status: "PENDING",
      },
      select: { id: true, status: true, reason: true, createdAt: true },
    });

    await recordLifecycleAudit({
      actionType: "RECORDING_LOCATION_EXCEPTION_REQUESTED",
      entityType: "booking",
      entityId: jobId,
      actorUserId: manager.userId,
      newValue: { exceptionId: exception.id, status: exception.status },
      metadata: { vendorId, assessmentId: assessment.id },
    });
    return NextResponse.json({ success: true, exception }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request the location exception";
    return NextResponse.json({ success: false, error: message }, { status: statusFor(error) });
  }
}
