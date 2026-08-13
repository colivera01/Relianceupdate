import { createHash } from "crypto";
import { resolveCanonicalMediaLifecycle } from "@/lib/media-lifecycle";
import { prisma } from "@/server/db";
import type { RecordingPermissionGate, RecordingGateSurface } from "@/lib/consent/recording-gate";

export const REQUIRED_SERVICE_VIDEO_STAGES = ["INTRO", "IN_PROGRESS", "COMPLETED"] as const;
export type ServiceVideoStage = (typeof REQUIRED_SERVICE_VIDEO_STAGES)[number];
export type CaptureProvenance = "LIVE_BROWSER_CAPTURE" | "PRERECORDED_FALLBACK";
export type TruthfulUploadState = "UPLOADING" | "SAVED" | "RETRY_REQUIRED" | "REJECTED";

export class ServiceVideoMutationBlockedError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ServiceVideoMutationBlockedError";
  }
}

export async function assertServiceVideoStageMutationAllowed(
  db: any,
  input: { bookingId: string; vendorId: string; stage: ServiceVideoStage },
) {
  const booking = await db.booking.findFirst({
    where: { id: input.bookingId, vendorId: input.vendorId },
    select: { id: true, status: true },
  });
  if (!booking) throw new ServiceVideoMutationBlockedError("WORK_RECORD_NOT_FOUND");

  const currentPackage = await db.serviceVideoPackageEvidence.findFirst({
    where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
    select: { status: true, managerDecisionId: true },
  });
  if (
    String(booking.status || "").toUpperCase() === "AWAITING_REVIEW" ||
    String(currentPackage?.status || "").toUpperCase() === "AWAITING_MANAGER_REVIEW"
  ) {
    throw new ServiceVideoMutationBlockedError("MANAGER_REVIEW_IN_PROGRESS");
  }

  if (String(currentPackage?.status || "").toUpperCase() === "CORRECTION_REQUESTED") {
    const decision = currentPackage?.managerDecisionId
      ? await db.serviceVideoManagerDecisionEvidence.findFirst({
          where: {
            id: currentPackage.managerDecisionId,
            bookingId: input.bookingId,
            vendorId: input.vendorId,
            decision: "CORRECTION_REQUESTED",
          },
          select: { targetedStagesJson: true },
        })
      : null;
    let targetedStages: string[] = [];
    try {
      const parsed = JSON.parse(String(decision?.targetedStagesJson || "[]"));
      targetedStages = Array.isArray(parsed)
        ? parsed.map((value) => String(value || "").trim().toUpperCase())
        : [];
    } catch {
      targetedStages = [];
    }
    if (!targetedStages.includes(input.stage)) {
      throw new ServiceVideoMutationBlockedError("STAGE_CORRECTION_NOT_REQUESTED");
    }
    return;
  }

  if (currentPackage) {
    throw new ServiceVideoMutationBlockedError("SERVICE_VIDEO_PACKAGE_RECORDING_CLOSED");
  }
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export function normalizeCaptureProvenance(value: unknown): CaptureProvenance {
  return String(value || "").trim().toUpperCase() === "LIVE_BROWSER_CAPTURE"
    ? "LIVE_BROWSER_CAPTURE"
    : "PRERECORDED_FALLBACK";
}

export async function persistAllowedRecordingGateDecision(input: {
  bookingId: string;
  vendorId: string;
  membershipId: string;
  actorKind: string;
  surface: RecordingGateSurface;
  gate: RecordingPermissionGate;
  tx?: any;
}) {
  const gate = input.gate;
  if (
    gate.blockCode ||
    !gate.recordingUnlocked ||
    !gate.assessmentId ||
    !gate.assessmentGeneration ||
    !gate.scopeHash ||
    !gate.certificationId ||
    !gate.assignmentGeneration
  ) {
    throw new Error("RECORDING_GATE_EVIDENCE_INCOMPLETE");
  }
  const permissionBasis = gate.permissionRequired
    ? "VERIFIED_CUSTOMER_PERMISSION"
    : "ASSESSMENT_VENDOR_AUTHORIZATION";
  const permissionEvidenceId = gate.permissionRequired
    ? gate.permissionDecisionEvidenceId
    : gate.assessmentId;
  if (!permissionEvidenceId) throw new Error("PERMISSION_EVIDENCE_INCOMPLETE");

  const snapshot = {
    bookingId: input.bookingId,
    vendorId: input.vendorId,
    assessmentId: gate.assessmentId,
    assessmentGeneration: gate.assessmentGeneration,
    scopeHash: gate.scopeHash,
    permissionBasis,
    permissionEvidenceId,
    consentRecordId: gate.consentRecordId,
    certificationId: gate.certificationId,
    membershipId: input.membershipId,
    assignmentGeneration: gate.assignmentGeneration,
    locationAttemptId: gate.locationAttemptId,
    locationExceptionId: gate.locationExceptionId,
    surface: input.surface,
    actorKind: input.actorKind,
    decision: "ALLOWED",
    audioAllowed: false,
  };
  const snapshotJson = stableJson(snapshot);
  const db = input.tx || (prisma as any);
  return db.recordingGateDecisionEvidence.create({
    data: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      assessmentId: gate.assessmentId,
      assessmentGeneration: gate.assessmentGeneration,
      scopeHash: gate.scopeHash,
      permissionBasis,
      permissionEvidenceId,
      consentRecordId: gate.consentRecordId,
      certificationId: gate.certificationId,
      membershipId: input.membershipId,
      assignmentGeneration: gate.assignmentGeneration,
      locationAttemptId: gate.locationAttemptId,
      locationExceptionId: gate.locationExceptionId,
      surface: input.surface,
      actorKind: input.actorKind,
      decision: "ALLOWED",
      evidenceHash: sha256(snapshotJson),
      snapshotJson,
    },
  });
}

