import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function POST(req: Request) {
  const { code, deviceType, deviceName, userAgent } = await req.json();

  if (!deviceName || !deviceType) {
    return NextResponse.json({ error: "deviceName and deviceType are required" }, { status: 400 });
  }

  const session = await (prisma as any).devicePairingCode.findUnique({
    where: { code },
  });

  if (!session || session.used || session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const device = await (prisma as any).device.create({
    data: {
      vendorId: session.vendorId,
      deviceType,
      deviceName,
      userAgent: userAgent ?? null,
      // lastSeenAt has a default, so we don't need to set it explicitly
    },
  });

  await (prisma as any).devicePairingCode.update({
    where: { id: session.id },
    data: { used: true },
  });

  return NextResponse.json({
    success: true,
    device,
  });
}
