import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; membershipId: string }>;
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeText(value: unknown): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function isUniqueConstraintError(error: any): boolean {
  return String(error?.code || "").toUpperCase() === "P2002";
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  let step = "init";
  const nonProd = process.env.NODE_ENV !== "production";
  const debug: Record<string, unknown> = {};
  try {
    step = "resolve_params";
    const { vendorId, membershipId } = await params;
    debug.membershipIdReceived = membershipId;
    debug.vendorId = vendorId;

    step = "require_manager";
    await requireVendorManager(request, vendorId);

    step = "parse_body";
    const body = await request.json().catch(() => ({}));
    const name = normalizeText(body?.name);
    const email = normalizeEmail(body?.email);
    const phone = normalizeText(body?.phone);

    if (!name) {
      return NextResponse.json({ error: "Team member name is required" }, { status: 422 });
    }
    if (!email && !phone) {
      return NextResponse.json(
        { error: "Enter at least one contact method for this team member" },
        { status: 422 }
      );
    }

    step = "load_membership";
    const membership = await (prisma as any).vendorMembership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            authCredential: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (String(membership.vendorId) !== String(vendorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (String(membership.status || "").trim().toUpperCase() !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active team members can be edited", code: "MEMBERSHIP_NOT_ACTIVE" },
        { status: 422 }
      );
    }
    if (membership.user?.authCredential?.id && !email) {
      return NextResponse.json(
        { error: "This team member signs in with email, so an email address is required." },
        { status: 422 }
      );
    }

    step = "update_user_contact";
    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const updatedUser = await tx.user.update({
        where: { id: String(membership.userId) },
        data: {
          name,
          email,
          phone,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });

      const authCredentialId = membership.user?.authCredential?.id
        ? String(membership.user.authCredential.id)
        : "";
      const existingAuthEmail = String(membership.user?.authCredential?.email || "").trim().toLowerCase();
      if (authCredentialId && email && existingAuthEmail !== email) {
        await tx.authCredential.update({
          where: { id: authCredentialId },
          data: { email },
        });
      }

      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      membership: {
        id: membership.id,
        userId: membership.userId,
        role: membership.role,
        status: membership.status,
        user: updated,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        {
          error: "That email or phone number is already used by another Reliance account.",
          code: "CONTACT_ALREADY_USED",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to update team member",
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