export async function createUploadAttempt(input: {
  assetId: string;
  vendorId: string;
  bookingId: string;
  mediaSessionId: string;
  membershipId: string;
  stage: ServiceVideoStage;
  captureProvenance: CaptureProvenance;
  blobKey: string;
  expectedBytes: bigint;
  mimeType: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    await assertServiceVideoStageMutationAllowed(tx, {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      stage: input.stage,
    });
    return tx.mediaUploadAttempt.create({ data: { ...input, state: "UPLOADING" } });
  }, { isolationLevel: "Serializable" });
}

export async function setUploadAttemptState(input: {
  assetId: string;
  vendorId: string;
  state: TruthfulUploadState;
  failureCode?: string | null;
  failureMessage?: string | null;
  actualBytes?: bigint | null;
  durationSeconds?: number | null;
}) {
  const now = new Date();
  const update = (db: any) => db.mediaUploadAttempt.updateMany({
      where: { assetId: input.assetId, vendorId: input.vendorId },
      data: {
        state: input.state,
        failureCode: input.failureCode || null,
        failureMessage: input.failureMessage || null,
        actualBytes: input.actualBytes ?? undefined,
        durationSeconds: input.durationSeconds ?? undefined,
        savedAt: input.state === "SAVED" ? now : undefined,
        rejectedAt: input.state === "REJECTED" ? now : undefined,
        retryRequiredAt: input.state === "RETRY_REQUIRED" ? now : undefined,
      },
    });
  return prisma.$transaction(async (tx: any) => {
    const attempt = await tx.mediaUploadAttempt.findFirst({
      where: { assetId: input.assetId, vendorId: input.vendorId },
      select: { bookingId: true, stage: true },
    });
    if (!attempt) return { count: 0 };
    await assertServiceVideoStageMutationAllowed(tx, {
      bookingId: attempt.bookingId,
      vendorId: input.vendorId,
      stage: attempt.stage as ServiceVideoStage,
    });
    return update(tx);
  }, { isolationLevel: "Serializable" });
}

