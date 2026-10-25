import { recalculateVendorTrustScore } from "@/lib/trust-score-calculator";
import {
  TRUST_OUTCOME_TYPES,
  recordFinalizedOperationalOutcome,
} from "@/lib/trust-score-outcome-foundation";

interface CoreAuditDecisionRow {
  id: string;
  bookingId: string;
  vendorId: string;
  packageId: string;
  packageVersion?: number | null;
  decision: string;
  decidedAt: Date | string;
  adminUserId?: string | null;
  evidenceVersion?: number | null;
}

type ReconciliationDb = {
  serviceVideoAdminAuditDecisionEvidence?: {
    findMany?: (args: any) => Promise<CoreAuditDecisionRow[]>;
  };
  vendorOperationalOutcome?: any;
  bookingServiceIssue?: any;
  vendorTrustScoreSnapshot?: any;
  booking?: any;
};

function finalizedAt(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Core Admin Audit decision is missing a valid decidedAt timestamp.");
  }
  return date;
}

/**
 * Projects one exact, durable Reliance Audit decision into the Trust Score truth layer.
 * Source-keyed writes are idempotent and never alter the underlying audit evidence.
 */
export async function reconcileCoreAuditDecisionForTrustScore(
  db: ReconciliationDb,
  row: CoreAuditDecisionRow,
) {
  const decision = String(row.decision || "").trim().toUpperCase();
  if (decision !== "PASS" && decision !== "REJECT") {
    return { skipped: true, reason: "Unsupported core audit decision", outcomes: 0 };
  }

  const at = finalizedAt(row.decidedAt);
  const common = {
    vendorId: row.vendorId,
    bookingId: row.bookingId,
    sourceEntityType: "service_video_admin_audit_decision",
    sourceEntityId: row.id,
    finalizedAt: at,
    finalizedByUserId: row.adminUserId || null,
    metadata: {
      packageId: row.packageId,
      packageVersion: row.packageVersion ?? null,
      auditEvidenceVersion: row.evidenceVersion ?? null,
    },
  };

  const packageOutcome = decision === "PASS"
    ? TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED
    : TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED;

  await recordFinalizedOperationalOutcome(db as any, {
    ...common,
    outcomeType: packageOutcome,
  });

  if (decision === "PASS") {
    await recordFinalizedOperationalOutcome(db as any, {
      ...common,
      outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
    });
  }

  return { skipped: false, outcomes: decision === "PASS" ? 2 : 1 };
}

/**
 * Repairs missing derived Trust Score inputs from immutable Reliance Audit decisions, then
 * recalculates the vendor's current Version 2 snapshot. It does not backfill from status text,
 * reviews, privacy choices, or inferred dates.
 */
export async function reconcileVendorTrustScore(
  db: ReconciliationDb,
  vendorId: string,
  reason = "vendor_trust_score_refresh",
  source = "vendor_trust_score",
) {
  if (!vendorId) {
    return {
      ok: false,
      skipped: true,
      reason: "vendorId is required",
      reconciledDecisions: 0,
      verifiedAt: null,
      snapshot: null,
      breakdown: undefined,
    };
  }

  const decisions = db.serviceVideoAdminAuditDecisionEvidence?.findMany
    ? await db.serviceVideoAdminAuditDecisionEvidence.findMany({
        where: { vendorId },
        orderBy: [{ decidedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          bookingId: true,
          vendorId: true,
          packageId: true,
          packageVersion: true,
          decision: true,
          decidedAt: true,
          adminUserId: true,
          evidenceVersion: true,
        },
      })
    : [];

  let reconciledDecisions = 0;
  for (const decision of decisions) {
    const result = await reconcileCoreAuditDecisionForTrustScore(db, decision);
    if (!result.skipped) reconciledDecisions += 1;
  }

  const recalculation = await recalculateVendorTrustScore(db as any, vendorId, reason, source);
  return {
    ...recalculation,
    reconciledDecisions,
    verifiedAt: new Date().toISOString(),
  };
}

/** Scoring is advisory and must never roll back a completed legal/evidence workflow. */
export async function tryReconcileCoreAuditDecisionAndScore(
  db: ReconciliationDb,
  row: CoreAuditDecisionRow,
) {
  try {
    const reconciliation = await reconcileCoreAuditDecisionForTrustScore(db, row);
    const recalculation = await recalculateVendorTrustScore(
      db as any,
      row.vendorId,
      `core_admin_audit_${String(row.decision || "").toLowerCase()}`,
      "core_admin_audit",
    );
    return { ok: true, reconciliation, recalculation };
  } catch (error) {
    console.error("[trust-score-reconciliation] core audit sync skipped", {
      auditDecisionId: row.id,
      bookingId: row.bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      skipped: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
