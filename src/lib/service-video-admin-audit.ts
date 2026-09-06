import { createHash } from "crypto";

import { prisma } from "@/server/db";
import {
  getRelianceOps,
  parseCustomerMetadataRecord,
  setOperationalPhaseOnMetadataJson,
} from "@/lib/vendor-job-operational-phase";
import {
  REQUIRED_SERVICE_VIDEO_STAGES,
  assertServiceVideoAudioEvidenceConforms,
  type ServiceVideoStage,
} from "@/lib/service-video-evidence";
import { isCoreAdminAuditRejectionCategory } from "@/lib/core-admin-audit-categories";
import { interpretRecordingAssessment } from "@/lib/recording/assessment-reader";
import { createVendorManagerAuditNotifications } from "@/lib/vendor-manager-notifications";

export const CORE_ADMIN_AUDIT_EVIDENCE_VERSION = 1;
export const CORE_ADMIN_AUDIT_DECISION_EVIDENCE_VERSION = 2;
export const CORE_ADMIN_PUBLIC_ELIGIBILITY_EVIDENCE_VERSION = 1;
export const CORE_ADMIN_PUBLIC_DISPLAY_ELIGIBILITY = {
  ELIGIBLE: "PUBLIC_DISPLAY_ELIGIBLE",
  PRIVATE_ONLY: "PRIVATE_ONLY",
} as const;
export const MANAGER_ADMIN_AUDIT_SUBMISSION = "SUBMITTED_FOR_ADMIN_AUDIT";
export const PACKAGE_AWAITING_ADMIN_AUDIT = "AWAITING_ADMIN_REVIEW";
export const PACKAGE_ADMIN_AUDIT_REJECTED = "ADMIN_REJECTED";
export const CORE_ADMIN_AUDIT_READY_NOTIFICATION_KIND = "SERVICE_VIDEO_ADMIN_AUDIT_READY_V1";
export const CORE_PRIVATE_PROOF_READY_NOTIFICATION_KIND = "PRIVATE_PROOF_READY_ADMIN_AUDIT_V1";
export const CORE_PRIVATE_PROOF_REJECTED_NOTIFICATION_KIND = "PRIVATE_PROOF_AUDIT_REJECTED_V1";
export const CORE_VENDOR_AUDIT_PASSED_NOTIFICATION_KIND = "VENDOR_CORE_AUDIT_PASSED_V1";
export const CORE_VENDOR_AUDIT_REJECTED_NOTIFICATION_KIND = "VENDOR_CORE_AUDIT_REJECTED_V1";

export type CoreAdminAuditDecision = "PASS" | "REJECT";
export type CoreAdminPublicDisplayEligibility =
  typeof CORE_ADMIN_PUBLIC_DISPLAY_ELIGIBILITY[keyof typeof CORE_ADMIN_PUBLIC_DISPLAY_ELIGIBILITY];

type PackageStage = {
  stage: ServiceVideoStage;
  stageEvidenceId: string;
  stageVersion: number;
  mediaAssetId: string;
  contentHash: string;
};

type ManagerAttestationStage = PackageStage & {
  assessmentId: string;
  assessmentGeneration: number;
  permissionEvidenceId: string;
  recordingGateDecisionId: string;
  scopeHash: string;
};

type ManagerSubmissionAttestation = {
  evidenceVersion: number;
  bookingId: string;
  vendorId: string;
  packageId: string;
  packageVersion: number;
  packageHash: string;
  managerUserId: string;
  managerMembershipId: string;
  stages: ManagerAttestationStage[];
};

export type CoreAdminAuditQueueIssue = {
  bookingId: string;
  vendorId: string;
  packageId: string;
  code: string;
  correlationId: string;
  submittedAt: Date | null;
};

export class CoreAdminAuditError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CoreAdminAuditError";
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : stableJson(value))
    .digest("hex");
}

function parsePackageStages(value: unknown): PackageStage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value || "[]"));
  } catch {
    throw new CoreAdminAuditError("ADMIN_AUDIT_PACKAGE_STAGE_EVIDENCE_INVALID");
  }
  if (!Array.isArray(parsed) || parsed.length !== REQUIRED_SERVICE_VIDEO_STAGES.length) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_PACKAGE_INCOMPLETE");
  }
  const stages = parsed.map((row: any) => ({
    stage: String(row?.stage || "").trim().toUpperCase() as ServiceVideoStage,
    stageEvidenceId: String(row?.stageEvidenceId || "").trim(),
    stageVersion: Number(row?.stageVersion || 0),
    mediaAssetId: String(row?.mediaAssetId || "").trim(),
    contentHash: String(row?.contentHash || "").trim(),
  }));
  for (const required of REQUIRED_SERVICE_VIDEO_STAGES) {
    const matches = stages.filter((row) => row.stage === required);
    if (
      matches.length !== 1 ||
      !matches[0].stageEvidenceId ||
      !matches[0].mediaAssetId ||
      !matches[0].contentHash ||
      !Number.isInteger(matches[0].stageVersion) ||
      matches[0].stageVersion < 1
    ) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_PACKAGE_STAGE_EVIDENCE_INVALID");
    }
  }
  return REQUIRED_SERVICE_VIDEO_STAGES.map(
    (stage) => stages.find((row) => row.stage === stage)!,
  );
}

