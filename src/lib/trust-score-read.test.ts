import { describe, expect, it, vi } from "vitest";
import {
  buildTrustScoreExplanationDetails,
  buildImprovementHints,
  getCurrentVendorTrustScoreSnapshot,
  getTrustScoreSnapshotReadCapability,
  toAdminTrustScore,
  toPublicTrustScore,
  toVendorTrustScore,
  TRUST_SCORE_PUBLIC_EXPLAINER,
  type SnapshotRow,
} from "./trust-score-read";

const FULL_SNAPSHOT: SnapshotRow = {
  id: "snap-1",
  vendorId: "v1",
  scoreVersion: 1,
  totalScorePct: 88,
  workflowCompletionPct: 100,
  videoVerificationPct: 80,
  disputeFreePct: 90,
  operationalReliabilityPct: 75,
  workflowCompletionNumerator: 10,
  workflowCompletionDenominator: 10,
  videoVerificationNumerator: 8,
  videoVerificationDenominator: 10,
  disputeFreeNumerator: 9,
  disputeFreeDenominator: 10,
  operationalReliabilityNumerator: 6,
  operationalReliabilityDenominator: 8,
  computedAt: new Date("2026-05-28T10:00:00.000Z"),
  periodStart: null,
  periodEnd: null,
  inputHash: "v1_abc123",
  isCurrent: true,
  visibilityStatus: "internal",
  recalcReason: "job_approved",
  recalcSource: "job_approve",
  detailJson: JSON.stringify({ scoreVersion: 1, reason: "job_approved", source: "job_approve" }),
  createdAt: new Date("2026-05-28T10:00:00.000Z"),
  updatedAt: new Date("2026-05-28T10:00:00.000Z"),
};

// Fields that must NEVER appear anywhere in the public payload.
const FORBIDDEN_PUBLIC_KEYS = [
  "inputHash",
  "recalcReason",
  "recalcSource",
  "detailJson",
  "detail",
  "visibilityStatus",
  "lastRecalcReason",
  "lastRecalcSource",
];

function deepKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) deepKeys(item, acc);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      acc.add(k);
      deepKeys(v, acc);
    }
  }
  return acc;
}

