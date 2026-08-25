import { createHash } from "crypto";
import { prisma } from "@/server/db";
import { resolveCanonicalMediaLifecycle } from "@/lib/media-lifecycle";
import {
  REQUIRED_SERVICE_VIDEO_STAGES,
  type ServiceVideoStage,
} from "@/lib/service-video-evidence";

export const PUBLICATION_STATUSES = {
  AWAITING_CUSTOMER: "AWAITING_CUSTOMER_DECISION",
  AWAITING_PARTICIPANTS: "AWAITING_PARTICIPANT_DECISIONS",
  AWAITING_VENDOR: "AWAITING_VENDOR_APPROVAL",
  AWAITING_ADMIN: "AWAITING_ADMIN_REVIEW",
  CORRECTION_REQUESTED: "CORRECTION_REQUESTED",
  DECLINED_PRIVATE: "DECLINED_PRIVATE",
  ADMIN_REJECTED: "ADMIN_REJECTED",
  ADMIN_FLAGGED: "ADMIN_FLAGGED",
  PUBLIC: "PUBLIC",
  SUPERSEDED: "SUPERSEDED",
} as const;

export const PACKAGE_VISIBILITY_DECISIONS = {
  KEEP_PRIVATE: "KEEP_PRIVATE",
  SHARE_PUBLICLY: "SHARE_PUBLICLY",
} as const;

const PACKAGE_VISIBILITY_CONTRACT_VERSION = 2;
const PACKAGE_VISIBILITY_AUTHORIZATION_MODEL = "CUSTOMER_COMPLETE_PACKAGE";

export type PublicationStageInput = {
  stage: ServiceVideoStage;
  label?: string | null;
  caption?: string | null;
  containsCustomerLikeness?: boolean;
  containsEmployeeLikeness?: boolean;
  containsMinor?: boolean;
  containsBystander?: boolean;
  includesAudio?: boolean;
};

