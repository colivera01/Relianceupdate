import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  isVendorAccountRestricted,
} from "@/lib/account-status";
import { getEmployeeRuntimeErrorResponse } from "@/lib/employee-runtime-errors";
import { parseAssignmentMetadata, parseRecordingComplianceMetadata } from "@/lib/job-assignment";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";

type StageKey = "INTRO" | "IN_PROGRESS" | "COMPLETED";

function emptyStageProgress() {
  return {
    INTRO: false,
    IN_PROGRESS: false,
    COMPLETED: false,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    const tokenAccess = await resolveEmployeeCaptureAccess(request);
    if (!userId && !tokenAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (userId && !tokenAccess) {
      await ensureUserAccountCanAct(userId);
    }

    const memberships = tokenAccess
      ? await prisma.vendorMembership.findMany({
          where: { id: tokenAccess.membershipId },
          select: { id: true, vendorId: true, vendor: { select: { name: true, businessName: true, accountStatus: true } } },
        })
      : await prisma.vendorMembership.findMany({
          where: { userId: userId!, status: "ACTIVE", role: "EMPLOYEE" },
          select: { id: true, vendorId: true, vendor: { select: { name: true, businessName: true, accountStatus: true } } },
        });
    const activeVendorMemberships = memberships.filter((m) => !isVendorAccountRestricted((m.vendor as any)?.accountStatus));
    if (activeVendorMemberships.length === 0) {
      return NextResponse.json({ jobs: [], membership: null });
    }

    const byVendor = new Map<string, string[]>();
    for (const m of activeVendorMemberships) {
      byVendor.set(m.vendorId, [...(byVendor.get(m.vendorId) || []), m.id]);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId: { in: Array.from(byVendor.keys()) },
        ...(tokenAccess ? { id: tokenAccess.bookingId } : {}),
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "AWAITING_REVIEW", "COMPLETED"] },
      },
      include: {
        service: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        vendor: { select: { id: true, name: true, businessName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const assignedBookings = bookings.filter((booking) => {
      const assigned = parseAssignmentMetadata(booking.customerMetadata);
      const allowedMembershipIds = byVendor.get(booking.vendorId) || [];
      return assigned.assignedMembershipIds.some((id) => allowedMembershipIds.includes(id));
    });
    const releasedBookings = assignedBookings.filter((booking) => {
      const compliance = parseRecordingComplianceMetadata(booking.customerMetadata);
      const allowedMembershipIds = byVendor.get(booking.vendorId) || [];
      return allowedMembershipIds.some((id) => compliance.releasedMembershipIds.includes(id));
    });

    if (tokenAccess && assignedBookings.length > 0 && releasedBookings.length === 0) {
      return NextResponse.json({
        jobs: [],
        membership: activeVendorMemberships[0],
        placeholderData: false,
        pendingServiceOrder: true,
        message:
          "This service order has been assigned, but it is not ready for recording yet. Your manager still needs to send the service order or finish any required customer-consent check.",
      });
    }

    const bookingIds = releasedBookings.map((b) => b.id);

    const sessions = bookingIds.length
      ? await (prisma as any).mediaSession.findMany({
          where: { bookingId: { in: bookingIds } },
          select: {
            id: true,
            bookingId: true,
            vendorJobVideoStage: true,
            mediaAssets: {
              where: { deletedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        })
      : [];

    const stageByBooking = new Map<string, Record<StageKey, boolean>>();
    for (const booking of releasedBookings) {
      stageByBooking.set(booking.id, emptyStageProgress());
    }
    for (const row of sessions) {
      const bookingId = String(row.bookingId || "");
      const stage = String(row.vendorJobVideoStage || "").trim().toUpperCase() as StageKey;
      if (!bookingId || !stageByBooking.has(bookingId)) continue;
      if (!["INTRO", "IN_PROGRESS", "COMPLETED"].includes(stage)) continue;
      if (!Array.isArray(row.mediaAssets) || row.mediaAssets.length === 0) continue;
      stageByBooking.set(bookingId, {
        ...stageByBooking.get(bookingId)!,
        [stage]: true,
      });
    }

    const jobs = releasedBookings.map((booking) => {
      const stageProgress = stageByBooking.get(booking.id) || emptyStageProgress();
      const recordingCompliance = parseRecordingComplianceMetadata(booking.customerMetadata);
      const normalizedStatus = String(booking.status || "").trim().toUpperCase();
      const canMarkComplete =
        stageProgress.INTRO &&
        stageProgress.IN_PROGRESS &&
        stageProgress.COMPLETED &&
        (normalizedStatus === "PENDING" || normalizedStatus === "CONFIRMED");
      return {
        id: booking.id,
        vendorId: booking.vendorId,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || "Vendor",
        title: booking.title || booking.service?.name || "Assigned Job",
        status: booking.status,
        service: booking.service || null,
        customer: {
          id: booking.user?.id || null,
          name: booking.user?.name || null,
          email: booking.user?.email || null,
          phone: booking.user?.phone || null,
        },
        bookingDate: booking.scheduledFor || booking.date || null,
        rejectionReason: (booking as any).rejectionReason || null,
        rejectedAt: (booking as any).rejectedAt || null,
        recordingCompliance,
        stageProgress,
        canMarkComplete,
      };
    });

    return NextResponse.json({
      jobs,
      membership: activeVendorMemberships[0],
      placeholderData: false,
    });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const runtimeError = getEmployeeRuntimeErrorResponse("jobs", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
