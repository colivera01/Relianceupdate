// src/app/api/vendors/[vendorId]/devices/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/devices
 * List all devices (phones + headsets) for a vendor (MANAGER only)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await params;
    await requireVendorManager(request, vendorId);

    const devices = await (prisma as any).device.findMany({
      where: { vendorId },
      include: {
        assignments: {
          where: {
            unassignedAt: null,
          },
          include: {
            membership: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return NextResponse.json({
      devices: devices.map((device: any) => ({
        id: device.id,
        deviceUid: device.deviceUid,
        deviceType: device.deviceType,
        pairedAt: device.pairedAt,
        lastSeenAt: device.lastSeenAt,
        isActive: device.isActive,
        firmwareVersion: device.firmwareVersion,
        model: device.model,
        os: device.os,
        appVersion: device.appVersion,
        assignedTo: device.assignments.length > 0
          ? {
              membershipId: device.assignments[0].membershipId,
              user: device.assignments[0].membership.user,
            }
          : null,
      })),
    });
  } catch (error: any) {
    console.error("[devices] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch devices", details: error.message },
      { status: 500 }
    );
  }
}

