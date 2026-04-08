// src/app/api/devices/route.ts

import { prisma } from "@/server/db";

import { getVendorIdFromRequest } from "@/lib/auth";

import { NextResponse } from "next/server";



export async function GET(req: Request) {
  try {
    const vendorId = await getVendorIdFromRequest(req);

    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await (prisma as any).device.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ devices });
  } catch (error: any) {
    console.error("[devices] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch devices",
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}


