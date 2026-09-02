import { createHash, randomBytes } from "crypto";

import { prisma } from "@/server/db";
import { openMediaLifecycleCaseInTransaction } from "@/lib/media-lifecycle";
import { resolveCanonicalPublicAssetIds } from "@/lib/service-video-publication";

export const CONTENT_REPORT_REASONS = [
  "private_sensitive_information",
  "wrong_service_or_video",
  "person_or_voice_without_permission",
  "inappropriate_or_abusive",
  "hate_or_harassment",
  "sexual_or_nudity",
  "violence_or_threats",
  "fraud_scam_or_misleading",
  "copyright",
  "other",
] as const;

export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];

const LEGACY_REASON_MAP: Record<string, ContentReportReason> = {
  privacy: "private_sensitive_information",
  misleading: "wrong_service_or_video",
  harassment: "inappropriate_or_abusive",
  hate: "hate_or_harassment",
  nudity: "sexual_or_nudity",
  violence: "violence_or_threats",
  fraud: "fraud_scam_or_misleading",
  spam: "fraud_scam_or_misleading",
  copyright: "copyright",
  other: "other",
};

const REASON_POLICY: Record<ContentReportReason, { severity: string; policyCategory: string; ownerPublicHold: boolean }> = {
  private_sensitive_information: { severity: "high", policyCategory: "PRIVACY", ownerPublicHold: true },
  wrong_service_or_video: { severity: "high", policyCategory: "MATERIAL_MISREPRESENTATION", ownerPublicHold: true },
  person_or_voice_without_permission: { severity: "high", policyCategory: "IDENTITY", ownerPublicHold: true },
  inappropriate_or_abusive: { severity: "medium", policyCategory: "SAFETY", ownerPublicHold: true },
  hate_or_harassment: { severity: "high", policyCategory: "SAFETY", ownerPublicHold: true },
  sexual_or_nudity: { severity: "high", policyCategory: "SAFETY", ownerPublicHold: true },
  violence_or_threats: { severity: "critical", policyCategory: "SAFETY", ownerPublicHold: true },
  fraud_scam_or_misleading: { severity: "high", policyCategory: "MATERIAL_MISREPRESENTATION", ownerPublicHold: false },
  copyright: { severity: "medium", policyCategory: "COPYRIGHT", ownerPublicHold: false },
  other: { severity: "medium", policyCategory: "OTHER", ownerPublicHold: false },
};

