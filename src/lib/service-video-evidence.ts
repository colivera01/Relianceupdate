import { createHash } from "crypto";
import { resolveCanonicalMediaLifecycle } from "@/lib/media-lifecycle";
import { prisma } from "@/server/db";
import {
  loadRecordingPermissionGate,
  type RecordingPermissionGate,
  type RecordingGateSurface,
} from "@/lib/consent/recording-gate";
import { SERVICE_VIDEO_AUDIO_CONTRACT_VERSION } from "@/lib/recording/scope-assessment";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "@/lib/recording/assessment-v2";

export const V2_RECORDING_GATE_EVIDENCE_VERSION =
  "recording-gate-decision-v2-safety-binding-v1" as const;

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

export function assertServiceVideoAudioEvidenceConforms(row: {
  audioExpected?: boolean | null;
  audioPresence?: string | null;
  audioEvidenceVersion?: number | null;
}): void {
  const expected = Boolean(row.audioExpected);
  const presence = String(row.audioPresence || "LEGACY_UNKNOWN").toUpperCase();
  const version = Number(row.audioEvidenceVersion || 1);
  if (version < SERVICE_VIDEO_AUDIO_CONTRACT_VERSION) {
    if (expected || presence === "PRESENT") throw new Error("SERVICE_VIDEO_AUDIO_EVIDENCE_INVALID");
    return;
  }
  if (presence === "UNVERIFIABLE" || presence === "LEGACY_UNKNOWN") {
    throw new Error("SERVICE_VIDEO_AUDIO_UNVERIFIABLE");
  }
  if (!expected && presence === "PRESENT") throw new Error("SERVICE_VIDEO_UNAUTHORIZED_AUDIO");
  if (expected && presence !== "PRESENT") throw new Error("SERVICE_VIDEO_REQUIRED_AUDIO_MISSING");
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
    select: { status: true, managerDecisionId: true, adminAuditDecisionId: true },
  });
  const packageStatus = String(currentPackage?.status || "").toUpperCase();
  if (packageStatus === "ADMIN_REJECTED") {
    throw new ServiceVideoMutationBlockedError("ADMIN_AUDIT_REJECTED_TERMINAL");
  }
  if (packageStatus === "AWAITING_ADMIN_REVIEW") {
    throw new ServiceVideoMutationBlockedError("ADMIN_AUDIT_IN_PROGRESS");
  }
  if (
    String(booking.status || "").toUpperCase() === "AWAITING_REVIEW" ||
    packageStatus === "AWAITING_MANAGER_REVIEW"
  ) {
    throw new ServiceVideoMutationBlockedError("MANAGER_REVIEW_IN_PROGRESS");
  }

  if (packageStatus === "CORRECTION_REQUESTED") {
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
  stage: ServiceVideoStage;
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
  const v2 = gate.assessmentContractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION;
  if (
    v2 &&
    (!gate.v2Safety?.ready ||
      !gate.v2Safety.evidenceId ||
      !gate.v2Safety.evidenceHash ||
      !gate.v2Safety.locationAttemptId ||
      !gate.v2Safety.locationAttemptEvidenceHash ||
      gate.locationAttemptId !== gate.v2Safety.locationAttemptId)
  ) {
    throw new Error("V2_RECORDING_GATE_EVIDENCE_INCOMPLETE");
  }

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
    audioAllowed: gate.audioAllowed,
    audioContractVersion: SERVICE_VIDEO_AUDIO_CONTRACT_VERSION,
    ...(v2
      ? {
          evidenceVersion: V2_RECORDING_GATE_EVIDENCE_VERSION,
          stage: input.stage,
          safetyEvidenceId: gate.v2Safety!.evidenceId,
          safetyEvidenceHash: gate.v2Safety!.evidenceHash,
          locationAttemptEvidenceHash: gate.v2Safety!.locationAttemptEvidenceHash,
        }
      : {}),
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
      locationAttemptEvidenceHash: v2
        ? gate.v2Safety!.locationAttemptEvidenceHash
        : null,
      locationExceptionId: gate.locationExceptionId,
      safetyEvidenceId: v2 ? gate.v2Safety!.evidenceId : null,
      safetyEvidenceHash: v2 ? gate.v2Safety!.evidenceHash : null,
      stage: v2 ? input.stage : null,
      evidenceVersion: v2 ? V2_RECORDING_GATE_EVIDENCE_VERSION : null,
      surface: input.surface,
      actorKind: input.actorKind,
      decision: "ALLOWED",
      audioExpected: gate.audioAllowed,
      audioContractVersion: SERVICE_VIDEO_AUDIO_CONTRACT_VERSION,
      evidenceHash: sha256(snapshotJson),
      snapshotJson,
    },
  });
}

