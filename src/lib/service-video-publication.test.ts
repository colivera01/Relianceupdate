import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const prisma: any = {
    $transaction: vi.fn(),
    booking: { findFirst: vi.fn() },
    serviceVideoPackageEvidence: { findFirst: vi.fn(), updateMany: vi.fn() },
    serviceVideoManagerDecisionEvidence: { findFirst: vi.fn() },
    privateProofAccessGrant: { findFirst: vi.fn() },
    serviceVideoStageEvidence: { findFirst: vi.fn(), findUnique: vi.fn() },
    recordingGateDecisionEvidence: { findFirst: vi.fn() },
    mediaSession: { findFirst: vi.fn() },
    mediaAsset: { findFirst: vi.fn(), updateMany: vi.fn() },
    serviceVideoPublicationProposal: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    serviceVideoPublicationStage: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    serviceVideoPublicationCustomerDecision: { findFirst: vi.fn() },
    serviceVideoPublicationVendorDecision: { findFirst: vi.fn() },
    serviceVideoPublicationAdminDecision: { findFirst: vi.fn() },
    serviceVideoPublicationParticipantDecision: { findMany: vi.fn() },
    serviceVideoPublicationAuditEvent: { create: vi.fn() },
    publicServiceVideoEligibility: { findMany: vi.fn(), updateMany: vi.fn() },
    vendorMembership: { findUnique: vi.fn() },
  };
  return { prisma };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));

const packageStages = [
  { stage: "INTRO", stageEvidenceId: "stage-intro", stageVersion: 1, mediaAssetId: "asset-intro", contentHash: "hash-intro" },
  { stage: "IN_PROGRESS", stageEvidenceId: "stage-progress", stageVersion: 1, mediaAssetId: "asset-progress", contentHash: "hash-progress" },
  { stage: "COMPLETED", stageEvidenceId: "stage-final", stageVersion: 2, mediaAssetId: "asset-final", contentHash: "hash-final" },
];

function setPrivateFoundation() {
  hoisted.prisma.booking.findFirst.mockResolvedValue({
    id: "booking-1",
    userId: "customer-1",
    vendorId: "vendor-1",
    serviceId: "service-1",
    status: "COMPLETED",
    title: "Outlet repair",
    clientName: "Customer",
  });
  hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValue({
    id: "package-1",
    version: 3,
    vendorId: "vendor-1",
    managerDecisionId: "manager-decision-1",
    customerAccessGrantId: "grant-1",
    packageHash: "package-hash-1",
    stageEvidenceJson: JSON.stringify(packageStages),
  });
  hoisted.prisma.serviceVideoManagerDecisionEvidence.findFirst.mockResolvedValue({ id: "manager-decision-1" });
  hoisted.prisma.privateProofAccessGrant.findFirst.mockResolvedValue({ id: "grant-1" });
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
  hoisted.prisma.recordingGateDecisionEvidence.findFirst.mockResolvedValue({ id: "gate-final", decision: "ALLOWED" });
  hoisted.prisma.mediaSession.findFirst.mockImplementation(({ where }: any) => Promise.resolve({ id: where.id, serviceId: "service-1", status: "COMPLETED" }));
  hoisted.prisma.mediaAsset.findFirst.mockImplementation(({ where }: any) => Promise.resolve({
    id: where.id,
    visibilityStatus: "public",
    moderationStatus: "approved",
  }));
}

