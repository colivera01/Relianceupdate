import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const vendorId = await getVendorIdFromRequest(request);
    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = String(searchParams.get("code") || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Valid pairing code required" }, { status: 400 });
    }

    const pairing = await (prisma as any).devicePairingCode.findUnique({
      where: { code },
      select: {
        id: true,
        vendorId: true,
        used: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!pairing || String(pairing.vendorId) !== String(vendorId)) {
      return NextResponse.json({ error: "Pairing request not found" }, { status: 404 });
    }

    const now = new Date();
    const expired = new Date(pairing.expiresAt) <= now;
    const status = pairing.used ? "paired" : expired ? "expired" : "pending";

    return NextResponse.json({
      success: true,
      status,
      used: Boolean(pairing.used),
      expiresAt: new Date(pairing.expiresAt).toISOString(),
      createdAt: new Date(pairing.createdAt).toISOString(),
    });
  } catch (error: any) {
    console.error("[pairing/status] GET error:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch pairing status" }, { status: 500 });
  }
}