async function loadBoundStageEvidence(
  db: any,
  packageStages: PackageStage[],
  scope: { bookingId: string; vendorId: string },
) {
  const rows = await db.serviceVideoStageEvidence.findMany({
    where: { id: { in: packageStages.map((row) => row.stageEvidenceId) } },
    select: {
      id: true,
      bookingId: true,
      vendorId: true,
      stage: true,
      stageVersion: true,
      isCurrent: true,
      mediaAssetId: true,
      contentHash: true,
      uploadState: true,
      assessmentId: true,
      assessmentGeneration: true,
      permissionEvidenceId: true,
      recordingGateDecisionId: true,
      mediaSessionId: true,
      audioExpected: true,
      audioPresence: true,
      audioEvidenceVersion: true,
    },
  });
  if (rows.length !== packageStages.length) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_STAGE_EVIDENCE_MISSING");
  }
  const byId = new Map(rows.map((row: any) => [String(row.id), row]));
  for (const expected of packageStages) {
    const actual = byId.get(expected.stageEvidenceId) as any;
    if (
      !actual ||
      String(actual.stage).toUpperCase() !== expected.stage ||
      Number(actual.stageVersion) !== expected.stageVersion ||
      String(actual.mediaAssetId) !== expected.mediaAssetId ||
      String(actual.contentHash) !== expected.contentHash ||
      String(actual.bookingId) !== scope.bookingId ||
      String(actual.vendorId) !== scope.vendorId ||
      !actual.isCurrent ||
      String(actual.uploadState).toUpperCase() !== "SAVED"
    ) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_PACKAGE_VERSION_MISMATCH");
    }
  }
  return packageStages.map((expected) => byId.get(expected.stageEvidenceId));
}

async function loadBoundMediaAssets(db: any, packageStages: PackageStage[]) {
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: packageStages.map((row) => row.mediaAssetId) }, deletedAt: null },
    select: {
      id: true,
      vendorId: true,
      mediaSessionId: true,
      uploadedByMembershipId: true,
      contentHash: true,
      stageVersion: true,
      uploadState: true,
      moderationStatus: true,
      visibilityStatus: true,
      archiveStatus: true,
      moderationReason: true,
      moderatedAt: true,
      createdAt: true,
      mimeType: true,
      bytes: true,
      blobUrl: true,
      deletedAt: true,
      audioExpected: true,
      audioPresence: true,
      audioTrackCount: true,
      audioCodec: true,
      audioDetectionMethod: true,
      audioEvidenceVersion: true,
      mediaSession: {
        select: {
          employee: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (rows.length !== packageStages.length) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MEDIA_EVIDENCE_MISSING");
  }
  const byId = new Map(rows.map((row: any) => [String(row.id), row]));
  for (const expected of packageStages) {
    const actual = byId.get(expected.mediaAssetId) as any;
    if (
      !actual ||
      String(actual.contentHash || "") !== expected.contentHash ||
      Number(actual.stageVersion || 0) !== expected.stageVersion ||
      String(actual.uploadState || "").toUpperCase() !== "SAVED"
    ) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_MEDIA_VERSION_MISMATCH");
    }
  }
  return packageStages.map((expected) => byId.get(expected.mediaAssetId));
}

function parseManagerSubmissionAttestation(value: unknown): ManagerSubmissionAttestation {
  let parsed: any;
  try {
    parsed = JSON.parse(String(value || ""));
  } catch {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_ATTESTATION_INVALID");
  }
  if (!parsed || !Array.isArray(parsed.stages)) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_ATTESTATION_INVALID");
  }
  return parsed as ManagerSubmissionAttestation;
}

function assertManagerSubmissionBinding(input: {
  attestation: ManagerSubmissionAttestation;
  managerDecision: any;
  pkg: any;
  booking: any;
  packageStages: PackageStage[];
  stageEvidence: any[];
  recordingAssessment: any | null;
}) {
  const { attestation, managerDecision, pkg, booking, packageStages, stageEvidence, recordingAssessment } = input;
  if (
    Number(attestation.evidenceVersion) !== Number(managerDecision.evidenceVersion || CORE_ADMIN_AUDIT_EVIDENCE_VERSION) ||
    String(attestation.bookingId || "") !== String(booking.id) ||
    String(attestation.vendorId || "") !== String(booking.vendorId) ||
    String(attestation.packageId || "") !== String(pkg.id) ||
    Number(attestation.packageVersion) !== Number(pkg.version) ||
    String(attestation.packageHash || "") !== String(pkg.packageHash) ||
    String(attestation.managerUserId || "") !== String(managerDecision.managerUserId) ||
    String(attestation.managerMembershipId || "") !== String(managerDecision.managerMembershipId) ||
    attestation.stages.length !== packageStages.length
  ) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_ATTESTATION_BINDING_MISMATCH");
  }

  const attestedByStage = new Map(
    attestation.stages.map((stage) => [String(stage.stage || "").toUpperCase(), stage]),
  );
  for (let index = 0; index < packageStages.length; index += 1) {
    const expected = packageStages[index];
    const evidence = stageEvidence[index];
    const attested = attestedByStage.get(expected.stage);
    if (
      !attested ||
      String(attested.stageEvidenceId || "") !== expected.stageEvidenceId ||
      Number(attested.stageVersion) !== expected.stageVersion ||
      String(attested.mediaAssetId || "") !== expected.mediaAssetId ||
      String(attested.contentHash || "") !== expected.contentHash ||
      String(attested.assessmentId || "") !== String(evidence.assessmentId || "") ||
      Number(attested.assessmentGeneration) !== Number(evidence.assessmentGeneration) ||
      String(attested.permissionEvidenceId || "") !== String(evidence.permissionEvidenceId || "") ||
      String(attested.recordingGateDecisionId || "") !== String(evidence.recordingGateDecisionId || "")
    ) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_ATTESTATION_BINDING_MISMATCH");
    }
    if (
      recordingAssessment &&
      (String(attested.assessmentId) !== String(recordingAssessment.id) ||
        Number(attested.assessmentGeneration) !== Number(recordingAssessment.generation) ||
        String(attested.scopeHash || "") !== String(recordingAssessment.scopeHash || ""))
    ) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_RECORDING_SCOPE_MISMATCH");
    }
  }
}

