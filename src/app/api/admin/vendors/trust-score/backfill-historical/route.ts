import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { backfillHistoricalOutcomes } from "@/lib/trust-score-historical-backfill";
import { rebuildAllVendorTrustScores } from "@/lib/trust-score-calculator";

/**
 * POST /api/admin/vendors/trust-score/backfill-historical
 * Admin-only, one-time historical finalized-outcome backfill (Phase 1E). Seeds
 * `VendorOperationalOutcome` rows from genuinely finalized historical signals
 * (completed bookings + terminally-moderated job-video packages) idempotently, then
 * rebuilds snapshots. Never reads or writes `Review`. Pass `{ "dryRun": true }` to
 * preview classification counts without writing.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    const backfill = await backfillHistoricalOutcomes(prisma as any, { dryRun });

    const rebuild = dryRun
      ? null
      : await rebuildAllVendorTrustScores(prisma as any, {
          reason: "historical_backfill_phase1e",
          source: `admin_backfill_historical:${userId}`,
        });

    return NextResponse.json({ success: true, dryRun, backfill, rebuild });
  } catch (error: any) {
    console.error("[admin/vendors/trust-score/backfill-historical] POST error:", error);
    if (error?.message === "Unauthorized" || String(error?.message || "").includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to backfill historical trust outcomes", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
