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

    // Find device (prefer canonical deviceUid; fallback to legacy employeeId rows).
    const normalizedUid = String(phoneDeviceUid).trim();
    const device = await (prisma as any).device.findFirst({
      where: {
        OR: [{ deviceUid: normalizedUid }, { employeeId: normalizedUid }],
      },
      select: {
        id: true,
        vendorId: true,
        deviceUid: true,
        employeeId: true,
        deviceType: true,
        model: true,
        os: true,
        appVersion: true,
      },
      orderBy: { pairedAt: "desc" },
    });

    if (!device || String(device.deviceType || "").toUpperCase() !== "PHONE") {
      return NextResponse.json(
        { error: "Device not found or inactive" },
        { status: 404 }
      );
    }

    // Update lastSeenAt and latest device metadata
    await (prisma as any).device.update({
      where: { id: String(device.id) },
      data: {
        lastSeenAt: new Date(),
        model: String(deviceMeta.model || device.model || ""),
        os: String(deviceMeta.os || device.os || ""),
        appVersion: String(deviceMeta.appVersion || device.appVersion || ""),
      },
    });

    // Find active membership for this vendor and user
    // We need to find which user owns this device
    // For simplicity, we'll find by pendingPhoneDeviceUid or by device ownership
    const membership = await (prisma as any).vendorMembership.findFirst({
      where: {
        vendorId: String(device.vendorId || ""),
        status: "ACTIVE",
        // Find membership where this device was registered
        OR: [
          { pendingPhoneDeviceUid: normalizedUid },
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
      vendorId: String(device.vendorId || ""),
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

