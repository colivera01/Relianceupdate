import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getCurrentVendorTrustScoreSnapshot,
  getTrustScoreSnapshotReadCapability,
  toAdminTrustScore,
} from "@/lib/trust-score-read";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

/**
 * GET /api/admin/vendors/[vendorId]/trust-score
 * Admin-only, snapshot-based read of the vendor's current Reliance Trust Score, including
 * internal inputs and the last recalc trigger/source. Never recalculates live and never
 * reads `Review` — Trust Score and Customer Rating stay separate.
 */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { vendorId } = await context.params;

    const vendor = await withTransientDbRetry(() =>
      prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, name: true, businessName: true },
      })
    );
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const snapshotReadCapability = getTrustScoreSnapshotReadCapability(prisma as any);
    const snapshot = await withTransientDbRetry(() =>
      getCurrentVendorTrustScoreSnapshot(prisma as any, vendor.id)
    );

    return NextResponse.json({
      success: true,
      vendorId: vendor.id,
      vendorName: vendor.businessName || vendor.name || null,
      snapshotReadCapability,
      trustScore: toAdminTrustScore(snapshot),
    });
  } catch (error: any) {
    console.error("[admin/vendors/:vendorId/trust-score] GET error:", error);
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
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
