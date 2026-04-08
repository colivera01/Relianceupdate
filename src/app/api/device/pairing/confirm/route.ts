// src/app/api/device/pairing/confirm/route.ts

import { prisma } from "@/server/db";

import { NextResponse } from "next/server";



export async function POST(req: Request) {
  try {
    const { code, deviceName, deviceType } = await req.json();

    const pairing = await (prisma as any).devicePairingCode.findUnique({
      where: { code },
    });

    if (!pairing || pairing.used || pairing.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const device = await (prisma as any).device.create({
      data: {
        vendorId: pairing.vendorId,
        deviceName,
        deviceType,
        userAgent: req.headers.get("user-agent") || "",
      },
    });

    await (prisma as any).devicePairingCode.update({
      where: { id: pairing.id },
      data: { used: true },
    });

    return NextResponse.json({ success: true, device });
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


