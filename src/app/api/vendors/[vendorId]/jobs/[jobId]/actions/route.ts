import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

type JobAction = "ARCHIVE_JOB" | "MOVE_CONTENT_TO_ARCHIVE" | "UNARCHIVE_JOB";

function apiResponse(
  success: boolean,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return { success, code, message, ...(details ? { details } : {}) };
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
}

async function getLinkedMediaSummary(vendorId: string, bookingId: string) {
  const sessions = await (prisma as any).mediaSession.findMany({
    where: {
      vendorId,
      bookingId,
    },
    select: { id: true },
  });
  const sessionIds = sessions.map((s: any) => s.id);
  const linkedAssetCount = sessionIds.length
    ? await (prisma as any).mediaAsset.count({
        where: {
          mediaSessionId: { in: sessionIds },
          deletedAt: null,
        },
      })
    : 0;
  return {
    linkedSessionCount: sessionIds.length,
    linkedAssetCount,
    linkedSessionIds: sessionIds,
  };
}

export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase() as JobAction;

    const booking = await prisma.booking.findFirst({
      where: {
        id: jobId,
        vendorId,
      },
      select: {
        id: true,
        vendorId: true,
        status: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    if (action === "ARCHIVE_JOB") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "ARCHIVED" },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job archived successfully",
      });
    }

    if (action === "UNARCHIVE_JOB") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "PENDING" },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job restored to active jobs",
      });
    }

    if (action === "MOVE_CONTENT_TO_ARCHIVE") {
      const sessions = await (prisma as any).mediaSession.findMany({
        where: {
          vendorId,
          bookingId: booking.id,
        },
        select: { id: true },
      });
      const sessionIds = sessions.map((s: any) => s.id);

      if (sessionIds.length === 0) {
        return NextResponse.json({
          success: true,
          action,
          message: "No linked content found for this job",
          sessionCount: 0,
          archivedAssetCount: 0,
        });
      }

      await (prisma as any).mediaSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: "ARCHIVED" },
      });

      const archivedAssetsResult = await (prisma as any).mediaAsset.updateMany({
        where: {
          mediaSessionId: { in: sessionIds },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        action,
        message: "Job content moved to archive successfully",
        sessionCount: sessionIds.length,
        archivedAssetCount: archivedAssetsResult?.count || 0,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 422 });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to process job action", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: {
        id: jobId,
        vendorId,
      },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus === "COMPLETED") {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_COMPLETED",
          "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed.",
          { status: normalizedStatus }
        ),
        { status: 403 }
      );
    }

    const allowedVendorDeleteStatuses = new Set(["PENDING", "IN_PROGRESS"]);
    if (!allowedVendorDeleteStatuses.has(normalizedStatus)) {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
          `Job status ${normalizedStatus || "UNKNOWN"} is not eligible for vendor deletion.`,
          { status: normalizedStatus || "UNKNOWN" }
        ),
        { status: 409 }
      );
    }

    const { linkedSessionCount, linkedAssetCount, linkedSessionIds } = await getLinkedMediaSummary(
      vendorId,
      booking.id
    );

    try {
      await prisma.$transaction(async (tx) => {
        if (linkedSessionIds.length > 0) {
          await (tx as any).mediaSession.updateMany({
            where: { id: { in: linkedSessionIds } },
            data: {
              status: "ARCHIVED",
              endedAt: new Date(),
            },
          });

          await (tx as any).mediaAsset.updateMany({
            where: {
              mediaSessionId: { in: linkedSessionIds },
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
            },
          });

          // Detach sessions from booking before deleting booking to avoid FK/NoAction conflicts.
          await (tx as any).mediaSession.updateMany({
            where: { id: { in: linkedSessionIds } },
            data: { bookingId: null },
          });
        }

        await tx.booking.delete({
          where: { id: booking.id },
        });
      });
    } catch (transactionError: any) {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
          "Job deletion was blocked because linked dependencies could not be handled safely. No records were deleted.",
          {
            status: normalizedStatus,
            reason: transactionError?.message || "Unknown dependency handling failure",
          }
        ),
        { status: 409 }
      );
    }

    return NextResponse.json({
      ...apiResponse(
        true,
        linkedSessionCount > 0
          ? "JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED"
          : "JOB_DELETE_SUCCESS_NO_LINKED_CONTENT",
        linkedSessionCount > 0
          ? "Job permanently deleted. Linked media sessions and assets were archived safely to prevent orphaned records."
          : "Job permanently deleted. No linked media content was found.",
        {
          linkedSessionCount,
          linkedAssetCount,
          mediaHandled: linkedSessionCount > 0 ? "archived" : "none",
        }
      ),
      hardDeleted: true,
    });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] DELETE error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        apiResponse(false, "JOB_DELETE_BLOCKED_FORBIDDEN", String(error.message)),
        { status: 403 }
      );
    }
    return NextResponse.json(
      apiResponse(
        false,
        "JOB_DELETE_FAILED_INTERNAL",
        "Failed to permanently delete job.",
        { reason: error.message }
      ),
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    const { linkedSessionCount, linkedAssetCount } = await getLinkedMediaSummary(vendorId, booking.id);

    const canVendorDelete =
      normalizedStatus === "PENDING" || normalizedStatus === "IN_PROGRESS";

    return NextResponse.json({
      jobId: booking.id,
      status: normalizedStatus,
      canVendorDelete,
      linkedSessionCount,
      linkedAssetCount,
      message:
        normalizedStatus === "COMPLETED"
          ? "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed."
          : canVendorDelete
          ? linkedSessionCount > 0
            ? "This job has linked media. Deleting this job will also archive related media/session records so nothing is orphaned."
            : "This job can be deleted safely. No linked media content found."
          : `Job status ${normalizedStatus || "UNKNOWN"} is not eligible for vendor deletion.`,
      code:
        normalizedStatus === "COMPLETED"
          ? "JOB_DELETE_BLOCKED_COMPLETED"
          : canVendorDelete
          ? linkedSessionCount > 0
            ? "JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED"
            : "JOB_DELETE_SUCCESS_NO_LINKED_CONTENT"
          : "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
    });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to inspect job delete dependencies", details: error.message },
      { status: 500 }
    );
  }
}