export async function saveVerifiedServiceVideoStage(input: {
  assetId: string;
  vendorId: string;
  bookingId: string;
  mediaSessionId: string;
  membershipId: string;
  deviceId?: string | null;
  bytes: bigint;
  mimeType: string;
  blobKey: string;
  blobUrl?: string | null;
  stage: ServiceVideoStage;
  captureProvenance: CaptureProvenance;
  verifiedDurationSeconds: number;
  videoBuffer: Buffer;
  gateDecisionId: string;
  bookingMetadataAfterSave?: string;
}) {
  const contentHash = sha256(input.videoBuffer);
  return prisma.$transaction(async (tx: any) => {
    await assertServiceVideoStageMutationAllowed(tx, {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      stage: input.stage,
    });
    const gateEvidence = await tx.recordingGateDecisionEvidence.findFirst({
      where: {
        id: input.gateDecisionId,
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        membershipId: input.membershipId,
        decision: "ALLOWED",
      },
    });
    if (!gateEvidence) throw new Error("RECORDING_GATE_EVIDENCE_NOT_FOUND");
    const attempt = await tx.mediaUploadAttempt.findFirst({
      where: {
        assetId: input.assetId,
        vendorId: input.vendorId,
        bookingId: input.bookingId,
        mediaSessionId: input.mediaSessionId,
        membershipId: input.membershipId,
        stage: input.stage,
        state: { in: ["UPLOADING", "RETRY_REQUIRED"] },
      },
    });
    if (!attempt) throw new Error("UPLOAD_ATTEMPT_EVIDENCE_NOT_FOUND");

    const previous = await tx.serviceVideoStageEvidence.findFirst({
      where: { bookingId: input.bookingId, stage: input.stage, isCurrent: true },
      orderBy: { stageVersion: "desc" },
    });
    const latest = previous || (await tx.serviceVideoStageEvidence.findFirst({
      where: { bookingId: input.bookingId, stage: input.stage },
      orderBy: { stageVersion: "desc" },
    }));
    const stageVersion = Number(latest?.stageVersion || 0) + 1;

    const asset = await tx.mediaAsset.create({
      data: {
        id: input.assetId,
        vendorId: input.vendorId,
        mediaSessionId: input.mediaSessionId,
        membershipId: input.membershipId,
        uploadedByMembershipId: input.membershipId,
        deviceId: input.deviceId || null,
        bytes: input.bytes,
        mimeType: input.mimeType,
        blobKey: input.blobKey,
        blobUrl: input.blobUrl || null,
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
        uploadState: "SAVED",
        contentHash,
        hashAlgorithm: "SHA-256",
        captureProvenance: input.captureProvenance,
        stageVersion,
        replacesMediaAssetId: previous?.mediaAssetId || null,
        publicEligible: input.captureProvenance === "LIVE_BROWSER_CAPTURE",
        deletedAt: null,
      },
    });

    if (previous) {
      await tx.serviceVideoStageEvidence.update({ where: { id: previous.id }, data: { isCurrent: false } });
      await tx.mediaAsset.update({
        where: { id: previous.mediaAssetId },
        data: { deletedAt: new Date(), archiveStatus: "replaced" },
      });
      await tx.mediaSession.updateMany({
        where: { id: previous.mediaSessionId, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", endedAt: new Date() },
      });
    }

    const stageEvidence = await tx.serviceVideoStageEvidence.create({
      data: {
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        stage: input.stage,
        stageVersion,
        isCurrent: true,
        mediaSessionId: input.mediaSessionId,
        mediaAssetId: input.assetId,
        assessmentId: gateEvidence.assessmentId,
        assessmentGeneration: gateEvidence.assessmentGeneration,
        permissionBasis: gateEvidence.permissionBasis,
        permissionEvidenceId: gateEvidence.permissionEvidenceId,
        recordingGateDecisionId: gateEvidence.id,
        employeeMembershipId: input.membershipId,
        captureProvenance: input.captureProvenance,
        contentHash,
        hashAlgorithm: "SHA-256",
        verifiedDurationSeconds: input.verifiedDurationSeconds,
        uploadState: "SAVED",
        replacesStageEvidenceId: previous?.id || null,
        publicEligible: input.captureProvenance === "LIVE_BROWSER_CAPTURE",
      },
    });
    await tx.mediaUploadAttempt.update({
      where: { assetId: input.assetId },
      data: {
        state: "SAVED",
        actualBytes: input.bytes,
        durationSeconds: input.verifiedDurationSeconds,
        savedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });
    await tx.mediaSession.update({ where: { id: input.mediaSessionId }, data: { status: "COMPLETED", endedAt: new Date() } });
    if (input.bookingMetadataAfterSave !== undefined) {
      await tx.booking.update({
        where: { id: input.bookingId },
        data: { customerMetadata: input.bookingMetadataAfterSave },
      });
    }
    return { asset, stageEvidence };
  }, { isolationLevel: "Serializable" });
}

async function loadCompleteCurrentStageEvidence(db: any, bookingId: string, vendorId: string) {
  const stages: any[] = await db.serviceVideoStageEvidence.findMany({
    where: { bookingId, vendorId, isCurrent: true, uploadState: "SAVED" },
    orderBy: [{ stage: "asc" }, { stageVersion: "desc" }],
  });
  const byStage = new Map<string, any>(stages.map((row: any) => [String(row.stage), row]));
  const required: any[] = REQUIRED_SERVICE_VIDEO_STAGES.map((stage) => byStage.get(stage)).filter(Boolean);
  if (required.length !== REQUIRED_SERVICE_VIDEO_STAGES.length) throw new Error("SERVICE_VIDEO_EVIDENCE_CHAIN_INCOMPLETE");
  for (const row of required) {
    if (!row.assessmentId || !row.permissionEvidenceId || !row.recordingGateDecisionId || !row.employeeMembershipId || !row.contentHash) {
      throw new Error("SERVICE_VIDEO_EVIDENCE_CHAIN_INCOMPLETE");
    }
    const gate = await db.recordingGateDecisionEvidence.findFirst({
      where: {
        id: row.recordingGateDecisionId,
        bookingId,
        vendorId,
        membershipId: row.employeeMembershipId,
        assessmentId: row.assessmentId,
        permissionEvidenceId: row.permissionEvidenceId,
        decision: "ALLOWED",
      },
    });
    const asset = await db.mediaAsset.findFirst({
      where: {
        id: row.mediaAssetId,
        vendorId,
        mediaSessionId: row.mediaSessionId,
        membershipId: row.employeeMembershipId,
        deletedAt: null,
        uploadState: "SAVED",
        contentHash: row.contentHash,
      },
    });
    const session = await db.mediaSession.findFirst({
      where: {
        id: row.mediaSessionId,
        vendorId,
        bookingId,
        recordingGateDecisionId: row.recordingGateDecisionId,
        capturedByMembershipId: row.employeeMembershipId,
        status: "COMPLETED",
      },
    });
    if (!gate || !asset || !session) throw new Error("SERVICE_VIDEO_EVIDENCE_CHAIN_INCOMPLETE");
    if (
      String(asset.captureProvenance) !== String(row.captureProvenance) ||
      Number(asset.stageVersion) !== Number(row.stageVersion) ||
      Boolean(asset.publicEligible) !== Boolean(row.publicEligible)
    ) {
      throw new Error("SERVICE_VIDEO_EVIDENCE_CHAIN_INCOMPLETE");
    }
  }
  return required;
}

export async function submitServiceVideoPackage(input: {
  bookingId: string;
  vendorId: string;
  submittedByUserId?: string | null;
  submittedByMembershipId: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const stages = await loadCompleteCurrentStageEvidence(tx, input.bookingId, input.vendorId);
    const stageEvidence = REQUIRED_SERVICE_VIDEO_STAGES.map((stage) => {
      const row = stages.find((candidate: any) => candidate.stage === stage)!;
      return { stage, stageEvidenceId: row.id, stageVersion: row.stageVersion, mediaAssetId: row.mediaAssetId, contentHash: row.contentHash };
    });
    const stageEvidenceJson = stableJson(stageEvidence);
    const packageHash = sha256(stageEvidenceJson);
    const current = await tx.serviceVideoPackageEvidence.findFirst({
      where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
    });
    if (current?.status === "AWAITING_MANAGER_REVIEW" && current.packageHash === packageHash) {
      return current;
    }
    const previous = await tx.serviceVideoPackageEvidence.findFirst({
      where: { bookingId: input.bookingId },
      orderBy: { version: "desc" },
    });
    await tx.serviceVideoPackageEvidence.updateMany({ where: { bookingId: input.bookingId, isCurrent: true }, data: { isCurrent: false } });
    return tx.serviceVideoPackageEvidence.create({
      data: {
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        version: Number(previous?.version || 0) + 1,
        isCurrent: true,
        status: "AWAITING_MANAGER_REVIEW",
        stageEvidenceJson,
        packageHash,
        submittedByUserId: input.submittedByUserId || null,
        submittedByMembershipId: input.submittedByMembershipId,
      },
    });
  }, { isolationLevel: "Serializable" });
}

export async function requestServiceVideoCorrection(input: {
  bookingId: string;
  vendorId: string;
  managerUserId: string;
  managerMembershipId: string;
  stages: ServiceVideoStage[];
  reason: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const pkg = await tx.serviceVideoPackageEvidence.findFirst({ where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true, status: "AWAITING_MANAGER_REVIEW" } });
    if (!pkg) throw new Error("SERVICE_VIDEO_PACKAGE_NOT_REVIEWABLE");
    const targetedStagesJson = stableJson(input.stages);
    const decision = await tx.serviceVideoManagerDecisionEvidence.create({ data: {
      packageId: pkg.id, bookingId: input.bookingId, vendorId: input.vendorId, decision: "CORRECTION_REQUESTED",
      targetedStagesJson, reason: input.reason, managerUserId: input.managerUserId,
      managerMembershipId: input.managerMembershipId, packageHash: pkg.packageHash,
    }});
    await tx.serviceVideoPackageEvidence.update({ where: { id: pkg.id }, data: { status: "CORRECTION_REQUESTED", managerDecisionId: decision.id } });
    const stageRows = await tx.serviceVideoStageEvidence.findMany({ where: { bookingId: input.bookingId, isCurrent: true, stage: { in: input.stages } } });
    if (stageRows.length !== input.stages.length) throw new Error("CORRECTION_STAGE_EVIDENCE_NOT_FOUND");
    await tx.serviceVideoStageEvidence.updateMany({ where: { id: { in: stageRows.map((row: any) => row.id) } }, data: { uploadState: "REJECTED" } });
    await tx.mediaAsset.updateMany({ where: { id: { in: stageRows.map((row: any) => row.mediaAssetId) } }, data: { uploadState: "REJECTED", moderationStatus: "rejected", visibilityStatus: "private", moderationReason: input.reason } });
    return { package: pkg, decision };
  });
}