type ExactPackageStage = {
  stage: ServiceVideoStage;
  stageEvidenceId: string;
  stageVersion: number;
  mediaAssetId: string;
  contentHash: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeStage(value: unknown): ServiceVideoStage | null {
  const stage = String(value || "").trim().toUpperCase();
  return REQUIRED_SERVICE_VIDEO_STAGES.includes(stage as ServiceVideoStage)
    ? (stage as ServiceVideoStage)
    : null;
}

function isPackageVisibilityProposal(proposal: any): boolean {
  return Number(proposal?.contractVersion || 1) >= PACKAGE_VISIBILITY_CONTRACT_VERSION &&
    String(proposal?.authorizationModel || "") === PACKAGE_VISIBILITY_AUTHORIZATION_MODEL;
}

function exactPackageStageSetHash(packageStages: ExactPackageStage[]): string {
  return sha256(stableJson(
    [...packageStages]
      .sort((a, b) => a.stage.localeCompare(b.stage))
      .map((stage) => ({
        stage: stage.stage,
        stageEvidenceId: stage.stageEvidenceId,
        stageVersion: stage.stageVersion,
        mediaAssetId: stage.mediaAssetId,
        contentHash: stage.contentHash,
      })),
  ));
}

async function writeAudit(db: any, input: {
  proposalId: string;
  bookingId: string;
  vendorId: string;
  actorUserId?: string | null;
  actorRole: string;
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  const metadataJson = stableJson(input.metadata);
  return db.serviceVideoPublicationAuditEvent.create({
    data: {
      proposalId: input.proposalId,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      actorUserId: input.actorUserId || null,
      actorRole: input.actorRole,
      eventType: input.eventType,
      evidenceHash: sha256(`${input.proposalId}:${input.eventType}:${metadataJson}`),
      metadataJson,
    },
  });
}

async function loadPrivateFoundation(db: any, bookingId: string, vendorId?: string) {
  const booking = await db.booking.findFirst({
    where: { id: bookingId, ...(vendorId ? { vendorId } : {}) },
    select: { id: true, userId: true, vendorId: true, serviceId: true, status: true, title: true, clientName: true },
  });
  if (!booking || String(booking.status).toUpperCase() !== "COMPLETED") {
    throw new Error("PUBLICATION_PRIVATE_PROOF_NOT_COMPLETE");
  }
  const pkg = await db.serviceVideoPackageEvidence.findFirst({
    where: {
      bookingId,
      vendorId: booking.vendorId,
      isCurrent: true,
      status: "PRIVATE_APPROVED",
    },
    orderBy: { version: "desc" },
  });
  if (!pkg) throw new Error("PUBLICATION_PRIVATE_PACKAGE_NOT_AVAILABLE");
  const isCoreAdminPackage = Boolean(pkg.adminAuditDecisionId || pkg.auditEvidenceVersion);
  const managerDecision = await db.serviceVideoManagerDecisionEvidence.findFirst({
    where: {
      id: pkg.managerDecisionId,
      packageId: pkg.id,
      bookingId,
      vendorId: booking.vendorId,
      decision: isCoreAdminPackage ? "SUBMITTED_FOR_ADMIN_AUDIT" : "PRIVATE_APPROVED",
      packageHash: pkg.packageHash,
    },
  });
  const grant = await db.privateProofAccessGrant.findFirst({
    where: {
      id: pkg.customerAccessGrantId,
      packageId: pkg.id,
      bookingId,
      vendorId: booking.vendorId,
      customerUserId: booking.userId,
      managerDecisionId: managerDecision?.id || "",
      ...(isCoreAdminPackage ? { adminAuditDecisionId: pkg.adminAuditDecisionId || "" } : {}),
      status: "ACTIVE",
      revokedAt: null,
    },
  });
  const adminAuditDecision = isCoreAdminPackage
    ? await db.serviceVideoAdminAuditDecisionEvidence.findFirst({
        where: {
          id: pkg.adminAuditDecisionId,
          packageId: pkg.id,
          bookingId,
          vendorId: booking.vendorId,
          managerDecisionId: managerDecision?.id || "",
          packageHash: pkg.packageHash,
          decision: "PASS",
          customerProofReleased: true,
          customerAccessGrantId: grant?.id || "",
        },
      })
    : null;
  if (!managerDecision || !grant || (isCoreAdminPackage && !adminAuditDecision)) {
    throw new Error("PUBLICATION_PRIVATE_EVIDENCE_INCOMPLETE");
  }
  const packageStages = parseJson<ExactPackageStage[]>(pkg.stageEvidenceJson, []);
  if (
    packageStages.length !== REQUIRED_SERVICE_VIDEO_STAGES.length ||
    !REQUIRED_SERVICE_VIDEO_STAGES.every((stage) => packageStages.filter((row) => row.stage === stage).length === 1)
  ) {
    throw new Error("PUBLICATION_PACKAGE_STAGE_SET_INVALID");
  }
  return { booking, package: pkg, managerDecision, adminAuditDecision, grant, packageStages };
}

async function loadExactStage(db: any, foundation: Awaited<ReturnType<typeof loadPrivateFoundation>>, packaged: ExactPackageStage) {
  const stage = await db.serviceVideoStageEvidence.findFirst({
    where: {
      id: packaged.stageEvidenceId,
      bookingId: foundation.booking.id,
      vendorId: foundation.booking.vendorId,
      stage: packaged.stage,
      stageVersion: packaged.stageVersion,
      mediaAssetId: packaged.mediaAssetId,
      contentHash: packaged.contentHash,
      isCurrent: true,
      uploadState: "SAVED",
      publicEligible: true,
      captureProvenance: "LIVE_BROWSER_CAPTURE",
    },
  });
  if (!stage) throw new Error("PUBLICATION_STAGE_VERSION_NOT_ELIGIBLE");
  const [gate, session, asset] = await Promise.all([
    db.recordingGateDecisionEvidence.findFirst({
      where: {
        id: stage.recordingGateDecisionId,
        bookingId: stage.bookingId,
        vendorId: stage.vendorId,
        membershipId: stage.employeeMembershipId,
        assessmentId: stage.assessmentId,
        permissionEvidenceId: stage.permissionEvidenceId,
        decision: "ALLOWED",
      },
    }),
    db.mediaSession.findFirst({
      where: {
        id: stage.mediaSessionId,
        bookingId: stage.bookingId,
        vendorId: stage.vendorId,
        recordingGateDecisionId: stage.recordingGateDecisionId,
        capturedByMembershipId: stage.employeeMembershipId,
        status: "COMPLETED",
      },
    }),
    db.mediaAsset.findFirst({
      where: {
        id: stage.mediaAssetId,
        vendorId: stage.vendorId,
        mediaSessionId: stage.mediaSessionId,
        deletedAt: null,
        uploadState: "SAVED",
        contentHash: stage.contentHash,
        stageVersion: stage.stageVersion,
        captureProvenance: "LIVE_BROWSER_CAPTURE",
        publicEligible: true,
      },
    }),
  ]);
  if (!gate || !session || !asset) throw new Error("PUBLICATION_RECORDING_EVIDENCE_INCOMPLETE");
  return { stage, asset, session };
}

async function supersedeCurrentPublicAuthorization(db: any, bookingId: string) {
  const previousDecision = await db.serviceVideoPackageVisibilityDecision.findFirst({
    where: { bookingId, isCurrent: true },
  });
  if (previousDecision) {
    await db.serviceVideoPackageVisibilityDecision.update({
      where: { id: previousDecision.id },
      data: { isCurrent: false, supersededAt: new Date() },
    });
  }
  const previousProposal = await db.serviceVideoPublicationProposal.findFirst({
    where: {
      bookingId,
      isCurrent: true,
      contractVersion: { gte: PACKAGE_VISIBILITY_CONTRACT_VERSION },
    },
  });
  if (previousProposal) {
    await db.serviceVideoPublicationProposal.update({
      where: { id: previousProposal.id },
      data: {
        isCurrent: false,
        status: PUBLICATION_STATUSES.SUPERSEDED,
        supersededAt: new Date(),
      },
    });
    const activeEligibility = await db.publicServiceVideoEligibility.findMany({
      where: { proposalId: previousProposal.id, status: "ACTIVE" },
      select: { id: true, mediaAssetId: true },
    });
    if (activeEligibility.length) {
      await db.publicServiceVideoEligibility.updateMany({
        where: { id: { in: activeEligibility.map((row: any) => row.id) } },
        data: {
          status: "INVALIDATED",
          invalidatedAt: new Date(),
          invalidationReason: "CUSTOMER_PACKAGE_VISIBILITY_CHANGED",
        },
      });
      await db.mediaAsset.updateMany({
        where: { id: { in: activeEligibility.map((row: any) => row.mediaAssetId) } },
        data: { visibilityStatus: "customer_only" },
      });
    }
  }
}

export async function decidePackageVisibility(input: {
  bookingId: string;
  customerUserId: string;
  decision: "KEEP_PRIVATE" | "SHARE_PUBLICLY";
  verificationMethod: string;
  audioConfirmation?: boolean;
}) {
  return prisma.$transaction(async (tx: any) => {
    const decision = String(input.decision || "").trim().toUpperCase();
    if (!Object.values(PACKAGE_VISIBILITY_DECISIONS).includes(decision as any)) {
      throw new Error("PACKAGE_VISIBILITY_DECISION_INVALID");
    }
    const foundation = await loadPrivateFoundation(tx, input.bookingId);
    if (!foundation.adminAuditDecision ||
      foundation.adminAuditDecision.decision !== "PASS" ||
      foundation.adminAuditDecision.customerProofReleased !== true) {
      throw new Error("PACKAGE_VISIBILITY_CORE_ADMIN_PASS_REQUIRED");
    }
    if (foundation.booking.userId !== input.customerUserId) {
      throw new Error("PACKAGE_VISIBILITY_CUSTOMER_FORBIDDEN");
    }
    const packageIncludesAudio = Boolean(foundation.package.audioExpected);
    if (
      decision === PACKAGE_VISIBILITY_DECISIONS.SHARE_PUBLICLY &&
      packageIncludesAudio &&
      input.audioConfirmation !== true
    ) {
      throw new Error("PACKAGE_VISIBILITY_AUDIO_CONFIRMATION_REQUIRED");
    }
    const stageSetHash = exactPackageStageSetHash(foundation.packageStages);
    const existing = await tx.serviceVideoPackageVisibilityDecision.findFirst({
      where: {
        bookingId: input.bookingId,
        isCurrent: true,
        packageId: foundation.package.id,
        packageVersion: foundation.package.version,
        packageHash: foundation.package.packageHash,
      },
    });
    if (existing?.decision === decision) {
      const proposal = existing.publicationProposalId
        ? await tx.serviceVideoPublicationProposal.findUnique({ where: { id: existing.publicationProposalId } })
        : null;
      return { decision: existing, proposal, idempotent: true };
    }

    const latest = await tx.serviceVideoPackageVisibilityDecision.findFirst({
      where: { bookingId: input.bookingId },
      orderBy: { version: "desc" },
    });
    await supersedeCurrentPublicAuthorization(tx, input.bookingId);
    const version = Number(latest?.version || 0) + 1;
    const evidenceDocument = {
      evidenceVersion: PACKAGE_VISIBILITY_CONTRACT_VERSION,
      bookingId: input.bookingId,
      vendorId: foundation.booking.vendorId,
      customerUserId: input.customerUserId,
      packageId: foundation.package.id,
      packageVersion: foundation.package.version,
      packageHash: foundation.package.packageHash,
      stageSetHash,
      stages: [...foundation.packageStages].sort((a, b) => a.stage.localeCompare(b.stage)),
      decision,
      version,
      verificationMethod: input.verificationMethod,
      audioIncluded: packageIncludesAudio,
      audioConfirmation: packageIncludesAudio && decision === PACKAGE_VISIBILITY_DECISIONS.SHARE_PUBLICLY,
    };
    const decisionHash = sha256(stableJson(evidenceDocument));
    const visibilityDecision = await tx.serviceVideoPackageVisibilityDecision.create({
      data: {
        bookingId: input.bookingId,
        vendorId: foundation.booking.vendorId,
        customerUserId: input.customerUserId,
        packageId: foundation.package.id,
        packageVersion: foundation.package.version,
        packageHash: foundation.package.packageHash,
        stageEvidenceJson: stableJson(evidenceDocument.stages),
        stageSetHash,
        decision,
        version,
        isCurrent: true,
        evidenceVersion: PACKAGE_VISIBILITY_CONTRACT_VERSION,
        decisionHash,
        verificationMethod: input.verificationMethod,
      },
    });

    if (decision === PACKAGE_VISIBILITY_DECISIONS.KEEP_PRIVATE) {
      return { decision: visibilityDecision, proposal: null, idempotent: false };
    }

    const assessment = await tx.recordingScopeAssessment.findFirst({
      where: { bookingId: input.bookingId, vendorId: foundation.booking.vendorId, isCurrent: true },
      orderBy: { generation: "desc" },
      select: { peopleScope: true, subjectJson: true, audioAllowed: true },
    });
    const subject = parseJson<Record<string, unknown>>(assessment?.subjectJson, {});
    const containsMinor = subject.includesMinor === true || subject.minorMayAppear === true;
    const containsBystander = subject.includesBystander === true || subject.bystanderMayAppear === true;
    if (containsMinor || containsBystander) {
      throw new Error("PUBLICATION_PROTECTED_PERSON_BLOCK");
    }
    const peopleScope = String(assessment?.peopleScope || "none").toLowerCase();
    const containsCustomerLikeness = ["customer", "multiple"].includes(peopleScope);
    const containsEmployeeLikeness = ["employee", "multiple"].includes(peopleScope);
    const includesAudio = packageIncludesAudio;

    const exactStages = [] as Array<{
      packaged: ExactPackageStage;
      presentationJson: string;
      presentationHash: string;
    }>;
    for (const packaged of foundation.packageStages) {
      await loadExactStage(tx, foundation, packaged);
      const presentationJson = stableJson({
        stage: packaged.stage,
        audience: "PUBLIC",
        packageLevel: true,
        audioIncluded: includesAudio,
      });
      exactStages.push({
        packaged,
        presentationJson,
        presentationHash: sha256(presentationJson),
      });
    }
    exactStages.sort((a, b) => a.packaged.stage.localeCompare(b.packaged.stage));
    const proposalDocument = {
      contractVersion: PACKAGE_VISIBILITY_CONTRACT_VERSION,
      authorizationModel: PACKAGE_VISIBILITY_AUTHORIZATION_MODEL,
      visibilityDecisionId: visibilityDecision.id,
      visibilityDecisionHash: decisionHash,
      bookingId: input.bookingId,
      vendorId: foundation.booking.vendorId,
      packageId: foundation.package.id,
      packageVersion: foundation.package.version,
      packageHash: foundation.package.packageHash,
      stageSetHash,
      stages: exactStages.map(({ packaged, presentationHash }) => ({ ...packaged, presentationHash })),
    };
    const proposalHash = sha256(stableJson(proposalDocument));
    const latestProposal = await tx.serviceVideoPublicationProposal.findFirst({
      where: { bookingId: input.bookingId },
      orderBy: { version: "desc" },
    });
    const proposal = await tx.serviceVideoPublicationProposal.create({
      data: {
        bookingId: input.bookingId,
        vendorId: foundation.booking.vendorId,
        packageId: foundation.package.id,
        packageVersion: foundation.package.version,
        packageHash: foundation.package.packageHash,
        version: Number(latestProposal?.version || 0) + 1,
        isCurrent: true,
        status: PUBLICATION_STATUSES.AWAITING_ADMIN,
        audience: "PUBLIC",
        proposalHash,
        contractVersion: PACKAGE_VISIBILITY_CONTRACT_VERSION,
        authorizationModel: PACKAGE_VISIBILITY_AUTHORIZATION_MODEL,
        packageVisibilityDecisionId: visibilityDecision.id,
        proposedByUserId: input.customerUserId,
        proposedByMembershipId: null,
      },
    });
    for (const row of exactStages) {
      await tx.serviceVideoPublicationStage.create({
        data: {
          proposalId: proposal.id,
          bookingId: input.bookingId,
          stage: row.packaged.stage,
          stageEvidenceId: row.packaged.stageEvidenceId,
          mediaAssetId: row.packaged.mediaAssetId,
          stageVersion: row.packaged.stageVersion,
          contentHash: row.packaged.contentHash,
          presentationJson: row.presentationJson,
          presentationHash: row.presentationHash,
          containsCustomerLikeness,
          containsEmployeeLikeness,
          containsMinor: false,
          containsBystander: false,
          includesAudio,
        },
      });
    }
    await tx.serviceVideoPackageVisibilityDecision.update({
      where: { id: visibilityDecision.id },
      data: { publicationProposalId: proposal.id },
    });
    const stages = await tx.serviceVideoPublicationStage.findMany({ where: { proposalId: proposal.id } });
    const requirements = await requiredParticipantRows(tx, proposal, stages, visibilityDecision);
    const nextStatus = requirements.length
      ? PUBLICATION_STATUSES.AWAITING_PARTICIPANTS
      : PUBLICATION_STATUSES.AWAITING_ADMIN;
    if (nextStatus !== proposal.status) {
      await tx.serviceVideoPublicationProposal.update({ where: { id: proposal.id }, data: { status: nextStatus } });
    }
    await writeAudit(tx, {
      proposalId: proposal.id,
      bookingId: input.bookingId,
      vendorId: foundation.booking.vendorId,
      actorUserId: input.customerUserId,
      actorRole: "CUSTOMER",
      eventType: "CUSTOMER_PACKAGE_PUBLIC_SHARING_AUTHORIZED",
      metadata: {
        packageVisibilityDecisionId: visibilityDecision.id,
        decisionHash,
        proposalHash,
        stageSetHash,
        status: nextStatus,
      },
    });
    return {
      decision: { ...visibilityDecision, publicationProposalId: proposal.id },
      proposal: { ...proposal, status: nextStatus },
      idempotent: false,
    };
  });
}

export async function loadPackageVisibilityView(input: { bookingId: string }) {
  const booking = await (prisma as any).booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, userId: true, vendorId: true },
  });
  if (!booking) return null;
  const pkg = await (prisma as any).serviceVideoPackageEvidence.findFirst({
    where: { bookingId: input.bookingId, vendorId: booking.vendorId, isCurrent: true },
    orderBy: { version: "desc" },
  });
  const adminDecision = pkg?.adminAuditDecisionId
    ? await (prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst({
        where: { id: pkg.adminAuditDecisionId, packageId: pkg.id, bookingId: input.bookingId },
      })
    : null;
  const grant = pkg?.customerAccessGrantId
    ? await (prisma as any).privateProofAccessGrant.findFirst({
        where: {
          id: pkg.customerAccessGrantId,
          packageId: pkg.id,
          bookingId: input.bookingId,
          customerUserId: booking.userId,
          status: "ACTIVE",
          revokedAt: null,
        },
      })
    : null;
  const visibilityDecision = await (prisma as any).serviceVideoPackageVisibilityDecision.findFirst({
    where: { bookingId: input.bookingId, isCurrent: true },
    orderBy: { version: "desc" },
  });
  const proposal = visibilityDecision?.publicationProposalId
    ? await (prisma as any).serviceVideoPublicationProposal.findUnique({
        where: { id: visibilityDecision.publicationProposalId },
      })
    : null;
  const legacyProposal = !visibilityDecision
    ? await (prisma as any).serviceVideoPublicationProposal.findFirst({
        where: { bookingId: input.bookingId, isCurrent: true, contractVersion: 1 },
        orderBy: { version: "desc" },
      })
    : null;
  const auditPassed = adminDecision?.decision === "PASS" &&
    adminDecision?.customerProofReleased === true &&
    Boolean(grant);
  const auditFailed = adminDecision?.decision === "REJECT";
  const state = auditFailed
    ? "AUDIT_FAILED"
    : !auditPassed
      ? "AUDIT_PENDING"
      : visibilityDecision?.decision === PACKAGE_VISIBILITY_DECISIONS.SHARE_PUBLICLY
        ? proposal?.status === PUBLICATION_STATUSES.PUBLIC
          ? "PUBLIC"
          : "PUBLIC_REVIEW_PENDING"
        : visibilityDecision?.decision === PACKAGE_VISIBILITY_DECISIONS.KEEP_PRIVATE
          ? "PRIVATE"
          : "PRIVATE_DEFAULT";
  return {
    state,
    auditPassed,
    privateProofReleased: auditPassed,
    package: pkg ? { id: pkg.id, version: pkg.version, packageHash: pkg.packageHash, audioIncluded: Boolean(pkg.audioExpected) } : null,
    visibilityDecision,
    proposal,
    legacyProposal,
  };
}

