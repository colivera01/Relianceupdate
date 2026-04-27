// src/app/api/device/pairing/confirm/route.ts

import { prisma } from "@/server/db";

import { NextResponse } from "next/server";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}



export async function POST(req: Request) {
  try {
    const { code, deviceName, deviceType, deviceUid } = await req.json();
    const normalizedCode = String(code || '').trim();
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

    const pairing = await (prisma as any).devicePairingCode.findUnique({
      where: { code: normalizedCode },
    });

    if (!pairing || pairing.used || pairing.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const now = new Date();
    // Transition strategy:
    // - Primary lookup/write key: deviceUid
    // - Legacy fallback key: employeeId (for old MVP rows)
    const vendorIdEsc = sqlEscape(String(pairing.vendorId));
    const uidEsc = sqlEscape(normalizedUid);
    const typeEsc = sqlEscape(normalizedType);
    const nameEsc = sqlEscape(normalizedName);
    const uaEsc = sqlEscape(req.headers.get("user-agent") || "");

    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT TOP 1 id FROM devices WHERE deviceUid='${uidEsc}' OR employeeId='${uidEsc}' ORDER BY createdAt DESC`
    );
    const existingDeviceId = String(existingRows?.[0]?.id || "");

    if (existingDeviceId) {
      const idEsc = sqlEscape(existingDeviceId);
      await prisma.$executeRawUnsafe(
        `UPDATE devices SET vendorId='${vendorIdEsc}', deviceUid='${uidEsc}', employeeId=COALESCE(employeeId,'${uidEsc}'), deviceType='${typeEsc}', deviceName='${nameEsc}', userAgent='${uaEsc}', lastSeenAt=GETUTCDATE() WHERE id='${idEsc}'`
      );
    } else {
      const newId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const idEsc = sqlEscape(newId);
      await prisma.$executeRawUnsafe(
        `INSERT INTO devices (id, vendorId, deviceUid, employeeId, deviceType, deviceName, createdAt, lastSeenAt, userAgent) VALUES ('${idEsc}','${vendorIdEsc}','${uidEsc}','${uidEsc}','${typeEsc}','${nameEsc}',GETUTCDATE(),GETUTCDATE(),'${uaEsc}')`
      );
    }

    const deviceRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT TOP 1 id, vendorId, deviceUid, employeeId, deviceType, deviceName, lastSeenAt FROM devices WHERE deviceUid='${uidEsc}' OR employeeId='${uidEsc}' ORDER BY createdAt DESC`
    );
    const device = deviceRows?.[0] || null;

    await (prisma as any).devicePairingCode.update({
      where: { id: pairing.id },
      data: { used: true },
    });

    return NextResponse.json({
      success: true,
      device: {
        ...device,
        deviceUid: normalizedUid,
        lastActive: now.toISOString(),
      },
    });
  } catch (error: any) {
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


