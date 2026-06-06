/**
 * Trust Score Phase 1E — one-time historical finalized-outcome backfill.
 *
 * Seeds `VendorOperationalOutcome` rows from GENUINELY finalized historical signals
 * that already exist in persisted booking/media data, so the admin-only Trust Score
 * panel can show meaningful numbers where the old data honestly supports them.
 *
 * It NEVER reads from or writes to `Review`: Customer Rating and Reliance Trust Score
 * stay fully separate. It only derives operational outcomes from bookings + media.
 *
 * ACCEPTED historical signals (finalized + reliable):
 *   - WORKFLOW_COMPLETED            <- booking.status === "COMPLETED"
 *   - VIDEO_PACKAGE_APPROVED/REJECTED <- a booking whose required-stage job-video
 *     assets are ALL terminally moderated (approved/rejected, no pending/flagged).
 *
 * REJECTED historical signals (not reliably finalized in the historical data):
 *   - BOOKING_CANCELED   -> no CANCELED bookings exist; ARCHIVED is overloaded, not a cancel.
 *   - VALIDATED_DISPUTE  -> requires content_reports.status === "resolved_action_taken"; none exist.
 *   - LATE_COMPLETION    -> booking.date is overloaded (scheduled vs completion) historically,
 *                           so lateness cannot be derived reliably; only emitted going forward.
 *
 * Idempotent: reuses the Phase 1A source-keyed dedupe in `recordFinalizedOperationalOutcome`
 * (same sourceEntityType/sourceEntityId as the live runtime emitters), so reruns update in
 * place instead of duplicating, and a future runtime event for the same entity dedupes too.
 * Backfilled rows are tagged in metadata so they are auditable as historical, not live events.
 */

import {
  TRUST_OUTCOME_TYPES,
  recordFinalizedOperationalOutcome,
  type OperationalOutcomeInput,
} from "@/lib/trust-score-outcome-foundation";
import { MODERATION_APPROVED, MODERATION_REJECTED } from "@/lib/media-visibility";

export const HISTORICAL_BACKFILL_SOURCE = "historical_backfill_phase1e";

const JOB_VIDEO_SESSION_TYPE = "JOB_SERVICE_VIDEO";
const REQUIRED_STAGES = ["INTRO", "IN_PROGRESS", "COMPLETED"] as const;

