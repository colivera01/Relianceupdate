import { beforeEach, describe, expect, it, vi } from "vitest";

import { getVendorIdFromRequest } from "@/lib/auth";
import { getCurrentVendorTrustScoreSnapshot, toVendorTrustScore } from "@/lib/trust-score-read";
import { reconcileVendorTrustScore } from "@/lib/trust-score-reconciliation";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({ getVendorIdFromRequest: vi.fn() }));
vi.mock("@/lib/trust-score-read", () => ({
  getCurrentVendorTrustScoreSnapshot: vi.fn(),
  toVendorTrustScore: vi.fn((snapshot) => ({
    scored: Boolean(snapshot?.totalScorePct !== null && snapshot?.totalScorePct !== undefined),
    scoreVersion: snapshot?.scoreVersion || 2,
    totalScorePct: snapshot?.totalScorePct ?? null,
  })),
}));
vi.mock("@/lib/trust-score-reconciliation", () => ({ reconcileVendorTrustScore: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));

const currentSnapshot = { id: "snapshot-v2", scoreVersion: 2, totalScorePct: 96 };

describe("vendor reliability score route", () => {
  beforeEach(() => {
    vi.mocked(getVendorIdFromRequest).mockReset();
    vi.mocked(getCurrentVendorTrustScoreSnapshot).mockReset();
    vi.mocked(toVendorTrustScore).mockClear();
    vi.mocked(reconcileVendorTrustScore).mockReset();
    vi.mocked(getVendorIdFromRequest).mockResolvedValue("vendor-1");
    vi.mocked(getCurrentVendorTrustScoreSnapshot).mockResolvedValue(currentSnapshot);
    vi.mocked(reconcileVendorTrustScore).mockResolvedValue({
      ok: true,
      snapshot: currentSnapshot,
      verifiedAt: "2026-10-24T20:00:00.000Z",
      reconciledDecisions: 3,
    } as any);
  });

  it("reads a current Version 2 snapshot without rebuilding it", async () => {
    const response = await GET(new Request("http://localhost/api/vendor/trust-score"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      scoreVersion: 2,
      refreshed: false,
      verifiedAt: null,
      trustScore: { totalScorePct: 96 },
    });
    expect(reconcileVendorTrustScore).not.toHaveBeenCalled();
  });

  it("upgrades an obsolete snapshot before returning analytics", async () => {
    vi.mocked(getCurrentVendorTrustScoreSnapshot).mockResolvedValueOnce({
      id: "snapshot-v1",
      scoreVersion: 1,
      totalScorePct: 85,
    });

    const response = await GET(new Request("http://localhost/api/vendor/trust-score"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reconcileVendorTrustScore).toHaveBeenCalledWith(
      expect.anything(),
      "vendor-1",
      "score_version_upgrade",
      "vendor_analytics",
    );
    expect(body).toMatchObject({
      refreshed: true,
      verifiedAt: "2026-10-24T20:00:00.000Z",
      trustScore: { scoreVersion: 2, totalScorePct: 96 },
    });
  });

  it("force-refreshes exact audit evidence on POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/vendor/trust-score", { method: "POST" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reconcileVendorTrustScore).toHaveBeenCalledWith(
      expect.anything(),
      "vendor-1",
      "vendor_requested_refresh",
      "vendor_analytics",
    );
    expect(body.refreshed).toBe(true);
  });

  it("returns 401 without a vendor session", async () => {
    vi.mocked(getVendorIdFromRequest).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/vendor/trust-score"));
    expect(response.status).toBe(401);
    expect(reconcileVendorTrustScore).not.toHaveBeenCalled();
  });
});
