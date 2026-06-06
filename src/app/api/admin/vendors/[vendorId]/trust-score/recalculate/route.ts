import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { recalculateVendorTrustScore } from "@/lib/trust-score-calculator";
import { getCurrentVendorTrustScoreSnapshot, toAdminTrustScore } from "@/lib/trust-score-read";

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

/**
 * POST /api/admin/vendors/[vendorId]/trust-score/recalculate
 * Admin-only, explicit, idempotent rebuild of a single vendor's Trust Score snapshot,
 * reusing the Phase 1B calculator. Idempotent: an unchanged input hash writes no new row.
 * Never reads `Review`.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const { vendorId } = await context.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    const result = await recalculateVendorTrustScore(
      prisma as any,
      vendor.id,
      "admin_manual_recalculate",
      `admin_recalculate:${userId}`
    );

    const snapshot = await getCurrentVendorTrustScoreSnapshot(prisma as any, vendor.id);

    return NextResponse.json({
      success: result.ok,
      vendorId: vendor.id,
      unchanged: Boolean(result.unchanged),
      skipped: Boolean(result.skipped),
      reason: result.reason || null,
      trustScore: toAdminTrustScore(snapshot),
    });
  } catch (error: any) {
    console.error("[admin/vendors/:vendorId/trust-score/recalculate] POST error:", error);
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to recalculate trust score", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
