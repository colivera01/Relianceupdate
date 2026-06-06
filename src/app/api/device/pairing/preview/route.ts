import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { verifyDevicePairingInviteToken } from "@/lib/device-pairing-link";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const inviteToken = String(searchParams.get("invite") || "").trim();
    const claims = verifyDevicePairingInviteToken(inviteToken);
    if (!claims) {
      return NextResponse.json({ error: "Invalid or expired pairing link" }, { status: 400 });
    }

    const pairing = await (prisma as any).devicePairingCode.findUnique({
      where: { code: claims.code },
      select: {
        used: true,
        expiresAt: true,
      },
    });

    const now = new Date();
    if (!pairing || pairing.used || new Date(pairing.expiresAt) <= now) {
      return NextResponse.json({ error: "Pairing link has already been used or expired" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      vendorName: claims.vendorName,
      expiresAt: new Date(pairing.expiresAt).toISOString(),
      maskedCode: `**${claims.code.slice(-2)}`,
    });
  } catch (error: any) {
    console.error("[pairing/preview] GET error:", error);
    return NextResponse.json({ error: "Failed to preview pairing link" }, { status: 500 });
  }
}