export async function approvePrivateServiceVideoPackage(input: {
  bookingId: string;
  vendorId: string;
  customerUserId: string;
  managerUserId: string;
  managerMembershipId: string;
  completedAt: Date;
  customerMetadata: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const stages = await loadCompleteCurrentStageEvidence(tx, input.bookingId, input.vendorId);
    const pkg = await tx.serviceVideoPackageEvidence.findFirst({ where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true, status: "AWAITING_MANAGER_REVIEW" } });
    if (!pkg) throw new Error("SERVICE_VIDEO_PACKAGE_NOT_REVIEWABLE");
    const expectedIds = new Set((JSON.parse(pkg.stageEvidenceJson) as any[]).map((row) => row.stageEvidenceId));
    if (stages.some((row: any) => !expectedIds.has(row.id))) throw new Error("SERVICE_VIDEO_PACKAGE_VERSION_MISMATCH");
    const targetedStagesJson = stableJson(REQUIRED_SERVICE_VIDEO_STAGES);
    const decision = await tx.serviceVideoManagerDecisionEvidence.create({ data: {
      packageId: pkg.id, bookingId: input.bookingId, vendorId: input.vendorId, decision: "PRIVATE_APPROVED",
      targetedStagesJson, managerUserId: input.managerUserId, managerMembershipId: input.managerMembershipId,
      packageHash: pkg.packageHash,
    }});
    const grant = await tx.privateProofAccessGrant.create({ data: {
      packageId: pkg.id, bookingId: input.bookingId, vendorId: input.vendorId,
      customerUserId: input.customerUserId, managerDecisionId: decision.id,
      status: "ACTIVE", grantedByUserId: input.managerUserId,
    }});
    await tx.serviceVideoPackageEvidence.update({ where: { id: pkg.id }, data: { status: "PRIVATE_APPROVED", managerDecisionId: decision.id, customerAccessGrantId: grant.id } });
    await tx.mediaAsset.updateMany({ where: { id: { in: stages.map((row: any) => row.mediaAssetId) }, deletedAt: null }, data: {
      moderationStatus: "approved", visibilityStatus: "customer_only", moderationReason: null,
      moderatedAt: new Date(), moderatedByUserId: input.managerUserId,
    }});
    const booking = await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        status: "COMPLETED",
        date: input.completedAt,
        customerMetadata: input.customerMetadata,
      },
      select: { id: true, status: true, date: true, updatedAt: true },
    });
    return { package: pkg, decision, grant, stages, booking };
  });
}

