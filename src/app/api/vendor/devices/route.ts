import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const vendorId = await getVendorIdFromRequest(req);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devices = await (prisma as any).device.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(devices);
}