export async function createPublicationProposal(input: {
  bookingId: string;
  vendorId: string;
  proposedByUserId: string;
  proposedByMembershipId: string;
  stages?: PublicationStageInput[];
}) {
  return prisma.$transaction(async (tx: any) => {
    const foundation = await loadPrivateFoundation(tx, input.bookingId, input.vendorId);
    const requested = input.stages?.length
      ? input.stages
      : [{ stage: "COMPLETED" as ServiceVideoStage }];
    const normalized = requested.map((row) => ({ ...row, stage: normalizeStage(row.stage) }));
    if (normalized.some((row) => !row.stage) || new Set(normalized.map((row) => row.stage)).size !== normalized.length) {
      throw new Error("PUBLICATION_STAGE_SELECTION_INVALID");
    }
    if (normalized.some((row) => row.containsMinor)) {
      throw new Error("PUBLICATION_IDENTIFIABLE_MINOR_PROHIBITED");
    }
    if (normalized.some((row) => row.containsBystander)) {
      throw new Error("PUBLICATION_BYSTANDER_REQUIRES_CORRECTION");
    }

    const exactStages: Array<{ input: PublicationStageInput & { stage: ServiceVideoStage }; packaged: ExactPackageStage; exact: any; presentationJson: string; presentationHash: string }> = [];
    for (const row of normalized as Array<PublicationStageInput & { stage: ServiceVideoStage }>) {
      const packaged = foundation.packageStages.find((candidate) => candidate.stage === row.stage);
      if (!packaged) throw new Error("PUBLICATION_STAGE_NOT_IN_PRIVATE_PACKAGE");
      const exact = await loadExactStage(tx, foundation, packaged);
      const presentation = {
        stage: row.stage,
        label: String(row.label || row.stage).trim(),
        caption: String(row.caption || "").trim(),
        audience: "PUBLIC",
        audioIncluded: row.includesAudio === true,
      };
      const presentationJson = stableJson(presentation);
      exactStages.push({ input: row, packaged, exact, presentationJson, presentationHash: sha256(presentationJson) });
    }
    exactStages.sort((a, b) => a.input.stage.localeCompare(b.input.stage));
    const proposalDocument = {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      packageId: foundation.package.id,
      packageVersion: foundation.package.version,
      packageHash: foundation.package.packageHash,
      audience: "PUBLIC",
      stages: exactStages.map((row) => ({
        stage: row.input.stage,
        stageEvidenceId: row.packaged.stageEvidenceId,
        mediaAssetId: row.packaged.mediaAssetId,
        stageVersion: row.packaged.stageVersion,
        contentHash: row.packaged.contentHash,
        presentationHash: row.presentationHash,
        containsCustomerLikeness: row.input.containsCustomerLikeness === true,
        containsEmployeeLikeness: row.input.containsEmployeeLikeness === true,
        containsMinor: false,
        containsBystander: false,
        includesAudio: row.input.includesAudio === true,
      })),
    };
    const proposalHash = sha256(stableJson(proposalDocument));
    const latest = await tx.serviceVideoPublicationProposal.findFirst({
      where: { bookingId: input.bookingId },
      orderBy: { version: "desc" },
    });

    const previous = await tx.serviceVideoPublicationProposal.findFirst({
      where: { bookingId: input.bookingId, isCurrent: true },
    });
    if (previous) {
      await tx.serviceVideoPublicationProposal.update({
        where: { id: previous.id },
        data: { isCurrent: false, status: PUBLICATION_STATUSES.SUPERSEDED, supersededAt: new Date() },
      });
      const previousEligibility = await tx.publicServiceVideoEligibility.findMany({
        where: { proposalId: previous.id, status: "ACTIVE" },
        select: { id: true, mediaAssetId: true },
      });
      if (previousEligibility.length) {
        await tx.publicServiceVideoEligibility.updateMany({
          where: { id: { in: previousEligibility.map((row: any) => row.id) } },
          data: { status: "INVALIDATED", invalidatedAt: new Date(), invalidationReason: "SUPERSEDED_PUBLICATION_PROPOSAL" },
        });
        await tx.mediaAsset.updateMany({
          where: { id: { in: previousEligibility.map((row: any) => row.mediaAssetId) } },
          data: { visibilityStatus: "customer_only" },
        });
      }
    }

    const proposal = await tx.serviceVideoPublicationProposal.create({
      data: {
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        packageId: foundation.package.id,
        packageVersion: foundation.package.version,
        packageHash: foundation.package.packageHash,
        version: Number(latest?.version || 0) + 1,
        isCurrent: true,
        status: PUBLICATION_STATUSES.AWAITING_CUSTOMER,
        audience: "PUBLIC",
        proposalHash,
        proposedByUserId: input.proposedByUserId,
        proposedByMembershipId: input.proposedByMembershipId,
      },
    });
    for (const row of exactStages) {
      await tx.serviceVideoPublicationStage.create({
        data: {
          proposalId: proposal.id,
          bookingId: input.bookingId,
          stage: row.input.stage,
          stageEvidenceId: row.packaged.stageEvidenceId,
          mediaAssetId: row.packaged.mediaAssetId,
          stageVersion: row.packaged.stageVersion,
          contentHash: row.packaged.contentHash,
          presentationJson: row.presentationJson,
          presentationHash: row.presentationHash,
          containsCustomerLikeness: row.input.containsCustomerLikeness === true,
          containsEmployeeLikeness: row.input.containsEmployeeLikeness === true,
          containsMinor: false,
          containsBystander: false,
          includesAudio: row.input.includesAudio === true,
        },
      });
    }
    await writeAudit(tx, {
      proposalId: proposal.id,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      actorUserId: input.proposedByUserId,
      actorRole: "VENDOR_MANAGER",
      eventType: "PUBLICATION_PROPOSED",
      metadata: { proposalHash, packageHash: foundation.package.packageHash, stages: exactStages.map((row) => row.input.stage) },
    });
    return proposal;
  });
}

