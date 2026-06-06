// src/app/api/devices/route.ts

import { prisma } from "@/server/db";

import { getVendorIdFromRequest } from "@/lib/auth";

import { NextResponse } from "next/server";



export async function GET(req: Request) {
  try {
    const vendorId = await getVendorIdFromRequest(req);

    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await (prisma as any).device.findMany({
      where: { vendorId },
      select: {
        id: true,
        vendorId: true,
        deviceUid: true,
        employeeId: true,
        deviceType: true,
        pairedAt: true,
        lastSeenAt: true,
        isActive: true,
        model: true,
      },
      orderBy: [{ lastSeenAt: "desc" }, { pairedAt: "desc" }],
    });

    return NextResponse.json({
      devices: devices.map((device: any) => ({
        id: device.id,
        vendorId: device.vendorId,
        deviceUid: device.deviceUid,
        employeeId: device.employeeId,
        deviceType: device.deviceType,
        deviceName: device.model || device.deviceUid || `${device.deviceType} device`,
        userAgent: null,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.pairedAt,
        isActive: device.isActive,
      })),
    });
  } catch (error: any) {
    console.error("[devices] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch devices",
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}


