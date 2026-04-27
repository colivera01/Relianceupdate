// src/app/api/device/heartbeat/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

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
    const uidEsc = sqlEscape(String(phoneDeviceUid));
    const deviceRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT TOP 1 id, vendorId, deviceUid, employeeId, deviceType, model, os, appVersion FROM devices WHERE deviceUid='${uidEsc}' OR employeeId='${uidEsc}' ORDER BY createdAt DESC`
    );
    const device = deviceRows?.[0] || null;

    if (!device || String(device.deviceType || "").toUpperCase() !== "PHONE") {
      return NextResponse.json(
        { error: "Device not found or inactive" },
        { status: 404 }
      );
    }

    // Update lastSeenAt
    const idEsc = sqlEscape(String(device.id));
    const modelEsc = sqlEscape(String(deviceMeta.model || device.model || ""));
    const osEsc = sqlEscape(String(deviceMeta.os || device.os || ""));
    const appVersionEsc = sqlEscape(String(deviceMeta.appVersion || device.appVersion || ""));
    await prisma.$executeRawUnsafe(
      `UPDATE devices SET lastSeenAt=GETUTCDATE(), model='${modelEsc}', os='${osEsc}', appVersion='${appVersionEsc}' WHERE id='${idEsc}'`
    );

    // Find active membership for this vendor and user
    // We need to find which user owns this device
    // For simplicity, we'll find by pendingPhoneDeviceUid or by device ownership
    const membership = await (prisma as any).vendorMembership.findFirst({
      where: {
        vendorId: String(device.vendorId || ""),
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