export async function loadAuthorizedPrivateProof(input: { bookingId: string; customerUserId: string }) {
  const grant = await (prisma as any).privateProofAccessGrant.findFirst({
    where: { bookingId: input.bookingId, customerUserId: input.customerUserId, status: "ACTIVE", revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });
  if (!grant) return null;
  const pkg = await (prisma as any).serviceVideoPackageEvidence.findFirst({
    where: { id: grant.packageId, bookingId: input.bookingId, isCurrent: true, status: "PRIVATE_APPROVED", managerDecisionId: grant.managerDecisionId, customerAccessGrantId: grant.id },
  });
  if (!pkg) return null;
  const decision = await (prisma as any).serviceVideoManagerDecisionEvidence.findFirst({ where: { id: grant.managerDecisionId, packageId: pkg.id, decision: "PRIVATE_APPROVED", packageHash: pkg.packageHash } });
  if (!decision) return null;
  const packageStages = JSON.parse(pkg.stageEvidenceJson) as Array<{
    stage: ServiceVideoStage;
    stageEvidenceId: string;
    stageVersion: number;
    mediaAssetId: string;
    contentHash: string;
  }>;
  if (packageStages.length !== REQUIRED_SERVICE_VIDEO_STAGES.length) return null;
  if (!REQUIRED_SERVICE_VIDEO_STAGES.every((stage) => packageStages.filter((row) => row.stage === stage).length === 1)) {
    return null;
  }
  const stages: any[] = await (prisma as any).serviceVideoStageEvidence.findMany({
    where: {
      id: { in: packageStages.map((row) => row.stageEvidenceId) },
      bookingId: input.bookingId,
      vendorId: pkg.vendorId,
      uploadState: "SAVED",
    },
  });
  if (stages.length !== REQUIRED_SERVICE_VIDEO_STAGES.length) return null;
  const packageStageById = new Map(packageStages.map((row) => [row.stageEvidenceId, row]));
  for (const stage of stages) {
    const packaged = packageStageById.get(stage.id);
    if (
      !packaged ||
      packaged.stage !== stage.stage ||
      Number(packaged.stageVersion) !== Number(stage.stageVersion) ||
      packaged.mediaAssetId !== stage.mediaAssetId ||
      packaged.contentHash !== stage.contentHash
    ) {
      return null;
    }
    const gate = await (prisma as any).recordingGateDecisionEvidence.findFirst({
      where: {
        id: stage.recordingGateDecisionId,
        bookingId: input.bookingId,
        vendorId: pkg.vendorId,
        membershipId: stage.employeeMembershipId,
        assessmentId: stage.assessmentId,
        permissionEvidenceId: stage.permissionEvidenceId,
        decision: "ALLOWED",
      },
    });
    const session = await (prisma as any).mediaSession.findFirst({
      where: {
        id: stage.mediaSessionId,
        bookingId: input.bookingId,
        vendorId: pkg.vendorId,
        recordingGateDecisionId: stage.recordingGateDecisionId,
        capturedByMembershipId: stage.employeeMembershipId,
        status: "COMPLETED",
      },
    });
    const asset = await (prisma as any).mediaAsset.findFirst({
      where: {
        id: stage.mediaAssetId,
        vendorId: pkg.vendorId,
        mediaSessionId: stage.mediaSessionId,
        membershipId: stage.employeeMembershipId,
        deletedAt: null,
        uploadState: "SAVED",
        moderationStatus: "approved",
        visibilityStatus: "customer_only",
        contentHash: stage.contentHash,
        stageVersion: stage.stageVersion,
        captureProvenance: stage.captureProvenance,
      },
    });
    if (!gate || !session || !asset) return null;
    const lifecycle = await resolveCanonicalMediaLifecycle({
      bookingId: input.bookingId,
      mediaAssetId: stage.mediaAssetId,
      intendedAudience: "PRIVATE",
    });
    if (!lifecycle.privateAllowed) return null;
  }
  const assetIds = REQUIRED_SERVICE_VIDEO_STAGES.map(
    (stage) => packageStages.find((row) => row.stage === stage)?.mediaAssetId || "",
  );
  if (assetIds.some((assetId) => !assetId)) return null;
  return { grant, package: pkg, decision, stages, assetIds };
}

export async function recordPrivateProofAccess(input: {
  grantId: string;
  packageId: string;
  bookingId: string;
  mediaAssetId?: string | null;
  actorUserId: string;
  eventType: "VIEW" | "DOWNLOAD";
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await (prisma as any).privateProofAccessEvent.create({ data: input });
}
