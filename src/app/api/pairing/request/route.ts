import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req: Request) {
  const vendorId = await getVendorIdFromRequest(req);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const session = await (prisma as any).devicePairingCode.create({
    data: { vendorId, code, expiresAt },
  });

  return NextResponse.json({
    code: session.code,
    expiresAt: session.expiresAt,
  });
}
