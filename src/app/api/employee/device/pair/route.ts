import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { getEmployeeRuntimeErrorResponse } from "@/lib/employee-runtime-errors";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const deviceUid = String(body?.deviceUid || "").trim();
    const deviceType = String(body?.deviceType || "PHONE").trim().toUpperCase();
    const model = String(body?.model || "").trim();
    const os = String(body?.os || "").trim();
    const appVersion = String(body?.appVersion || "").trim();
    const deviceName =
      model ||
      (deviceType === "HEADSET" ? "Employee Headset" : "Employee Phone");
    if (!deviceUid) {
      return NextResponse.json({ error: "deviceUid is required" }, { status: 422 });
    }
    if (!["PHONE", "HEADSET"].includes(deviceType)) {
      return NextResponse.json({ error: "Unsupported deviceType" }, { status: 422 });
    }

    const membership = await prisma.vendorMembership.findFirst({
      where: { userId, status: "ACTIVE", role: "EMPLOYEE" },
      orderBy: { approvedAt: "desc" },
      select: { id: true, vendorId: true, pendingPhoneDeviceUid: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Active employee membership required" }, { status: 403 });
    }

    const now = new Date();
    const existing = await (prisma as any).device.findUnique({ where: { deviceUid } });
    if (existing) {
      const activeOwner = await prisma.deviceAssignment.findFirst({
        where: { deviceId: existing.id, unassignedAt: null },
        select: { membershipId: true },
      });
      const isCurrentOwner = activeOwner?.membershipId === membership.id;
      const isApprovedLegacyClaim =
        !activeOwner &&
        existing.vendorId === membership.vendorId &&
        membership.pendingPhoneDeviceUid === deviceUid;
      if (!isCurrentOwner && !isApprovedLegacyClaim) {
        return NextResponse.json(
          { error: "This device is already connected to another account." },
          { status: 409 }
        );
      }
    }
    const device = existing
      ? await (prisma as any).device.update({
          where: { id: existing.id },
          data: {
            vendorId: membership.vendorId,
            deviceType,
            isActive: true,
            lastSeenAt: now,
            deviceName: deviceName || existing.deviceName,
            model: model || existing.model || "",
            os: os || existing.os || "",
            appVersion: appVersion || existing.appVersion || "",
          },
        })
      : await (prisma as any).device.create({
          data: {
            vendorId: membership.vendorId,
            deviceUid,
            deviceName,
            deviceType,
            isActive: true,
            pairedAt: now,
            lastSeenAt: now,
            model,
            os,
            appVersion,
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

    const isFirstPairing = !existing;
    if (isFirstPairing) {
      await recordLifecycleAudit({
        actionType: "device_paired",
        entityType: "device",
        entityId: String(device.id),
        actorUserId: userId,
        newValue: {
          deviceUid,
          deviceName,
          deviceType,
          model,
          os,
          appVersion,
        },
        metadata: {
          vendorId: membership.vendorId,
          membershipId: membership.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      pairing: {
        deviceId: device.id,
        deviceUid: device.deviceUid,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        vendorId: membership.vendorId,
        membershipId: membership.id,
        pairedAt: device.pairedAt,
        lastSeenAt: device.lastSeenAt,
        status: device.isActive ? "active" : "inactive",
        model: device.model || null,
        os: device.os || null,
        appVersion: device.appVersion || null,
        firstPairing: isFirstPairing,
      },
    });
  } catch (error: any) {
    const runtimeError = getEmployeeRuntimeErrorResponse("pair", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
