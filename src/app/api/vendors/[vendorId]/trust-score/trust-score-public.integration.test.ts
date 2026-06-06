import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const hoisted = vi.hoisted(() => {
  const vendorFindFirst = vi.fn();
  const snapshotFindFirst = vi.fn();
  const reviewSpy = vi.fn();
  const prisma = {
    vendor: { findFirst: vendorFindFirst },
    vendorTrustScoreSnapshot: { findFirst: snapshotFindFirst },
    review: { findFirst: reviewSpy, findMany: reviewSpy, create: reviewSpy },
  };
  return { prisma, vendorFindFirst, snapshotFindFirst, reviewSpy };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));

function ctx(vendorId: string) {
  return { params: Promise.resolve({ vendorId }) };
}

describe("GET /api/vendors/[vendorId]/trust-score (public-safe)", () => {
  beforeEach(() => {
    hoisted.vendorFindFirst.mockReset();
    hoisted.snapshotFindFirst.mockReset();
    hoisted.reviewSpy.mockReset();
  });

  it("404s when the vendor is not publicly listed/active", async () => {
    hoisted.vendorFindFirst.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/vendors/v1/trust-score"), ctx("v1"));
    expect(res.status).toBe(404);
  });

  it("returns a 'not yet scored' shape when no current snapshot exists", async () => {
    hoisted.vendorFindFirst.mockResolvedValue({ id: "v1" });
    hoisted.snapshotFindFirst.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trustScore.scored).toBe(false);
    expect(body.trustScore.totalScorePct).toBeNull();
    expect(body.trustScore.explanation).toContain("separate");
  });

  it("returns public-safe component pcts/counts and excludes internal fields", async () => {
    hoisted.vendorFindFirst.mockResolvedValue({ id: "v1" });
    hoisted.snapshotFindFirst.mockResolvedValue({
      id: "snap-1",
      vendorId: "v1",
      scoreVersion: 1,
      totalScorePct: 91,
      workflowCompletionPct: 100,
      videoVerificationPct: 90,
      disputeFreePct: 95,
      operationalReliabilityPct: 80,
      workflowCompletionNumerator: 5,
      workflowCompletionDenominator: 5,
      videoVerificationNumerator: 9,
      videoVerificationDenominator: 10,
      disputeFreeNumerator: 19,
      disputeFreeDenominator: 20,
      operationalReliabilityNumerator: 4,
      operationalReliabilityDenominator: 5,
      computedAt: new Date("2026-05-28T10:00:00.000Z"),
      inputHash: "v1_secret",
      recalcReason: "job_approved",
      recalcSource: "job_approve",
      detailJson: JSON.stringify({ internal: true }),
      visibilityStatus: "internal",
      isCurrent: true,
    });

    const res = await GET(new Request("http://localhost/api/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();
    const raw = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(body.trustScore.scored).toBe(true);
    expect(body.trustScore.totalScorePct).toBe(91);
    expect(body.trustScore.components.videoVerification).toMatchObject({ pct: 90, numerator: 9, denominator: 10 });

    // Internal-only fields must not leak to the public payload.
    expect(raw).not.toContain("v1_secret");
    expect(raw).not.toContain("recalcReason");
    expect(raw).not.toContain("detailJson");
    expect(raw).not.toContain("visibilityStatus");

    // Public read never touches Review.
    expect(hoisted.reviewSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when the database is temporarily unavailable", async () => {
    hoisted.vendorFindFirst.mockRejectedValue(Object.assign(new Error("Can't reach database server"), { code: "P1001" }));

    const res = await GET(new Request("http://localhost/api/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("DB_UNAVAILABLE");
    expect(body.retryable).toBe(true);
  });
});
