import { describe, expect, it, vi } from "vitest";

import {
  reconcileCoreAuditDecisionForTrustScore,
  reconcileVendorTrustScore,
} from "@/lib/trust-score-reconciliation";

function dbWith(decisions: any[] = []) {
  const outcomes: any[] = [];
  const db = {
    serviceVideoAdminAuditDecisionEvidence: {
      findMany: vi.fn(async () => decisions),
    },
    vendorOperationalOutcome: {
      findFirst: vi.fn(async ({ where }: any) =>
        outcomes.find(
          (row) =>
            row.vendorId === where.vendorId &&
            row.bookingId === where.bookingId &&
            row.outcomeType === where.outcomeType &&
            row.sourceEntityType === where.sourceEntityType &&
            row.sourceEntityId === where.sourceEntityId,
        ) || null,
      ),
      findMany: vi.fn(async () => outcomes),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `outcome-${outcomes.length + 1}`, ...data };
        outcomes.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = outcomes.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    bookingServiceIssue: { findMany: vi.fn(async () => []) },
    vendorTrustScoreSnapshot: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async ({ data }: any) => ({ id: "snapshot-1", ...data })),
    },
  };
  return { db, outcomes };
}

const passDecision = {
  id: "audit-pass-1",
  bookingId: "booking-1",
  vendorId: "vendor-1",
  packageId: "package-1",
  packageVersion: 2,
  decision: "PASS",
  decidedAt: new Date("2026-10-24T15:00:00.000Z"),
  adminUserId: "admin-1",
  evidenceVersion: 1,
};

describe("trust score reconciliation", () => {
  it("derives workflow and package success only from an exact PASS decision", async () => {
    const { db, outcomes } = dbWith();
    await reconcileCoreAuditDecisionForTrustScore(db as any, passDecision);

    expect(outcomes.map((row) => row.outcomeType).sort()).toEqual([
      "VIDEO_PACKAGE_APPROVED",
      "WORKFLOW_COMPLETED",
    ]);
    expect(outcomes.every((row) => row.sourceEntityId === "audit-pass-1")).toBe(true);
    expect(outcomes.every((row) => row.finalizedAt.toISOString() === "2026-10-24T15:00:00.000Z")).toBe(true);
  });

  it("derives only a package rejection from an exact REJECT decision", async () => {
    const { db, outcomes } = dbWith();
    await reconcileCoreAuditDecisionForTrustScore(db as any, {
      ...passDecision,
      id: "audit-reject-1",
      decision: "REJECT",
    });

    expect(outcomes.map((row) => row.outcomeType)).toEqual(["VIDEO_PACKAGE_REJECTED"]);
  });

  it("is idempotent and rebuilds a current Version 2 snapshot", async () => {
    const { db, outcomes } = dbWith([passDecision]);

    const first = await reconcileVendorTrustScore(db as any, "vendor-1");
    const second = await reconcileVendorTrustScore(db as any, "vendor-1");

    expect(outcomes).toHaveLength(2);
    expect(first.breakdown).toMatchObject({
      totalScorePct: 100,
      measurable: true,
      operationalReliability: { pct: null, numerator: 0, denominator: 0 },
    });
    expect(second.reconciledDecisions).toBe(1);
  });
});
