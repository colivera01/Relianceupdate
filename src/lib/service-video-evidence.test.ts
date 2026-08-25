import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const hoisted = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    privateProofAccessGrant: { findFirst: vi.fn() },
    serviceVideoPackageEvidence: { findFirst: vi.fn() },
    serviceVideoManagerDecisionEvidence: { findFirst: vi.fn() },
    serviceVideoAdminAuditDecisionEvidence: { findFirst: vi.fn() },
    booking: { findFirst: vi.fn() },
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
    hoisted.prisma.booking.findFirst.mockResolvedValue({ id: "booking-1", status: "IN_PROGRESS" });
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

  it("requires durable Admin PASS evidence for a new-path customer proof grant", async () => {
    const { loadAuthorizedPrivateProof } = await import("./service-video-evidence");
    hoisted.prisma.privateProofAccessGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      packageId: "package-1",
      managerDecisionId: "manager-decision-1",
      adminAuditDecisionId: "admin-audit-1",
    });
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      id: "package-1",
      vendorId: "vendor-1",
      packageHash: "package-hash",
      managerDecisionId: "manager-decision-1",
      adminAuditDecisionId: "admin-audit-1",
      auditEvidenceVersion: 1,
      stageEvidenceJson: JSON.stringify(packageRows),
    });
    hoisted.prisma.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({ id: "manager-decision-1" });
    hoisted.prisma.serviceVideoAdminAuditDecisionEvidence.findFirst.mockResolvedValue(null);

    await expect(loadAuthorizedPrivateProof({ bookingId: "booking-1", customerUserId: "customer-1" })).resolves.toBeNull();
    expect(hoisted.prisma.serviceVideoAdminAuditDecisionEvidence.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "admin-audit-1",
        decision: "PASS",
        customerProofReleased: true,
        customerAccessGrantId: "grant-1",
      }),
    });
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
    expect(hoisted.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(tx.serviceVideoPackageEvidence.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceVideoPackageEvidence.create).not.toHaveBeenCalled();
  });

  it("blocks a durable stage mutation after manager review becomes authoritative", async () => {
    const { assertServiceVideoStageMutationAllowed } = await import("./service-video-evidence");
    hoisted.prisma.booking.findFirst.mockResolvedValue({ id: "booking-1", status: "AWAITING_REVIEW" });
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      status: "AWAITING_MANAGER_REVIEW",
      managerDecisionId: null,
    });

    await expect(assertServiceVideoStageMutationAllowed(hoisted.prisma, {
      bookingId: "booking-1",
      vendorId: "vendor-1",
      stage: "INTRO",
    })).rejects.toMatchObject({ code: "MANAGER_REVIEW_IN_PROGRESS" });
  });

  it("treats Admin REJECT as terminal for every later employee mutation", async () => {
    const { assertServiceVideoStageMutationAllowed } = await import("./service-video-evidence");
    hoisted.prisma.booking.findFirst.mockResolvedValue({ id: "booking-1", status: "REJECTED" });
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      status: "ADMIN_REJECTED",
      managerDecisionId: "manager-decision-1",
      adminAuditDecisionId: "admin-audit-1",
    });

    await expect(assertServiceVideoStageMutationAllowed(hoisted.prisma, {
      bookingId: "booking-1",
      vendorId: "vendor-1",
      stage: "INTRO",
    })).rejects.toMatchObject({ code: "ADMIN_AUDIT_REJECTED_TERMINAL" });
  });

  it("rejects finalization when upload authority predates manager review", async () => {
    const { saveVerifiedServiceVideoStage } = await import("./service-video-evidence");
    const tx: any = {
      booking: { findFirst: vi.fn().mockResolvedValue({ id: "booking-1", status: "AWAITING_REVIEW" }) },
      serviceVideoPackageEvidence: {
        findFirst: vi.fn().mockResolvedValue({ status: "AWAITING_MANAGER_REVIEW", managerDecisionId: null }),
      },
      recordingGateDecisionEvidence: { findFirst: vi.fn() },
      mediaAsset: { create: vi.fn() },
      serviceVideoStageEvidence: { create: vi.fn() },
    };
    hoisted.prisma.$transaction.mockImplementationOnce(async (callback: (db: unknown) => unknown) => callback(tx));

    await expect(saveVerifiedServiceVideoStage({
      assetId: "asset-race",
      vendorId: "vendor-1",
      bookingId: "booking-1",
      mediaSessionId: "session-1",
      membershipId: "employee-membership-1",
      bytes: BigInt(1024),
      mimeType: "video/webm",
      blobKey: "vendor/vendor-1/media/asset-race.webm",
      stage: "INTRO",
      captureProvenance: "LIVE_BROWSER_CAPTURE",
      verifiedDurationSeconds: 5,
      videoBuffer: Buffer.from("video"),
      gateDecisionId: "gate-issued-before-submission",
    })).rejects.toMatchObject({ code: "MANAGER_REVIEW_IN_PROGRESS" });

    expect(tx.recordingGateDecisionEvidence.findFirst).not.toHaveBeenCalled();
    expect(tx.mediaAsset.create).not.toHaveBeenCalled();
    expect(tx.serviceVideoStageEvidence.create).not.toHaveBeenCalled();
  });

  it("reopens only the exact stage named by the manager correction", async () => {
    const { assertServiceVideoStageMutationAllowed } = await import("./service-video-evidence");
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      status: "CORRECTION_REQUESTED",
      managerDecisionId: "decision-1",
    });
    hoisted.prisma.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({
      targetedStagesJson: JSON.stringify(["IN_PROGRESS"]),
    });

    await expect(assertServiceVideoStageMutationAllowed(hoisted.prisma, {
      bookingId: "booking-1",
      vendorId: "vendor-1",
      stage: "INTRO",
    })).rejects.toMatchObject({ code: "STAGE_CORRECTION_NOT_REQUESTED" });
    await expect(assertServiceVideoStageMutationAllowed(hoisted.prisma, {
      bookingId: "booking-1",
      vendorId: "vendor-1",
      stage: "IN_PROGRESS",
    })).resolves.toBeUndefined();
  });
});
