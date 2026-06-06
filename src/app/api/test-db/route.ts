import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  enforceDevRouteAccess,
  getDevRouteSecretHeaderName,
} from "@/lib/dev-route-access";

export async function GET(request: NextRequest) {
  const denied = enforceDevRouteAccess(request);
  if (denied) return denied;

  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    const vendorCount = await prisma.vendor.count();

    return NextResponse.json({
      success: true,
      message: "Development database probe succeeded",
      requiredHeader: getDevRouteSecretHeaderName(),
      vendorCount,
    });
  } catch (error: any) {
    console.error("[test-db] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Development database probe failed",
        code: String(error?.code || ""),
        name: String(error?.name || ""),
        message: String(error?.message || "Unknown database error"),
      },
      { status: 500 }
    );
  }
}