function validatePackageAudio(
  stageRows: any[],
  mediaAssets: any[],
  options: { strict?: boolean } = {},
) {
  const assetById = new Map(mediaAssets.map((asset: any) => [String(asset.id), asset]));
  const expectedValues = new Set<boolean>();
  const errors: string[] = [];
  for (const stage of stageRows) {
    const asset: any = assetById.get(String(stage.mediaAssetId));
    try {
      assertServiceVideoAudioEvidenceConforms(stage);
      assertServiceVideoAudioEvidenceConforms(asset || {});
    } catch (error: any) {
      errors.push(String(error?.message || "ADMIN_AUDIT_AUDIO_EVIDENCE_INVALID"));
    }
    if (
      !asset ||
      Boolean(asset.audioExpected) !== Boolean(stage.audioExpected) ||
      String(asset.audioPresence || "") !== String(stage.audioPresence || "")
    ) {
      errors.push("ADMIN_AUDIT_AUDIO_EVIDENCE_MISMATCH");
    }
    expectedValues.add(Boolean(stage.audioExpected));
  }
  if (expectedValues.size !== 1) errors.push("ADMIN_AUDIT_MIXED_AUDIO_SCOPE");
  const uniqueErrors = Array.from(new Set(errors));
  if (options.strict !== false && uniqueErrors.length > 0) {
    throw new CoreAdminAuditError(uniqueErrors[0]);
  }
  return {
    expected: expectedValues.has(true),
    conformance: uniqueErrors.length === 0 ? "CONFORMING" as const : "MISMATCH" as const,
    errors: uniqueErrors,
    stages: stageRows.map((stage) => ({
      stage: stage.stage,
      expected: Boolean(stage.audioExpected),
      presence: String(stage.audioPresence || "LEGACY_UNKNOWN"),
      evidenceVersion: Number(stage.audioEvidenceVersion || 1),
    })),
  };
}

