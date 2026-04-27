import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const rejectionReason = String(body?.rejectionReason || "").trim();

    if (!rejectionReason) {
      return NextResponse.json(
        {
          error: "rejectionReason is required.",
          code: "REJECTION_REASON_REQUIRED",
        },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: { id: true, status: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Job not found for this vendor." }, { status: 404 });
    }

    const currentStatus = normalizeBookingStatus(booking.status);
    if (currentStatus !== "AWAITING_REVIEW") {
      return NextResponse.json(
        {
          error: "Only jobs in AWAITING_REVIEW can be rejected.",
          code: "INVALID_REJECTION_STATUS",
          status: currentStatus || "UNKNOWN",
        },
        { status: 409 }
      );
    }

    await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        status: "IN_PROGRESS",
        rejectionReason,
        rejectedAt: new Date(),
        rejectedBy: manager.userId,
      },
    });

    return NextResponse.json({
      success: true,
      code: "JOB_REJECTED",
      message: "Job returned to in-progress for corrections",
      details: {
        rejectionReason,
      },
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: "Failed to reject job completion",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
