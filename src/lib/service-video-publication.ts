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
  const managerDecision = await db.serviceVideoManagerDecisionEvidence.findFirst({
    where: {
      id: pkg.managerDecisionId,
      packageId: pkg.id,
      bookingId,
      vendorId: booking.vendorId,
      decision: "PRIVATE_APPROVED",
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
      status: "ACTIVE",
      revokedAt: null,
    },
  });
  if (!managerDecision || !grant) throw new Error("PUBLICATION_PRIVATE_EVIDENCE_INCOMPLETE");
  const packageStages = parseJson<ExactPackageStage[]>(pkg.stageEvidenceJson, []);
  if (
    packageStages.length !== REQUIRED_SERVICE_VIDEO_STAGES.length ||
    !REQUIRED_SERVICE_VIDEO_STAGES.every((stage) => packageStages.filter((row) => row.stage === stage).length === 1)
  ) {
    throw new Error("PUBLICATION_PACKAGE_STAGE_SET_INVALID");
  }
  return { booking, package: pkg, managerDecision, grant, packageStages };
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
  const approved = approvedStageIds(customerDecision);
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
    const customer = await tx.serviceVideoPublicationCustomerDecision.findUnique({ where: { proposalId: proposal.id } });
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
        ? PUBLICATION_STATUSES.AWAITING_VENDOR
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
  const customer = await db.serviceVideoPublicationCustomerDecision.findUnique({ where: { proposalId: proposal.id } });
  if (!customer || customer.proposalHash !== proposal.proposalHash || !["APPROVED_ALL", "APPROVED_SOME"].includes(customer.decision)) {
    throw new Error("PUBLICATION_CUSTOMER_APPROVAL_INCOMPLETE");
  }
  const approved = approvedStageIds(customer);
  if (!approved.size) throw new Error("PUBLICATION_NO_APPROVED_STAGES");
  const requirements = await requiredParticipantRows(db, proposal, stages, customer);
  const decisions = requirements.length
    ? await db.serviceVideoPublicationParticipantDecision.findMany({ where: { proposalId: proposal.id } })
    : [];
  if (!requirements.every((required) => decisions.some((row: any) =>
    row.stageId === required.stageId && row.actorUserId === required.actorUserId && row.authorityType === required.authorityType && row.decision === "APPROVED" && row.proposalHash === proposal.proposalHash && row.presentationHash === required.presentationHash,
  ))) {
    throw new Error("PUBLICATION_PARTICIPANT_APPROVAL_INCOMPLETE");
  }
  return { customer, approved, participantDecisions: decisions };
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
    const vendorDecision = await tx.serviceVideoPublicationVendorDecision.findUnique({ where: { proposalId: proposal.id } });
    if (!vendorDecision || vendorDecision.decision !== "APPROVED" || vendorDecision.proposalHash !== proposal.proposalHash) {
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
          vendorDecisionId: vendorDecision.id,
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
            vendorDecisionId: vendorDecision.id,
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
  const [stages, customerDecision, participantDecisions, vendorDecision, adminDecision, audit] = await Promise.all([
    (prisma as any).serviceVideoPublicationStage.findMany({ where: { proposalId: proposal.id }, orderBy: { stage: "asc" } }),
    (prisma as any).serviceVideoPublicationCustomerDecision.findUnique({ where: { proposalId: proposal.id } }),
    (prisma as any).serviceVideoPublicationParticipantDecision.findMany({ where: { proposalId: proposal.id }, orderBy: { decidedAt: "asc" } }),
    (prisma as any).serviceVideoPublicationVendorDecision.findUnique({ where: { proposalId: proposal.id } }),
    (prisma as any).serviceVideoPublicationAdminDecision.findUnique({ where: { proposalId: proposal.id } }),
    (prisma as any).serviceVideoPublicationAuditEvent.findMany({ where: { proposalId: proposal.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return { proposal, stages, customerDecision, participantDecisions, vendorDecision, adminDecision, audit };
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
  const [customer, vendor, admin] = await Promise.all([
    db.serviceVideoPublicationCustomerDecision.findFirst({ where: { id: row.customerDecisionId, proposalId: proposal.id, proposalHash: proposal.proposalHash } }),
    db.serviceVideoPublicationVendorDecision.findFirst({ where: { id: row.vendorDecisionId, proposalId: proposal.id, proposalHash: proposal.proposalHash, decision: "APPROVED" } }),
    db.serviceVideoPublicationAdminDecision.findFirst({ where: { id: row.adminDecisionId, proposalId: proposal.id, proposalHash: proposal.proposalHash, decision: "APPROVED", approvedAudience: "PUBLIC" } }),
  ]);
  if (!customer || !vendor || !admin || !approvedStageIds(customer).has(stage.id)) return false;
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
