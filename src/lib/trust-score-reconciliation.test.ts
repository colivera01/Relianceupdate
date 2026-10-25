import { describe, expect, it, vi } from "vitest";

import {
  reconcileBookingCancellationForTrustScore,
  reconcileCoreAuditDecisionForTrustScore,
  reconcileVendorTrustScore,
  resolveBookingCancellationAttribution,
} from "@/lib/trust-score-reconciliation";

function dbWith(decisions: any[] = [], cancellations: any[] = []) {
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
    booking: { findMany: vi.fn(async () => cancellations) },
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

  it("classifies only explicit vendor responsibility as score-affecting", () => {
    const base = { id: "booking-1", vendorId: "vendor-1", status: "CANCELED", updatedAt: new Date() };
    expect(resolveBookingCancellationAttribution({
      ...base,
      customerMetadata: JSON.stringify({ vendor_job_cancellation: { attribution: "VENDOR" } }),
    })).toBe("VENDOR");
    expect(resolveBookingCancellationAttribution({
      ...base,
      customerMetadata: JSON.stringify({ vendor_job_cancellation: { source: "CUSTOMER_CANCELLATION" } }),
    })).toBe("CUSTOMER");
    expect(resolveBookingCancellationAttribution({
      ...base,
      customerMetadata: JSON.stringify({
        vendor_job_cancellation: { canceled_by_membership_id: "manager-1", reason: "Legacy record" },
      }),
    })).toBe("UNKNOWN");
  });

  it("projects explicit cancellation attribution idempotently", async () => {
    const { db, outcomes } = dbWith();
    const row = {
      id: "booking-cancel-1",
      vendorId: "vendor-1",
      status: "CANCELED",
      customerMetadata: JSON.stringify({
        vendor_job_cancellation: {
          attribution: "VENDOR",
          source: "VENDOR_ATTRIBUTED_CANCELLATION",
          canceled_at: "2026-10-24T16:00:00.000Z",
          canceled_by_user_id: "manager-1",
          reason: "Business unavailable",
        },
      }),
      updatedAt: new Date("2026-10-24T16:00:01.000Z"),
    };

    await reconcileBookingCancellationForTrustScore(db as any, row);
    await reconcileBookingCancellationForTrustScore(db as any, row);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      bookingId: "booking-cancel-1",
      outcomeType: "WORKFLOW_CANCELED_VENDOR",
      sourceEntityType: "booking_cancellation_attribution",
      sourceEntityId: "booking-cancel-1",
      finalizedByUserId: "manager-1",
    });
    expect(outcomes[0].finalizedAt.toISOString()).toBe("2026-10-24T16:00:00.000Z");
  });

  it("is idempotent and rebuilds a current Version 3 snapshot", async () => {
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

  it("self-heals explicit cancellation outcomes and keeps neutral cancellations out of the denominator", async () => {
    const cancellations = [
      {
        id: "vendor-cancel",
        vendorId: "vendor-1",
        status: "CANCELED",
        customerMetadata: JSON.stringify({
          vendor_job_cancellation: {
            attribution: "VENDOR",
            source: "VENDOR_ATTRIBUTED_CANCELLATION",
            canceled_at: "2026-10-24T16:00:00.000Z",
          },
        }),
        updatedAt: new Date("2026-10-24T16:00:00.000Z"),
      },
      {
        id: "customer-cancel",
        vendorId: "vendor-1",
        status: "CANCELED",
        customerMetadata: JSON.stringify({
          vendor_job_cancellation: {
            attribution: "CUSTOMER",
            source: "CUSTOMER_CANCELLATION",
            canceled_at: "2026-10-24T17:00:00.000Z",
          },
        }),
        updatedAt: new Date("2026-10-24T17:00:00.000Z"),
      },
    ];
    const { db, outcomes } = dbWith([passDecision], cancellations);

    const result = await reconcileVendorTrustScore(db as any, "vendor-1");

    expect(result.reconciledCancellations).toBe(2);
    expect(result.reconciledVendorCancellations).toBe(1);
    expect(result.breakdown).toMatchObject({
      workflowCompletion: { numerator: 1, denominator: 2, pct: 50 },
      videoVerification: { numerator: 1, denominator: 1, pct: 100 },
      disputeFree: { numerator: 1, denominator: 1, pct: 100 },
      totalScorePct: 83,
    });
    expect(outcomes.map((row) => row.outcomeType)).toContain("WORKFLOW_CANCELED_CUSTOMER");
  });
});