export async function submitPackageForCoreAdminAudit(input: {
  bookingId: string;
  vendorId: string;
  managerUserId: string;
  managerMembershipId: string;
}) {
  return (prisma as any).$transaction(async (tx: any) => {
    const booking = await tx.booking.findFirst({
      where: { id: input.bookingId, vendorId: input.vendorId },
      select: { id: true, status: true, customerMetadata: true },
    });
    if (!booking) throw new CoreAdminAuditError("WORK_RECORD_NOT_FOUND");

    const pkg = await tx.serviceVideoPackageEvidence.findFirst({
      where: { bookingId: input.bookingId, vendorId: input.vendorId, isCurrent: true },
    });
    if (!pkg) throw new CoreAdminAuditError("SERVICE_VIDEO_PACKAGE_NOT_REVIEWABLE");
    if (
      String(pkg.status).toUpperCase() === PACKAGE_AWAITING_ADMIN_AUDIT &&
      pkg.managerDecisionId
    ) {
      const existing = await tx.serviceVideoManagerDecisionEvidence.findFirst({
        where: {
          id: pkg.managerDecisionId,
          packageId: pkg.id,
          decision: MANAGER_ADMIN_AUDIT_SUBMISSION,
          packageHash: pkg.packageHash,
        },
      });
      if (existing) {
        const adminNotificationId = `service-video-admin-audit-${pkg.id}`;
        const adminEmailNotification = await tx.bookingNotification.findFirst({
          where: {
            bookingId: input.bookingId,
            kind: CORE_ADMIN_AUDIT_READY_NOTIFICATION_KIND,
          },
        });
        if (!adminEmailNotification) {
          throw new CoreAdminAuditError("ADMIN_AUDIT_NOTIFICATION_EVIDENCE_MISSING");
        }
        return {
          booking,
          package: pkg,
          managerDecision: existing,
          adminNotificationId,
          adminEmailNotificationId: adminEmailNotification.id,
          firstTransition: false,
        };
      }
    }
    if (
      String(booking.status || "").toUpperCase() !== "AWAITING_REVIEW" ||
      String(pkg.status || "").toUpperCase() !== "AWAITING_MANAGER_REVIEW"
    ) {
      throw new CoreAdminAuditError("SERVICE_VIDEO_PACKAGE_NOT_REVIEWABLE");
    }

    const packageStages = parsePackageStages(pkg.stageEvidenceJson);
    const stageRows = await loadBoundStageEvidence(tx, packageStages, {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
    });
    const mediaAssets = await loadBoundMediaAssets(tx, packageStages);
    const audioAudit = validatePackageAudio(stageRows, mediaAssets);
    const gateRows = await tx.recordingGateDecisionEvidence.findMany({
      where: {
        id: { in: stageRows.map((row: any) => String(row.recordingGateDecisionId)) },
      },
      select: {
        id: true,
        scopeHash: true,
        assessmentGeneration: true,
        permissionEvidenceId: true,
        audioExpected: true,
      },
    });
    const gateById = new Map(gateRows.map((row: any) => [String(row.id), row]));
    if (gateRows.length !== stageRows.length) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_RECORDING_GATE_EVIDENCE_MISSING");
    }
    const attestation = {
      evidenceVersion: CORE_ADMIN_AUDIT_EVIDENCE_VERSION,
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      packageId: pkg.id,
      packageVersion: pkg.version,
      packageHash: pkg.packageHash,
      stages: packageStages.map((stage, index) => {
        const evidence: any = stageRows[index];
        const gate: any = gateById.get(String(evidence.recordingGateDecisionId));
        if (
          !gate ||
          Number(gate.assessmentGeneration) !== Number(evidence.assessmentGeneration) ||
          String(gate.permissionEvidenceId) !== String(evidence.permissionEvidenceId)
          || Boolean(gate.audioExpected) !== Boolean(evidence.audioExpected)
        ) {
          throw new CoreAdminAuditError("ADMIN_AUDIT_RECORDING_GATE_EVIDENCE_MISMATCH");
        }
        return {
          ...stage,
          assessmentId: evidence.assessmentId,
          assessmentGeneration: evidence.assessmentGeneration,
          permissionEvidenceId: evidence.permissionEvidenceId,
          recordingGateDecisionId: evidence.recordingGateDecisionId,
          scopeHash: gate?.scopeHash,
          audioExpected: Boolean(evidence.audioExpected),
          audioPresence: String(evidence.audioPresence || "LEGACY_UNKNOWN"),
          audioEvidenceVersion: Number(evidence.audioEvidenceVersion || 1),
        };
      }),
      audioAudit,
      managerUserId: input.managerUserId,
      managerMembershipId: input.managerMembershipId,
    };
    const attestationJson = stableJson(attestation);
    const attestationHash = sha256(attestationJson);

    const claimed = await tx.serviceVideoPackageEvidence.updateMany({
      where: {
        id: pkg.id,
        isCurrent: true,
        status: "AWAITING_MANAGER_REVIEW",
        managerDecisionId: null,
      },
      data: {
        status: PACKAGE_AWAITING_ADMIN_AUDIT,
        auditEvidenceVersion: CORE_ADMIN_AUDIT_EVIDENCE_VERSION,
      },
    });
    if (Number(claimed.count || 0) !== 1) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_SUBMISSION_RACE");
    }
    const managerDecision = await tx.serviceVideoManagerDecisionEvidence.create({
      data: {
        packageId: pkg.id,
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        decision: MANAGER_ADMIN_AUDIT_SUBMISSION,
        targetedStagesJson: stableJson(REQUIRED_SERVICE_VIDEO_STAGES),
        managerUserId: input.managerUserId,
        managerMembershipId: input.managerMembershipId,
        packageHash: pkg.packageHash,
        packageVersion: pkg.version,
        attestationJson,
        attestationHash,
        evidenceVersion: CORE_ADMIN_AUDIT_EVIDENCE_VERSION,
      },
    });
    const updatedPackage = await tx.serviceVideoPackageEvidence.update({
      where: { id: pkg.id },
      data: { managerDecisionId: managerDecision.id },
    });
    const updatedBooking = await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        status: "COMPLETED",
        customerMetadata: setOperationalPhaseOnMetadataJson(
          booking.customerMetadata,
          "AWAITING_ADMIN_REVIEW",
        ),
      },
    });

    const adminNotificationId = `service-video-admin-audit-${pkg.id}`;
    await tx.adminNotification.upsert({
      where: { id: adminNotificationId },
      create: {
        id: adminNotificationId,
        vendorId: input.vendorId,
        type: "SERVICE_VIDEO_ADMIN_AUDIT_REQUIRED",
        title: "Service Video package requires Reliance Audit",
        message: "A vendor manager submitted a complete Service Video package for final Reliance Audit.",
        metadata: stableJson({
          bookingId: input.bookingId,
          packageId: pkg.id,
          packageVersion: pkg.version,
        }),
        read: false,
      },
      update: {},
    });
    let adminEmailNotification = await tx.bookingNotification.findFirst({
      where: { bookingId: input.bookingId, kind: CORE_ADMIN_AUDIT_READY_NOTIFICATION_KIND },
    });
    if (!adminEmailNotification) {
      adminEmailNotification = await tx.bookingNotification.create({
        data: {
          bookingId: input.bookingId,
          kind: CORE_ADMIN_AUDIT_READY_NOTIFICATION_KIND,
          status: "QUEUED",
          idempotencyKey: `service-video-admin-audit:${pkg.id}`,
        },
      });
    }
    return {
      booking: updatedBooking,
      package: updatedPackage,
      managerDecision,
      adminNotificationId,
      adminEmailNotificationId: adminEmailNotification.id,
      firstTransition: true,
    };
  }, { isolationLevel: "Serializable" });
}

