import { describe, expect, it, vi } from "vitest";
import { TRUST_OUTCOME_TYPES } from "./trust-score-outcome-foundation";
import {
  computeTrustScoreBreakdown,
  rebuildAllVendorTrustScores,
  type IssueRow,
  type OutcomeRow,
} from "./trust-score-calculator";

const { WORKFLOW_COMPLETED, LATE_COMPLETION, VIDEO_PACKAGE_APPROVED } = TRUST_OUTCOME_TYPES;

function makeBatchDb(opts: {
  vendors?: Array<{ id: string }>;
  outcomesByVendor?: Record<string, OutcomeRow[]>;
  issuesByVendor?: Record<string, IssueRow[]>;
  existingByVendor?: Record<string, any>;
}) {
  const reviewSpies = {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  };
  const created: any[] = [];
  const db = {
    vendor: { findMany: vi.fn(async () => opts.vendors || []) },
    vendorOperationalOutcome: {
      findMany: vi.fn(async (args: any) => opts.outcomesByVendor?.[args.where.vendorId] || []),
    },
    bookingServiceIssue: {
      findMany: vi.fn(async (args: any) => opts.issuesByVendor?.[args.where.vendorId] || []),
    },
    vendorTrustScoreSnapshot: {
      findFirst: vi.fn(async (args: any) => opts.existingByVendor?.[args.where.vendorId] ?? null),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async (args: any) => {
        const row = { id: `snap-${created.length + 1}`, ...args.data };
        created.push(row);
        return row;
      }),
    },
    review: reviewSpies,
  };
  return { db, reviewSpies, created };
}

describe("LATE_COMPLETION outcome (Phase 1C)", () => {
  it("counts a late job as completed for workflow but as an operational-reliability failure", () => {
    const outcomes: OutcomeRow[] = [
      { bookingId: "b1", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-01") },
      { bookingId: "b1", outcomeType: LATE_COMPLETION, finalizedAt: new Date("2026-05-01") },
      { bookingId: "b2", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date("2026-05-02") },
    ];
    const breakdown = computeTrustScoreBreakdown(outcomes, []);

    // Both bookings completed -> workflow completion 100%.
    expect(breakdown.workflowCompletion).toMatchObject({ numerator: 2, denominator: 2, pct: 100 });
    // b1 is late -> only b2 is operationally clean -> 50%.
    expect(breakdown.operationalReliability).toMatchObject({ numerator: 1, denominator: 2, pct: 50 });
    // Late completion is not a dispute -> dispute-free stays 100%.
    expect(breakdown.disputeFree).toMatchObject({ numerator: 2, denominator: 2, pct: 100 });
  });
});

describe("rebuildAllVendorTrustScores (Phase 1C backfill)", () => {
  it("rebuilds snapshots for all vendors and never touches Review", async () => {
    const { db, reviewSpies, created } = makeBatchDb({
      vendors: [{ id: "v1" }, { id: "v2" }],
      outcomesByVendor: {
        v1: [{ bookingId: "b1", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date() }],
        v2: [
          { bookingId: "b2", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date() },
          { bookingId: "b2", outcomeType: VIDEO_PACKAGE_APPROVED, finalizedAt: new Date() },
        ],
      },
    });

    const summary = await rebuildAllVendorTrustScores(db as any);

    expect(summary.totalVendors).toBe(2);
    expect(summary.rebuilt).toBe(2);
    expect(summary.unchanged).toBe(0);
    expect(summary.failed).toBe(0);
    expect(created).toHaveLength(2);
    for (const spy of Object.values(reviewSpies)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("is idempotent: an unchanged input hash counts as 'unchanged' and writes no new row", async () => {
    // First compute the hash the calculator would produce for an empty vendor, then feed it back.
    const probe = makeBatchDb({ vendors: [{ id: "v1" }] });
    await rebuildAllVendorTrustScores(probe.db as any);
    const writtenHash = probe.created[0]?.inputHash;
    expect(writtenHash).toBeTruthy();

    const { db, created } = makeBatchDb({
      vendors: [{ id: "v1" }],
      existingByVendor: { v1: { inputHash: writtenHash, isCurrent: true } },
    });
    const summary = await rebuildAllVendorTrustScores(db as any);
    expect(summary.unchanged).toBe(1);
    expect(summary.rebuilt).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("processes an explicit vendorIds subset without listing all vendors", async () => {
    const { db } = makeBatchDb({
      vendors: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
      outcomesByVendor: { v2: [{ bookingId: "b", outcomeType: WORKFLOW_COMPLETED, finalizedAt: new Date() }] },
    });
    const summary = await rebuildAllVendorTrustScores(db as any, { vendorIds: ["v2"] });
    expect(summary.totalVendors).toBe(1);
    expect(db.vendor.findMany).not.toHaveBeenCalled();
  });

  it("is best-effort: one vendor failure does not abort the batch", async () => {
    const { db } = makeBatchDb({ vendors: [{ id: "v1" }, { id: "v2" }] });
    let calls = 0;
    db.vendorOperationalOutcome.findMany = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("db blip");
      return [];
    });

    const summary = await rebuildAllVendorTrustScores(db as any);
    expect(summary.totalVendors).toBe(2);
    // The failing vendor is recorded as skipped (tryRecalculate swallows the throw); the
    // other still processes.
    expect(summary.skipped + summary.failed).toBe(1);
    expect(summary.rebuilt).toBe(1);
  });
});