describe("trust-score-read shaping (public vs vendor vs admin separation)", () => {
  it("public payload includes total + four component pcts/counts + explanation, excludes internals", () => {
    const out = toPublicTrustScore(FULL_SNAPSHOT);
    expect(out.scored).toBe(true);
    expect(out.totalScorePct).toBe(88);
    expect(out.explanation).toBe(TRUST_SCORE_PUBLIC_EXPLAINER);
    expect(out.explanationDetails.overview).toContain("88%");
    expect(out.explanationDetails.coverageSummary).toContain("100%");
    expect(out.computedAt).toBe("2026-05-28T10:00:00.000Z");
    expect(out.evidence).toMatchObject({
      verifiedBookings: 10,
      approvedServiceVideos: 8,
      validatedDisputes: 1,
    });
    expect(out.presentation).toMatchObject({
      maturityState: "established",
      maturityLabel: "Established",
      title: "Reliance Trust Score",
      scoreDisplay: "88%",
    });

    const c = out.components!;
    expect(c.workflowCompletion).toMatchObject({ pct: 100, numerator: 10, denominator: 10, weightPct: 30 });
    expect(c.videoVerification).toMatchObject({ pct: 80, numerator: 8, denominator: 10, weightPct: 25 });
    expect(c.disputeFree).toMatchObject({ pct: 90, weightPct: 30 });
    expect(c.operationalReliability).toMatchObject({ pct: 75, weightPct: 15 });

    const keys = deepKeys(out);
    for (const forbidden of FORBIDDEN_PUBLIC_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("public payload returns a safe 'not yet scored' shape when no snapshot exists", () => {
    const out = toPublicTrustScore(null);
    expect(out.scored).toBe(false);
    expect(out.totalScorePct).toBeNull();
    expect(out.components).toBeNull();
    expect(out.computedAt).toBeNull();
    expect(out.explanation).toBe(TRUST_SCORE_PUBLIC_EXPLAINER);
    expect(out.explanationDetails.overview).toContain("has not recorded a current Trust Score snapshot");
    expect(out.presentation.summary).toContain("More verified completed work is needed");
  });

  it("vendor payload adds improvement hints but still excludes admin internals", () => {
    const out = toVendorTrustScore(FULL_SNAPSHOT);
    expect(Array.isArray(out.improvementHints)).toBe(true);
    expect(out.improvementHints.length).toBeGreaterThan(0);

    const keys = deepKeys(out);
    for (const forbidden of FORBIDDEN_PUBLIC_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("admin payload exposes internal inputs and recalc trigger/source", () => {
    const out = toAdminTrustScore(FULL_SNAPSHOT);
    expect(out.scored).toBe(true);
    expect(out.snapshot!.inputHash).toBe("v1_abc123");
    expect(out.snapshot!.lastRecalcReason).toBe("job_approved");
    expect(out.snapshot!.lastRecalcSource).toBe("job_approve");
    expect(out.snapshot!.visibilityStatus).toBe("internal");
    expect(out.snapshot!.detail).toMatchObject({ reason: "job_approved" });
    expect(out.explanationDetails.strongestSignals.length).toBeGreaterThan(0);
  });

  it("improvement hints are ordered lowest-pct first and skip 100% / unmeasurable metrics", () => {
    const hints = buildImprovementHints(FULL_SNAPSHOT);
    // operationalReliability (75) is lowest, then videoVerification (80), then disputeFree (90).
    expect(hints[0]).toContain("Operational reliability");
    expect(hints[1]).toContain("Video verification");
    expect(hints.some((h) => h.includes("Verified workflow completion"))).toBe(false); // 100%
  });

  it("buildTrustScoreExplanationDetails explains measurable coverage and weakest signals deterministically", () => {
    const details = buildTrustScoreExplanationDetails(FULL_SNAPSHOT);
    expect(details.overview).toContain("88%");
    expect(details.coverageSummary).toContain("100%");
    expect(details.strongestSignals[0]).toContain("Verified workflow completion");
    expect(details.watchItems[0]).toContain("Operational reliability");
    expect(details.methodology[1]).toContain("Customer Ratings");
  });

  it("buildTrustScoreExplanationDetails handles an unmeasurable snapshot honestly", () => {
    const details = buildTrustScoreExplanationDetails({
      scoreVersion: 1,
      totalScorePct: null,
      workflowCompletionPct: null,
      videoVerificationPct: null,
      disputeFreePct: null,
      operationalReliabilityPct: null,
      workflowCompletionNumerator: 0,
      workflowCompletionDenominator: 0,
      videoVerificationNumerator: 0,
      videoVerificationDenominator: 0,
      disputeFreeNumerator: 0,
      disputeFreeDenominator: 0,
      operationalReliabilityNumerator: 0,
      operationalReliabilityDenominator: 0,
    });
    expect(details.overview).toContain("snapshot exists");
    expect(details.watchItems.some((item) => item.includes("not yet measurable"))).toBe(true);
  });

  it("getCurrentVendorTrustScoreSnapshot only queries the snapshot delegate by isCurrent (no Review)", async () => {
    const findFirst = vi.fn(async () => FULL_SNAPSHOT);
    const reviewSpy = vi.fn();
    const db = {
      vendorTrustScoreSnapshot: { findFirst },
      review: { findFirst: reviewSpy, findMany: reviewSpy, create: reviewSpy },
    };
    const row = await getCurrentVendorTrustScoreSnapshot(db as any, "v1");
    expect(row).toBe(FULL_SNAPSHOT);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: "v1", isCurrent: true } })
    );
    expect(reviewSpy).not.toHaveBeenCalled();
  });

  it("getCurrentVendorTrustScoreSnapshot returns null safely when delegate is missing", async () => {
    expect(await getCurrentVendorTrustScoreSnapshot({} as any, "v1")).toBeNull();
    expect(await getCurrentVendorTrustScoreSnapshot({ vendorTrustScoreSnapshot: {} } as any, "")).toBeNull();
  });

  it("getTrustScoreSnapshotReadCapability distinguishes ok vs stale delegate", () => {
    expect(getTrustScoreSnapshotReadCapability({} as any)).toBe("delegate_unavailable");
    expect(
      getTrustScoreSnapshotReadCapability({ vendorTrustScoreSnapshot: {} } as any)
    ).toBe("delegate_unavailable");
    expect(
      getTrustScoreSnapshotReadCapability({
        vendorTrustScoreSnapshot: { findFirst: vi.fn() },
      } as any)
    ).toBe("ok");
  });
});
