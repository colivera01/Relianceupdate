// src/app/api/device/pairing/request/route.ts

import { prisma } from "@/server/db";

import { getVendorIdFromRequest } from "@/lib/auth";

import { NextResponse } from "next/server";

import crypto from "crypto";



export async function POST(req: Request) {
  try {
    console.log("[pairing/request] Starting request...");
    const vendorId = await getVendorIdFromRequest(req);
    console.log("[pairing/request] Vendor ID:", vendorId);

    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    console.log("[pairing/request] Generated code:", code);

    // Try to create the pairing code
    // Using 'as any' to bypass TypeScript if Prisma client hasn't been regenerated
    await (prisma as any).devicePairingCode.create({
      data: {
        vendorId,
        code,
        expiresAt,
      },
    });

    console.log("[pairing/request] Successfully created pairing code");
    return NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("[pairing/request] Error:", error);
    console.error("[pairing/request] Error name:", error?.name);
    console.error("[pairing/request] Error message:", error?.message);
    if (error?.stack) {
      console.error("[pairing/request] Error stack:", error.stack);
    }
    return NextResponse.json(
      { 
        error: "Failed to create pairing code",
        details: error?.message || String(error),
        code: error?.code,
        meta: error?.meta
      },
      { status: 500 }
    );
  }
}


