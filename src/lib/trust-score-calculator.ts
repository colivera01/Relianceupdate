/**
 * Trust Score Phase 1B — internal calculation + snapshot service.
 *
 * Consumes ONLY the finalized Phase 1A truth layer (`VendorOperationalOutcome`,
 * `BookingServiceIssue`) plus the finalized package-moderation outcomes recorded there.
 * It NEVER reads from or writes to `Review`: Customer Rating and Reliance Trust Score
 * remain fully separate. Pending / unreviewed items never reduce the score.
 *
 * The four weighted metrics (per RELIANCE_TRUST_SCORE_HANDOFF.md):
 *   - Verified Workflow Completion Rate   30%
 *   - Video Verification Success Rate      25%
 *   - Dispute-Free Completion Rate         30%
 *   - Operational Reliability Rate         15%
 *
 * Empty-denominator behavior (documented): a metric with no finalized denominator is
 * "not yet measurable" -> its pct is `null` and it is EXCLUDED from the weighted total,
 * with the remaining weights renormalized. If no metric is measurable, `totalScorePct`
 * is `null` (a snapshot is still written so the system stays idempotent).
 */

import { countableVendorWhere } from "@/lib/metrics-exclusion";
import { TRUST_OUTCOME_TYPES, isServiceIssueScoreAffecting } from "@/lib/trust-score-outcome-foundation";

export const TRUST_SCORE_VERSION = 1;

export const TRUST_SCORE_WEIGHTS = {
  workflowCompletion: 0.3,
  videoVerification: 0.25,
  disputeFree: 0.3,
  operationalReliability: 0.15,
} as const;

export interface OutcomeRow {
  bookingId?: string | null;
  outcomeType: string;
  finalizedAt?: Date | string | null;
}

export interface IssueRow {
  bookingId?: string | null;
  status: string;
}

export interface MetricResult {
  pct: number | null;
  numerator: number;
  denominator: number;
}

