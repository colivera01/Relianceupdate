import { describe, it, expect } from "vitest";
import {
  buildCompletionOutcome,
  classifyHistoricalPackage,
  buildPackageOutcome,
  backfillHistoricalOutcomes,
  HISTORICAL_BACKFILL_SOURCE,
} from "@/lib/trust-score-historical-backfill";
import { TRUST_OUTCOME_TYPES } from "@/lib/trust-score-outcome-foundation";
import { rebuildAllVendorTrustScores } from "@/lib/trust-score-calculator";

/**
 * In-memory Prisma-like fake. Implements ONLY the delegates the backfill + rebuild touch.
 * `review` is a trap that throws if accessed, proving Customer Rating is never read/written.
 */
function makeFakeDb(opts: { bookings: any[]; sessions: any[]; vendors?: any[] }) {
  const outcomes: any[] = [];
  const snapshots: any[] = [];
  let seq = 0;

  const matchSource = (w: any, row: any) =>
    (w.vendorId === undefined || row.vendorId === w.vendorId) &&
    (w.bookingId === undefined || row.bookingId === w.bookingId) &&
    (w.outcomeType === undefined || row.outcomeType === w.outcomeType) &&
    (w.sourceEntityType === undefined || row.sourceEntityType === w.sourceEntityType) &&
    (w.sourceEntityId === undefined || row.sourceEntityId === w.sourceEntityId);

  const db: any = {
    booking: { findMany: async () => opts.bookings.map((b) => ({ ...b })) },
    mediaSession: { findMany: async () => opts.sessions.map((s) => ({ ...s })) },
    vendor: { findMany: async () => (opts.vendors || []).map((v) => ({ ...v })) },
    vendorOperationalOutcome: {
      findFirst: async ({ where }: any) => outcomes.find((o) => matchSource(where, o)) || null,
      create: async ({ data }: any) => {
        const row = { id: `o${++seq}`, ...data };
        outcomes.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = outcomes.find((o) => o.id === where.id);
        Object.assign(row, data);
        return row;
      },
      findMany: async ({ where }: any) =>
        outcomes.filter(
          (o) => o.vendorId === where.vendorId && (where.status ? o.status === where.status : true)
        ),
    },
    bookingServiceIssue: { findMany: async () => [] },
    vendorTrustScoreSnapshot: {
      findFirst: async ({ where }: any) =>
        snapshots.find((s) => s.vendorId === where.vendorId && s.isCurrent === where.isCurrent) || null,
      updateMany: async ({ where, data }: any) => {
        for (const s of snapshots) if (s.vendorId === where.vendorId && s.isCurrent === where.isCurrent) Object.assign(s, data);
        return { count: 0 };
      },
      create: async ({ data }: any) => {
        const row = { id: `s${++seq}`, ...data };
        snapshots.push(row);
        return row;
      },
    },
    get review() {
      throw new Error("Review must never be touched by Trust Score backfill");
    },
  };
  return { db, outcomes, snapshots };
}

describe("buildCompletionOutcome", () => {
  it("emits WORKFLOW_COMPLETED for a completed booking with a date", () => {
    const out = buildCompletionOutcome({ id: "b1", vendorId: "v1", status: "COMPLETED", date: new Date("2026-01-02") });
    expect(out?.outcomeType).toBe(TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED);
    expect(out?.sourceEntityType).toBe("booking");
    expect(out?.sourceEntityId).toBe("b1");
    expect((out?.metadata as any)?.backfillSource).toBe(HISTORICAL_BACKFILL_SOURCE);
  });

  it("falls back to updatedAt when date is missing", () => {
    const out = buildCompletionOutcome({ id: "b1", vendorId: "v1", status: "completed", updatedAt: new Date("2026-01-03") });
    expect(out?.finalizedAt.toISOString()).toBe(new Date("2026-01-03").toISOString());
  });

  it("returns null for non-completed, missing vendor, or undated bookings", () => {
    expect(buildCompletionOutcome({ id: "b1", vendorId: "v1", status: "PENDING", date: new Date() })).toBeNull();
    expect(buildCompletionOutcome({ id: "b1", vendorId: "v1", status: "ARCHIVED", date: new Date() })).toBeNull();
    expect(buildCompletionOutcome({ id: "b1", vendorId: null, status: "COMPLETED", date: new Date() })).toBeNull();
    expect(buildCompletionOutcome({ id: "b1", vendorId: "v1", status: "COMPLETED" })).toBeNull();
  });
});

