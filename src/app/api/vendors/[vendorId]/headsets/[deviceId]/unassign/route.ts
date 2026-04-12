// src/app/api/vendors/[vendorId]/headsets/[deviceId]/unassign/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string; deviceId: string }>;
}

/**
 * POST /api/vendors/[vendorId]/headsets/[deviceId]/unassign
 * Unassign a headset from an employee (MANAGER only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId, deviceId } = await params;
    await requireVendorManager(request, vendorId);

    // Verify device exists
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

    // Unassign all active assignments for this headset
    const result = await (prisma as any).deviceAssignment.updateMany({
      where: {
        deviceId,
        unassignedAt: null,
      },
      data: {
        unassignedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      unassignedCount: result.count,
    });
  } catch (error: any) {
    console.error("[headsets/unassign] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to unassign headset", details: error.message },
      { status: 500 }
    );
  }
}

