import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { rebuildAllVendorTrustScores } from "@/lib/trust-score-calculator";

/**
 * POST /api/admin/vendors/trust-score/rebuild
 * Admin-only backfill/rebuild path. Idempotently (re)builds the current Trust Score
 * snapshot for every vendor (or an explicit `vendorIds` subset in the body) by reusing the
 * Phase 1B calculator. Best-effort per vendor — one failure never aborts the batch. Never
 * reads `Review`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const vendorIds = Array.isArray(body?.vendorIds)
      ? body.vendorIds.map((v: unknown) => String(v || "").trim()).filter(Boolean)
      : undefined;

    const summary = await rebuildAllVendorTrustScores(prisma as any, {
      reason: "admin_backfill_rebuild",
      source: `admin_rebuild:${userId}`,
      vendorIds,
    });

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error("[admin/vendors/trust-score/rebuild] POST error:", error);
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to rebuild trust scores", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