export async function loadCoreAdminAuditCandidate(db: any, bookingId: string) {
  const pkg = await db.serviceVideoPackageEvidence.findFirst({
    where: { bookingId, isCurrent: true },
  });
  if (!pkg || String(pkg.status).toUpperCase() !== PACKAGE_AWAITING_ADMIN_AUDIT) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_PACKAGE_NOT_ELIGIBLE");
  }
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      vendorId: true,
      userId: true,
      status: true,
      title: true,
      clientName: true,
      date: true,
      customerMetadata: true,
      rejectionReason: true,
      user: { select: { name: true, email: true, phone: true } },
      service: { select: { id: true, name: true } },
      vendor: { select: { name: true, businessName: true } },
    },
  });
  const phase = getRelianceOps(parseCustomerMetadataRecord(booking?.customerMetadata)).operational_phase;
  if (
    !booking ||
    String(booking.status).toUpperCase() !== "COMPLETED" ||
    String(phase || "").toUpperCase() !== "AWAITING_ADMIN_REVIEW"
  ) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_WORK_RECORD_NOT_ELIGIBLE");
  }
  const managerDecision = pkg.managerDecisionId
    ? await db.serviceVideoManagerDecisionEvidence.findFirst({
        where: {
          id: pkg.managerDecisionId,
          packageId: pkg.id,
          bookingId,
          vendorId: booking.vendorId,
          decision: MANAGER_ADMIN_AUDIT_SUBMISSION,
          packageHash: pkg.packageHash,
          packageVersion: pkg.version,
        },
      })
    : null;
  if (!managerDecision?.attestationHash || !managerDecision?.attestationJson) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_ATTESTATION_MISSING");
  }
  if (sha256(managerDecision.attestationJson) !== managerDecision.attestationHash) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_ATTESTATION_INVALID");
  }
  const managerMembership = db.vendorMembership?.findFirst
    ? await db.vendorMembership.findFirst({
        where: {
          id: managerDecision.managerMembershipId,
          vendorId: booking.vendorId,
          userId: managerDecision.managerUserId,
          role: "MANAGER",
          status: "ACTIVE",
        },
        select: { id: true, user: { select: { name: true, email: true } } },
      })
    : { id: managerDecision.managerMembershipId };
  if (!managerMembership) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_MANAGER_MEMBERSHIP_INVALID");
  }
  const existingDecision = await db.serviceVideoAdminAuditDecisionEvidence.findUnique({
    where: { packageId: pkg.id },
  });
  if (existingDecision) throw new CoreAdminAuditError("ADMIN_AUDIT_ALREADY_DECIDED");
  const activeGrant = await db.privateProofAccessGrant.findFirst({
    where: { packageId: pkg.id, status: "ACTIVE", revokedAt: null },
  });
  if (activeGrant) throw new CoreAdminAuditError("ADMIN_AUDIT_CUSTOMER_PROOF_ALREADY_RELEASED");
  const packageStages = parsePackageStages(pkg.stageEvidenceJson);
  const stageEvidence = await loadBoundStageEvidence(db, packageStages, {
    bookingId,
    vendorId: booking.vendorId,
  });
  const mediaAssets = await loadBoundMediaAssets(db, packageStages);
  const assessmentIds = Array.from(
    new Set(stageEvidence.map((stage: any) => String(stage.assessmentId || "")).filter(Boolean)),
  );
  if (assessmentIds.length !== 1) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_RECORDING_SCOPE_MISMATCH");
  }
  const recordingAssessment = db.recordingScopeAssessment?.findFirst
    ? await db.recordingScopeAssessment.findFirst({
        where: {
          id: assessmentIds[0],
          bookingId,
          vendorId: booking.vendorId,
        },
      })
    : null;
  const recordingAssessmentInterpretation = recordingAssessment
    ? interpretRecordingAssessment(recordingAssessment)
    : null;
  if (recordingAssessment && stageEvidence.some(
    (stage: any) => Number(stage.assessmentGeneration) !== Number(recordingAssessment.generation),
  )) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_RECORDING_SCOPE_MISMATCH");
  }
  assertManagerSubmissionBinding({
    attestation: parseManagerSubmissionAttestation(managerDecision.attestationJson),
    managerDecision,
    pkg,
    booking,
    packageStages,
    stageEvidence,
    recordingAssessment,
  });
  const audioAudit = validatePackageAudio(stageEvidence, mediaAssets, { strict: false });
  for (const asset of mediaAssets as any[]) {
    if (
      String(asset.moderationStatus || "").toLowerCase() !== "pending_review" ||
      String(asset.visibilityStatus || "").toLowerCase() !== "private"
    ) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_MEDIA_NOT_PRIVATE_PENDING");
    }
  }
  return {
    booking,
    package: pkg,
    managerDecision,
    managerMembership,
    packageStages,
    stageEvidence,
    mediaAssets,
    audioAudit,
    recordingAssessment,
    recordingAssessmentInterpretation,
  };
}

export async function resolveCoreAdminAuditPendingPackages(
  db: any,
  options: { vendorId?: string | null; includeVendorIds?: string[] | null } = {},
) {
  const packageRows = await db.serviceVideoPackageEvidence.findMany({
    where: {
      isCurrent: true,
      status: PACKAGE_AWAITING_ADMIN_AUDIT,
      ...(options.vendorId ? { vendorId: options.vendorId } : {}),
      ...(options.includeVendorIds?.length ? { vendorId: { in: options.includeVendorIds } } : {}),
    },
    select: { id: true, bookingId: true, vendorId: true, submittedAt: true },
    orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
  });
  const candidates: any[] = [];
  const issues: CoreAdminAuditQueueIssue[] = [];
  for (const row of packageRows) {
    try {
      candidates.push(await loadCoreAdminAuditCandidate(db, String(row.bookingId)));
    } catch (error) {
      const code = error instanceof CoreAdminAuditError
        ? error.code
        : "ADMIN_AUDIT_CANDIDATE_RESOLUTION_FAILED";
      const correlationId = sha256(`admin-audit-queue:${row.id}:${code}`).slice(0, 12).toUpperCase();
      issues.push({
        bookingId: String(row.bookingId),
        vendorId: String(row.vendorId),
        packageId: String(row.id),
        code,
        correlationId,
        submittedAt: row.submittedAt || null,
      });
      console.error("[core-admin-audit] pending package integrity issue", {
        bookingId: row.bookingId,
        packageId: row.id,
        code,
        correlationId,
      });
    }
  }
  return { candidates, issues };
}

export async function isCoreAdminAuditEligible(db: any, bookingId: string): Promise<boolean> {
  try {
    await loadCoreAdminAuditCandidate(db, bookingId);
    return true;
  } catch {
    return false;
  }
}

