// src/app/api/vendors/[vendorId]/memberships/[membershipId]/revoke/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; membershipId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/memberships/[membershipId]/revoke
 * Revoke an active membership (MANAGER only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, membershipId } = await params;
    const { userId } = await requireVendorManager(request, vendorId);

    const membership = await (prisma as any).vendorMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    if (membership.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (membership.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Membership is not active" },
        { status: 422 }
      );
    }

    const updatedMembership = await (prisma as any).vendorMembership.update({
      where: { id: membershipId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedByUserId: userId,
      },
    });

    // Deactivate all device assignments for this membership
    await (prisma as any).deviceAssignment.updateMany({
      where: {
        membershipId,
        unassignedAt: null,
      },
      data: {
        unassignedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      membership: {
        id: updatedMembership.id,
        status: updatedMembership.status,
        revokedAt: updatedMembership.revokedAt,
      },
    });
  } catch (error: any) {
    console.error("[memberships/revoke] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to revoke membership", details: error.message },
      { status: 500 }
    );
  }
}