function norm(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export interface HistoricalBooking {
  id: string;
  vendorId?: string | null;
  status: string;
  date?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface HistoricalPackageAsset {
  moderationStatus: string;
  moderatedAt?: Date | string | null;
}

export interface HistoricalPackage {
  bookingId: string;
  vendorId?: string | null;
  assets: HistoricalPackageAsset[];
}

/**
 * Pure: build the WORKFLOW_COMPLETED outcome for a genuinely completed booking, or null.
 * finalizedAt prefers `date` (completion date set on approval) and falls back to updatedAt.
 */
export function buildCompletionOutcome(booking: HistoricalBooking): OperationalOutcomeInput | null {
  if (norm(booking.status) !== "COMPLETED") return null;
  const vendorId = booking.vendorId ? String(booking.vendorId) : "";
  if (!vendorId || !booking.id) return null;
  const finalizedAt = asDate(booking.date) || asDate(booking.updatedAt);
  if (!finalizedAt) return null;
  return {
    vendorId,
    bookingId: booking.id,
    outcomeType: TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED,
    status: "FINALIZED",
    sourceEntityType: "booking",
    sourceEntityId: booking.id,
    finalizedAt,
    metadata: {
      backfill: true,
      backfillSource: HISTORICAL_BACKFILL_SOURCE,
      signal: "booking_status_completed",
    },
  };
}

/**
 * Pure: classify a historical media package as a finalized approve/reject outcome, or null.
 *
 * Only finalizes when EVERY asset is terminally moderated (approved/rejected). Any
 * pending/flagged/other asset means the package was never fully finalized -> skip (honest).
 * A rejected stage makes the whole package a REJECTED outcome.
 */
export function classifyHistoricalPackage(
  pkg: HistoricalPackage
): { outcomeType: string; finalizedAt: Date } | null {
  const assets = pkg.assets || [];
  if (assets.length === 0) return null;

  let anyRejected = false;
  let latest = -1;
  for (const asset of assets) {
    const status = norm(asset.moderationStatus);
    const isApproved = status === norm(MODERATION_APPROVED);
    const isRejected = status === norm(MODERATION_REJECTED);
    if (!isApproved && !isRejected) {
      // Non-terminal (pending_review / flagged / unknown) -> package not finalized.
      return null;
    }
    if (isRejected) anyRejected = true;
    const at = asDate(asset.moderatedAt);
    if (at) latest = Math.max(latest, at.getTime());
  }

  if (latest < 0) return null; // terminal status but no moderation timestamp -> cannot date it.

  return {
    outcomeType: anyRejected
      ? TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED
      : TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED,
    finalizedAt: new Date(latest),
  };
}

export function buildPackageOutcome(pkg: HistoricalPackage): OperationalOutcomeInput | null {
  const vendorId = pkg.vendorId ? String(pkg.vendorId) : "";
  if (!vendorId || !pkg.bookingId) return null;
  const classified = classifyHistoricalPackage(pkg);
  if (!classified) return null;
  return {
    vendorId,
    bookingId: pkg.bookingId,
    outcomeType: classified.outcomeType,
    status: "FINALIZED",
    sourceEntityType: "media_package",
    sourceEntityId: pkg.bookingId,
    finalizedAt: classified.finalizedAt,
    metadata: {
      backfill: true,
      backfillSource: HISTORICAL_BACKFILL_SOURCE,
      signal: "historical_media_moderation",
      assetCount: (pkg.assets || []).length,
    },
  };
}

type BackfillDb = {
  booking?: { findMany: (args: any) => Promise<any[]> };
  mediaSession?: { findMany: (args: any) => Promise<any[]> };
  vendorOperationalOutcome?: {
    findFirst?: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update?: (args: any) => Promise<any>;
  };
  review?: unknown;
};

export interface HistoricalBackfillSummary {
  completedBookings: number;
  completionOutcomesWritten: number;
  packagesEvaluated: number;
  packageApproved: number;
  packageRejected: number;
  packageSkippedNotFinalized: number;
  outcomesWritten: number;
  errors: number;
  rejectedSignals: string[];
}

/**
 * One-time historical backfill orchestrator. Loads persisted bookings + job-video packages,
 * derives ONLY the accepted finalized outcomes, and writes them idempotently. Best-effort
 * per row: a single write failure is counted but never aborts the batch or any host flow.
 */
export async function backfillHistoricalOutcomes(
  db: BackfillDb,
  options: { dryRun?: boolean } = {}
): Promise<HistoricalBackfillSummary> {
  const dryRun = Boolean(options.dryRun);
  const summary: HistoricalBackfillSummary = {
    completedBookings: 0,
    completionOutcomesWritten: 0,
    packagesEvaluated: 0,
    packageApproved: 0,
    packageRejected: 0,
    packageSkippedNotFinalized: 0,
    outcomesWritten: 0,
    errors: 0,
    rejectedSignals: [
      "BOOKING_CANCELED: no CANCELED bookings in history (ARCHIVED is not a cancel)",
      "VALIDATED_DISPUTE: no content_reports resolved_action_taken in history",
      "LATE_COMPLETION: booking.date overloaded historically, lateness not reliably derivable",
    ],
  };

  const bookings: HistoricalBooking[] = db.booking?.findMany
    ? ((await db.booking.findMany({
        select: { id: true, vendorId: true, status: true, date: true, updatedAt: true },
      })) as HistoricalBooking[])
    : [];

  const vendorByBooking = new Map<string, string>();
  for (const b of bookings) {
    if (b?.id && b.vendorId) vendorByBooking.set(String(b.id), String(b.vendorId));
  }

  const write = async (outcome: OperationalOutcomeInput | null): Promise<boolean> => {
    if (!outcome) return false;
    if (dryRun) return true;
    try {
      const res: any = await recordFinalizedOperationalOutcome(db as any, outcome);
      if (res?.skipped) return false;
      return true;
    } catch {
      summary.errors += 1;
      return false;
    }
  };

  // 1) WORKFLOW_COMPLETED from genuinely completed bookings.
  for (const booking of bookings) {
    const outcome = buildCompletionOutcome(booking);
    if (!outcome) continue;
    summary.completedBookings += 1;
    if (await write(outcome)) {
      summary.completionOutcomesWritten += 1;
      summary.outcomesWritten += 1;
    }
  }

  // 2) VIDEO_PACKAGE_* from terminally-moderated historical job-video packages.
  const sessions: any[] = db.mediaSession?.findMany
    ? await db.mediaSession.findMany({
        where: {
          sessionType: JOB_VIDEO_SESSION_TYPE,
          bookingId: { not: null },
          vendorJobVideoStage: { in: [...REQUIRED_STAGES] },
        },
        select: {
          bookingId: true,
          vendorId: true,
          mediaAssets: {
            where: { deletedAt: null },
            select: { moderationStatus: true, moderatedAt: true },
          },
        },
      })
    : [];

  const packageByBooking = new Map<string, HistoricalPackage>();
  for (const session of sessions) {
    const bookingId = session?.bookingId ? String(session.bookingId) : "";
    if (!bookingId) continue;
    const vendorId = vendorByBooking.get(bookingId) || (session?.vendorId ? String(session.vendorId) : "");
    let pkg = packageByBooking.get(bookingId);
    if (!pkg) {
      pkg = { bookingId, vendorId, assets: [] };
      packageByBooking.set(bookingId, pkg);
    }
    for (const asset of session?.mediaAssets || []) {
      pkg.assets.push({
        moderationStatus: String(asset?.moderationStatus || ""),
        moderatedAt: asset?.moderatedAt ?? null,
      });
    }
  }

  for (const pkg of Array.from(packageByBooking.values())) {
    summary.packagesEvaluated += 1;
    const outcome = buildPackageOutcome(pkg);
    if (!outcome) {
      summary.packageSkippedNotFinalized += 1;
      continue;
    }
    if (outcome.outcomeType === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED) summary.packageApproved += 1;
    else summary.packageRejected += 1;
    if (await write(outcome)) summary.outcomesWritten += 1;
  }

  return summary;
}