export async function decideCoreServiceVideoAdminAudit(input: {
  bookingId: string;
  adminUserId: string;
  adminRole: string;
  decision: CoreAdminAuditDecision;
  rejectionCategory?: string | null;
  reason?: string | null;
  publicDisplayEligibility?: CoreAdminPublicDisplayEligibility | null;
  publicDisplayReason?: string | null;
}) {
  const decision = String(input.decision || "").toUpperCase() as CoreAdminAuditDecision;
  const rejectionCategory = String(input.rejectionCategory || "").trim().toUpperCase();
  const reason = String(input.reason || "").trim();
  const publicDisplayEligibility = String(input.publicDisplayEligibility || "").trim().toUpperCase();
  const publicDisplayReason = String(input.publicDisplayReason || "").trim();
  if (!(["PASS", "REJECT"] as string[]).includes(decision)) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_DECISION_INVALID");
  }
  if (decision === "REJECT" && !isCoreAdminAuditRejectionCategory(rejectionCategory)) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_REJECTION_CATEGORY_INVALID");
  }
  if (decision === "REJECT" && !reason) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_REJECTION_REASON_REQUIRED");
  }
  if (
    decision === "PASS" &&
    !Object.values(CORE_ADMIN_PUBLIC_DISPLAY_ELIGIBILITY).includes(publicDisplayEligibility as CoreAdminPublicDisplayEligibility)
  ) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_PUBLIC_ELIGIBILITY_REQUIRED");
  }
  if (
    decision === "PASS" &&
    publicDisplayEligibility === CORE_ADMIN_PUBLIC_DISPLAY_ELIGIBILITY.PRIVATE_ONLY &&
    !publicDisplayReason
  ) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_PRIVATE_ONLY_REASON_REQUIRED");
  }

  return (prisma as any).$transaction(async (tx: any) => {
    const currentPackage = await tx.serviceVideoPackageEvidence.findFirst({
      where: { bookingId: input.bookingId, isCurrent: true },
    });
    if (!currentPackage) throw new CoreAdminAuditError("ADMIN_AUDIT_PACKAGE_NOT_FOUND");
    const priorDecision = await tx.serviceVideoAdminAuditDecisionEvidence.findUnique({
      where: { packageId: currentPackage.id },
    });
    if (priorDecision) {
      if (String(priorDecision.decision).toUpperCase() !== decision) {
        throw new CoreAdminAuditError("ADMIN_AUDIT_TERMINAL_DECISION_CONFLICT");
      }
      if (
        decision === "PASS" &&
        String(priorDecision.publicDisplayEligibility || "").toUpperCase() !== publicDisplayEligibility
      ) {
        throw new CoreAdminAuditError("ADMIN_AUDIT_TERMINAL_DECISION_CONFLICT");
      }
      return {
        decision: priorDecision,
        package: currentPackage,
        booking: await tx.booking.findUnique({ where: { id: input.bookingId } }),
        customerNotificationId: priorDecision.customerNotificationId,
        vendorNotificationId: `vendor-core-audit-${decision.toLowerCase()}-${currentPackage.id}`,
        alreadyDecided: true,
      };
    }

    const candidate = await loadCoreAdminAuditCandidate(tx, input.bookingId);
    if (decision === "PASS" && candidate.audioAudit.conformance !== "CONFORMING") {
      throw new CoreAdminAuditError("ADMIN_AUDIT_AUDIO_SCOPE_MISMATCH");
    }
    const now = new Date();
    const publicEligibilityDocument = decision === "PASS" ? {
      evidenceVersion: CORE_ADMIN_PUBLIC_ELIGIBILITY_EVIDENCE_VERSION,
      bookingId: input.bookingId,
      vendorId: candidate.booking.vendorId,
      packageId: candidate.package.id,
      packageVersion: candidate.package.version,
      packageHash: candidate.package.packageHash,
      stageEvidence: candidate.packageStages,
      adminUserId: input.adminUserId,
      eligibility: publicDisplayEligibility,
      reason: publicDisplayReason || null,
      decidedAt: now.toISOString(),
    } : null;
    const decisionDocument = {
      evidenceVersion: CORE_ADMIN_AUDIT_DECISION_EVIDENCE_VERSION,
      bookingId: input.bookingId,
      vendorId: candidate.booking.vendorId,
      packageId: candidate.package.id,
      packageVersion: candidate.package.version,
      packageHash: candidate.package.packageHash,
      stageEvidence: candidate.packageStages,
      audioAudit: candidate.audioAudit,
      managerDecisionId: candidate.managerDecision.id,
      adminUserId: input.adminUserId,
      adminRole: input.adminRole || "ADMIN",
      decision,
      rejectionCategory: decision === "REJECT" ? rejectionCategory : null,
      reason: decision === "REJECT" ? reason : null,
      publicDisplayEligibility: decision === "PASS" ? publicDisplayEligibility : null,
      publicDisplayReason: decision === "PASS" ? publicDisplayReason || null : null,
      decidedAt: now.toISOString(),
    };
    const nextPackageStatus = decision === "PASS" ? "PRIVATE_APPROVED" : PACKAGE_ADMIN_AUDIT_REJECTED;
    const claimed = await tx.serviceVideoPackageEvidence.updateMany({
      where: {
        id: candidate.package.id,
        status: PACKAGE_AWAITING_ADMIN_AUDIT,
        adminAuditDecisionId: null,
      },
      data: { status: nextPackageStatus },
    });
    if (Number(claimed.count || 0) !== 1) {
      throw new CoreAdminAuditError("ADMIN_AUDIT_TERMINAL_DECISION_RACE");
    }

    const auditDecision = await tx.serviceVideoAdminAuditDecisionEvidence.create({
      data: {
        bookingId: input.bookingId,
        vendorId: candidate.booking.vendorId,
        packageId: candidate.package.id,
        packageVersion: candidate.package.version,
        packageHash: candidate.package.packageHash,
        stageEvidenceJson: candidate.package.stageEvidenceJson,
        managerDecisionId: candidate.managerDecision.id,
        adminUserId: input.adminUserId,
        adminRole: input.adminRole || "ADMIN",
        decision,
        rejectionCategory: decision === "REJECT" ? rejectionCategory : null,
        reason: decision === "REJECT" ? reason : null,
        decisionHash: sha256(decisionDocument),
        evidenceVersion: CORE_ADMIN_AUDIT_DECISION_EVIDENCE_VERSION,
        customerProofReleased: false,
        publicDisplayEligibility: decision === "PASS" ? publicDisplayEligibility : null,
        publicDisplayReason: decision === "PASS" ? publicDisplayReason || null : null,
        publicEligibilityHash: publicEligibilityDocument ? sha256(publicEligibilityDocument) : null,
        publicEligibilityEvidenceVersion: publicEligibilityDocument
          ? CORE_ADMIN_PUBLIC_ELIGIBILITY_EVIDENCE_VERSION
          : null,
        decidedAt: now,
      },
    });

    let grant: any = null;
    let customerNotification: any = null;
    let vendorNotification: any = null;
    if (decision === "PASS") {
      grant = await tx.privateProofAccessGrant.create({
        data: {
          packageId: candidate.package.id,
          bookingId: input.bookingId,
          vendorId: candidate.booking.vendorId,
          customerUserId: candidate.booking.userId,
          managerDecisionId: candidate.managerDecision.id,
          adminAuditDecisionId: auditDecision.id,
          status: "ACTIVE",
          grantedByUserId: input.adminUserId,
        },
      });
      const releasedAssets = await tx.mediaAsset.updateMany({
        where: { id: { in: candidate.packageStages.map((row) => row.mediaAssetId) }, deletedAt: null },
        data: {
          moderationStatus: "approved",
          visibilityStatus: "customer_only",
          moderationReason: null,
          moderatedAt: now,
          moderatedByUserId: input.adminUserId,
        },
      });
      if (Number(releasedAssets.count || 0) !== REQUIRED_SERVICE_VIDEO_STAGES.length) {
        throw new CoreAdminAuditError("ADMIN_AUDIT_MEDIA_RELEASE_RACE");
      }
      customerNotification = await tx.bookingNotification.create({
        data: {
          bookingId: input.bookingId,
          kind: CORE_PRIVATE_PROOF_READY_NOTIFICATION_KIND,
          status: "QUEUED",
          idempotencyKey: `private-proof-ready:${candidate.package.id}`,
        },
      });
      vendorNotification = await tx.bookingNotification.create({
        data: {
          id: `vendor-core-audit-pass-${candidate.package.id}`,
          bookingId: input.bookingId,
          kind: CORE_VENDOR_AUDIT_PASSED_NOTIFICATION_KIND,
          status: "QUEUED",
          idempotencyKey: `vendor-core-audit-passed:${candidate.package.id}`,
        },
      });
      await tx.serviceVideoAdminAuditDecisionEvidence.update({
        where: { id: auditDecision.id },
        data: {
          customerProofReleased: true,
          customerAccessGrantId: grant.id,
          customerNotificationId: customerNotification.id,
        },
      });
      await tx.serviceVideoPackageEvidence.update({
        where: { id: candidate.package.id },
        data: {
          adminAuditDecisionId: auditDecision.id,
          customerAccessGrantId: grant.id,
        },
      });
      await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          status: "COMPLETED",
          customerMetadata: setOperationalPhaseOnMetadataJson(
            candidate.booking.customerMetadata,
            "COMPLETED",
          ),
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
        },
      });
    } else {
      await tx.privateProofAccessGrant.updateMany({
        where: { packageId: candidate.package.id, status: "ACTIVE", revokedAt: null },
        data: { status: "REVOKED", revokedAt: now },
      });
      const rejectedAssets = await tx.mediaAsset.updateMany({
        where: { id: { in: candidate.packageStages.map((row) => row.mediaAssetId) }, deletedAt: null },
        data: {
          moderationStatus: "rejected",
          visibilityStatus: "private",
          moderationReason: reason,
          moderatedAt: now,
          moderatedByUserId: input.adminUserId,
        },
      });
      if (Number(rejectedAssets.count || 0) !== REQUIRED_SERVICE_VIDEO_STAGES.length) {
        throw new CoreAdminAuditError("ADMIN_AUDIT_MEDIA_REJECTION_RACE");
      }
      customerNotification = await tx.bookingNotification.create({
        data: {
          bookingId: input.bookingId,
          kind: CORE_PRIVATE_PROOF_REJECTED_NOTIFICATION_KIND,
          status: "QUEUED",
          idempotencyKey: `private-proof-audit-rejected:${candidate.package.id}`,
        },
      });
      vendorNotification = await tx.bookingNotification.create({
        data: {
          id: `vendor-core-audit-reject-${candidate.package.id}`,
          bookingId: input.bookingId,
          kind: CORE_VENDOR_AUDIT_REJECTED_NOTIFICATION_KIND,
          status: "QUEUED",
          idempotencyKey: `vendor-core-audit-rejected:${candidate.package.id}`,
        },
      });
      await tx.serviceVideoAdminAuditDecisionEvidence.update({
        where: { id: auditDecision.id },
        data: { customerNotificationId: customerNotification.id },
      });
      await tx.serviceVideoPackageEvidence.update({
        where: { id: candidate.package.id },
        data: { adminAuditDecisionId: auditDecision.id, customerAccessGrantId: null },
      });
      await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          status: "REJECTED",
          customerMetadata: setOperationalPhaseOnMetadataJson(
            candidate.booking.customerMetadata,
            "REJECTED",
          ),
          rejectionReason: `${rejectionCategory}: ${reason}`,
          rejectedAt: now,
          rejectedBy: input.adminUserId,
        },
      });
    }

    if (vendorNotification) {
      const serviceName = candidate.booking.service?.name || candidate.booking.title || "Service Order";
      await createVendorManagerAuditNotifications(tx, {
        vendorId: candidate.booking.vendorId,
        bookingId: input.bookingId,
        packageId: candidate.package.id,
        sourceAdminDecisionId: auditDecision.id,
        sourceBookingNotificationId: vendorNotification.id,
        notificationType: decision === "PASS"
          ? CORE_VENDOR_AUDIT_PASSED_NOTIFICATION_KIND
          : CORE_VENDOR_AUDIT_REJECTED_NOTIFICATION_KIND,
        title: decision === "PASS" ? "Reliance Audit Passed" : "Reliance Audit Failed",
        message: decision === "PASS"
          ? `${serviceName}: Private Proof was released to the customer. No video was made Public.`
          : `${serviceName}: ${rejectionCategory}. ${reason}`,
      });
    }

    await tx.adminAuditLog.create({
      data: {
        actionType: decision === "PASS" ? "core_service_video_admin_pass" : "core_service_video_admin_reject",
        entityType: "service_video_package",
        entityId: candidate.package.id,
        actorUserId: input.adminUserId,
        previousValue: stableJson({ status: PACKAGE_AWAITING_ADMIN_AUDIT }),
        newValue: stableJson({ status: nextPackageStatus, decisionEvidenceId: auditDecision.id }),
        metadata: stableJson({
          bookingId: input.bookingId,
          vendorId: candidate.booking.vendorId,
          packageVersion: candidate.package.version,
          packageHash: candidate.package.packageHash,
          managerDecisionId: candidate.managerDecision.id,
          rejectionCategory: decision === "REJECT" ? rejectionCategory : null,
          publicDisplayEligibility: decision === "PASS" ? publicDisplayEligibility : null,
          publicEligibilityHash: publicEligibilityDocument ? sha256(publicEligibilityDocument) : null,
        }),
      },
    });

    return {
      decision: { ...auditDecision, customerAccessGrantId: grant?.id || null, customerNotificationId: customerNotification?.id || null },
      package: await tx.serviceVideoPackageEvidence.findUnique({ where: { id: candidate.package.id } }),
      booking: await tx.booking.findUnique({ where: { id: input.bookingId } }),
      grant,
      customerNotificationId: customerNotification?.id || null,
      vendorNotificationId: vendorNotification?.id || null,
      alreadyDecided: false,
    };
  }, { isolationLevel: "Serializable" });
}

