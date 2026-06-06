// src/app/api/device/pairing/confirm/route.ts

import { prisma } from "@/server/db";
import { verifyDevicePairingInviteToken } from "@/lib/device-pairing-link";

import { NextResponse } from "next/server";



export async function POST(req: Request) {
  try {
    const { code, inviteToken, deviceName, deviceType, deviceUid } = await req.json();
    const claims = verifyDevicePairingInviteToken(inviteToken);
    const normalizedCode = claims?.code || String(code || '').trim();
    const normalizedUid = String(deviceUid || '').trim();
    const normalizedName = String(deviceName || '').trim() || 'Vendor Device';
    const normalizedType = String(deviceType || 'PHONE').trim().toUpperCase();

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({ error: "Pairing code must be a 6-digit number" }, { status: 400 });
    }
    if (!normalizedUid) {
      return NextResponse.json({ error: "deviceUid is required" }, { status: 400 });
    }
    if (!['PHONE', 'HEADSET'].includes(normalizedType)) {
      return NextResponse.json({ error: "Invalid deviceType" }, { status: 400 });
    }

    const now = new Date();
    const pairing = await (prisma as any).devicePairingCode.findUnique({
      where: { code: normalizedCode },
      select: { id: true, vendorId: true, used: true, expiresAt: true },
    });

    if (!pairing || pairing.used || pairing.expiresAt < now) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const device = await prisma.$transaction(async (tx: any) => {
      // Consume code atomically so concurrent confirms cannot both succeed.
      const consumed = await tx.devicePairingCode.updateMany({
        where: {
          id: String(pairing.id),
          used: false,
          expiresAt: { gt: now },
        },
        data: { used: true },
      });
      if (Number(consumed?.count || 0) === 0) {
        throw new Error("PAIRING_CODE_ALREADY_USED_OR_EXPIRED");
      }

      // Transition strategy:
      // - Primary lookup/write key: deviceUid
      // - Legacy fallback key: employeeId (for old MVP rows)
      const existing = await tx.device.findFirst({
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
          lastSeenAt: true,
        },
        orderBy: { pairedAt: "desc" },
      });

      if (existing?.id) {
        return tx.device.update({
          where: { id: String(existing.id) },
          data: {
            vendorId: String(pairing.vendorId),
            deviceUid: normalizedUid,
            employeeId: existing.employeeId || normalizedUid,
            deviceName: normalizedName,
            deviceType: normalizedType,
            lastSeenAt: now,
          },
          select: {
            id: true,
            vendorId: true,
            deviceUid: true,
            employeeId: true,
            deviceType: true,
            lastSeenAt: true,
          },
        });
      }

      return tx.device.create({
        data: {
          vendorId: String(pairing.vendorId),
          deviceUid: normalizedUid,
          employeeId: normalizedUid,
          deviceName: normalizedName,
          deviceType: normalizedType,
          pairedAt: now,
          lastSeenAt: now,
        },
        select: {
          id: true,
          vendorId: true,
          deviceUid: true,
          employeeId: true,
          deviceType: true,
          lastSeenAt: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      device: {
        ...device,
        deviceName: normalizedName,
        deviceUid: normalizedUid,
        lastActive: now.toISOString(),
      },
    });
  } catch (error: any) {
    if (String(error?.message || "") === "PAIRING_CODE_ALREADY_USED_OR_EXPIRED") {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    console.error("[pairing/confirm] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to confirm pairing",
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
