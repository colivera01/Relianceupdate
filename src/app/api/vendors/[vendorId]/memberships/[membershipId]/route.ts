import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; membershipId: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<NextResponse> {
  let step = "init";
  const nonProd = process.env.NODE_ENV !== "production";
  const debug: Record<string, unknown> = {};
  try {
    step = "resolve_params";
    const { vendorId, membershipId } = await params;
    debug.membershipIdReceived = membershipId;
    debug.vendorId = vendorId;
    step = "require_manager";
    const { userId: managerUserId } = await requireVendorManager(request, vendorId);
    debug.currentUserId = managerUserId;

    step = "load_membership";
    const membership = await (prisma as any).vendorMembership.findUnique({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!membership) {
      return NextResponse.json(
        {
          error: "Membership not found",
          ...(nonProd ? { step, details: debug } : {}),
        },
        { status: 404 }
      );
    }
    debug.actualStatus = String(membership.status || "");
    debug.actualRole = String(membership.role || "");
    debug.membershipUserId = String(membership.userId || "");
    debug.membershipVendorId = String(membership.vendorId || "");
    if (String(membership.vendorId) !== String(vendorId)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          ...(nonProd ? { step, details: debug } : {}),
        },
        { status: 403 }
      );
    }

    const membershipStatus = String(membership.status || "").trim().toUpperCase();
    if (membershipStatus !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "Only active memberships can be removed",
          code: "MEMBERSHIP_NOT_ACTIVE",
          ...(nonProd ? { step, details: debug } : {}),
        },
        { status: 422 }
      );
    }

    if (String(membership.userId) === String(managerUserId)) {
      return NextResponse.json(
        {
          error: "You cannot remove your own manager account",
          code: "CANNOT_REMOVE_SELF",
          ...(nonProd ? { step, details: debug } : {}),
        },
        { status: 422 }
      );
    }

    const membershipRole = String(membership.role || "").trim().toUpperCase();
    if (membershipRole === "MANAGER") {
      const activeManagers = await (prisma as any).vendorMembership.count({
        where: {
          vendorId,
          role: { in: ["MANAGER", "manager"] },
          status: { in: ["ACTIVE", "active"] },
        },
      });
      if (activeManagers <= 1) {
        return NextResponse.json(
          {
            error: "Cannot remove the last active manager from this vendor",
            code: "CANNOT_REMOVE_LAST_MANAGER",
            ...(nonProd ? { step, details: debug } : {}),
          },
          { status: 422 }
        );
      }
    }

    step = "update_membership_removed";
    const removedAt = new Date();
    const updatedMembership = await (prisma as any).vendorMembership.update({
      where: { id: membershipId },
      data: {
        status: "REMOVED",
        revokedAt: removedAt,
        revokedByUserId: managerUserId,
      },
    });

    step = "unassign_devices";
    try {
      await (prisma as any).deviceAssignment.updateMany({
        where: {
          membershipId,
          unassignedAt: null,
        },
        data: { unassignedAt: removedAt },
      });
    } catch (error: any) {
      // Some local DBs do not yet include device_assignments; removal should still succeed.
      const code = String(error?.code || "").toUpperCase();
      if (code !== "P2021") {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      membership: {
        id: updatedMembership.id,
        userId: updatedMembership.userId,
        role: updatedMembership.role,
        status: updatedMembership.status,
        revokedAt: updatedMembership.revokedAt,
      },
      removedUser: membership.user,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: "Failed to remove membership",
        details: error?.message || String(error),
        ...(nonProd
          ? {
              step,
              debug: {
                ...debug,
                prismaCode: error?.code || null,
                prismaMeta: error?.meta || null,
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
