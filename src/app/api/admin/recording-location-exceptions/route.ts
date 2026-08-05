import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { prisma } from "@/server/db";

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage location exceptions";
  if (message.includes("Unauthorized")) return 401;
  if (message.includes("Forbidden")) return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get("status") || "PENDING").trim().toUpperCase();
    const rows = await (prisma as any).recordingLocationException.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        bookingId: true,
        vendorId: true,
        reason: true,
        status: true,
        decisionNote: true,
        createdAt: true,
        decidedAt: true,
        booking: { select: { title: true, service: { select: { name: true } } } },
        vendor: { select: { name: true, businessName: true } },
        assessment: { select: { locationType: true, riskLevel: true, scopeHash: true } },
      },
    });
    return NextResponse.json({ success: true, exceptions: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load location exceptions";
    return NextResponse.json({ success: false, error: message }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const exceptionId = String(body?.exceptionId || "").trim();
    const decision = String(body?.decision || "").trim().toUpperCase();
    const decisionNote = String(body?.decisionNote || "").trim();
    if (!exceptionId || !["APPROVED", "DENIED"].includes(decision)) {
      return NextResponse.json({ success: false, error: "Choose Approve or Deny for a valid exception request." }, { status: 400 });
    }
    if (decisionNote.length < 10) {
      return NextResponse.json({ success: false, error: "Add a short decision explanation (at least 10 characters)." }, { status: 400 });
    }

    const current = await (prisma as any).recordingLocationException.findUnique({ where: { id: exceptionId } });
    if (!current) return NextResponse.json({ success: false, error: "Location exception request not found." }, { status: 404 });
    if (current.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "This location exception already has a final admin decision." }, { status: 409 });
    }

    const updated = await (prisma as any).recordingLocationException.updateMany({
      where: { id: exceptionId, status: "PENDING" },
      data: {
        status: decision,
        decisionNote,
        decidedByAdminUserId: admin.userId,
        decidedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json({ success: false, error: "This request changed before the decision was saved. Refresh and try again." }, { status: 409 });
    }

    await recordLifecycleAudit({
      actionType: `RECORDING_LOCATION_EXCEPTION_${decision}`,
      entityType: "booking",
      entityId: current.bookingId,
      actorUserId: admin.userId,
      previousValue: { status: "PENDING" },
      newValue: { status: decision, exceptionId },
      metadata: { vendorId: current.vendorId, assessmentId: current.assessmentId },
    });
    return NextResponse.json({ success: true, exception: { id: exceptionId, status: decision, decisionNote } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to decide the location exception";
    return NextResponse.json({ success: false, error: message }, { status: errorStatus(error) });
  }
}