export class ContentReportError extends Error {
  constructor(public code: string, message: string, public statusCode: number) {
    super(message);
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

export function contentReportHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function normalizeContentReportReason(value: unknown): ContentReportReason | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if ((CONTENT_REPORT_REASONS as readonly string[]).includes(normalized)) {
    return normalized as ContentReportReason;
  }
  return LEGACY_REASON_MAP[normalized] || null;
}

function parsePackageStages(value: unknown): Array<{
  stage: string;
  stageEvidenceId: string;
  stageVersion: number;
  mediaAssetId: string;
  contentHash: string;
}> {
  try {
    const rows = JSON.parse(String(value || "[]"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export type ReportableMediaEvidence = {
  bookingId: string;
  vendorId: string;
  customerUserId: string;
  packageId: string;
  packageVersion: number;
  packageHash: string;
  stageEvidenceId: string;
  stage: string;
  stageVersion: number;
  stageHash: string;
  mediaAssetId: string;
  mediaContentHash: string;
  adminAuditDecisionId: string | null;
  visibilityAtReport: "PUBLIC" | "PRIVATE_PROOF";
  accessBasis: "OWNING_CUSTOMER_PRIVATE_PROOF" | "OWNING_CUSTOMER_PUBLIC" | "AUTHENTICATED_PUBLIC_VIEWER";
  reporterIsOwningCustomer: boolean;
  proposalId: string | null;
};

export async function resolveReportableMediaEvidence(input: {
  mediaAssetId: string;
  reporterUserId: string;
}): Promise<ReportableMediaEvidence> {
  const asset = await (prisma as any).mediaAsset.findUnique({
    where: { id: input.mediaAssetId },
    select: {
      id: true,
      vendorId: true,
      contentHash: true,
      moderationStatus: true,
      visibilityStatus: true,
      archiveStatus: true,
      uploadState: true,
      deletedAt: true,
      mediaSession: { select: { bookingId: true, vendorId: true, vendorJobVideoStage: true } },
    },
  });
  const bookingId = String(asset?.mediaSession?.bookingId || "");
  if (
    !asset || !bookingId || asset.deletedAt || asset.archiveStatus !== "active" ||
    asset.uploadState !== "SAVED" || asset.moderationStatus !== "approved" || !asset.contentHash
  ) {
    throw new ContentReportError("REPORT_MEDIA_NOT_AVAILABLE", "This video is not available for reporting.", 404);
  }
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, vendorId: true },
  });
  if (!booking) throw new ContentReportError("REPORT_MEDIA_NOT_AVAILABLE", "This video is not available for reporting.", 404);
  const reporterIsOwningCustomer = String(booking.userId) === input.reporterUserId;
  const canonicalPublicIds = await resolveCanonicalPublicAssetIds({ bookingId });
  const isCanonicalPublic = canonicalPublicIds.includes(asset.id);

  let pkg: any = null;
  let adminAuditDecision: any = null;
  let proposalId: string | null = null;
  if (isCanonicalPublic) {
    const eligibility = await (prisma as any).publicServiceVideoEligibility.findFirst({
      where: { bookingId, mediaAssetId: asset.id, status: "ACTIVE", invalidatedAt: null },
      orderBy: { eligibleAt: "desc" },
    });
    if (!eligibility) throw new ContentReportError("REPORT_PUBLIC_MEDIA_NOT_CANONICAL", "This video is not currently Public.", 403);
    proposalId = String(eligibility.proposalId || "") || null;
    pkg = await (prisma as any).serviceVideoPackageEvidence.findFirst({
      where: { id: eligibility.packageId, bookingId, packageHash: eligibility.packageHash, isCurrent: true, status: "PRIVATE_APPROVED" },
    });
    adminAuditDecision = await (prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst({
      where: { packageId: eligibility.packageId, bookingId, packageHash: eligibility.packageHash, decision: "PASS" },
    });
  } else {
    if (!reporterIsOwningCustomer) {
      throw new ContentReportError("REPORT_MEDIA_ACCESS_DENIED", "You do not have access to report this video.", 403);
    }
    if (!["customer_only", "public"].includes(String(asset.visibilityStatus || "").toLowerCase())) {
      throw new ContentReportError("REPORT_MEDIA_ACCESS_DENIED", "This video is not available through Private Proof.", 403);
    }
    const grant = await (prisma as any).privateProofAccessGrant.findFirst({
      where: { bookingId, customerUserId: input.reporterUserId, status: "ACTIVE", revokedAt: null },
      orderBy: { grantedAt: "desc" },
    });
    if (!grant) throw new ContentReportError("REPORT_PRIVATE_PROOF_REQUIRED", "Active Private Proof access is required.", 403);
    pkg = await (prisma as any).serviceVideoPackageEvidence.findFirst({
      where: {
        id: grant.packageId,
        bookingId,
        vendorId: booking.vendorId,
        isCurrent: true,
        status: "PRIVATE_APPROVED",
        customerAccessGrantId: grant.id,
        adminAuditDecisionId: grant.adminAuditDecisionId,
      },
    });
    if (!pkg) {
      throw new ContentReportError("REPORT_PACKAGE_EVIDENCE_MISMATCH", "The approved Service Video package could not be verified.", 403);
    }
    adminAuditDecision = grant.adminAuditDecisionId
      ? await (prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst({
          where: {
            id: grant.adminAuditDecisionId,
            bookingId,
            packageId: grant.packageId,
            packageHash: pkg.packageHash,
            managerDecisionId: grant.managerDecisionId,
            decision: "PASS",
            customerProofReleased: true,
            customerAccessGrantId: grant.id,
          },
        })
      : null;
  }
  if (!pkg) throw new ContentReportError("REPORT_PACKAGE_EVIDENCE_MISMATCH", "The approved Service Video package could not be verified.", 403);
  const packaged = parsePackageStages(pkg.stageEvidenceJson).find((row) => row.mediaAssetId === asset.id);
  if (!packaged || packaged.contentHash !== asset.contentHash) {
    throw new ContentReportError("REPORT_STAGE_EVIDENCE_MISMATCH", "The reported stage is not part of the approved package.", 403);
  }
  const stageEvidence = await (prisma as any).serviceVideoStageEvidence.findFirst({
    where: {
      id: packaged.stageEvidenceId,
      bookingId,
      vendorId: booking.vendorId,
      stage: packaged.stage,
      stageVersion: packaged.stageVersion,
      mediaAssetId: asset.id,
      contentHash: packaged.contentHash,
      uploadState: "SAVED",
    },
  });
  if (!stageEvidence) throw new ContentReportError("REPORT_STAGE_EVIDENCE_MISMATCH", "The reported stage evidence could not be verified.", 403);
  if (!adminAuditDecision && pkg.adminAuditDecisionId) {
    adminAuditDecision = await (prisma as any).serviceVideoAdminAuditDecisionEvidence.findFirst({
      where: { id: pkg.adminAuditDecisionId, packageId: pkg.id, packageHash: pkg.packageHash, decision: "PASS" },
    });
  }
  if (!adminAuditDecision) {
    throw new ContentReportError("REPORT_ADMIN_PASS_REQUIRED", "The approved Reliance Audit evidence could not be verified.", 403);
  }
  return {
    bookingId,
    vendorId: String(booking.vendorId),
    customerUserId: String(booking.userId),
    packageId: String(pkg.id),
    packageVersion: Number(pkg.version),
    packageHash: String(pkg.packageHash),
    stageEvidenceId: String(stageEvidence.id),
    stage: String(stageEvidence.stage),
    stageVersion: Number(stageEvidence.stageVersion),
    stageHash: String(stageEvidence.contentHash),
    mediaAssetId: String(asset.id),
    mediaContentHash: String(asset.contentHash),
    adminAuditDecisionId: String(adminAuditDecision.id),
    visibilityAtReport: isCanonicalPublic ? "PUBLIC" : "PRIVATE_PROOF",
    accessBasis: isCanonicalPublic
      ? reporterIsOwningCustomer ? "OWNING_CUSTOMER_PUBLIC" : "AUTHENTICATED_PUBLIC_VIEWER"
      : "OWNING_CUSTOMER_PRIVATE_PROOF",
    reporterIsOwningCustomer,
    proposalId,
  };
}

export async function appendContentReportEvent(tx: any, input: {
  reportId: string;
  eventType: string;
  actorUserId?: string | null;
  actorRole: string;
  priorStatus?: string | null;
  resultingStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const metadataJson = stableJson(input.metadata || {});
  return tx.contentReportCaseEvent.create({
    data: {
      reportId: input.reportId,
      eventType: input.eventType,
      actorUserId: input.actorUserId || null,
      actorRole: input.actorRole,
      priorStatus: input.priorStatus || null,
      resultingStatus: input.resultingStatus || null,
      reason: input.reason || null,
      metadataJson,
      evidenceHash: contentReportHash({
        reportId: input.reportId,
        eventType: input.eventType,
        actorUserId: input.actorUserId || null,
        actorRole: input.actorRole,
        priorStatus: input.priorStatus || null,
        resultingStatus: input.resultingStatus || null,
        reason: input.reason || null,
        metadataJson,
      }),
    },
  });
}

function caseReference(): string {
  return `RP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createServiceVideoReportCase(input: {
  request: Request;
  reporterUserId: string;
  reporterRole: string;
  requestId: string;
  reasonCategory: ContentReportReason;
  reasonDetail?: string | null;
  evidence: ReportableMediaEvidence;
}) {
  const policy = REASON_POLICY[input.reasonCategory];
  const canonicalPayload = {
    targetType: "media_asset",
    targetId: input.evidence.mediaAssetId,
    reasonCategory: input.reasonCategory,
    reasonDetail: input.reasonDetail || null,
  };
  const payloadHash = contentReportHash(canonicalPayload);
  const idempotencyKey = contentReportHash({ reporterUserId: input.reporterUserId, requestId: input.requestId });
  const semanticKey = contentReportHash({
    reporterUserId: input.reporterUserId,
    targetType: canonicalPayload.targetType,
    targetId: canonicalPayload.targetId,
    payloadHash,
    fiveMinuteBucket: Math.floor(Date.now() / (5 * 60 * 1000)),
  });
  const create = async () => (prisma as any).$transaction(async (tx: any) => {
    const existingRequest = await tx.contentReportRequest.findUnique({ where: { idempotencyKey } });
    if (existingRequest) {
      if (existingRequest.payloadHash !== payloadHash) {
        throw new ContentReportError("REPORT_IDEMPOTENCY_CONFLICT", "This report request was already used with different details.", 409);
      }
      const existing = await tx.contentReport.findUnique({ where: { id: existingRequest.reportId } });
      return { report: existing, idempotent: true, publicHoldApplied: Boolean(existing?.lifecycleCaseId) };
    }
    const semanticDuplicate = await tx.contentReportRequest.findUnique({ where: { semanticKey } });
    if (semanticDuplicate) {
      const existing = await tx.contentReport.findUnique({ where: { id: semanticDuplicate.reportId } });
      return { report: existing, idempotent: true, publicHoldApplied: Boolean(existing?.lifecycleCaseId) };
    }
    const now = new Date();
    const recentSameAsset = await tx.contentReport.count({
      where: {
        reporterUserId: input.reporterUserId,
        targetType: "media_asset",
        targetId: input.evidence.mediaAssetId,
        createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
      },
    });
    const recentTotal = await tx.contentReport.count({
      where: { reporterUserId: input.reporterUserId, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
    if (recentSameAsset >= 3 || recentTotal >= 20) {
      throw new ContentReportError("REPORT_RATE_LIMITED", "Please wait before submitting another report.", 429);
    }
    const groupingKey = contentReportHash({
      bookingId: input.evidence.bookingId,
      packageId: input.evidence.packageId,
      mediaAssetId: input.evidence.mediaAssetId,
    });
    let report = await tx.contentReport.create({
      data: {
        targetType: "media_asset",
        targetId: input.evidence.mediaAssetId,
        bookingId: input.evidence.bookingId,
        vendorId: input.evidence.vendorId,
        reportedUserId: input.evidence.customerUserId,
        reportedVendorId: input.evidence.vendorId,
        reporterUserId: input.reporterUserId,
        reporterVendorId: null,
        reporterRole: input.reporterRole,
        reasonCategory: input.reasonCategory,
        reasonDetail: input.reasonDetail || null,
        status: "open",
        severity: policy.severity,
        autoHidden: false,
        caseReference: caseReference(),
        contractVersion: 2,
        accessBasis: input.evidence.accessBasis,
        packageId: input.evidence.packageId,
        packageVersion: input.evidence.packageVersion,
        packageHash: input.evidence.packageHash,
        stageEvidenceId: input.evidence.stageEvidenceId,
        stage: input.evidence.stage,
        stageVersion: input.evidence.stageVersion,
        stageHash: input.evidence.stageHash,
        mediaContentHash: input.evidence.mediaContentHash,
        adminAuditDecisionId: input.evidence.adminAuditDecisionId,
        visibilityAtReport: input.evidence.visibilityAtReport,
        policyCategory: policy.policyCategory,
        groupingKey,
      },
    });
    await appendContentReportEvent(tx, {
      reportId: report.id,
      eventType: "REPORT_CREATED",
      actorUserId: input.reporterUserId,
      actorRole: input.reporterRole,
      resultingStatus: "open",
      metadata: {
        contractVersion: 2,
        accessBasis: input.evidence.accessBasis,
        packageId: input.evidence.packageId,
        packageVersion: input.evidence.packageVersion,
        packageHash: input.evidence.packageHash,
        stageEvidenceId: input.evidence.stageEvidenceId,
        stage: input.evidence.stage,
        stageVersion: input.evidence.stageVersion,
        stageHash: input.evidence.stageHash,
        mediaAssetId: input.evidence.mediaAssetId,
        mediaContentHash: input.evidence.mediaContentHash,
        adminAuditDecisionId: input.evidence.adminAuditDecisionId,
        visibilityAtReport: input.evidence.visibilityAtReport,
        policyCategory: policy.policyCategory,
      },
    });
    let publicHoldApplied = false;
    if (
      input.evidence.visibilityAtReport === "PUBLIC" &&
      input.evidence.reporterIsOwningCustomer &&
      policy.ownerPublicHold
    ) {
      const lifecycleCase = await openMediaLifecycleCaseInTransaction(tx, {
        bookingId: input.evidence.bookingId,
        vendorId: input.evidence.vendorId,
        actorUserId: input.reporterUserId,
        actorRole: "CUSTOMER",
        category: policy.policyCategory,
        reasonDetail: input.reasonDetail || input.reasonCategory,
        packageId: input.evidence.packageId,
        proposalId: input.evidence.proposalId,
        mediaAssetId: input.evidence.mediaAssetId,
        contentReportId: report.id,
        request: input.request,
      });
      report = await tx.contentReport.update({
        where: { id: report.id },
        data: { lifecycleCaseId: lifecycleCase.id, publicHoldAppliedAt: now, autoHidden: true },
      });
      await appendContentReportEvent(tx, {
        reportId: report.id,
        eventType: "PUBLIC_HOLD_APPLIED",
        actorUserId: input.reporterUserId,
        actorRole: "CUSTOMER",
        priorStatus: "open",
        resultingStatus: "open",
        metadata: { lifecycleCaseId: lifecycleCase.id, policyCategory: policy.policyCategory },
      });
      publicHoldApplied = true;
    }
    await tx.contentReportRequest.create({
      data: {
        idempotencyKey,
        semanticKey,
        requestId: input.requestId,
        reporterUserId: input.reporterUserId,
        targetType: "media_asset",
        targetId: input.evidence.mediaAssetId,
        payloadHash,
        reportId: report.id,
      },
    });
    return { report, idempotent: false, publicHoldApplied };
  }, { isolationLevel: "Serializable" });
  try {
    return await create();
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    const existingRequest = await (prisma as any).contentReportRequest.findUnique({ where: { idempotencyKey } });
    if (existingRequest && existingRequest.payloadHash !== payloadHash) {
      throw new ContentReportError("REPORT_IDEMPOTENCY_CONFLICT", "This report request conflicts with an existing request.", 409);
    }
    const semanticDuplicate = existingRequest || await (prisma as any).contentReportRequest.findUnique({ where: { semanticKey } });
    if (!semanticDuplicate) throw error;
    const report = await (prisma as any).contentReport.findUnique({ where: { id: semanticDuplicate.reportId } });
    return { report, idempotent: true, publicHoldApplied: Boolean(report?.lifecycleCaseId) };
  }
}

export function safeReportStatus(status: unknown): "Received" | "Under review" | "Resolved" {
  const value = String(status || "").toLowerCase();
  if (["resolved_action_taken", "resolved_no_action", "dismissed"].includes(value)) return "Resolved";
  if (["triaged", "under_review"].includes(value)) return "Under review";
  return "Received";
}
