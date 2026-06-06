import { describe, expect, it, vi } from "vitest";
import { TRUST_OUTCOME_TYPES } from "./trust-score-outcome-foundation";
import {
  computeInputHash,
  computeTrustScoreBreakdown,
  recalculateTrustScoreForBooking,
  recalculateVendorTrustScore,
  tryRecalculateVendorTrustScore,
  TRUST_SCORE_WEIGHTS,
  type IssueRow,
  type OutcomeRow,
} from "./trust-score-calculator";

const { WORKFLOW_COMPLETED, BOOKING_CANCELED, VIDEO_PACKAGE_APPROVED, VIDEO_PACKAGE_REJECTED } =
  TRUST_OUTCOME_TYPES;

function makeDb(opts: {
  outcomes?: OutcomeRow[];
  issues?: IssueRow[];
  existingCurrent?: any;
  bookingVendorId?: string | null;
  snapshotOverrides?: Record<string, any>;
}) {
  const reviewSpies = {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  };
  const db = {
    vendorOperationalOutcome: {
      findMany: vi.fn(async () => opts.outcomes || []),
    },
    bookingServiceIssue: {
      findMany: vi.fn(async () => opts.issues || []),
    },
    booking: {
      findUnique: vi.fn(async () =>
        opts.bookingVendorId === null ? null : { vendorId: opts.bookingVendorId || "v1" }
      ),
    },
    vendorTrustScoreSnapshot: {
      findFirst: vi.fn(async () => opts.existingCurrent ?? null),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async (args: any) => ({ id: "snap-1", ...args.data })),
      ...(opts.snapshotOverrides || {}),
    },
    review: reviewSpies,
  };
  return { db, reviewSpies };
}

function expectReviewUntouched(reviewSpies: Record<string, ReturnType<typeof vi.fn>>) {
  for (const spy of Object.values(reviewSpies)) {
    expect(spy).not.toHaveBeenCalled();
  }
}