export interface TrustScoreBreakdown {
  workflowCompletion: MetricResult;
  videoVerification: MetricResult;
  disputeFree: MetricResult;
  operationalReliability: MetricResult;
  totalScorePct: number | null;
  measurable: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function rate(numerator: number, denominator: number): MetricResult {
  if (denominator <= 0) {
    return { pct: null, numerator, denominator: 0 };
  }
  return { pct: round2((numerator / denominator) * 100), numerator, denominator };
}

function toTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

interface PerBookingState {
  completed: boolean;
  canceled: boolean;
  lateCompletion: boolean;
  packageLatestType: string | null;
  packageLatestAt: number;
  hasScoreAffectingIssue: boolean;
}

/**
 * Reduces the raw finalized outcome + issue rows into per-booking terminal state.
 * Outcomes with no bookingId cannot be attributed to a workflow and are ignored
 * (documented limitation; such rows are kept for future aggregate metrics only).
 */
export function aggregateBookingStates(
  outcomes: OutcomeRow[],
  issues: IssueRow[]
): Map<string, PerBookingState> {
  const byBooking = new Map<string, PerBookingState>();

  const ensure = (bookingId: string): PerBookingState => {
    let state = byBooking.get(bookingId);
    if (!state) {
      state = {
        completed: false,
        canceled: false,
        lateCompletion: false,
        packageLatestType: null,
        packageLatestAt: -1,
        hasScoreAffectingIssue: false,
      };
      byBooking.set(bookingId, state);
    }
    return state;
  };

  for (const row of outcomes) {
    const bookingId = row.bookingId ? String(row.bookingId) : "";
    if (!bookingId) continue;
    const type = String(row.outcomeType || "").trim().toUpperCase();
    const state = ensure(bookingId);
    if (type === TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED) {
      state.completed = true;
    } else if (type === TRUST_OUTCOME_TYPES.LATE_COMPLETION) {
      // Late completion is an operational-reliability ding only; the workflow still
      // counts as completed (so it does not reduce Verified Workflow Completion).
      state.lateCompletion = true;
    } else if (type === TRUST_OUTCOME_TYPES.BOOKING_CANCELED) {
      state.canceled = true;
    } else if (
      type === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED ||
      type === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED
    ) {
      const at = toTime(row.finalizedAt);
      // Latest finalized package moderation outcome wins for the booking.
      if (at >= state.packageLatestAt) {
        state.packageLatestAt = at;
        state.packageLatestType = type;
      }
    }
  }

  for (const issue of issues) {
    const bookingId = issue.bookingId ? String(issue.bookingId) : "";
    if (!bookingId) continue;
    if (isServiceIssueScoreAffecting({ status: issue.status })) {
      ensure(bookingId).hasScoreAffectingIssue = true;
    }
  }

  return byBooking;
}

/**
 * Pure metric + weighted total computation. Easy to unit test without a DB.
 */
export function computeTrustScoreBreakdown(
  outcomes: OutcomeRow[],
  issues: IssueRow[]
): TrustScoreBreakdown {
  const states = Array.from(aggregateBookingStates(outcomes, issues).values());

  let completedCount = 0;
  let terminalCount = 0;
  let packageDenominator = 0;
  let packageApproved = 0;
  let disputeFreeNumerator = 0;
  let operationalCleanCount = 0;

  for (const s of states) {
    const terminal = s.completed || s.canceled;
    if (terminal) terminalCount += 1;
    if (s.completed) completedCount += 1;

    if (s.packageLatestType === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED) {
      packageDenominator += 1;
      packageApproved += 1;
    } else if (s.packageLatestType === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED) {
      packageDenominator += 1;
    }

    if (s.completed && !s.hasScoreAffectingIssue) disputeFreeNumerator += 1;

    if (terminal) {
      const operationalFailure =
        s.canceled ||
        s.lateCompletion ||
        s.packageLatestType === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED ||
        s.hasScoreAffectingIssue;
      if (!operationalFailure) operationalCleanCount += 1;
    }
  }

  const workflowCompletion = rate(completedCount, terminalCount);
  const videoVerification = rate(packageApproved, packageDenominator);
  const disputeFree = rate(disputeFreeNumerator, completedCount);
  const operationalReliability = rate(operationalCleanCount, terminalCount);

  const weighted: Array<{ weight: number; pct: number }> = [];
  if (workflowCompletion.pct !== null)
    weighted.push({ weight: TRUST_SCORE_WEIGHTS.workflowCompletion, pct: workflowCompletion.pct });
  if (videoVerification.pct !== null)
    weighted.push({ weight: TRUST_SCORE_WEIGHTS.videoVerification, pct: videoVerification.pct });
  if (disputeFree.pct !== null)
    weighted.push({ weight: TRUST_SCORE_WEIGHTS.disputeFree, pct: disputeFree.pct });
  if (operationalReliability.pct !== null)
    weighted.push({ weight: TRUST_SCORE_WEIGHTS.operationalReliability, pct: operationalReliability.pct });

  let totalScorePct: number | null = null;
  if (weighted.length > 0) {
    const weightSum = weighted.reduce((acc, w) => acc + w.weight, 0);
    const score = weighted.reduce((acc, w) => acc + w.weight * w.pct, 0) / weightSum;
    totalScorePct = Math.round(score);
  }

  return {
    workflowCompletion,
    videoVerification,
    disputeFree,
    operationalReliability,
    totalScorePct,
    measurable: weighted.length > 0,
  };
}

/**
 * Stable, dependency-free hash of the snapshot-defining inputs. Used to skip rewriting
 * an identical current snapshot (idempotent recalculation).
 */
export function computeInputHash(breakdown: TrustScoreBreakdown): string {
  const canonical = [
    TRUST_SCORE_VERSION,
    breakdown.totalScorePct,
    breakdown.workflowCompletion.numerator,
    breakdown.workflowCompletion.denominator,
    breakdown.videoVerification.numerator,
    breakdown.videoVerification.denominator,
    breakdown.disputeFree.numerator,
    breakdown.disputeFree.denominator,
    breakdown.operationalReliability.numerator,
    breakdown.operationalReliability.denominator,
  ].join("|");
  let hash = 5381;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) | 0;
  }
  return `v${TRUST_SCORE_VERSION}_${(hash >>> 0).toString(36)}`;
}

