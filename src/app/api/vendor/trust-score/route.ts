import { NextResponse } from "next/server";

import { getVendorIdFromRequest } from "@/lib/auth";
import { TRUST_SCORE_VERSION } from "@/lib/trust-score-calculator";
import { getCurrentVendorTrustScoreSnapshot, toVendorTrustScore } from "@/lib/trust-score-read";
import { reconcileVendorTrustScore } from "@/lib/trust-score-reconciliation";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";
import { prisma } from "@/server/db";

function unavailable(error: unknown) {
  console.error("[vendor/trust-score] request failed:", error);
  if (isTransientDbConnectivityError(error)) {
    return NextResponse.json(
      {
        success: false,
        code: PUBLIC_DB_UNAVAILABLE_CODE,
        error:
          "The reliability score is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
        message:
          "The reliability score is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
        retryable: true,
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: "Failed to fetch the reliability score",
      details: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  );
}

async function vendorIdFor(request: Request) {
  const vendorId = await getVendorIdFromRequest(request);
  return String(vendorId || "").trim();
}

async function responseFor(vendorId: string, forceRefresh: boolean) {
  let snapshot = await withTransientDbRetry(() =>
    getCurrentVendorTrustScoreSnapshot(prisma as any, vendorId),
  );
  let verifiedAt: string | null = null;
  let refreshed = false;

  if (forceRefresh || !snapshot || Number(snapshot.scoreVersion || 0) !== TRUST_SCORE_VERSION) {
    const result = await withTransientDbRetry(() =>
      reconcileVendorTrustScore(
        prisma as any,
        vendorId,
        forceRefresh ? "vendor_requested_refresh" : "score_version_upgrade",
        "vendor_analytics",
      ),
    );
    snapshot = result.snapshot || await getCurrentVendorTrustScoreSnapshot(prisma as any, vendorId);
    verifiedAt = result.verifiedAt || new Date().toISOString();
    refreshed = true;
  }

  return NextResponse.json({
    success: true,
    vendorId,
    scoreVersion: TRUST_SCORE_VERSION,
    refreshed,
    verifiedAt,
    trustScore: toVendorTrustScore(snapshot),
  });
}

/** Reads the current vendor-owned snapshot and upgrades stale formula versions on demand. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const vendorId = await vendorIdFor(request);
    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized: no vendor ID" }, { status: 401 });
    }
    return await responseFor(vendorId, false);
  } catch (error) {
    return unavailable(error);
  }
}

/** Reconciles exact finalized Audit evidence and returns one freshly verified snapshot. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const vendorId = await vendorIdFor(request);
    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized: no vendor ID" }, { status: 401 });
    }
    return await responseFor(vendorId, true);
  } catch (error) {
    return unavailable(error);
  }
}
