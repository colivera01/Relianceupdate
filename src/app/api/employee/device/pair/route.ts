import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const deviceUid = String(body?.deviceUid || "").trim();
    const deviceType = String(body?.deviceType || "PHONE").trim().toUpperCase();
    if (!deviceUid) {
      return NextResponse.json({ error: "deviceUid is required" }, { status: 422 });
    }
    if (!["PHONE", "HEADSET"].includes(deviceType)) {
      return NextResponse.json({ error: "Unsupported deviceType" }, { status: 422 });
    }

    const membership = await prisma.vendorMembership.findFirst({
      where: { userId, status: "ACTIVE", role: "EMPLOYEE" },
      orderBy: { approvedAt: "desc" },
      select: { id: true, vendorId: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Active employee membership required" }, { status: 403 });
    }

    const now = new Date();
    const existing = await (prisma as any).device.findUnique({ where: { deviceUid } });
    const device = existing
      ? await (prisma as any).device.update({
          where: { id: existing.id },
          data: {
            vendorId: membership.vendorId,
            deviceType,
            isActive: true,
            lastSeenAt: now,
            model: String(body?.model || existing.model || ""),
            os: String(body?.os || existing.os || ""),
            appVersion: String(body?.appVersion || existing.appVersion || ""),
          },
        })
      : await (prisma as any).device.create({
          data: {
            vendorId: membership.vendorId,
            deviceUid,
            deviceType,
            isActive: true,
            pairedAt: now,
            lastSeenAt: now,
            model: String(body?.model || ""),
            os: String(body?.os || ""),
            appVersion: String(body?.appVersion || ""),
          },
        });

    // Keep assignment visible in vendor device management.
    const activeAssignment = await prisma.deviceAssignment.findFirst({
      where: { deviceId: device.id, membershipId: membership.id, unassignedAt: null },
      select: { id: true },
    });
    if (!activeAssignment) {
      await prisma.deviceAssignment.create({
        data: {
          vendorId: membership.vendorId,
          deviceId: device.id,
          membershipId: membership.id,
          assignedByUserId: userId,
        },
      });
    }

    await prisma.vendorMembership.update({
      where: { id: membership.id },
      data: {
        pendingPhoneDeviceUid: deviceUid,
        pendingDeviceModel: String(body?.model || ""),
        pendingDeviceOs: String(body?.os || ""),
        pendingAppVersion: String(body?.appVersion || ""),
      },
    });

    return NextResponse.json({
      success: true,
      pairing: {
        deviceId: device.id,
        deviceUid: device.deviceUid,
        deviceType: device.deviceType,
        vendorId: membership.vendorId,
        membershipId: membership.id,
        pairedAt: device.pairedAt,
        lastSeenAt: device.lastSeenAt,
        status: device.isActive ? "active" : "inactive",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to pair employee device", details: error?.message }, { status: 500 });
  }
}
