import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { POST as RECALC } from "./recalculate/route";
import { requireAdmin } from "@/lib/admin-auth";

const hoisted = vi.hoisted(() => {
  const vendorFindUnique = vi.fn();
  const snapshotFindFirst = vi.fn();
  const snapshotUpdateMany = vi.fn();
  const snapshotCreate = vi.fn();
  const outcomeFindMany = vi.fn();
  const issueFindMany = vi.fn();
  const reviewSpy = vi.fn();
  const prisma = {
    vendor: { findUnique: vendorFindUnique },
    vendorOperationalOutcome: { findMany: outcomeFindMany },
    bookingServiceIssue: { findMany: issueFindMany },
    vendorTrustScoreSnapshot: {
      findFirst: snapshotFindFirst,
      updateMany: snapshotUpdateMany,
      create: snapshotCreate,
    },
    review: { findFirst: reviewSpy, findMany: reviewSpy, create: reviewSpy, update: reviewSpy },
  };
  return {
    prisma,
    vendorFindUnique,
    snapshotFindFirst,
    snapshotUpdateMany,
    snapshotCreate,
    outcomeFindMany,
    issueFindMany,
    reviewSpy,
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));

function ctx(vendorId: string) {
  return { params: Promise.resolve({ vendorId }) };
}

const ADMIN_SNAPSHOT = {
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
  inputHash: "v1_hash",
  recalcReason: "job_approved",
  recalcSource: "job_approve",
  detailJson: JSON.stringify({ scoreVersion: 1, reason: "job_approved" }),
  visibilityStatus: "internal",
  isCurrent: true,
};

describe("admin trust-score routes", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
    Object.values(hoisted).forEach((v: any) => typeof v?.mockReset === "function" && v.mockReset());
    vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin-1", role: "admin" });
  });

  it("GET returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden: Admin access required"));
    const res = await GET(new Request("http://localhost/api/admin/vendors/v1/trust-score"), ctx("v1"));
    expect(res.status).toBe(403);
  });

  it("GET exposes admin-only internals (inputHash, recalc trigger/source, detail)", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({ id: "v1", name: "V", businessName: "Biz" });
    hoisted.snapshotFindFirst.mockResolvedValue(ADMIN_SNAPSHOT);

    const res = await GET(new Request("http://localhost/api/admin/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshotReadCapability).toBe("ok");
    expect(body.trustScore.snapshot.inputHash).toBe("v1_hash");
    expect(body.trustScore.snapshot.lastRecalcReason).toBe("job_approved");
    expect(body.trustScore.snapshot.lastRecalcSource).toBe("job_approve");
    expect(body.trustScore.snapshot.detail).toMatchObject({ reason: "job_approved" });

    // Even the admin read never queries Review.
    expect(hoisted.reviewSpy).not.toHaveBeenCalled();
  });

  it("GET returns scored:false when the vendor has no current snapshot (not yet scored)", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({ id: "v1", name: "V", businessName: "Biz" });
    hoisted.snapshotFindFirst.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/admin/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trustScore.scored).toBe(false);
    expect(body.trustScore.snapshot).toBeNull();
    expect(hoisted.reviewSpy).not.toHaveBeenCalled();
  });

  it("GET surfaces a null-total snapshot (live backfill baseline) with null component pcts", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({ id: "v1" });
    hoisted.snapshotFindFirst.mockResolvedValue({
      ...ADMIN_SNAPSHOT,
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

    const res = await GET(new Request("http://localhost/api/admin/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trustScore.scored).toBe(true); // a snapshot row exists
    expect(body.trustScore.snapshot.totalScorePct).toBeNull(); // but it is not yet meaningful
    expect(body.trustScore.snapshot.components.workflowCompletion.pct).toBeNull();
    expect(hoisted.reviewSpy).not.toHaveBeenCalled();
  });

  it("GET reports snapshotReadCapability delegate_unavailable when Prisma delegate is missing", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({ id: "v1", businessName: "Biz" });
    const saved = hoisted.prisma.vendorTrustScoreSnapshot;
    hoisted.prisma.vendorTrustScoreSnapshot = {} as typeof saved;

    const res = await GET(new Request("http://localhost/api/admin/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    hoisted.prisma.vendorTrustScoreSnapshot = saved;

    expect(res.status).toBe(200);
    expect(body.snapshotReadCapability).toBe("delegate_unavailable");
    expect(body.trustScore.scored).toBe(false);
    expect(body.trustScore.snapshot).toBeNull();
    expect(hoisted.reviewSpy).not.toHaveBeenCalled();
  });

  it("GET returns 503 when the database is temporarily unavailable", async () => {
    hoisted.vendorFindUnique.mockRejectedValue(Object.assign(new Error("Can't reach database server"), { code: "P1001" }));

    const res = await GET(new Request("http://localhost/api/admin/vendors/v1/trust-score"), ctx("v1"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("DB_UNAVAILABLE");
    expect(body.retryable).toBe(true);
  });

  it("POST recalculate rebuilds a snapshot idempotently and never touches Review", async () => {
    hoisted.vendorFindUnique.mockResolvedValue({ id: "v1" });
    hoisted.outcomeFindMany.mockResolvedValue([
      { bookingId: "b1", outcomeType: "WORKFLOW_COMPLETED", finalizedAt: new Date() },
    ]);
    hoisted.issueFindMany.mockResolvedValue([]);
    hoisted.snapshotFindFirst.mockResolvedValue(null); // no current -> write new
    hoisted.snapshotUpdateMany.mockResolvedValue({ count: 0 });
    hoisted.snapshotCreate.mockImplementation(async (args: any) => ({ id: "snap-new", ...args.data }));

    const res = await RECALC(
      new Request("http://localhost/api/admin/vendors/v1/trust-score/recalculate", { method: "POST" }),
      ctx("v1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(hoisted.snapshotCreate).toHaveBeenCalledTimes(1);
    expect(hoisted.reviewSpy).not.toHaveBeenCalled();
  });
});
