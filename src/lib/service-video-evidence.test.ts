import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const hoisted = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    privateProofAccessGrant: { findFirst: vi.fn() },
    serviceVideoPackageEvidence: { findFirst: vi.fn() },
    serviceVideoManagerDecisionEvidence: { findFirst: vi.fn() },
    serviceVideoStageEvidence: { findMany: vi.fn() },
    recordingGateDecisionEvidence: { findFirst: vi.fn() },
    mediaSession: { findFirst: vi.fn() },
    mediaAsset: { findFirst: vi.fn() },
  },
}));

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));

function stage(stage: "INTRO" | "IN_PROGRESS" | "COMPLETED", index: number) {
  return {
    id: `stage-${index}`,
    stage,
    stageVersion: 1,
    mediaAssetId: `asset-${index}`,
    mediaSessionId: `session-${index}`,
    assessmentId: "assessment-1",
    permissionEvidenceId: "permission-1",
    recordingGateDecisionId: `gate-${index}`,
    employeeMembershipId: "employee-membership-1",
    captureProvenance: "LIVE_BROWSER_CAPTURE",
    contentHash: `hash-${index}`,
    publicEligible: true,
    uploadState: "SAVED",
  };
}

const stages = [stage("INTRO", 1), stage("IN_PROGRESS", 2), stage("COMPLETED", 3)];
const packageRows = stages.map((row) => ({
  stage: row.stage,
  stageEvidenceId: row.id,
  stageVersion: row.stageVersion,
  mediaAssetId: row.mediaAssetId,
  contentHash: row.contentHash,
}));

describe("Private Service Video evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(hoisted.prisma));
  });

  it("fails closed when a customer access grant does not exist", async () => {
    const { loadAuthorizedPrivateProof } = await import("./service-video-evidence");
    hoisted.prisma.privateProofAccessGrant.findFirst.mockResolvedValue(null);

    await expect(loadAuthorizedPrivateProof({ bookingId: "booking-1", customerUserId: "customer-1" })).resolves.toBeNull();
    expect(hoisted.prisma.serviceVideoPackageEvidence.findFirst).not.toHaveBeenCalled();
  });

  it("fails closed when the package does not contain exactly one saved version of every stage", async () => {
    const { loadAuthorizedPrivateProof } = await import("./service-video-evidence");
    hoisted.prisma.privateProofAccessGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      packageId: "package-1",
      managerDecisionId: "decision-1",
    });
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      id: "package-1",
      vendorId: "vendor-1",
      packageHash: "package-hash",
      stageEvidenceJson: JSON.stringify(packageRows.slice(0, 2)),
    });
    hoisted.prisma.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({ id: "decision-1" });

    await expect(loadAuthorizedPrivateProof({ bookingId: "booking-1", customerUserId: "customer-1" })).resolves.toBeNull();
    expect(hoisted.prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });

  it("authorizes customer-only proof only when every evidence link matches", async () => {
    const { loadAuthorizedPrivateProof } = await import("./service-video-evidence");
    hoisted.prisma.privateProofAccessGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      packageId: "package-1",
      managerDecisionId: "decision-1",
    });
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      id: "package-1",
      vendorId: "vendor-1",
      packageHash: "package-hash",
      stageEvidenceJson: JSON.stringify(packageRows),
    });
    hoisted.prisma.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({ id: "decision-1" });
    hoisted.prisma.serviceVideoStageEvidence.findMany.mockResolvedValue(stages);
    hoisted.prisma.recordingGateDecisionEvidence.findFirst.mockResolvedValue({ decision: "ALLOWED" });
    hoisted.prisma.mediaSession.findFirst.mockResolvedValue({ status: "COMPLETED" });
    hoisted.prisma.mediaAsset.findFirst.mockResolvedValue({
      uploadState: "SAVED",
      moderationStatus: "approved",
      visibilityStatus: "customer_only",
    });

    const proof = await loadAuthorizedPrivateProof({ bookingId: "booking-1", customerUserId: "customer-1" });

    expect(proof).toMatchObject({
      grant: { id: "grant-1" },
      package: { id: "package-1" },
      decision: { id: "decision-1" },
      assetIds: ["asset-1", "asset-2", "asset-3"],
    });
    expect(hoisted.prisma.recordingGateDecisionEvidence.findFirst).toHaveBeenCalledTimes(3);
    expect(hoisted.prisma.mediaSession.findFirst).toHaveBeenCalledTimes(3);
    expect(hoisted.prisma.mediaAsset.findFirst).toHaveBeenCalledTimes(3);
  });

  it("does not create another package version when the same package is resubmitted", async () => {
    const { submitServiceVideoPackage } = await import("./service-video-evidence");
    const packageHash = createHash("sha256").update(JSON.stringify(packageRows)).digest("hex");
    const current = { id: "package-1", status: "AWAITING_MANAGER_REVIEW", packageHash };
    const tx: any = {
      serviceVideoStageEvidence: { findMany: vi.fn().mockResolvedValue(stages) },
      recordingGateDecisionEvidence: { findFirst: vi.fn().mockResolvedValue({ decision: "ALLOWED" }) },
      mediaAsset: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          const row = stages.find((candidate) => candidate.mediaAssetId === where.id)!;
          return Promise.resolve({
            captureProvenance: row.captureProvenance,
            stageVersion: row.stageVersion,
            publicEligible: row.publicEligible,
          });
        }),
      },
      mediaSession: { findFirst: vi.fn().mockResolvedValue({ status: "COMPLETED" }) },
      serviceVideoPackageEvidence: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: (db: unknown) => unknown) => callback(tx));
    tx.serviceVideoPackageEvidence.findFirst.mockResolvedValueOnce(current);

    const first = await submitServiceVideoPackage({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      submittedByMembershipId: "employee-membership-1",
    });

    expect(first).toBe(current);
    expect(tx.serviceVideoPackageEvidence.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceVideoPackageEvidence.create).not.toHaveBeenCalled();
  });
});