export async function assertRecordingAuthorizationCurrent(
  db: any,
  input: {
    gateDecisionId: string;
    bookingId: string;
    vendorId: string;
    membershipId: string;
    stage: ServiceVideoStage;
    surface: RecordingGateSurface;
    actorKind?: string | null;
    now?: Date;
  },
) {
  const evidence = await db.recordingGateDecisionEvidence.findFirst({
    where: {
      id: input.gateDecisionId,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      decision: "ALLOWED",
    },
  });
  if (!evidence) throw new ServiceVideoMutationBlockedError("RECORDING_GATE_EVIDENCE_NOT_FOUND");

  const assessmentModel = db.recordingScopeAssessment;
  if (!assessmentModel?.findFirst) return evidence;
  const assessment = await assessmentModel.findFirst({
    where: { id: evidence.assessmentId, bookingId: input.bookingId, vendorId: input.vendorId },
    select: { contractVersion: true },
  });
  if (assessment?.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) return evidence;
  if (
    evidence.evidenceVersion !== V2_RECORDING_GATE_EVIDENCE_VERSION ||
    evidence.stage !== input.stage ||
    !evidence.safetyEvidenceId ||
    !evidence.safetyEvidenceHash ||
    !evidence.locationAttemptId ||
    !evidence.locationAttemptEvidenceHash ||
    sha256(String(evidence.snapshotJson || "")) !== evidence.evidenceHash
  ) {
    throw new ServiceVideoMutationBlockedError("V2_RECORDING_AUTHORIZATION_EVIDENCE_INVALID");
  }
  let snapshot: any;
  try {
    snapshot = JSON.parse(String(evidence.snapshotJson || ""));
  } catch {
    throw new ServiceVideoMutationBlockedError("V2_RECORDING_AUTHORIZATION_EVIDENCE_INVALID");
  }
  if (
    snapshot.evidenceVersion !== evidence.evidenceVersion ||
    snapshot.bookingId !== evidence.bookingId ||
    snapshot.vendorId !== evidence.vendorId ||
    snapshot.assessmentId !== evidence.assessmentId ||
    Number(snapshot.assessmentGeneration) !== Number(evidence.assessmentGeneration) ||
    snapshot.scopeHash !== evidence.scopeHash ||
    snapshot.membershipId !== evidence.membershipId ||
    Number(snapshot.assignmentGeneration) !== Number(evidence.assignmentGeneration) ||
    snapshot.stage !== evidence.stage ||
    snapshot.safetyEvidenceId !== evidence.safetyEvidenceId ||
    snapshot.safetyEvidenceHash !== evidence.safetyEvidenceHash ||
    snapshot.locationAttemptId !== evidence.locationAttemptId ||
    snapshot.locationAttemptEvidenceHash !== evidence.locationAttemptEvidenceHash ||
    snapshot.decision !== "ALLOWED"
  ) {
    throw new ServiceVideoMutationBlockedError("V2_RECORDING_AUTHORIZATION_EVIDENCE_INVALID");
  }

  const [booking, membership] = await Promise.all([
    db.booking.findFirst({
      where: { id: input.bookingId, vendorId: input.vendorId },
      select: { customerMetadata: true },
    }),
    db.vendorMembership.findFirst({
      where: { id: input.membershipId, vendorId: input.vendorId, role: "EMPLOYEE", status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  if (!booking || !membership) {
    throw new ServiceVideoMutationBlockedError("V2_RECORDING_AUTHORIZATION_STALE");
  }
  const gate = await loadRecordingPermissionGate({
    bookingId: input.bookingId,
    vendorId: input.vendorId,
    customerMetadata: booking.customerMetadata,
    membershipId: input.membershipId,
    surface: input.surface,
    capability: "record",
    actorKind: input.actorKind || "EMPLOYEE",
    recordingStage: input.stage,
    now: input.now,
    db,
  });
  if (
    gate.blockCode ||
    !gate.recordingUnlocked ||
    gate.assessmentId !== evidence.assessmentId ||
    gate.assessmentGeneration !== evidence.assessmentGeneration ||
    gate.scopeHash !== evidence.scopeHash ||
    gate.certificationId !== evidence.certificationId ||
    gate.assignmentGeneration !== evidence.assignmentGeneration ||
    gate.locationAttemptId !== evidence.locationAttemptId ||
    gate.v2Safety?.evidenceId !== evidence.safetyEvidenceId ||
    gate.v2Safety?.evidenceHash !== evidence.safetyEvidenceHash ||
    gate.v2Safety?.locationAttemptEvidenceHash !== evidence.locationAttemptEvidenceHash
  ) {
    throw new ServiceVideoMutationBlockedError("V2_RECORDING_AUTHORIZATION_STALE");
  }
  return evidence;
}

export async function assertMediaSessionAuthorizationCurrent(
  db: any,
  input: {
    mediaSessionId: string;
    bookingId: string;
    vendorId: string;
    membershipId: string;
    stage: ServiceVideoStage;
    surface: RecordingGateSurface;
    actorKind?: string | null;
  },
) {
  const session = await db.mediaSession.findFirst({
    where: {
      id: input.mediaSessionId,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      capturedByMembershipId: input.membershipId,
      vendorJobVideoStage: input.stage,
    },
    select: { recordingGateDecisionId: true },
  });
  if (!session) {
    throw new ServiceVideoMutationBlockedError("RECORDING_SESSION_AUTHORIZATION_NOT_FOUND");
  }
  const currentAssessment = db.recordingScopeAssessment?.findFirst
    ? await db.recordingScopeAssessment.findFirst({
        where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
        orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
        select: { contractVersion: true },
      })
    : null;
  if (currentAssessment?.contractVersion !== RECORDING_ASSESSMENT_V2_CONTRACT_VERSION) {
    return session;
  }
  if (!session.recordingGateDecisionId) {
    throw new ServiceVideoMutationBlockedError("RECORDING_SESSION_AUTHORIZATION_NOT_FOUND");
  }
  return assertRecordingAuthorizationCurrent(db, {
    ...input,
    gateDecisionId: session.recordingGateDecisionId,
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
  audioExpected: boolean;
}) {
  return prisma.$transaction(async (tx: any) => {
    await assertServiceVideoStageMutationAllowed(tx, {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      stage: input.stage,
    });
    await assertMediaSessionAuthorizationCurrent(tx, {
      mediaSessionId: input.mediaSessionId,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      stage: input.stage,
      surface: "upload_init",
    });
    return tx.mediaUploadAttempt.create({
      data: {
        ...input,
        state: "UPLOADING",
        audioPresence: "UNVERIFIABLE",
        audioEvidenceVersion: SERVICE_VIDEO_AUDIO_CONTRACT_VERSION,
      },
    });
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
      select: { bookingId: true, stage: true, mediaSessionId: true, membershipId: true },
    });
    if (!attempt) return { count: 0 };
    await assertServiceVideoStageMutationAllowed(tx, {
      bookingId: attempt.bookingId,
      vendorId: input.vendorId,
      stage: attempt.stage as ServiceVideoStage,
    });
    await assertMediaSessionAuthorizationCurrent(tx, {
      mediaSessionId: attempt.mediaSessionId,
      bookingId: attempt.bookingId,
      vendorId: input.vendorId,
      membershipId: attempt.membershipId,
      stage: attempt.stage as ServiceVideoStage,
      surface: "upload_status",
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
  audioExpected?: boolean;
  audioPresence?: "PRESENT" | "ABSENT";
  audioTrackCount?: number | null;
  audioCodec?: string | null;
  audioDetectionMethod?: string;
  audioEvidenceVersion?: number;
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
    await assertRecordingAuthorizationCurrent(tx, {
      gateDecisionId: input.gateDecisionId,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      membershipId: input.membershipId,
      stage: input.stage,
      surface: "upload_complete",
    });
    const audioExpected = input.audioExpected ?? Boolean(gateEvidence.audioExpected);
    const audioPresence = input.audioPresence || "LEGACY_UNKNOWN";
    const audioEvidenceVersion = input.audioEvidenceVersion || 1;
    if (Boolean(gateEvidence.audioExpected) !== audioExpected && audioEvidenceVersion >= SERVICE_VIDEO_AUDIO_CONTRACT_VERSION) {
      throw new Error("AUDIO_SCOPE_GATE_EVIDENCE_MISMATCH");
    }
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
        audioExpected,
        audioPresence,
        audioTrackCount: input.audioTrackCount,
        audioCodec: input.audioCodec,
        audioDetectionMethod: input.audioDetectionMethod || null,
        audioEvidenceVersion,
        audioDetectedAt: audioEvidenceVersion >= SERVICE_VIDEO_AUDIO_CONTRACT_VERSION ? new Date() : null,
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
        audioExpected,
        audioPresence,
        audioEvidenceVersion,
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
        audioExpected,
        audioPresence,
        audioEvidenceVersion,
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
    assertServiceVideoAudioEvidenceConforms(row);
    assertServiceVideoAudioEvidenceConforms(asset);
    if (
      String(asset.captureProvenance) !== String(row.captureProvenance) ||
      Number(asset.stageVersion) !== Number(row.stageVersion) ||
      Boolean(asset.publicEligible) !== Boolean(row.publicEligible)
      || Boolean(asset.audioExpected) !== Boolean(row.audioExpected)
      || String(asset.audioPresence || "") !== String(row.audioPresence || "")
      || Boolean(session.audioExpected) !== Boolean(row.audioExpected)
      || Boolean(gate.audioExpected) !== Boolean(row.audioExpected)
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
      return {
        stage,
        stageEvidenceId: row.id,
        stageVersion: row.stageVersion,
        mediaAssetId: row.mediaAssetId,
        contentHash: row.contentHash,
        audioExpected: Boolean(row.audioExpected),
        audioPresence: String(row.audioPresence || "LEGACY_UNKNOWN"),
        audioEvidenceVersion: Number(row.audioEvidenceVersion || 1),
      };
    });
    const stageEvidenceJson = stableJson(stageEvidence);
    const packageHash = sha256(stageEvidenceJson);
    const current = await tx.serviceVideoPackageEvidence.findFirst({
      where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
    });
    const currentStatus = String(current?.status || "").toUpperCase();
    if (currentStatus === "ADMIN_REJECTED") {
      throw new ServiceVideoMutationBlockedError("ADMIN_AUDIT_REJECTED_TERMINAL");
    }
    if (currentStatus === "AWAITING_ADMIN_REVIEW" || currentStatus === "PRIVATE_APPROVED") {
      throw new ServiceVideoMutationBlockedError("SERVICE_VIDEO_PACKAGE_RECORDING_CLOSED");
    }
    if (currentStatus === "CORRECTION_REQUESTED") {
      const decision = current?.managerDecisionId
        ? await tx.serviceVideoManagerDecisionEvidence.findFirst({
            where: {
              id: current.managerDecisionId,
              packageId: current.id,
              decision: "CORRECTION_REQUESTED",
            },
            select: { targetedStagesJson: true },
          })
        : null;
      let targeted: string[] = [];
      try {
        const parsed = JSON.parse(String(decision?.targetedStagesJson || "[]"));
        targeted = Array.isArray(parsed) ? parsed.map((stage) => String(stage).toUpperCase()) : [];
      } catch {
        targeted = [];
      }
      if (!REQUIRED_SERVICE_VIDEO_STAGES.every((stage) =>
        targeted.includes(stage) || stages.some((row: any) => row.stage === stage && row.uploadState === "SAVED")
      )) {
        throw new ServiceVideoMutationBlockedError("CORRECTION_PACKAGE_INCOMPLETE");
      }
    }
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
        audioExpected: stages.some((row: any) => Boolean(row.audioExpected)),
        audioConformance: "CONFORMING",
        audioEvidenceVersion: Math.max(...stages.map((row: any) => Number(row.audioEvidenceVersion || 1))),
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
  const isCoreAdminGrant = Boolean(grant.adminAuditDecisionId || pkg.adminAuditDecisionId);
  const decision = await (prisma as any).serviceVideoManagerDecisionEvidence.findFirst({
    where: {
      id: grant.managerDecisionId,
      packageId: pkg.id,
      decision: isCoreAdminGrant ? "SUBMITTED_FOR_ADMIN_AUDIT" : "PRIVATE_APPROVED",
      packageHash: pkg.packageHash,
    },
  });
  if (!decision) return null;
  if (isCoreAdminGrant) {
    if (
      !grant.adminAuditDecisionId ||
      pkg.adminAuditDecisionId !== grant.adminAuditDecisionId ||
      !pkg.auditEvidenceVersion
    ) return null;
    const auditDecision = await (prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst({
      where: {
        id: grant.adminAuditDecisionId,
        packageId: pkg.id,
        bookingId: input.bookingId,
        managerDecisionId: decision.id,
        packageHash: pkg.packageHash,
        decision: "PASS",
        customerProofReleased: true,
        customerAccessGrantId: grant.id,
      },
    });
    if (!auditDecision) return null;
  }
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