describe("exact-media Public Service Video evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(hoisted.prisma));
    setPrivateFoundation();
  });

  it("creates a proposal for Final Result only by default", async () => {
    const { createPublicationProposal } = await import("./service-video-publication");
    hoisted.prisma.serviceVideoPublicationProposal.findFirst.mockResolvedValue(null);
    hoisted.prisma.serviceVideoPublicationProposal.create.mockResolvedValue({ id: "proposal-1", status: "AWAITING_CUSTOMER_DECISION" });
    hoisted.prisma.serviceVideoPublicationStage.create.mockResolvedValue({ id: "publication-stage-1" });
    hoisted.prisma.serviceVideoPublicationAuditEvent.create.mockResolvedValue({ id: "audit-1" });

    await createPublicationProposal({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      proposedByUserId: "manager-1",
      proposedByMembershipId: "manager-membership-1",
    });

    expect(hoisted.prisma.serviceVideoPublicationStage.create).toHaveBeenCalledTimes(1);
    expect(hoisted.prisma.serviceVideoPublicationStage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stage: "COMPLETED", mediaAssetId: "asset-final", stageVersion: 2, contentHash: "hash-final" }),
    }));
  });

  it("blocks an identifiable minor from a Public proposal", async () => {
    const { createPublicationProposal } = await import("./service-video-publication");
    await expect(createPublicationProposal({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      proposedByUserId: "manager-1",
      proposedByMembershipId: "manager-membership-1",
      stages: [{ stage: "COMPLETED", containsMinor: true }],
    })).rejects.toThrow("PUBLICATION_IDENTIFIABLE_MINOR_PROHIBITED");
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
  });

  it("supersedes the old proposal and invalidates its Public media before creating a changed version", async () => {
    const { createPublicationProposal } = await import("./service-video-publication");
    hoisted.prisma.serviceVideoPublicationProposal.findFirst
      .mockResolvedValueOnce({ id: "proposal-1", version: 1 })
      .mockResolvedValueOnce({ id: "proposal-1", version: 1, isCurrent: true, status: "PUBLIC" });
    hoisted.prisma.publicServiceVideoEligibility.findMany.mockResolvedValue([
      { id: "eligibility-1", mediaAssetId: "asset-final" },
    ]);
    hoisted.prisma.serviceVideoPublicationProposal.create.mockResolvedValue({
      id: "proposal-2",
      version: 2,
      status: "AWAITING_CUSTOMER_DECISION",
    });
    hoisted.prisma.serviceVideoPublicationStage.create.mockResolvedValue({ id: "publication-stage-2" });
    hoisted.prisma.serviceVideoPublicationAuditEvent.create.mockResolvedValue({ id: "audit-2" });

    await createPublicationProposal({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      proposedByUserId: "manager-1",
      proposedByMembershipId: "manager-membership-1",
      stages: [{ stage: "COMPLETED", caption: "Updated approved caption" }],
    });

    expect(hoisted.prisma.serviceVideoPublicationProposal.update).toHaveBeenCalledWith({
      where: { id: "proposal-1" },
      data: expect.objectContaining({ isCurrent: false, status: "SUPERSEDED" }),
    });
    expect(hoisted.prisma.publicServiceVideoEligibility.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["eligibility-1"] } },
      data: expect.objectContaining({
        status: "INVALIDATED",
        invalidationReason: "SUPERSEDED_PUBLICATION_PROPOSAL",
      }),
    });
    expect(hoisted.prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["asset-final"] } },
      data: { visibilityStatus: "customer_only" },
    });
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 2, isCurrent: true }),
    });
  });

  it("serves an exact Public asset only while the complete chain remains current", async () => {
    const { resolveCanonicalPublicAssetIds } = await import("./service-video-publication");
    const eligibility = {
      id: "eligibility-1",
      proposalId: "proposal-1",
      stageId: "publication-stage-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      mediaAssetId: "asset-final",
      packageId: "package-1",
      packageHash: "package-hash-1",
      proposalHash: "proposal-hash-1",
      presentationHash: "presentation-hash-1",
      contentHash: "hash-final",
      customerDecisionId: "customer-decision-1",
      vendorDecisionId: "vendor-decision-1",
      adminDecisionId: "admin-decision-1",
      participantDecisionIdsJson: "[]",
    };
    const proposal = {
      id: "proposal-1",
      bookingId: "booking-1",
      vendorId: "vendor-1",
      packageId: "package-1",
      packageVersion: 3,
      packageHash: "package-hash-1",
      proposalHash: "proposal-hash-1",
      isCurrent: true,
      status: "PUBLIC",
    };
    const publicationStage = {
      id: "publication-stage-1",
      proposalId: "proposal-1",
      stageEvidenceId: "stage-final",
      stageVersion: 2,
      mediaAssetId: "asset-final",
      contentHash: "hash-final",
      presentationHash: "presentation-hash-1",
      containsMinor: false,
      containsBystander: false,
      containsEmployeeLikeness: false,
      includesAudio: false,
    };
    hoisted.prisma.publicServiceVideoEligibility.findMany.mockResolvedValue([eligibility]);
    hoisted.prisma.serviceVideoPublicationProposal.findFirst.mockResolvedValue(proposal);
    hoisted.prisma.serviceVideoPublicationStage.findFirst.mockResolvedValue(publicationStage);
    hoisted.prisma.serviceVideoPublicationCustomerDecision.findFirst.mockResolvedValue({ id: "customer-decision-1", decisionJson: JSON.stringify({ stages: { "publication-stage-1": "APPROVED" } }) });
    hoisted.prisma.serviceVideoPublicationVendorDecision.findFirst.mockResolvedValue({ id: "vendor-decision-1", decision: "APPROVED" });
    hoisted.prisma.serviceVideoPublicationAdminDecision.findFirst.mockResolvedValue({ id: "admin-decision-1", decision: "APPROVED", approvedAudience: "PUBLIC" });

    await expect(resolveCanonicalPublicAssetIds({ bookingId: "booking-1" })).resolves.toEqual(["asset-final"]);

    hoisted.prisma.serviceVideoPackageEvidence.findFirst.mockResolvedValueOnce({
      id: "package-2",
      version: 4,
      vendorId: "vendor-1",
      managerDecisionId: "manager-decision-2",
      customerAccessGrantId: "grant-2",
      packageHash: "new-package-hash",
      stageEvidenceJson: JSON.stringify(packageStages),
    });
    await expect(resolveCanonicalPublicAssetIds({ bookingId: "booking-1" })).resolves.toEqual([]);
  });

  it("fails closed when an applicable participant decision is missing", async () => {
    const { resolveCanonicalPublicAssetIds } = await import("./service-video-publication");
    hoisted.prisma.publicServiceVideoEligibility.findMany.mockResolvedValue([{
      proposalId: "proposal-1", stageId: "publication-stage-1", bookingId: "booking-1", vendorId: "vendor-1",
      mediaAssetId: "asset-final", packageId: "package-1", packageHash: "package-hash-1", proposalHash: "proposal-hash-1",
      presentationHash: "presentation-hash-1", contentHash: "hash-final", customerDecisionId: "customer-decision-1",
      vendorDecisionId: "vendor-decision-1", adminDecisionId: "admin-decision-1", participantDecisionIdsJson: "[]",
    }]);
    hoisted.prisma.serviceVideoPublicationProposal.findFirst.mockResolvedValue({
      id: "proposal-1", bookingId: "booking-1", vendorId: "vendor-1", packageId: "package-1", packageVersion: 3,
      packageHash: "package-hash-1", proposalHash: "proposal-hash-1", isCurrent: true, status: "PUBLIC",
    });
    hoisted.prisma.serviceVideoPublicationStage.findFirst.mockResolvedValue({
      id: "publication-stage-1", proposalId: "proposal-1", stageEvidenceId: "stage-final", stageVersion: 2,
      mediaAssetId: "asset-final", contentHash: "hash-final", presentationHash: "presentation-hash-1",
      containsMinor: false, containsBystander: false, containsEmployeeLikeness: true, includesAudio: false,
    });
    hoisted.prisma.serviceVideoPublicationCustomerDecision.findFirst.mockResolvedValue({ id: "customer-decision-1", decisionJson: JSON.stringify({ stages: { "publication-stage-1": "APPROVED" } }) });
    hoisted.prisma.serviceVideoPublicationVendorDecision.findFirst.mockResolvedValue({ id: "vendor-decision-1", decision: "APPROVED" });
    hoisted.prisma.serviceVideoPublicationAdminDecision.findFirst.mockResolvedValue({ id: "admin-decision-1", decision: "APPROVED", approvedAudience: "PUBLIC" });
    hoisted.prisma.serviceVideoStageEvidence.findUnique.mockResolvedValue({ id: "stage-final", employeeMembershipId: "employee-membership-1" });
    hoisted.prisma.vendorMembership.findUnique.mockResolvedValue({ userId: "employee-1" });
    hoisted.prisma.serviceVideoPublicationParticipantDecision.findMany.mockResolvedValue([]);

    await expect(resolveCanonicalPublicAssetIds({ bookingId: "booking-1" })).resolves.toEqual([]);
  });
});