type SnapshotDelegate = {
  findFirst?: (args: any) => Promise<any>;
  updateMany?: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
};

type CalculatorDb = {
  vendor?: { findMany: (args: any) => Promise<any[]> };
  vendorOperationalOutcome?: { findMany: (args: any) => Promise<any[]> };
  bookingServiceIssue?: { findMany: (args: any) => Promise<any[]> };
  booking?: { findUnique?: (args: any) => Promise<any> };
  vendorTrustScoreSnapshot?: SnapshotDelegate;
  review?: unknown;
};

export interface RecalculationResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  unchanged?: boolean;
  vendorId?: string;
  breakdown?: TrustScoreBreakdown;
  snapshot?: any;
}

function buildDetailJson(breakdown: TrustScoreBreakdown, reason?: string, source?: string): string {
  return JSON.stringify({
    scoreVersion: TRUST_SCORE_VERSION,
    weights: TRUST_SCORE_WEIGHTS,
    components: {
      workflowCompletion: breakdown.workflowCompletion,
      videoVerification: breakdown.videoVerification,
      disputeFree: breakdown.disputeFree,
      operationalReliability: breakdown.operationalReliability,
    },
    totalScorePct: breakdown.totalScorePct,
    measurable: breakdown.measurable,
    reason: reason || null,
    source: source || null,
  });
}

/**
 * Reads finalized inputs for a vendor, computes the breakdown, and writes a current
 * snapshot (superseding the prior current row). Idempotent: if the recomputed inputHash
 * matches the existing current snapshot, no new row is written.
 */
export async function recalculateVendorTrustScore(
  db: CalculatorDb,
  vendorId: string,
  reason?: string,
  source?: string
): Promise<RecalculationResult> {
  if (!vendorId) {
    return { ok: false, skipped: true, reason: "vendorId is required" };
  }
  const outcomeDelegate = db.vendorOperationalOutcome;
  const issueDelegate = db.bookingServiceIssue;
  const snapshotDelegate = db.vendorTrustScoreSnapshot;
  if (!outcomeDelegate || !issueDelegate || !snapshotDelegate) {
    return { ok: false, skipped: true, reason: "trust score delegates unavailable" };
  }

  const [outcomes, issues] = await Promise.all([
    outcomeDelegate.findMany({
      where: { vendorId, status: "FINALIZED" },
      select: { bookingId: true, outcomeType: true, finalizedAt: true },
    }),
    issueDelegate.findMany({
      where: { vendorId },
      select: { bookingId: true, status: true },
    }),
  ]);

  const breakdown = computeTrustScoreBreakdown(outcomes as OutcomeRow[], issues as IssueRow[]);
  const inputHash = computeInputHash(breakdown);
  const computedAt = new Date();

  const existingCurrent = snapshotDelegate.findFirst
    ? await snapshotDelegate.findFirst({ where: { vendorId, isCurrent: true } })
    : null;
  if (existingCurrent?.inputHash && existingCurrent.inputHash === inputHash) {
    return { ok: true, unchanged: true, vendorId, breakdown, snapshot: existingCurrent };
  }

  if (snapshotDelegate.updateMany) {
    await snapshotDelegate.updateMany({
      where: { vendorId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  const snapshot = await snapshotDelegate.create({
    data: {
      vendorId,
      scoreVersion: TRUST_SCORE_VERSION,
      totalScorePct: breakdown.totalScorePct,
      workflowCompletionPct: breakdown.workflowCompletion.pct,
      videoVerificationPct: breakdown.videoVerification.pct,
      disputeFreePct: breakdown.disputeFree.pct,
      operationalReliabilityPct: breakdown.operationalReliability.pct,
      workflowCompletionNumerator: breakdown.workflowCompletion.numerator,
      workflowCompletionDenominator: breakdown.workflowCompletion.denominator,
      videoVerificationNumerator: breakdown.videoVerification.numerator,
      videoVerificationDenominator: breakdown.videoVerification.denominator,
      disputeFreeNumerator: breakdown.disputeFree.numerator,
      disputeFreeDenominator: breakdown.disputeFree.denominator,
      operationalReliabilityNumerator: breakdown.operationalReliability.numerator,
      operationalReliabilityDenominator: breakdown.operationalReliability.denominator,
      computedAt,
      inputHash,
      isCurrent: true,
      visibilityStatus: "internal",
      recalcReason: reason || null,
      recalcSource: source || null,
      detailJson: buildDetailJson(breakdown, reason, source),
    },
  });

  return { ok: true, vendorId, breakdown, snapshot };
}

/**
 * Resolves a booking's vendor and recalculates that vendor's score.
 */
export async function recalculateTrustScoreForBooking(
  db: CalculatorDb,
  bookingId: string,
  reason?: string,
  source?: string
): Promise<RecalculationResult> {
  if (!bookingId) {
    return { ok: false, skipped: true, reason: "bookingId is required" };
  }
  const booking = db.booking?.findUnique
    ? await db.booking.findUnique({ where: { id: bookingId }, select: { vendorId: true } })
    : null;
  const vendorId = booking?.vendorId ? String(booking.vendorId) : "";
  if (!vendorId) {
    return { ok: false, skipped: true, reason: "vendor not found for booking" };
  }
  return recalculateVendorTrustScore(db, vendorId, reason, source);
}

/**
 * Best-effort, NON-BLOCKING wrappers for use inside real booking/job/media/admin actions.
 * A scoring failure must never break the underlying flow.
 */
export async function tryRecalculateVendorTrustScore(
  db: CalculatorDb,
  vendorId: string,
  reason?: string,
  source?: string
): Promise<RecalculationResult> {
  try {
    return await recalculateVendorTrustScore(db, vendorId, reason, source);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[trust-score-calculator] vendor recalc skipped (non-fatal)", {
        vendorId,
        reason,
        source,
        error: (error as Error)?.message || String(error),
      });
    }
    return { ok: false, skipped: true, reason: (error as Error)?.message || String(error) };
  }
}

export async function tryRecalculateTrustScoreForBooking(
  db: CalculatorDb,
  bookingId: string,
  reason?: string,
  source?: string
): Promise<RecalculationResult> {
  try {
    return await recalculateTrustScoreForBooking(db, bookingId, reason, source);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[trust-score-calculator] booking recalc skipped (non-fatal)", {
        bookingId,
        reason,
        source,
        error: (error as Error)?.message || String(error),
      });
    }
    return { ok: false, skipped: true, reason: (error as Error)?.message || String(error) };
  }
}

