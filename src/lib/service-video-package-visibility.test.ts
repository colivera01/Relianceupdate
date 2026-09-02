import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

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
    vendorMembership: { findUnique: vi.fn() },
    mediaLifecycleRestriction: { findFirst: vi.fn() },
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

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
    scopeJson: JSON.stringify({ schemaVersion: "recording-assessment-v3-package-audio-v1" }),
    audioAllowed: false,
  });
}

function installImmediateAudit(eligibility: "PUBLIC_DISPLAY_ELIGIBLE" | "PRIVATE_ONLY" = "PUBLIC_DISPLAY_ELIGIBLE") {
  const decidedAt = new Date("2026-09-02T15:00:00.000Z");
  const publicDisplayReason = eligibility === "PRIVATE_ONLY" ? "The package contains customer-private information." : null;
  const eligibilityDocument = {
    evidenceVersion: 1,
    bookingId: "booking-1",
    vendorId: "vendor-1",
    packageId: "package-1",
    packageVersion: 3,
    packageHash: "package-hash",
    stageEvidence: packageStages,
    adminUserId: "admin-1",
    eligibility,
    reason: publicDisplayReason,
    decidedAt: decidedAt.toISOString(),
  };
  hoisted.prisma.serviceVideoAdminAuditDecisionEvidence.findFirst.mockResolvedValue({
    id: "admin-audit-1",
    bookingId: "booking-1",
    vendorId: "vendor-1",
    packageId: "package-1",
    packageVersion: 3,
    packageHash: "package-hash",
    stageEvidenceJson: JSON.stringify(packageStages),
    adminUserId: "admin-1",
    decision: "PASS",
    evidenceVersion: 2,
    customerProofReleased: true,
    customerAccessGrantId: "grant-1",
    publicDisplayEligibility: eligibility,
    publicDisplayReason,
    publicEligibilityHash: createHash("sha256").update(stableJson(eligibilityDocument)).digest("hex"),
    publicEligibilityEvidenceVersion: 1,
    decidedAt,
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
    hoisted.prisma.mediaAsset.updateMany.mockResolvedValue({ count: 3 });
    hoisted.prisma.mediaLifecycleRestriction.findFirst.mockResolvedValue(null);
    hoisted.prisma.serviceVideoPackageVisibilityDecision.create.mockImplementation(({ data }: any) => {
      const created = { id: "visibility-1", ...data };
      hoisted.prisma.serviceVideoPackageVisibilityDecision.findFirst.mockResolvedValue(created);
      return Promise.resolve(created);
    });
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
    hoisted.prisma.publicServiceVideoEligibility.create.mockResolvedValue({ id: "eligibility-1" });
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

  it("blocks current-V1 Public eligibility when a protected nonparticipant may appear", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    hoisted.prisma.recordingScopeAssessment.findFirst.mockResolvedValue({
      peopleScope: "none",
      subjectJson: JSON.stringify({ protectedNonParticipantMayAppear: true }),
      scopeJson: JSON.stringify({ schemaVersion: "recording-assessment-v3-package-audio-v1" }),
      audioAllowed: false,
    });

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PUBLICATION_PROTECTED_PERSON_BLOCK");
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
  });

  it("uses the current-V1 field rather than stale historical bystander keys", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    hoisted.prisma.recordingScopeAssessment.findFirst.mockResolvedValue({
      peopleScope: "none",
      subjectJson: JSON.stringify({
        protectedNonParticipantMayAppear: false,
        includesBystander: true,
        bystanderMayAppear: true,
      }),
      scopeJson: JSON.stringify({ schemaVersion: "recording-assessment-v3-package-audio-v1" }),
      audioAllowed: false,
    });

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).resolves.toMatchObject({ proposal: { status: "AWAITING_ADMIN_REVIEW" } });
  });

  it("preserves historical bystander-key interpretation", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
    hoisted.prisma.recordingScopeAssessment.findFirst.mockResolvedValue({
      peopleScope: "none",
      subjectJson: JSON.stringify({ includesBystander: true }),
      scopeJson: JSON.stringify({ schemaVersion: "recording-assessment-v2-simplified-v1" }),
      audioAllowed: false,
    });

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PUBLICATION_PROTECTED_PERSON_BLOCK");
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
  });

  it("requires an explicit audio warning confirmation before the complete package enters Public review", async () => {
    const { decidePackageVisibility } = await import("./service-video-publication");
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
      audioExpected: true,
    });

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PACKAGE_VISIBILITY_AUDIO_CONFIRMATION_REQUIRED");

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
      audioConfirmation: true,
    })).resolves.toMatchObject({ proposal: { status: "AWAITING_ADMIN_REVIEW" } });
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

  it("publishes the complete exact package immediately when the single Reliance Audit marked it eligible", async () => {
    installImmediateAudit();
    const { decidePackageVisibility } = await import("./service-video-publication");

    const result = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });

    expect(result).toMatchObject({
      decision: { decision: "SHARE_PUBLICLY", evidenceVersion: 3 },
      proposal: {
        status: "PUBLIC",
        contractVersion: 3,
        authorizationModel: "CUSTOMER_COMPLETE_PACKAGE_IMMEDIATE_PUBLICATION",
      },
    });
    expect(hoisted.prisma.serviceVideoPublicationAdminDecision.create).not.toHaveBeenCalled();
    expect(hoisted.prisma.publicServiceVideoEligibility.create).toHaveBeenCalledTimes(3);
    expect(hoisted.prisma.publicServiceVideoEligibility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminDecisionId: "admin-audit-1",
        customerDecisionId: "visibility-1",
        packageVisibilityDecisionId: "visibility-1",
        vendorDecisionId: null,
      }),
    });
    expect(hoisted.prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { in: ["asset-intro", "asset-progress", "asset-final"] } }),
      data: { visibilityStatus: "public" },
    });
  });

  it("rejects a second Admin Public moderation decision for the immediate-publication contract", async () => {
    installImmediateAudit();
    const { decidePackageVisibility, moderatePublicationProposal } = await import("./service-video-publication");
    const authorized = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });
    hoisted.prisma.serviceVideoPublicationProposal.findUnique.mockResolvedValue(authorized.proposal);

    await expect(moderatePublicationProposal({
      proposalId: "proposal-1",
      adminUserId: "admin-2",
      decision: "APPROVED",
    })).rejects.toThrow("PUBLICATION_SECOND_ADMIN_AUDIT_NOT_ALLOWED");
    expect(hoisted.prisma.serviceVideoPublicationAdminDecision.create).not.toHaveBeenCalled();
  });

  it("keeps a Reliance Audit PASS package Private when Admin marked it Private-only", async () => {
    installImmediateAudit("PRIVATE_ONLY");
    const { decidePackageVisibility, loadPackageVisibilityView } = await import("./service-video-publication");

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PUBLICATION_PUBLIC_DISPLAY_INELIGIBLE");

    hoisted.prisma.booking.findUnique.mockResolvedValue({ id: "booking-1", userId: "customer-1", vendorId: "vendor-1" });
    const view = await loadPackageVisibilityView({ bookingId: "booking-1" });
    expect(view).toMatchObject({
      state: "PRIVATE_ONLY",
      publicDisplayEligibility: "PRIVATE_ONLY",
      publicDisplayReason: "The package contains customer-private information.",
    });
    expect(hoisted.prisma.serviceVideoPublicationProposal.create).not.toHaveBeenCalled();
  });

  it("keeps the package Private while an identifiable employee's Public-sharing permission is missing", async () => {
    installImmediateAudit();
    hoisted.prisma.recordingScopeAssessment.findFirst.mockResolvedValue({
      peopleScope: "employee",
      subjectJson: "{}",
      scopeJson: JSON.stringify({ schemaVersion: "historical-recording-scope" }),
      audioAllowed: false,
    });
    hoisted.prisma.serviceVideoStageEvidence.findUnique.mockResolvedValue({
      employeeMembershipId: "employee-membership-1",
    });
    hoisted.prisma.vendorMembership.findUnique.mockResolvedValue({ userId: "employee-1" });
    hoisted.prisma.serviceVideoPublicationStage.findMany.mockResolvedValue(packageStages.map((stage) => ({
      id: `pub-${stage.stage}`,
      proposalId: "proposal-1",
      ...stage,
      containsEmployeeLikeness: true,
      includesAudio: false,
    })));
    const { decidePackageVisibility } = await import("./service-video-publication");

    const result = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });

    expect(result.proposal).toMatchObject({ status: "AWAITING_PARTICIPANT_DECISIONS" });
    expect(hoisted.prisma.publicServiceVideoEligibility.create).not.toHaveBeenCalled();
    expect(hoisted.prisma.mediaAsset.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { visibilityStatus: "public" } }),
    );
  });

  it("makes a currently Public package Private immediately while preserving immutable decision history", async () => {
    installImmediateAudit();
    const currentDecision = {
      id: "visibility-public",
      bookingId: "booking-1",
      packageId: "package-1",
      packageVersion: 3,
      packageHash: "package-hash",
      decision: "SHARE_PUBLICLY",
      version: 2,
      isCurrent: true,
      publicationProposalId: "proposal-public",
    };
    hoisted.prisma.serviceVideoPackageVisibilityDecision.findFirst.mockResolvedValue(currentDecision);
    hoisted.prisma.serviceVideoPublicationProposal.findFirst.mockResolvedValue({
      id: "proposal-public",
      bookingId: "booking-1",
      isCurrent: true,
      contractVersion: 3,
      status: "PUBLIC",
    });
    hoisted.prisma.publicServiceVideoEligibility.findMany.mockResolvedValue(packageStages.map((stage) => ({
      id: `eligibility-${stage.stage}`,
      mediaAssetId: stage.mediaAssetId,
    })));
    const { decidePackageVisibility } = await import("./service-video-publication");

    const result = await decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "KEEP_PRIVATE",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    });

    expect(result).toMatchObject({ decision: { decision: "KEEP_PRIVATE", version: 3, evidenceVersion: 3 } });
    expect(hoisted.prisma.serviceVideoPackageVisibilityDecision.update).toHaveBeenCalledWith({
      where: { id: "visibility-public" },
      data: expect.objectContaining({ isCurrent: false }),
    });
    expect(hoisted.prisma.publicServiceVideoEligibility.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["eligibility-INTRO", "eligibility-IN_PROGRESS", "eligibility-COMPLETED"] } },
      data: expect.objectContaining({ status: "INVALIDATED" }),
    });
    expect(hoisted.prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["asset-intro", "asset-progress", "asset-final"] } },
      data: { visibilityStatus: "customer_only" },
    });
  });

  it("fails closed when a current Public restriction exists", async () => {
    installImmediateAudit();
    hoisted.prisma.mediaLifecycleRestriction.findFirst.mockResolvedValue({ id: "restriction-1" });
    const { decidePackageVisibility } = await import("./service-video-publication");

    await expect(decidePackageVisibility({
      bookingId: "booking-1",
      customerUserId: "customer-1",
      decision: "SHARE_PUBLICLY",
      verificationMethod: "SIGNED_IN_CUSTOMER_SESSION",
    })).rejects.toThrow("PUBLICATION_ACTIVE_RESTRICTION");
  });
});