function approvedStageIds(decision: any): Set<string> {
  const payload = parseJson<{ stages?: Record<string, string> }>(decision?.decisionJson, {});
  return new Set(
    Object.entries(payload.stages || {})
      .filter(([, value]) => String(value).toUpperCase() === "APPROVED")
      .map(([key]) => key),
  );
}

async function requiredParticipantRows(db: any, proposal: any, stages: any[], customerDecision: any) {
  const approved = isPackageVisibilityProposal(proposal)
    ? new Set(stages.map((stage) => stage.id))
    : approvedStageIds(customerDecision);
  const requirements: Array<{ stageId: string; actorUserId: string; authorityType: string; presentationHash: string }> = [];
  for (const stage of stages.filter((row) => approved.has(row.id))) {
    if (!stage.containsEmployeeLikeness && !stage.includesAudio) continue;
    const evidence = await db.serviceVideoStageEvidence.findUnique({ where: { id: stage.stageEvidenceId } });
    const membership = evidence
      ? await db.vendorMembership.findUnique({ where: { id: evidence.employeeMembershipId }, select: { userId: true } })
      : null;
    if (!membership?.userId) throw new Error("PUBLICATION_PARTICIPANT_AUTHORITY_UNRESOLVED");
    if (stage.containsEmployeeLikeness) {
      requirements.push({ stageId: stage.id, actorUserId: membership.userId, authorityType: "EMPLOYEE_LIKENESS", presentationHash: stage.presentationHash });
    }
    if (stage.includesAudio) {
      requirements.push({ stageId: stage.id, actorUserId: membership.userId, authorityType: "EMPLOYEE_AUDIO", presentationHash: stage.presentationHash });
    }
  }
  return requirements;
}