export async function assertNoTerminalCoreAdminRejection(db: any, input: {
  bookingId: string;
  vendorId?: string;
}) {
  const pkg = await db.serviceVideoPackageEvidence.findFirst({
    where: {
      bookingId: input.bookingId,
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      isCurrent: true,
    },
    select: { id: true, status: true, adminAuditDecisionId: true },
  });
  if (String(pkg?.status || "").toUpperCase() === PACKAGE_ADMIN_AUDIT_REJECTED) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_REJECTED_TERMINAL");
  }
  if (pkg?.adminAuditDecisionId) {
    const decision = await db.serviceVideoAdminAuditDecisionEvidence.findFirst({
      where: { id: pkg.adminAuditDecisionId, packageId: pkg.id, decision: "REJECT" },
      select: { id: true },
    });
    if (decision) throw new CoreAdminAuditError("ADMIN_AUDIT_REJECTED_TERMINAL");
  }
}

export async function assertCoreAdminAuditMutationAllowed(db: any, input: {
  bookingId: string;
  vendorId?: string;
}) {
  const pkg = await db.serviceVideoPackageEvidence.findFirst({
    where: {
      bookingId: input.bookingId,
      ...(input.vendorId ? { vendorId: input.vendorId } : {}),
      isCurrent: true,
    },
    select: { id: true, status: true, adminAuditDecisionId: true },
  });
  const status = String(pkg?.status || "").toUpperCase();
  if (status === PACKAGE_AWAITING_ADMIN_AUDIT) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_IN_PROGRESS");
  }
  if (status === PACKAGE_ADMIN_AUDIT_REJECTED) {
    throw new CoreAdminAuditError("ADMIN_AUDIT_REJECTED_TERMINAL");
  }
  if (status === "PRIVATE_APPROVED") {
    throw new CoreAdminAuditError("ADMIN_AUDIT_PASSED_TERMINAL");
  }
  if (pkg?.adminAuditDecisionId) {
    const decision = await db.serviceVideoAdminAuditDecisionEvidence.findFirst({
      where: { id: pkg.adminAuditDecisionId, packageId: pkg.id },
      select: { id: true, decision: true },
    });
    if (String(decision?.decision || "").toUpperCase() === "REJECT") {
      throw new CoreAdminAuditError("ADMIN_AUDIT_REJECTED_TERMINAL");
    }
    if (String(decision?.decision || "").toUpperCase() === "PASS") {
      throw new CoreAdminAuditError("ADMIN_AUDIT_PASSED_TERMINAL");
    }
  }
}
