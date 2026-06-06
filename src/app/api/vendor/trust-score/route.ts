import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";
import { getCurrentVendorTrustScoreSnapshot, toVendorTrustScore } from "@/lib/trust-score-read";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

/**
 * GET /api/vendor/trust-score
 * Vendor-facing, snapshot-based Reliance Trust Score for the authenticated vendor's OWN
 * account. Richer than public (adds improvement hints) but still snapshot-based and free of
 * admin-only internals. Never reads `Review`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const vendorId = await getVendorIdFromRequest(request);
    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized: no vendor ID" }, { status: 401 });
    }

    let snapshot = null;
    try {
      snapshot = await withTransientDbRetry(() =>
        getCurrentVendorTrustScoreSnapshot(prisma as any, vendorId)
      );
    } catch (readError) {
      console.error("[vendor/trust-score] snapshot read failed:", readError);
      snapshot = null;
    }

    return NextResponse.json({
      success: true,
      vendorId,
      trustScore: toVendorTrustScore(snapshot),
    });
  } catch (error: any) {
    console.error("[vendor/trust-score] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error:
            "Trust Score is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "Trust Score is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch trust score", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