async function publicationContext(db: any, proposalId: string) {
  const proposal = await db.serviceVideoPublicationProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || !proposal.isCurrent) throw new Error("PUBLICATION_PROPOSAL_NOT_CURRENT");
  const stages = await db.serviceVideoPublicationStage.findMany({ where: { proposalId }, orderBy: { stage: "asc" } });
  if (!stages.length) throw new Error("PUBLICATION_PROPOSAL_EMPTY");
  return { proposal, stages };
}

export async function decidePublicationAsCustomer(input: {
  proposalId: string;
  customerUserId: string;
  stageDecisions: Record<string, "APPROVED" | "DECLINED">;
  requestCorrection?: boolean;
  reason?: string | null;
  verificationMethod: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const { proposal, stages } = await publicationContext(tx, input.proposalId);
    if (proposal.status !== PUBLICATION_STATUSES.AWAITING_CUSTOMER) throw new Error("PUBLICATION_CUSTOMER_DECISION_CLOSED");
    const foundation = await loadPrivateFoundation(tx, proposal.bookingId, proposal.vendorId);
    if (foundation.booking.userId !== input.customerUserId || foundation.package.id !== proposal.packageId || foundation.package.packageHash !== proposal.packageHash) {
      throw new Error("PUBLICATION_CUSTOMER_FORBIDDEN");
    }
    const stageMap: Record<string, string> = {};
    for (const stage of stages) {
      const decision = input.requestCorrection ? "CORRECTION_REQUESTED" : String(input.stageDecisions[stage.id] || "DECLINED").toUpperCase();
      if (!["APPROVED", "DECLINED", "CORRECTION_REQUESTED"].includes(decision)) throw new Error("PUBLICATION_CUSTOMER_DECISION_INVALID");
      stageMap[stage.id] = decision;
    }
    const approvedCount = Object.values(stageMap).filter((value) => value === "APPROVED").length;
    const decision = input.requestCorrection
      ? "CORRECTION_REQUESTED"
      : approvedCount === 0
        ? "DECLINED"
        : approvedCount === stages.length
          ? "APPROVED_ALL"
          : "APPROVED_SOME";
    const decisionJson = stableJson({ stages: stageMap, audience: "PUBLIC" });
    const decisionHash = sha256(`${proposal.proposalHash}:${decision}:${decisionJson}:${input.customerUserId}`);
    const record = await tx.serviceVideoPublicationCustomerDecision.create({
      data: {
        proposalId: proposal.id,
        bookingId: proposal.bookingId,
        customerUserId: input.customerUserId,
        authorityRole: "CUSTOMER",
        decision,
        decisionJson,
        decisionHash,
        packageHash: proposal.packageHash,
        proposalHash: proposal.proposalHash,
        verificationMethod: input.verificationMethod,
        reason: input.reason || null,
      },
    });
    let nextStatus: string = PUBLICATION_STATUSES.DECLINED_PRIVATE;
    if (input.requestCorrection) nextStatus = PUBLICATION_STATUSES.CORRECTION_REQUESTED;
    else if (approvedCount) {
      const requirements = await requiredParticipantRows(tx, proposal, stages, record);
      nextStatus = requirements.length ? PUBLICATION_STATUSES.AWAITING_PARTICIPANTS : PUBLICATION_STATUSES.AWAITING_VENDOR;
    }
    await tx.serviceVideoPublicationProposal.update({ where: { id: proposal.id }, data: { status: nextStatus } });
    await writeAudit(tx, {
      proposalId: proposal.id,
      bookingId: proposal.bookingId,
      vendorId: proposal.vendorId,
      actorUserId: input.customerUserId,
      actorRole: "CUSTOMER",
      eventType: "CUSTOMER_PUBLICATION_DECIDED",
      metadata: { decision, decisionHash, approvedCount, proposalHash: proposal.proposalHash },
    });
    return { decision: record, status: nextStatus };
  });
}

