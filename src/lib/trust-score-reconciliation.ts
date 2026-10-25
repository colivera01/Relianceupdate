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

export interface BookingCancellationRow {
  id: string;
  vendorId: string;
  status: string;
  customerMetadata?: string | null;
  updatedAt?: Date | string | null;
}

export type BookingCancellationAttribution =
  | "CUSTOMER"
  | "VENDOR"
  | "ADMINISTRATIVE"
  | "UNKNOWN";

type ReconciliationDb = {
  serviceVideoAdminAuditDecisionEvidence?: {
    findMany?: (args: any) => Promise<CoreAuditDecisionRow[]>;
  };
  vendorOperationalOutcome?: any;
  bookingServiceIssue?: any;
  vendorTrustScoreSnapshot?: any;
  booking?: {
    findMany?: (args: any) => Promise<BookingCancellationRow[]>;
    [key: string]: any;
  };
};

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function normalized(value: unknown): string {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function cancellationDate(value: unknown, fallback: Date | string | null | undefined): Date {
  const candidate = value || fallback;
  const date = candidate instanceof Date ? candidate : new Date(String(candidate || ""));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Booking cancellation is missing a valid cancellation timestamp.");
  }
  return date;
}

export function resolveBookingCancellationAttribution(
  row: BookingCancellationRow,
): BookingCancellationAttribution {
  if (!new Set(["CANCELED", "CANCELLED"]).has(normalized(row.status))) return "UNKNOWN";
  const metadata = parseJsonRecord(row.customerMetadata);
  const cancellation = parseJsonRecord(metadata.vendor_job_cancellation);
  const attribution = normalized(cancellation.attribution);
  if (attribution === "CUSTOMER" || attribution === "VENDOR" || attribution === "ADMINISTRATIVE") {
    return attribution;
  }

  const source = normalized(cancellation.source);
  if (source === "CUSTOMER_CANCELLATION" || source === "CUSTOMER_RECORDING_PERMISSION_DECLINE") {
    return "CUSTOMER";
  }
  if (source === "VENDOR_ATTRIBUTED_CANCELLATION") return "VENDOR";
  if (source === "ADMINISTRATIVE_CANCELLATION") return "ADMINISTRATIVE";

  // Legacy manager-entered cancellations are deliberately neutral. A manager may have
  // recorded a customer's request, so actor membership alone cannot establish fault.
  return "UNKNOWN";
}

/** Projects explicit cancellation responsibility without inferring fault from the actor. */
export async function reconcileBookingCancellationForTrustScore(
  db: ReconciliationDb,
  row: BookingCancellationRow,
) {
  const attribution = resolveBookingCancellationAttribution(row);
  if (attribution === "UNKNOWN") {
    return { skipped: true, reason: "Cancellation attribution is not explicit", outcomes: 0, attribution };
  }

  const metadata = parseJsonRecord(row.customerMetadata);
  const cancellation = parseJsonRecord(metadata.vendor_job_cancellation);
  const outcomeType = attribution === "VENDOR"
    ? TRUST_OUTCOME_TYPES.WORKFLOW_CANCELED_VENDOR
    : attribution === "CUSTOMER"
      ? TRUST_OUTCOME_TYPES.WORKFLOW_CANCELED_CUSTOMER
      : TRUST_OUTCOME_TYPES.WORKFLOW_CANCELED_ADMINISTRATIVE;

  await recordFinalizedOperationalOutcome(db as any, {
    vendorId: row.vendorId,
    bookingId: row.id,
    outcomeType,
    sourceEntityType: "booking_cancellation_attribution",
    sourceEntityId: row.id,
    finalizedAt: cancellationDate(cancellation.canceled_at, row.updatedAt),
    finalizedByUserId: String(cancellation.canceled_by_user_id || "").trim() || null,
    metadata: {
      attribution,
      source: String(cancellation.source || "").trim() || null,
      reason: String(cancellation.reason || "").trim() || null,
    },
  });

  return { skipped: false, outcomes: 1, attribution };
}

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
 * Repairs missing derived Trust Score inputs from immutable Reliance Audit decisions and
 * explicit preserved cancellation attribution, then recalculates the vendor's current
 * Version 3 snapshot. It does not infer cancellation fault from an actor, status text,
 * reviews, privacy choices, or scheduled dates.
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
      reconciledCancellations: 0,
      reconciledVendorCancellations: 0,
      verifiedAt: null,
      snapshot: null,
      breakdown: undefined,
    };
  }

  const [decisions, cancellations] = await Promise.all([
    db.serviceVideoAdminAuditDecisionEvidence?.findMany
      ? db.serviceVideoAdminAuditDecisionEvidence.findMany({
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
      : Promise.resolve([]),
    db.booking?.findMany
      ? db.booking.findMany({
          where: { vendorId, status: { in: ["CANCELED", "CANCELLED"] } },
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            vendorId: true,
            status: true,
            customerMetadata: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  let reconciledDecisions = 0;
  for (const decision of decisions) {
    const result = await reconcileCoreAuditDecisionForTrustScore(db, decision);
    if (!result.skipped) reconciledDecisions += 1;
  }

  let reconciledCancellations = 0;
  let reconciledVendorCancellations = 0;
  for (const cancellation of cancellations) {
    const result = await reconcileBookingCancellationForTrustScore(db, cancellation);
    if (!result.skipped) {
      reconciledCancellations += 1;
      if (result.attribution === "VENDOR") reconciledVendorCancellations += 1;
    }
  }

  const recalculation = await recalculateVendorTrustScore(db as any, vendorId, reason, source);
  return {
    ...recalculation,
    reconciledDecisions,
    reconciledCancellations,
    reconciledVendorCancellations,
    verifiedAt: new Date().toISOString(),
  };
}

/** Scoring is advisory and must never roll back a completed cancellation workflow. */
export async function tryReconcileBookingCancellationAndScore(
  db: ReconciliationDb,
  row: BookingCancellationRow,
  reason = "booking_cancellation_recorded",
  source = "booking_cancellation",
) {
  try {
    const reconciliation = await reconcileBookingCancellationForTrustScore(db, row);
    const recalculation = await recalculateVendorTrustScore(db as any, row.vendorId, reason, source);
    return { ok: true, reconciliation, recalculation };
  } catch (error) {
    console.error("[trust-score-reconciliation] booking cancellation sync skipped", {
      bookingId: row.id,
      vendorId: row.vendorId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      skipped: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
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
