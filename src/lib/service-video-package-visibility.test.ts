import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const prisma: any = {
    $transaction: vi.fn(),
    booking: { findFirst: vi.fn(), findUnique: vi.fn() },
    serviceVideoPackageEvidence: { findFirst: vi.fn() },
    serviceVideoManagerDecisionEvidence: { findFirst: vi.fn() },
    serviceVideoAdminAuditDecisionEvidence: { findFirst: vi.fn() },
    privateProofAccessGrant: { findFirst: vi.fn() },
    serviceVideoStageEvidence: { findFirst: vi.fn(), findUnique: vi.fn() },
    recordingGateDecisionEvidence: { findFirst: vi.fn() },
    mediaSession: { findFirst: vi.fn() },
    mediaAsset: { findFirst: vi.fn(), updateMany: vi.fn() },
    recordingScopeAssessment: { findFirst: vi.fn() },
    serviceVideoPackageVisibilityDecision: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    serviceVideoPublicationProposal: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    serviceVideoPublicationStage: { create: vi.fn(), findMany: vi.fn() },
    serviceVideoPublicationParticipantDecision: { findMany: vi.fn() },
    serviceVideoPublicationAdminDecision: { create: vi.fn() },
    serviceVideoPublicationAuditEvent: { create: vi.fn() },
    publicServiceVideoEligibility: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  };
  return { prisma };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));

const packageStages = [
  { stage: "INTRO", stageEvidenceId: "stage-intro", stageVersion: 1, mediaAssetId: "asset-intro", contentHash: "hash-intro" },
  { stage: "IN_PROGRESS", stageEvidenceId: "stage-progress", stageVersion: 1, mediaAssetId: "asset-progress", contentHash: "hash-progress" },
  { stage: "COMPLETED", stageEvidenceId: "stage-final", stageVersion: 2, mediaAssetId: "asset-final", contentHash: "hash-final" },
];

function installFoundation({ passed = true } = {}) {
  hoisted.prisma.booking.findFirst.mockResolvedValue({
    id: "booking-1",
    userId: "customer-1",
    vendorId: "vendor-1",
    serviceId: "service-1",
    status: "COMPLETED",
  });
  hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
    id: "package-1",
    version: 3,
    vendorId: "vendor-1",
    managerDecisionId: "manager-1",
    adminAuditDecisionId: "admin-audit-1",
    auditEvidenceVersion: 2,
    customerAccessGrantId: "grant-1",
    packageHash: "package-hash",
    stageEvidenceJson: JSON.stringify(packageStages),
  });
  hoisted.prisma.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({ id: "manager-1" });
  hoisted.prisma.privateProofAccessGrant.findFirst.mockResolvedValue(passed ? { id: "grant-1" } : null);
  hoisted.prisma.serviceVideoAdminAuditDecisionEvidence.findFirst.mockResolvedValue(passed ? {
    id: "admin-audit-1",
    decision: "PASS",
    customerProofReleased: true,
    customerAccessGrantId: "grant-1",
  } : null);
  hoisted.prisma.serviceVideoStageEvidence.findFirst.mockImplementation(({ where }: any) => Promise.resolve({
    id: where.id,
    bookingId: "booking-1",
    vendorId: "vendor-1",
    stage: where.stage,
    stageVersion: where.stageVersion,
    mediaAssetId: where.mediaAssetId,
    mediaSessionId: `session-${where.stage}`,
    recordingGateDecisionId: `gate-${where.stage}`,
    employeeMembershipId: "employee-membership-1",
    assessmentId: "assessment-1",
    permissionEvidenceId: "permission-1",
    contentHash: where.contentHash,
  }));
  hoisted.prisma.recordingGateDecisionEvidence.findFirst.mockResolvedValue({ id: "gate-1" });
  hoisted.prisma.mediaSession.findFirst.mockResolvedValue({ id: "session-1", status: "COMPLETED" });
  hoisted.prisma.mediaAsset.findFirst.mockResolvedValue({ id: "asset-1" });
  hoisted.prisma.recordingScopeAssessment.findFirst.mockResolvedValue({
    peopleScope: "none",
    subjectJson: "{}",
    audioAllowed: false,
  });
}