export async function decidePublicationAsParticipant(input: {
  proposalId: string;
  actorUserId: string;
  decisions: Array<{ stageId: string; authorityType: "EMPLOYEE_LIKENESS" | "EMPLOYEE_AUDIO"; decision: "APPROVED" | "DECLINED" }>;
  verificationMethod: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const { proposal, stages } = await publicationContext(tx, input.proposalId);
    if (proposal.status !== PUBLICATION_STATUSES.AWAITING_PARTICIPANTS) throw new Error("PUBLICATION_PARTICIPANT_DECISION_CLOSED");
    const customer = isPackageVisibilityProposal(proposal)
      ? await tx.serviceVideoPackageVisibilityDecision.findFirst({
          where: {
            id: proposal.packageVisibilityDecisionId,
            bookingId: proposal.bookingId,
            isCurrent: true,
            decision: PACKAGE_VISIBILITY_DECISIONS.SHARE_PUBLICLY,
          },
        })
      : await tx.serviceVideoPublicationCustomerDecision.findUnique({ where: { proposalId: proposal.id } });
    if (!customer) throw new Error("PUBLICATION_CUSTOMER_DECISION_MISSING");
    const requirements = await requiredParticipantRows(tx, proposal, stages, customer);
    const actorRequirements = requirements.filter((row) => row.actorUserId === input.actorUserId);
    if (!actorRequirements.length) throw new Error("PUBLICATION_PARTICIPANT_FORBIDDEN");
    for (const decision of input.decisions) {
      const required = actorRequirements.find((row) => row.stageId === decision.stageId && row.authorityType === decision.authorityType);
      if (!required) throw new Error("PUBLICATION_PARTICIPANT_FORBIDDEN");
      const decisionHash = sha256(`${proposal.proposalHash}:${required.presentationHash}:${input.actorUserId}:${decision.authorityType}:${decision.decision}`);
      await tx.serviceVideoPublicationParticipantDecision.create({
        data: {
          proposalId: proposal.id,
          stageId: decision.stageId,
          bookingId: proposal.bookingId,
          actorUserId: input.actorUserId,
          authorityType: decision.authorityType,
          decision: decision.decision,
          decisionHash,
          proposalHash: proposal.proposalHash,
          presentationHash: required.presentationHash,
          verificationMethod: input.verificationMethod,
        },
      });
    }
    const recorded = await tx.serviceVideoPublicationParticipantDecision.findMany({ where: { proposalId: proposal.id } });
    const declined = recorded.some((row: any) => row.decision === "DECLINED");
    const complete = requirements.every((required) => recorded.some((row: any) =>
      row.stageId === required.stageId && row.actorUserId === required.actorUserId && row.authorityType === required.authorityType && row.decision === "APPROVED" && row.presentationHash === required.presentationHash,
    ));
    const nextStatus = declined
      ? PUBLICATION_STATUSES.DECLINED_PRIVATE
      : complete
        ? isPackageVisibilityProposal(proposal)
          ? PUBLICATION_STATUSES.AWAITING_ADMIN
          : PUBLICATION_STATUSES.AWAITING_VENDOR
        : PUBLICATION_STATUSES.AWAITING_PARTICIPANTS;
    await tx.serviceVideoPublicationProposal.update({ where: { id: proposal.id }, data: { status: nextStatus } });
    await writeAudit(tx, {
      proposalId: proposal.id,
      bookingId: proposal.bookingId,
      vendorId: proposal.vendorId,
      actorUserId: input.actorUserId,
      actorRole: "PARTICIPANT",
      eventType: "PARTICIPANT_PUBLICATION_DECIDED",
      metadata: { status: nextStatus, decisionCount: input.decisions.length, proposalHash: proposal.proposalHash },
    });
    return { status: nextStatus };
  });
}

async function assertRequiredDecisions(db: any, proposal: any, stages: any[]) {
  const packageLevel = isPackageVisibilityProposal(proposal);
  const customer = packageLevel
    ? await db.serviceVideoPackageVisibilityDecision.findFirst({
        where: {
          id: proposal.packageVisibilityDecisionId,
          bookingId: proposal.bookingId,
          packageId: proposal.packageId,
          packageVersion: proposal.packageVersion,
          packageHash: proposal.packageHash,
          isCurrent: true,
          decision: PACKAGE_VISIBILITY_DECISIONS.SHARE_PUBLICLY,
        },
      })
    : await db.serviceVideoPublicationCustomerDecision.findUnique({ where: { proposalId: proposal.id } });
  if (!customer || (!packageLevel && (customer.proposalHash !== proposal.proposalHash || !["APPROVED_ALL", "APPROVED_SOME"].includes(customer.decision)))) {
    throw new Error("PUBLICATION_CUSTOMER_APPROVAL_INCOMPLETE");
  }
  const approved = packageLevel
    ? new Set(stages.map((stage) => stage.id))
    : approvedStageIds(customer);
  if (!approved.size) throw new Error("PUBLICATION_NO_APPROVED_STAGES");
  if (packageLevel) {
    if (stages.length !== REQUIRED_SERVICE_VIDEO_STAGES.length ||
      !REQUIRED_SERVICE_VIDEO_STAGES.every((stage) => stages.filter((row) => row.stage === stage).length === 1)) {
      throw new Error("PUBLICATION_COMPLETE_PACKAGE_REQUIRED");
    }
    const stageSetHash = exactPackageStageSetHash(stages.map((stage) => ({
      stage: stage.stage,
      stageEvidenceId: stage.stageEvidenceId,
      stageVersion: stage.stageVersion,
      mediaAssetId: stage.mediaAssetId,
      contentHash: stage.contentHash,
    })));
    if (customer.stageSetHash !== stageSetHash) throw new Error("PUBLICATION_PACKAGE_STAGE_SET_MISMATCH");
  }
  const requirements = await requiredParticipantRows(db, proposal, stages, customer);
  const decisions = requirements.length
    ? await db.serviceVideoPublicationParticipantDecision.findMany({ where: { proposalId: proposal.id } })
    : [];
  if (!requirements.every((required) => decisions.some((row: any) =>
    row.stageId === required.stageId && row.actorUserId === required.actorUserId && row.authorityType === required.authorityType && row.decision === "APPROVED" && row.proposalHash === proposal.proposalHash && row.presentationHash === required.presentationHash,
  ))) {
    throw new Error("PUBLICATION_PARTICIPANT_APPROVAL_INCOMPLETE");
  }
  return { customer, approved, participantDecisions: decisions, packageLevel };
}

export async function approveVendorPublicationRepresentation(input: {
  proposalId: string;
  vendorId: string;
  managerUserId: string;
  managerMembershipId: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const { proposal, stages } = await publicationContext(tx, input.proposalId);
    if (proposal.vendorId !== input.vendorId || proposal.status !== PUBLICATION_STATUSES.AWAITING_VENDOR) {
      throw new Error("PUBLICATION_VENDOR_DECISION_NOT_ALLOWED");
    }
    await loadPrivateFoundation(tx, proposal.bookingId, proposal.vendorId);
    await assertRequiredDecisions(tx, proposal, stages);
    const decisionHash = sha256(`${proposal.proposalHash}:${input.vendorId}:${input.managerUserId}:APPROVED`);
    const decision = await tx.serviceVideoPublicationVendorDecision.create({
      data: {
        proposalId: proposal.id,
        bookingId: proposal.bookingId,
        vendorId: proposal.vendorId,
        managerUserId: input.managerUserId,
        managerMembershipId: input.managerMembershipId,
        decision: "APPROVED",
        decisionHash,
        proposalHash: proposal.proposalHash,
      },
    });
    await tx.serviceVideoPublicationProposal.update({ where: { id: proposal.id }, data: { status: PUBLICATION_STATUSES.AWAITING_ADMIN } });
    await writeAudit(tx, {
      proposalId: proposal.id,
      bookingId: proposal.bookingId,
      vendorId: proposal.vendorId,
      actorUserId: input.managerUserId,
      actorRole: "VENDOR_MANAGER",
      eventType: "VENDOR_REPRESENTATION_APPROVED",
      metadata: { decisionHash, proposalHash: proposal.proposalHash },
    });
    return decision;
  });
}

