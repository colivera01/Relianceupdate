import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { countableVendorWhere } from "@/lib/metrics-exclusion";
import { getCurrentVendorTrustScoreSnapshot, toPublicTrustScore } from "@/lib/trust-score-read";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/vendors/[vendorId]/trust-score
 * Public-safe, snapshot-based Reliance Trust Score. Never recalculates live.
 * Only publicly-listed, active vendors are exposed. Returns a "not yet scored" shape
 * when no current snapshot exists. Excludes internal incident detail / recalc internals /
 * reviewer data. Trust Score is separate from Customer Ratings and never reads `Review`.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;

    const vendor = await withTransientDbRetry(() =>
      prisma.vendor.findFirst({
        where: countableVendorWhere({ id: vendorId, isPubliclyListed: true, accountStatus: "active" }),
        select: { id: true },
      })
    );
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    let snapshot = null;
    try {
      snapshot = await withTransientDbRetry(() =>
        getCurrentVendorTrustScoreSnapshot(prisma as any, vendor.id)
      );
    } catch (readError) {
      // Snapshot read is best-effort; fall back to a safe "not yet scored" shape.
      console.error("[vendors/:vendorId/trust-score] snapshot read failed:", readError);
      snapshot = null;
    }

    return NextResponse.json({
      success: true,
      vendorId: vendor.id,
      trustScore: toPublicTrustScore(snapshot),
    });
  } catch (error: any) {
    console.error("[vendors/:vendorId/trust-score] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
          message: PUBLIC_DB_UNAVAILABLE_MESSAGE,
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
