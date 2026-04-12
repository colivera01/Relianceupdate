// src/app/api/vendors/[vendorId]/headsets/[deviceId]/assign/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; deviceId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/headsets/[deviceId]/assign
 * Assign a headset to an employee (MANAGER only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, deviceId } = await params;
    const { userId } = await requireVendorManager(request, vendorId);

    const body = await request.json();
    const { membershipId } = body;

    if (!membershipId) {
      return NextResponse.json(
        { error: "Membership ID required" },
        { status: 422 }
      );
    }

    // Verify device exists and is a headset
    const device = await (prisma as any).device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    if (device.vendorId !== vendorId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (device.deviceType !== "HEADSET") {
      return NextResponse.json(
        { error: "Device is not a headset" },
        { status: 422 }
      );
    }

    // Verify membership exists and is active
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

    // Use transaction to ensure atomicity: unassign existing, then assign new
    const assignment = await (prisma as any).$transaction(async (tx: any) => {
      // Close any existing active assignment for this headset
      await tx.deviceAssignment.updateMany({
        where: {
          deviceId,
          unassignedAt: null,
        },
        data: {
          unassignedAt: new Date(),
        },
      });

      // Create new assignment
      return await tx.deviceAssignment.create({
        data: {
          vendorId,
          deviceId,
          membershipId,
          assignedByUserId: userId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        deviceId: assignment.deviceId,
        membershipId: assignment.membershipId,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch (error: any) {
    console.error("[headsets/assign] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to assign headset", details: error.message },
      { status: 500 }
    );
  }
}