describe("package-level customer Service Video visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(hoisted.prisma));
    installFoundation();
    hoisted.prisma.serviceVideoPackageVisibilityDecision.findFirst.mockResolvedValue(null);
    hoisted.prisma.serviceVideoPublicationProposal.findFirst.mockResolvedValue(null);
    hoisted.prisma.publicServiceVideoEligibility.findMany.mockResolvedValue([]);
    hoisted.prisma.serviceVideoPackageVisibilityDecision.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "visibility-1", ...data }));
    hoisted.prisma.serviceVideoPublicationProposal.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "proposal-1", ...data }));
    hoisted.prisma.serviceVideoPublicationStage.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `pub-${data.stage}`, ...data }));
    hoisted.prisma.serviceVideoPublicationStage.findMany.mockResolvedValue(packageStages.map((stage) => ({
      id: `pub-${stage.stage}`,
      proposalId: "proposal-1",
      ...stage,
      containsEmployeeLikeness: false,
      includesAudio: false,
    })));
    hoisted.prisma.serviceVideoPublicationAuditEvent.create.mockResolvedValue({ id: "audit-1" });
  });

  it("keeps the complete Admin-approved package Private without creating a Public proposal", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    const result = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "KEEP_PRIVATE",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });

    expect(result.decision).toEqual(expect.objectContaining({
      decision: "KEEP_PRIVATE",
      packageId: "package-1",
      packageVersion: 3,
      evidenceVersion: 2,
    }));
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
    expect(hoisted.prisma.publicServiceVideoEligibility.findMany).toHaveBeenCalledTimes(0);
  });

  it("authorizes only the complete exact package for separate Public review", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    const result = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });

    expect(hoisted.prisma.serviceVideoPublicationProposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractVersion: 2,
        authorizationModel: "CUSTOMER_COMPLETE_PACKAGE",
        proposedByUserId: "customer-1",
        proposedByMembershipId: null,
        status: "AWAITING_ADMIN_REVIEW",
      }),
    });
    expect(hoisted.prisma.serviceVideoPublicationStage.create).toHaveBeenCalledTimes(3);
    expect(new Set(hoisted.prisma.serviceVideoPublicationStage.create.mock.calls.map(([call]: any[]) => call.data.stage))).toEqual(
      new Set(["INTRO", "IN_PROGRESS", "COMPLETED"]),
    );
    expect(result.proposal).toEqual(expect.objectContaining({ status: "AWAITING_ADMIN_REVIEW" }));
  });

  it("fails closed before Core Reliance Admin PASS and Private Proof release", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    installFoundation({ passed: false });

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PUBLICATION_PRIVATE_EVIDENCE_INCOMPLETE");
    expect(hoisted.prisma.serviceVideoPackageVisibilityDecision.create).not.toHaveBeenCalled();
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
  });

  it("does not upgrade a historical manager-only Private package into the new Public contract", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
      id: "legacy-package",
      version: 1,
      vendorId: "vendor-1",
      managerDecisionId: "manager-1",
      customerAccessGrantId: "grant-1",
      packageHash: "legacy-package-hash",
      stageEvidenceJson: JSON.stringify(packageStages),
    });

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PACKAGE_VISIBILITY_CORE_ADMIN_PASS_REQUIRED");
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
  });

  it("allows separate Public moderation without reintroducing a vendor visibility decision", async () => {
    const { decidePackageVisibility, moderatePublicationProposal } = await import("./service-video-publication");
    const authorized = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });
    const visibilityDecision = authorized.decision as any;
    const proposal = authorized.proposal as any;
    hoisted.prisma.serviceVideoPackageVisibilityDecision.findFirst.mockResolvedValue(visibilityDecision);
    hoisted.prisma.serviceVideoPublicationProposal.findUnique.mockResolvedValue(proposal);
    hoisted.prisma.serviceVideoPublicationAdminDecision.create.mockResolvedValue({
      id: "public-admin-1",
      decision: "APPROVED",
    });
    hoisted.prisma.publicServiceVideoEligibility.create.mockResolvedValue({ id: "eligibility-1" });

    const result = await moderatePublicationProposal({
      proposalId: "proposal-1",
      adminUserId: "admin-1",
      decision: "APPROVED",
    });

    expect(result.status).toBe("PUBLIC");
    expect(hoisted.prisma.publicServiceVideoEligibility.create).toHaveBeenCalledTimes(3);
    expect(hoisted.prisma.publicServiceVideoEligibility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendorDecisionId: null,
        packageVisibilityDecisionId: "visibility-1",
        customerDecisionId: "visibility-1",
      }),
    });
  });
});
