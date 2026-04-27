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

    const memberships = await prisma.vendorMembership.findMany({
      where: { userId, status: "ACTIVE", role: "EMPLOYEE" },
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

    const nextStatus = String(booking.status || "").toUpperCase() === "PENDING" ? "CONFIRMED" : booking.status;
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: nextStatus || "CONFIRMED" },
      select: { id: true, status: true },
    });
    return NextResponse.json({ success: true, job: updated });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to start employee job", details: error?.message }, { status: 500 });
  }
}