describe("classifyHistoricalPackage", () => {
  it("classifies an all-approved package as APPROVED with the latest moderatedAt", () => {
    const res = classifyHistoricalPackage({
      bookingId: "b1",
      vendorId: "v1",
      assets: [
        { moderationStatus: "approved", moderatedAt: new Date("2026-01-01") },
        { moderationStatus: "approved", moderatedAt: new Date("2026-01-05") },
      ],
    });
    expect(res?.outcomeType).toBe(TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED);
    expect(res?.finalizedAt.toISOString()).toBe(new Date("2026-01-05").toISOString());
  });

  it("classifies any rejected stage as a REJECTED package", () => {
    const res = classifyHistoricalPackage({
      bookingId: "b1",
      vendorId: "v1",
      assets: [
        { moderationStatus: "approved", moderatedAt: new Date("2026-01-01") },
        { moderationStatus: "rejected", moderatedAt: new Date("2026-01-02") },
      ],
    });
    expect(res?.outcomeType).toBe(TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED);
  });

  it("returns null when any asset is non-terminal (pending/flagged) or empty or undated", () => {
    expect(
      classifyHistoricalPackage({
        bookingId: "b1",
        vendorId: "v1",
        assets: [
          { moderationStatus: "approved", moderatedAt: new Date("2026-01-01") },
          { moderationStatus: "pending_review", moderatedAt: null },
        ],
      })
    ).toBeNull();
    expect(classifyHistoricalPackage({ bookingId: "b1", vendorId: "v1", assets: [] })).toBeNull();
    expect(
      classifyHistoricalPackage({ bookingId: "b1", vendorId: "v1", assets: [{ moderationStatus: "approved", moderatedAt: null }] })
    ).toBeNull();
  });
});

describe("backfillHistoricalOutcomes", () => {
  const bookings = [
    { id: "b1", vendorId: "v1", status: "COMPLETED", date: new Date("2026-01-02"), updatedAt: new Date("2026-01-02") },
    { id: "b2", vendorId: "v1", status: "COMPLETED", date: new Date("2026-01-03"), updatedAt: new Date("2026-01-03") },
    { id: "b3", vendorId: "v2", status: "PENDING", date: null, updatedAt: new Date("2026-01-04") },
    { id: "b4", vendorId: "v2", status: "CANCELED", date: null, updatedAt: new Date("2026-01-05") },
  ];
  const sessions = [
    { bookingId: "b1", vendorId: "v1", mediaAssets: [{ moderationStatus: "approved", moderatedAt: new Date("2026-01-02") }] },
    { bookingId: "b2", vendorId: "v1", mediaAssets: [{ moderationStatus: "rejected", moderatedAt: new Date("2026-01-03") }] },
    { bookingId: "b3", vendorId: "v2", mediaAssets: [{ moderationStatus: "pending_review", moderatedAt: null }] },
  ];

  it("writes only accepted finalized outcomes and documents rejected signals", async () => {
    const { db, outcomes } = makeFakeDb({ bookings, sessions });
    const summary = await backfillHistoricalOutcomes(db);

    expect(summary.completedBookings).toBe(2);
    expect(summary.completionOutcomesWritten).toBe(2);
    expect(summary.packageApproved).toBe(1);
    expect(summary.packageRejected).toBe(1);
    expect(summary.packageSkippedNotFinalized).toBe(1); // b3 pending
    expect(summary.outcomesWritten).toBe(4);
    expect(summary.errors).toBe(0);
    expect(summary.rejectedSignals.some((s) => s.startsWith("BOOKING_CANCELED"))).toBe(true);

    // Never created a BOOKING_CANCELED outcome even though b4 is CANCELED (not an accepted signal here).
    expect(outcomes.some((o) => o.outcomeType === TRUST_OUTCOME_TYPES.BOOKING_CANCELED)).toBe(false);
    expect(outcomes.filter((o) => o.outcomeType === TRUST_OUTCOME_TYPES.WORKFLOW_COMPLETED)).toHaveLength(2);
    expect(outcomes.filter((o) => o.outcomeType === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_APPROVED)).toHaveLength(1);
    expect(outcomes.filter((o) => o.outcomeType === TRUST_OUTCOME_TYPES.VIDEO_PACKAGE_REJECTED)).toHaveLength(1);
  });

  it("is idempotent: a rerun creates no duplicate rows", async () => {
    const { db, outcomes } = makeFakeDb({ bookings, sessions });
    await backfillHistoricalOutcomes(db);
    const afterFirst = outcomes.length;
    const second = await backfillHistoricalOutcomes(db);
    expect(outcomes.length).toBe(afterFirst); // dedupe -> update in place, no new rows
    expect(second.outcomesWritten).toBe(4); // still processes the same accepted signals
  });

  it("dryRun writes nothing", async () => {
    const { db, outcomes } = makeFakeDb({ bookings, sessions });
    const summary = await backfillHistoricalOutcomes(db, { dryRun: true });
    expect(outcomes).toHaveLength(0);
    expect(summary.completedBookings).toBe(2);
  });

  it("rebuild after backfill yields measurable scores and NEVER touches Review", async () => {
    const { db, snapshots } = makeFakeDb({
      bookings,
      sessions,
      vendors: [{ id: "v1" }, { id: "v2" }],
    });
    await backfillHistoricalOutcomes(db);
    const rebuild = await rebuildAllVendorTrustScores(db, { reason: "test", source: "test" });

    expect(rebuild.failed).toBe(0);
    const v1 = snapshots.find((s) => s.vendorId === "v1" && s.isCurrent);
    // v1: 2 completed (workflow 100), 1 approved + 1 rejected package (video 50).
    expect(v1?.totalScorePct).not.toBeNull();
    expect(v1?.workflowCompletionPct).toBe(100);
    expect(v1?.videoVerificationPct).toBe(50);
    // v2 has no accepted finalized outcomes -> honestly not yet scored.
    const v2 = snapshots.find((s) => s.vendorId === "v2" && s.isCurrent);
    expect(v2?.totalScorePct).toBeNull();
  });
});
