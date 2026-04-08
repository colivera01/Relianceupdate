// src/app/api/device/heartbeat/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * POST /api/device/heartbeat
 * Employee phone sends heartbeat to update lastSeenAt
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { phoneDeviceUid, deviceMeta = {} } = body;

    if (!phoneDeviceUid) {
      return NextResponse.json(
        { error: "Phone device UID required" },
        { status: 422 }
      );
    }

    // Find device
    const device = await (prisma as any).device.findUnique({
      where: { deviceUid: phoneDeviceUid },
      include: {
        vendor: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!device || device.deviceType !== "PHONE" || !device.isActive) {
      return NextResponse.json(
        { error: "Device not found or inactive" },
        { status: 404 }
      );
    }

    // Update lastSeenAt
    await (prisma as any).device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        model: deviceMeta.model || device.model,
        os: deviceMeta.os || device.os,
        appVersion: deviceMeta.appVersion || device.appVersion,
      },
    });

    // Find active membership for this vendor and user
    // We need to find which user owns this device
    // For simplicity, we'll find by pendingPhoneDeviceUid or by device ownership
    const membership = await (prisma as any).vendorMembership.findFirst({
      where: {
        vendorId: device.vendorId,
        status: "ACTIVE",
        // Find membership where this device was registered
        OR: [
          { pendingPhoneDeviceUid: phoneDeviceUid },
          // Could also check if we add a deviceId to membership
        ],
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No active membership found for this device" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: membership.status,
      vendorId: device.vendorId,
      membershipId: membership.id,
      role: membership.role,
    });
  } catch (error: any) {
    console.error("[device/heartbeat] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process heartbeat", details: error.message },
      { status: 500 }
    );
  }
}