export async function moderatePublicationProposal(input: {
  proposalId: string;
  adminUserId: string;
  decision: "APPROVED" | "REJECTED" | "FLAGGED" | "CORRECTION_REQUESTED";
  reason?: string | null;
}) {
  return prisma.$transaction(async (tx: any) => {
    const { proposal, stages } = await publicationContext(tx, input.proposalId);
    if (proposal.status !== PUBLICATION_STATUSES.AWAITING_ADMIN) throw new Error("PUBLICATION_NOT_READY_FOR_ADMIN");
    const foundation = await loadPrivateFoundation(tx, proposal.bookingId, proposal.vendorId);
    if (foundation.package.id !== proposal.packageId || foundation.package.packageHash !== proposal.packageHash || Number(foundation.package.version) !== Number(proposal.packageVersion)) {
      throw new Error("PUBLICATION_PACKAGE_VERSION_MISMATCH");
    }
    const approvals = await assertRequiredDecisions(tx, proposal, stages);
    const vendorDecision = isPackageVisibilityProposal(proposal)
      ? null
      : await tx.serviceVideoPublicationVendorDecision.findUnique({ where: { proposalId: proposal.id } });
    if (!isPackageVisibilityProposal(proposal) && (!vendorDecision || vendorDecision.decision !== "APPROVED" || vendorDecision.proposalHash !== proposal.proposalHash)) {
      throw new Error("PUBLICATION_VENDOR_APPROVAL_INCOMPLETE");
    }
    for (const stage of stages.filter((row: any) => approvals.approved.has(row.id))) {
      if (stage.containsMinor || stage.containsBystander) throw new Error("PUBLICATION_PROTECTED_PERSON_BLOCK");
      const packaged = foundation.packageStages.find((row: ExactPackageStage) => row.stageEvidenceId === stage.stageEvidenceId);
      if (!packaged || packaged.mediaAssetId !== stage.mediaAssetId || packaged.contentHash !== stage.contentHash || Number(packaged.stageVersion) !== Number(stage.stageVersion)) {
        throw new Error("PUBLICATION_STAGE_VERSION_MISMATCH");
      }
      await loadExactStage(tx, foundation, packaged);
    }
    const decisionHash = sha256(`${proposal.proposalHash}:${input.adminUserId}:${input.decision}:${input.reason || ""}`);
    const adminDecision = await tx.serviceVideoPublicationAdminDecision.create({
      data: {
        proposalId: proposal.id,
        bookingId: proposal.bookingId,
        adminUserId: input.adminUserId,
        decision: input.decision,
        approvedAudience: input.decision === "APPROVED" ? "PUBLIC" : null,
        decisionHash,
        proposalHash: proposal.proposalHash,
        reason: input.reason || null,
      },
    });
    let nextStatus: string = PUBLICATION_STATUSES.ADMIN_REJECTED;
    if (input.decision === "FLAGGED") nextStatus = PUBLICATION_STATUSES.ADMIN_FLAGGED;
    if (input.decision === "CORRECTION_REQUESTED") nextStatus = PUBLICATION_STATUSES.CORRECTION_REQUESTED;
    if (input.decision === "APPROVED") {
      nextStatus = PUBLICATION_STATUSES.PUBLIC;
      for (const stage of stages.filter((row: any) => approvals.approved.has(row.id))) {
        const relatedParticipantIds = approvals.participantDecisions
          .filter((row: any) => row.stageId === stage.id)
          .map((row: any) => row.id)
          .sort();
        const eligibilityDocument = {
          proposalHash: proposal.proposalHash,
          packageHash: proposal.packageHash,
          presentationHash: stage.presentationHash,
          contentHash: stage.contentHash,
          customerDecisionId: approvals.customer.id,
          vendorDecisionId: vendorDecision?.id || null,
          packageVisibilityDecisionId: approvals.packageLevel ? approvals.customer.id : null,
          adminDecisionId: adminDecision.id,
          participantDecisionIds: relatedParticipantIds,
          audience: "PUBLIC",
        };
        await tx.publicServiceVideoEligibility.create({
          data: {
            proposalId: proposal.id,
            stageId: stage.id,
            bookingId: proposal.bookingId,
            vendorId: proposal.vendorId,
            mediaAssetId: stage.mediaAssetId,
            packageId: proposal.packageId,
            packageHash: proposal.packageHash,
            proposalHash: proposal.proposalHash,
            presentationHash: stage.presentationHash,
            contentHash: stage.contentHash,
            eligibilityHash: sha256(stableJson(eligibilityDocument)),
            audience: "PUBLIC",
            status: "ACTIVE",
            adminDecisionId: adminDecision.id,
            customerDecisionId: approvals.customer.id,
            vendorDecisionId: vendorDecision?.id || null,
            packageVisibilityDecisionId: approvals.packageLevel ? approvals.customer.id : null,
            participantDecisionIdsJson: stableJson(relatedParticipantIds),
          },
        });
      }
      const approvedAssetIds = stages.filter((row: any) => approvals.approved.has(row.id)).map((row: any) => row.mediaAssetId);
      await tx.mediaAsset.updateMany({ where: { id: { in: approvedAssetIds } }, data: { moderationStatus: "approved", visibilityStatus: "public", moderatedByUserId: input.adminUserId, moderatedAt: new Date(), moderationReason: null } });
      await tx.mediaAsset.updateMany({ where: { id: { in: stages.filter((row: any) => !approvals.approved.has(row.id)).map((row: any) => row.mediaAssetId) } }, data: { visibilityStatus: "customer_only" } });
    } else {
      await tx.mediaAsset.updateMany({ where: { id: { in: stages.map((row: any) => row.mediaAssetId) } }, data: { visibilityStatus: "customer_only" } });
    }
    await tx.serviceVideoPublicationProposal.update({ where: { id: proposal.id }, data: { status: nextStatus } });
    await writeAudit(tx, {
      proposalId: proposal.id,
      bookingId: proposal.bookingId,
      vendorId: proposal.vendorId,
      actorUserId: input.adminUserId,
      actorRole: "ADMIN",
      eventType: "ADMIN_PUBLICATION_DECIDED",
      metadata: { decision: input.decision, decisionHash, proposalHash: proposal.proposalHash, status: nextStatus },
    });
    return { adminDecision, status: nextStatus };
  });
}