export interface RebuildSummary {
  totalVendors: number;
  rebuilt: number;
  unchanged: number;
  skipped: number;
  failed: number;
  failures: Array<{ vendorId: string; reason: string }>;
}

export interface RebuildOptions {
  reason?: string;
  source?: string;
  /** Optional explicit vendor id list; when omitted every vendor is rebuilt. */
  vendorIds?: string[];
}

/**
 * Phase 1C backfill/rebuild path. Idempotently (re)builds the current snapshot for every
 * vendor (or an explicit subset) by reusing the Phase 1B calculator. Each vendor is
 * processed best-effort so one failure never aborts the whole batch. Reuses the same
 * finalized-truth inputs and NEVER touches `Review`.
 */
export async function rebuildAllVendorTrustScores(
  db: CalculatorDb,
  options: RebuildOptions = {}
): Promise<RebuildSummary> {
  const reason = options.reason || "backfill";
  const source = options.source || "admin_rebuild";

  let vendorIds = options.vendorIds;
  if (!vendorIds) {
    const vendors = db.vendor?.findMany
      ? await db.vendor.findMany({
          where: countableVendorWhere(),
          select: { id: true },
        })
      : [];
    vendorIds = vendors.map((v) => String(v?.id || "")).filter(Boolean);
  }

  const summary: RebuildSummary = {
    totalVendors: vendorIds.length,
    rebuilt: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const vendorId of vendorIds) {
    const result = await tryRecalculateVendorTrustScore(db, vendorId, reason, source);
    if (result.ok) {
      if (result.unchanged) summary.unchanged += 1;
      else summary.rebuilt += 1;
    } else if (result.skipped) {
      summary.skipped += 1;
    } else {
      summary.failed += 1;
      summary.failures.push({ vendorId, reason: result.reason || "unknown error" });
    }
  }

  return summary;
}