/** Mixed dataset exercising all four metrics. */
const MIXED_OUTCOMES: OutcomeRow[] = [
  { bookingId: "b1", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
  { bookingId: "b1", outcomeType: VIDEO_PACKAGE_APPROVED, finalizedAt: new Date("2026-05-02") },
  { bookingId: "b2", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
  { bookingId: "b2", outcomeType: VIDEO_PACKAGE_REJECTED, finalizedAt: new Date("2026-05-02") },
  { bookingId: "b3", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
  { bookingId: "b4", outcomeType: BOOKING_CANCELED, finalizedAt: new Date("2026-05-01") },
];
const MIXED_ISSUES: IssueRow[] = [{ bookingId: "b3", status: "VALIDATED" }];

describe("computeTrustScoreBreakdown — four weighted metrics", () => {
  it("computes each metric and the weighted total from finalized data", () => {
    const b = computeTrustScoreBreakdown(MIXED_OUTCOMES, MIXED_ISSUES);
    // Workflow completion: 3 completed / 4 terminal
    expect(b.workflowCompletion).toMatchObject({ numerator: 3, denominator: 4, pct: 75 });
    // Video verification: 1 approved / 2 finalized packages
    expect(b.videoVerification).toMatchObject({ numerator: 1, denominator: 2, pct: 50 });
    // Dispute-free: 2 clean / 3 completed (b3 has a validated dispute)
    expect(b.disputeFree).toMatchObject({ numerator: 2, denominator: 3, pct: 66.67 });
    // Operational reliability: 1 clean / 4 terminal (b2 rejected, b3 disputed, b4 canceled fail)
    expect(b.operationalReliability).toMatchObject({ numerator: 1, denominator: 4, pct: 25 });
    // Weighted: .3*75 + .25*50 + .3*66.67 + .15*25 = 58.751 -> 59
    expect(b.totalScorePct).toBe(59);
    expect(b.measurable).toBe(true);
  });

  it("uses the latest finalized package-moderation outcome per booking", () => {
    const outcomes: OutcomeRow[] = [
      { bookingId: "b1", outcomeType: VIDEO_PACKAGE_REJECTED, finalizedAt: new Date("2026-05-01") },
      { bookingId: "b1", outcomeType: VIDEO_PACKAGE_APPROVED, finalizedAt: new Date("2026-05-05") },
    ];
    const b = computeTrustScoreBreakdown(outcomes, []);
    expect(b.videoVerification).toMatchObject({ numerator: 1, denominator: 1, pct: 100 });
    expect(b.totalScorePct).toBe(100);
  });

  it("does NOT let pending / non-finalized issues reduce the score", () => {
    const outcomes: OutcomeRow[] = [
      { bookingId: "b1", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
    ];
    const issues: IssueRow[] = [
      { bookingId: "b1", status: "PENDING" },
      { bookingId: "b1", status: "REJECTED" },
    ];
    const b = computeTrustScoreBreakdown(outcomes, issues);
    expect(b.disputeFree).toMatchObject({ numerator: 1, denominator: 1, pct: 100 });
    expect(b.operationalReliability.pct).toBe(100);
    expect(b.totalScorePct).toBe(100);
  });

  it("renormalizes weights when only some metrics are measurable", () => {
    const outcomes: OutcomeRow[] = [
      { bookingId: "b1", outcomeType: VIDEO_PACKAGE_APPROVED, finalizedAt: new Date("2026-05-01") },
      { bookingId: "b2", outcomeType: VIDEO_PACKAGE_REJECTED, finalizedAt: new Date("2026-05-01") },
    ];
    const b = computeTrustScoreBreakdown(outcomes, []);
    expect(b.workflowCompletion.pct).toBeNull();
    expect(b.disputeFree.pct).toBeNull();
    expect(b.operationalReliability.pct).toBeNull();
    expect(b.videoVerification.pct).toBe(50);
    // Only one measurable metric -> total equals that metric.
    expect(b.totalScorePct).toBe(50);
    expect(b.measurable).toBe(true);
  });

  it("returns null total when there is no finalized denominator at all", () => {
    const b = computeTrustScoreBreakdown([], []);
    expect(b.workflowCompletion.pct).toBeNull();
    expect(b.videoVerification.pct).toBeNull();
    expect(b.disputeFree.pct).toBeNull();
    expect(b.operationalReliability.pct).toBeNull();
    expect(b.totalScorePct).toBeNull();
    expect(b.measurable).toBe(false);
  });

  it("ignores outcomes that cannot be attributed to a booking", () => {
    const outcomes: OutcomeRow[] = [
      { bookingId: null, outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
      { bookingId: "b1", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
    ];
    const b = computeTrustScoreBreakdown(outcomes, []);
    expect(b.workflowCompletion).toMatchObject({ numerator: 1, denominator: 1 });
  });

  it("weights sum to 1.0", () => {
    const total =
      TRUST_SCORE_WEIGHTS.workflowCompletion +
      TRUST_SCORE_WEIGHTS.videoVerification +
      TRUST_SCORE_WEIGHTS.disputeFree +
      TRUST_SCORE_WEIGHTS.operationalReliability;
    expect(total).toBeCloseTo(1.0, 10);
  });
});

describe("computeInputHash", () => {
  it("is stable for identical inputs and changes when counts change", () => {
    const a = computeInputHash(computeTrustScoreBreakdown(MIXED_OUTCOMES, MIXED_ISSUES));
    const b = computeInputHash(computeTrustScoreBreakdown(MIXED_OUTCOMES, MIXED_ISSUES));
    const c = computeInputHash(computeTrustScoreBreakdown([], []));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("recalculateVendorTrustScore — snapshot supersede semantics", () => {
  it("supersedes the prior current snapshot and writes a new current row", async () => {
    const { db, reviewSpies } = makeDb({ outcomes: MIXED_OUTCOMES, issues: MIXED_ISSUES });
    const result = await recalculateVendorTrustScore(db as any, "v1", "job_approved", "job_approve");

    expect(result.ok).toBe(true);
    expect(db.vendorTrustScoreSnapshot.updateMany).toHaveBeenCalledWith({
      where: { vendorId: "v1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(db.vendorTrustScoreSnapshot.create).toHaveBeenCalledTimes(1);
    const data = db.vendorTrustScoreSnapshot.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      vendorId: "v1",
      totalScorePct: 59,
      workflowCompletionPct: 75,
      videoVerificationPct: 50,
      disputeFreePct: 66.67,
      operationalReliabilityPct: 25,
      isCurrent: true,
      visibilityStatus: "internal",
      recalcReason: "job_approved",
      recalcSource: "job_approve",
    });
    expect(data.workflowCompletionDenominator).toBe(4);
    expect(typeof data.inputHash).toBe("string");
    expectReviewUntouched(reviewSpies);
  });

  it("is idempotent: skips writing when the inputHash matches the existing current snapshot", async () => {
    const matchingHash = computeInputHash(computeTrustScoreBreakdown(MIXED_OUTCOMES, MIXED_ISSUES));
    const { db } = makeDb({
      outcomes: MIXED_OUTCOMES,
      issues: MIXED_ISSUES,
      existingCurrent: { id: "snap-prev", inputHash: matchingHash, isCurrent: true },
    });
    const result = await recalculateVendorTrustScore(db as any, "v1", "noop", "test");
    expect(result.unchanged).toBe(true);
    expect(db.vendorTrustScoreSnapshot.updateMany).not.toHaveBeenCalled();
    expect(db.vendorTrustScoreSnapshot.create).not.toHaveBeenCalled();
  });

  it("skips when vendorId is missing", async () => {
    const { db } = makeDb({});
    const result = await recalculateVendorTrustScore(db as any, "", "x", "y");
    expect(result).toMatchObject({ ok: false, skipped: true });
    expect(db.vendorTrustScoreSnapshot.create).not.toHaveBeenCalled();
  });

  it("skips gracefully when snapshot delegate is unavailable", async () => {
    const result = await recalculateVendorTrustScore(
      { vendorOperationalOutcome: { findMany: async () => [] }, bookingServiceIssue: { findMany: async () => [] } } as any,
      "v1"
    );
    expect(result).toMatchObject({ ok: false, skipped: true });
  });
});

describe("recalculateTrustScoreForBooking", () => {
  it("resolves the booking vendor then recalculates", async () => {
    const { db } = makeDb({ outcomes: MIXED_OUTCOMES, issues: MIXED_ISSUES, bookingVendorId: "v9" });
    const result = await recalculateTrustScoreForBooking(db as any, "b1", "booking_canceled", "booking_cancel");
    expect(result.ok).toBe(true);
    expect(db.booking.findUnique).toHaveBeenCalled();
    expect(db.vendorTrustScoreSnapshot.create.mock.calls[0][0].data.vendorId).toBe("v9");
  });

  it("skips when the booking has no vendor", async () => {
    const { db } = makeDb({ bookingVendorId: null });
    const result = await recalculateTrustScoreForBooking(db as any, "missing");
    expect(result).toMatchObject({ ok: false, skipped: true });
  });
});

describe("best-effort wrappers are non-blocking", () => {
  it("tryRecalculateVendorTrustScore swallows errors and returns skipped", async () => {
    const { db, reviewSpies } = makeDb({
      outcomes: MIXED_OUTCOMES,
      issues: MIXED_ISSUES,
      snapshotOverrides: {
        create: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    });
    const result = await tryRecalculateVendorTrustScore(db as any, "v1", "x", "y");
    expect(result).toMatchObject({ ok: false, skipped: true });
    expectReviewUntouched(reviewSpies);
  });
});