export async function loadPublicationView(input: { bookingId: string; proposalId?: string }) {
  const proposal = input.proposalId
    ? await (prisma as any).serviceVideoPublicationProposal.findFirst({ where: { id: input.proposalId, bookingId: input.bookingId } })
    : await (prisma as any).serviceVideoPublicationProposal.findFirst({ where: { bookingId: input.bookingId, isCurrent: true }, orderBy: { version: "desc" } });
  if (!proposal) return null;
  const [stages, customerDecision, packageVisibilityDecision, participantDecisions, vendorDecision, adminDecision, audit] = await Promise.all([
    (prisma as any).serviceVideoPublicationStage.findMany({ where: { proposalId: proposal.id }, orderBy: { stage: "asc" } }),
    (prisma as any).serviceVideoPublicationCustomerDecision.findUnique({ where: { proposalId: proposal.id } }),
    proposal.packageVisibilityDecisionId
      ? (prisma as any).serviceVideoPackageVisibilityDecision.findUnique({ where: { id: proposal.packageVisibilityDecisionId } })
      : null,
    (prisma as any).serviceVideoPublicationParticipantDecision.findMany({ where: { proposalId: proposal.id }, orderBy: { decidedAt: "asc" } }),
    (prisma as any).serviceVideoPublicationVendorDecision.findUnique({ where: { proposalId: proposal.id } }),
    (prisma as any).serviceVideoPublicationAdminDecision.findUnique({ where: { proposalId: proposal.id } }),
    (prisma as any).serviceVideoPublicationAuditEvent.findMany({ where: { proposalId: proposal.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return { proposal, stages, customerDecision, packageVisibilityDecision, participantDecisions, vendorDecision, adminDecision, audit };
}

async function canonicalEligibilityValid(db: any, row: any, filters?: { serviceId?: string }) {
  const proposal = await db.serviceVideoPublicationProposal.findFirst({
    where: { id: row.proposalId, bookingId: row.bookingId, vendorId: row.vendorId, isCurrent: true, status: PUBLICATION_STATUSES.PUBLIC, proposalHash: row.proposalHash, packageId: row.packageId, packageHash: row.packageHash },
  });
  if (!proposal) return false;
  const foundation = await loadPrivateFoundation(db, row.bookingId, row.vendorId).catch(() => null);
  if (!foundation || foundation.package.id !== row.packageId || foundation.package.packageHash !== row.packageHash || Number(foundation.package.version) !== Number(proposal.packageVersion)) return false;
  const stage = await db.serviceVideoPublicationStage.findFirst({
    where: { id: row.stageId, proposalId: proposal.id, mediaAssetId: row.mediaAssetId, contentHash: row.contentHash, presentationHash: row.presentationHash },
  });
  if (!stage || stage.containsMinor || stage.containsBystander) return false;
  const packaged = foundation.packageStages.find((candidate) => candidate.stageEvidenceId === stage.stageEvidenceId);
  if (!packaged || packaged.mediaAssetId !== row.mediaAssetId || packaged.contentHash !== row.contentHash || Number(packaged.stageVersion) !== Number(stage.stageVersion)) return false;
  const exact = await loadExactStage(db, foundation, packaged).catch(() => null);
  if (!exact) return false;
  if (filters?.serviceId && exact.session.serviceId !== filters.serviceId) return false;
  const packageLevel = isPackageVisibilityProposal(proposal);
  const [customer, vendor, admin] = await Promise.all([
    packageLevel
      ? db.serviceVideoPackageVisibilityDecision.findFirst({
          where: {
            id: row.packageVisibilityDecisionId,
            bookingId: proposal.bookingId,
            packageId: proposal.packageId,
            packageVersion: proposal.packageVersion,
            packageHash: proposal.packageHash,
            isCurrent: true,
            decision: PACKAGE_VISIBILITY_DECISIONS.SHARE_PUBLICLY,
          },
        })
      : db.serviceVideoPublicationCustomerDecision.findFirst({ where: { id: row.customerDecisionId, proposalId: proposal.id, proposalHash: proposal.proposalHash } }),
    packageLevel
      ? Promise.resolve(null)
      : db.serviceVideoPublicationVendorDecision.findFirst({ where: { id: row.vendorDecisionId, proposalId: proposal.id, proposalHash: proposal.proposalHash, decision: "APPROVED" } }),
    db.serviceVideoPublicationAdminDecision.findFirst({ where: { id: row.adminDecisionId, proposalId: proposal.id, proposalHash: proposal.proposalHash, decision: "APPROVED", approvedAudience: "PUBLIC" } }),
  ]);
  if (!customer || (!packageLevel && !vendor) || !admin || (!packageLevel && !approvedStageIds(customer).has(stage.id))) return false;
  if (packageLevel) {
    const proposalStages = await db.serviceVideoPublicationStage.findMany({ where: { proposalId: proposal.id } });
    if (proposalStages.length !== REQUIRED_SERVICE_VIDEO_STAGES.length ||
      !REQUIRED_SERVICE_VIDEO_STAGES.every((required) => proposalStages.filter((row: any) => row.stage === required).length === 1)) return false;
    const stageSetHash = exactPackageStageSetHash(proposalStages.map((row: any) => ({
      stage: row.stage,
      stageEvidenceId: row.stageEvidenceId,
      stageVersion: row.stageVersion,
      mediaAssetId: row.mediaAssetId,
      contentHash: row.contentHash,
    })));
    if (customer.stageSetHash !== stageSetHash) return false;
  }
  const requirements = await requiredParticipantRows(db, proposal, [stage], customer);
  const expectedParticipantIds = parseJson<string[]>(row.participantDecisionIdsJson, []);
  if (requirements.length) {
    const decisions = await db.serviceVideoPublicationParticipantDecision.findMany({ where: { id: { in: expectedParticipantIds }, proposalId: proposal.id, stageId: stage.id, decision: "APPROVED", proposalHash: proposal.proposalHash, presentationHash: stage.presentationHash } });
    if (!requirements.every((required) => decisions.some((decision: any) => decision.actorUserId === required.actorUserId && decision.authorityType === required.authorityType))) return false;
  }
  return exact.asset.visibilityStatus === "public" && exact.asset.moderationStatus === "approved";
}

export async function resolveCanonicalPublicAssetIds(filters: { bookingId?: string; vendorId?: string; serviceId?: string } = {}) {
  const rows = await (prisma as any).publicServiceVideoEligibility.findMany({
    where: {
      status: "ACTIVE",
      audience: "PUBLIC",
      invalidatedAt: null,
      ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    },
    orderBy: { eligibleAt: "desc" },
  });
  const valid: string[] = [];
  for (const row of rows) {
    if (!(await canonicalEligibilityValid(prisma as any, row, { serviceId: filters.serviceId }))) continue;
    const lifecycle = await resolveCanonicalMediaLifecycle({
      bookingId: row.bookingId,
      mediaAssetId: row.mediaAssetId,
      intendedAudience: "PUBLIC",
    });
    if (lifecycle.publicAllowed) valid.push(row.mediaAssetId);
  }
  return valid;
}

export async function listAdminPublicationQueue() {
  const proposals = await (prisma as any).serviceVideoPublicationProposal.findMany({
    where: { isCurrent: true, status: PUBLICATION_STATUSES.AWAITING_ADMIN },
    orderBy: { updatedAt: "asc" },
  });
  const result = [];
  for (const proposal of proposals) {
    const view = await loadPublicationView({ bookingId: proposal.bookingId, proposalId: proposal.id });
    if (!view) continue;
    const booking = await (prisma as any).booking.findUnique({
      where: { id: proposal.bookingId },
      select: { title: true, clientName: true, vendor: { select: { businessName: true, name: true } }, service: { select: { name: true } } },
    });
    result.push({ ...view, booking });
  }
  return result;
}
