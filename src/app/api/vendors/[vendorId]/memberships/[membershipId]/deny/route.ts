// src/app/api/vendors/[vendorId]/memberships/[membershipId]/deny/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: { vendorId: string; membershipId: string };
}

/**
 * POST /api/vendors/[vendorId]/memberships/[membershipId]/deny
 * Deny a pending membership (MANAGER only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, membershipId } = params;
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

    if (membership.status !== "PENDING") {
      return NextResponse.json(
        { error: "Membership is not pending" },
        { status: 422 }
      );
    }

    const updatedMembership = await (prisma as any).vendorMembership.update({
      where: { id: membershipId },
      data: {
        status: "DENIED",
        deniedAt: new Date(),
        deniedByUserId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      membership: {
        id: updatedMembership.id,
        status: updatedMembership.status,
        deniedAt: updatedMembership.deniedAt,
      },
    });
  } catch (error: any) {
    console.error("[memberships/deny] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to deny membership", details: error.message },
      { status: 500 }
    );
  }
}

