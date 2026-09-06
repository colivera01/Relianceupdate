import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ resolvePending: vi.fn() }));

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/internal-identities", () => ({ launchExcludedVendorIds: () => [] }));
vi.mock("@/lib/service-video-admin-audit", () => ({
  resolveCoreAdminAuditPendingPackages: hoisted.resolvePending,
}));

function candidate(packageId = "package-1", bookingId = "booking-1") {
  const stages = ["INTRO", "IN_PROGRESS", "COMPLETED"];
  return {
    booking: {
      id: bookingId,
      vendorId: "vendor-1",
      title: "Outlet Installation",
      status: "COMPLETED",
      clientName: "Customer",
      service: { id: "service-1", name: "Outlet Installation" },
      vendor: { name: "Electro LLC", businessName: "Electro LLC" },
    },
    package: {
      id: packageId,
      version: 2,
      packageHash: `hash-${packageId}`,
      auditEvidenceVersion: 1,
      submittedAt: new Date("2026-09-06T10:00:00Z"),
    },
    managerDecision: {
      id: `decision-${packageId}`,
      decidedAt: new Date("2026-09-06T10:00:00Z"),
      attestationHash: `attestation-${packageId}`,
    },
    managerMembership: { user: { name: "Morgan Manager" } },
    packageStages: stages.map((stage, index) => ({
      stage,
      stageEvidenceId: `stage-${index + 1}`,
      stageVersion: 1,
      mediaAssetId: `asset-${packageId}-${index + 1}`,
      contentHash: `content-${index + 1}`,
    })),
    mediaAssets: stages.map((_, index) => ({
      id: `asset-${packageId}-${index + 1}`,
      moderationStatus: "pending_review",
      visibilityStatus: "private",
      uploadState: "SAVED",
      audioExpected: false,
      audioPresence: "LEGACY_UNKNOWN",
      audioEvidenceVersion: 1,
      bytes: BigInt(10),
    })),
    audioAudit: { expected: false, conformance: "CONFORMING", errors: [] },
    recordingAssessmentInterpretation: null,
  };
}

describe("package-first Core Admin Audit queue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows every canonically valid pending package exactly once without a media-row cap", async () => {
    hoisted.resolvePending.mockResolvedValue({
      candidates: Array.from({ length: 75 }, (_, index) => candidate(`package-${index}`, `booking-${index}`)),
      issues: [],
    });
    const { getAdminMediaModerationQueueResult } = await import("./admin-media-moderation-queue");

    const result = await getAdminMediaModerationQueueResult({ includeInternal: true, limit: 200 });

    expect(result.totalPending).toBe(75);
    expect(result.packages).toHaveLength(75);
    expect(new Set(result.packages.map((item) => item.packageId)).size).toBe(75);
    expect(result.packages[0].packageReadiness).toBe("READY_FOR_ADMIN_REVIEW");
  });

  it("keeps invalid pending packages visible as safe Admin diagnostics", async () => {
    hoisted.resolvePending.mockResolvedValue({
      candidates: [candidate()],
      issues: [{
        bookingId: "booking-bad",
        vendorId: "vendor-1",
        packageId: "package-bad",
        code: "ADMIN_AUDIT_MANAGER_ATTESTATION_BINDING_MISMATCH",
        correlationId: "ABC123DEF456",
        submittedAt: new Date("2026-09-06T09:00:00Z"),
      }],
    });
    const { getAdminMediaModerationQueueResult } = await import("./admin-media-moderation-queue");

    const result = await getAdminMediaModerationQueueResult({ includeInternal: true });

    expect(result.packages).toHaveLength(1);
    expect(result.totalPending).toBe(1);
    expect(result.diagnostics).toEqual([expect.objectContaining({
      packageId: "package-bad",
      code: "ADMIN_AUDIT_MANAGER_ATTESTATION_BINDING_MISMATCH",
      correlationId: "ABC123DEF456",
    })]);
  });

  it("deep-links to one package without changing the authoritative pending count", async () => {
    hoisted.resolvePending.mockResolvedValue({
      candidates: [candidate("package-1", "booking-1"), candidate("package-2", "booking-2")],
      issues: [],
    });
    const { getAdminMediaModerationQueueResult } = await import("./admin-media-moderation-queue");

    const result = await getAdminMediaModerationQueueResult({ includeInternal: true, packageId: "package-2" });

    expect(result.totalPending).toBe(2);
    expect(result.packages.map((item) => item.packageId)).toEqual(["package-2"]);
  });
});
