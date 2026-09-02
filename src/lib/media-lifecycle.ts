import { createHash } from "crypto";

import { prisma } from "@/server/db";
import { deleteBlob, getBlobProperties } from "@/lib/azure-blob-storage";

export const EXPOSURE_ORDER = ["PUBLIC", "PRIVATE", "RESTRICTED", "HELD", "DELETED"] as const;
export type MediaExposureOutcome = (typeof EXPOSURE_ORDER)[number];

const ACTIVE_CASE_STATUSES = ["SUBMITTED", "RESTRICTED", "UNDER_REVIEW", "INFORMATION_NEEDED", "APPEALED"];
const ACTIVE_DELETION_STATUSES = [
  "REQUESTED",
  "ACCESS_RESTRICTED",
  "RETENTION_REVIEW",
  "HELD",
  "QUEUED",
  "ATTEMPTING",
  "VERIFYING",
  "RETRY_REQUIRED",
];

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
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

export function leastExposureOutcome(outcomes: Array<MediaExposureOutcome | string | null | undefined>): MediaExposureOutcome {
  let selected: MediaExposureOutcome = "PUBLIC";
  for (const candidate of outcomes) {
    const normalized = String(candidate || "").toUpperCase() as MediaExposureOutcome;
    if (!EXPOSURE_ORDER.includes(normalized)) continue;
    if (EXPOSURE_ORDER.indexOf(normalized) > EXPOSURE_ORDER.indexOf(selected)) selected = normalized;
  }
  return selected;
}

export function lifecycleModelsAvailable(db: any = prisma): boolean {
  return Boolean(db?.mediaLifecycleRestriction?.findMany && db?.mediaDeletionRequest?.findMany && db?.mediaEvidenceHold?.findMany);
}

function activeScopeWhere(bookingId: string, mediaAssetId?: string | null) {
  return {
    bookingId,
    active: true,
    OR: [{ mediaAssetId: null }, ...(mediaAssetId ? [{ mediaAssetId }] : [])],
  };
}

export async function resolveCanonicalMediaLifecycle(input: {
  bookingId: string;
  mediaAssetId?: string | null;
  intendedAudience?: "PUBLIC" | "PRIVATE";
  db?: any;
}) {
  const db = input.db || (prisma as any);
  if (!lifecycleModelsAvailable(db)) {
    return {
      outcome: input.intendedAudience || "PRIVATE",
      publicAllowed: input.intendedAudience === "PUBLIC",
      privateAllowed: true,
      recordingAllowed: true,
      deletionStatus: null,
      blockReason: null,
      responsibleParticipant: null,
      nextAction: null,
    };
  }

  const [restrictions, holds, deletions, lifecycleCase] = await Promise.all([
    db.mediaLifecycleRestriction.findMany({ where: activeScopeWhere(input.bookingId, input.mediaAssetId) }),
    db.mediaEvidenceHold.findMany({
      where: {
        bookingId: input.bookingId,
        status: { in: ["ACTIVE", "REVIEW_DUE", "EXTENDED"] },
        OR: [{ mediaAssetId: null }, ...(input.mediaAssetId ? [{ mediaAssetId: input.mediaAssetId }] : [])],
      },
    }),
    db.mediaDeletionRequest.findMany({
      where: {
        bookingId: input.bookingId,
        ...(input.mediaAssetId ? { mediaAssetId: input.mediaAssetId } : {}),
        status: { in: [...ACTIVE_DELETION_STATUSES, "COMPLETED"] },
      },
      orderBy: { requestedAt: "desc" },
    }),
    db.mediaLifecycleCase.findFirst({
      where: {
        bookingId: input.bookingId,
        ...(input.mediaAssetId ? { OR: [{ mediaAssetId: input.mediaAssetId }, { mediaAssetId: null }] } : {}),
        status: { in: ACTIVE_CASE_STATUSES },
      },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const completedDeletion = input.mediaAssetId
    ? deletions.find((item: any) => item.status === "COMPLETED")
    : null;
  const intendedAudience = input.intendedAudience || "PRIVATE";
  const audienceRestrictions = restrictions.filter((item: any) => {
    const scope = String(item.scope || "").toUpperCase();
    return scope === "ALL" || scope === intendedAudience;
  });
  const outcomes: MediaExposureOutcome[] = [intendedAudience];
  if (audienceRestrictions.length) outcomes.push(...audienceRestrictions.map((item: any) => item.outcome || "RESTRICTED"));
  if (holds.length) outcomes.push("HELD");
  if (deletions.some((item: any) => ACTIVE_DELETION_STATUSES.includes(item.status))) outcomes.push("RESTRICTED");
  if (completedDeletion) outcomes.push("DELETED");
  const outcome = leastExposureOutcome(outcomes);
  const recordingRestriction = restrictions.find((item: any) => ["RECORDING", "ALL"].includes(String(item.scope).toUpperCase()));

  return {
    outcome,
    publicAllowed: outcome === "PUBLIC",
    privateAllowed: outcome === "PUBLIC" || outcome === "PRIVATE",
    recordingAllowed: !recordingRestriction && !completedDeletion,
    deletionStatus: deletions[0]?.status || null,
    holdStatus: holds[0]?.status || null,
    caseStatus: lifecycleCase?.status || null,
    blockReason: recordingRestriction?.reasonCode || lifecycleCase?.category || (holds.length ? "EVIDENCE_HOLD" : null),
    responsibleParticipant: lifecycleCase?.assignedAdminUserId ? "ADMIN" : recordingRestriction ? "CUSTOMER" : holds.length ? "ADMIN" : null,
    nextAction: lifecycleCase
      ? lifecycleCase.status === "INFORMATION_NEEDED"
        ? "Provide the requested case information."
        : "Reliance is reviewing the scoped concern."
      : holds.length
        ? "An admin must review or release the evidence hold."
        : recordingRestriction
          ? "The vendor manager must continue the service without recording or obtain a new separately authorized decision."
          : null,
  };
}

async function audit(tx: any, input: {
  bookingId: string; vendorId: string; caseId?: string | null; mediaAssetId?: string | null;
  actorUserId?: string | null; actorRole: string; eventType: string; priorState?: string | null;
  resultingState: string; metadata?: Record<string, unknown>; request?: Request | null;
}) {
  const metadataJson = stableJson(input.metadata || {});
  return tx.mediaLifecycleAuditEvent.create({
    data: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      caseId: input.caseId || null,
      mediaAssetId: input.mediaAssetId || null,
      actorUserId: input.actorUserId || null,
      actorRole: input.actorRole,
      eventType: input.eventType,
      priorState: input.priorState || null,
      resultingState: input.resultingState,
      evidenceHash: sha256(`${input.bookingId}:${input.eventType}:${input.resultingState}:${metadataJson}`),
      metadataJson,
      ipAddress: input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: input.request?.headers.get("user-agent")?.slice(0, 1000) || null,
    },
  });
}

async function restrictPublicEligibility(tx: any, bookingId: string, reason: string, now: Date) {
  if (!tx.publicServiceVideoEligibility?.updateMany) return;
  const activeRows = tx.publicServiceVideoEligibility.findMany
    ? await tx.publicServiceVideoEligibility.findMany({
        where: { bookingId, status: "ACTIVE", invalidatedAt: null },
        select: { mediaAssetId: true },
      })
    : [];
  await tx.publicServiceVideoEligibility.updateMany({
    where: { bookingId, status: "ACTIVE", invalidatedAt: null },
    data: { status: "INVALIDATED", invalidatedAt: now, invalidationReason: reason },
  });
  const mediaAssetIds = activeRows.map((row: any) => String(row.mediaAssetId || "")).filter(Boolean);
  if (mediaAssetIds.length && tx.mediaAsset?.updateMany) {
    await tx.mediaAsset.updateMany({
      where: { id: { in: mediaAssetIds }, visibilityStatus: "public" },
      data: { visibilityStatus: "customer_only" },
    });
  }
}

export async function applyMediaWithdrawal(input: {
  bookingId: string; vendorId: string; actorUserId: string; actorRole: string; authorityType: string;
  scope: "RECORDING" | "PUBLICATION" | "LIKENESS"; reason?: string | null; packageId?: string | null;
  proposalId?: string | null; stageId?: string | null; mediaAssetId?: string | null; request?: Request | null;
}) {
  const now = new Date();
  return (prisma as any).$transaction(async (tx: any) => {
    const document = { ...input, request: undefined, appliedAt: now.toISOString() };
    const evidenceHash = sha256(document);
    const existing = await tx.mediaWithdrawalEvidence.findFirst({
      where: { bookingId: input.bookingId, mediaAssetId: input.mediaAssetId || null, actorUserId: input.actorUserId, scope: input.scope, status: "APPLIED" },
      orderBy: { appliedAt: "desc" },
    });
    if (existing) return existing;
    const withdrawal = await tx.mediaWithdrawalEvidence.create({
      data: { ...document, evidenceHash },
    });
    const restrictionScope = input.scope === "RECORDING" ? "RECORDING" : "PUBLIC";
    await tx.mediaLifecycleRestriction.create({
      data: {
        bookingId: input.bookingId, vendorId: input.vendorId, mediaAssetId: input.mediaAssetId || null,
        scope: restrictionScope, outcome: "RESTRICTED", reasonCode: `${input.scope}_WITHDRAWN`, active: true,
        appliedByUserId: input.actorUserId, appliedByRole: input.actorRole, appliedAt: now,
        evidenceHash: sha256(`${evidenceHash}:${restrictionScope}`),
      },
    });
    if (restrictionScope === "PUBLIC") await restrictPublicEligibility(tx, input.bookingId, `${input.scope}_WITHDRAWN`, now);
    await audit(tx, { ...input, eventType: "WITHDRAWAL_APPLIED", resultingState: "RESTRICTED", metadata: { scope: input.scope, withdrawalId: withdrawal.id }, request: input.request });
    return withdrawal;
  });
}

const IMMEDIATE_RESTRICTION_CATEGORIES = new Set(["PRIVACY", "IDENTITY", "AUTHORITY", "SAFETY", "MINOR", "MATERIAL_MISREPRESENTATION"]);

export async function openMediaLifecycleCaseInTransaction(tx: any, input: {
  bookingId: string; vendorId: string; actorUserId: string; actorRole: string; category: string;
  reasonDetail?: string | null; packageId?: string | null; proposalId?: string | null; mediaAssetId?: string | null;
  contentReportId?: string | null; request?: Request | null; forcePublicRestriction?: boolean;
}) {
  const category = String(input.category).trim().toUpperCase();
  const restrict = input.forcePublicRestriction === true || IMMEDIATE_RESTRICTION_CATEGORIES.has(category);
  const now = new Date();
  const lifecycleCase = await tx.mediaLifecycleCase.create({
      data: {
        bookingId: input.bookingId, vendorId: input.vendorId, packageId: input.packageId || null,
        proposalId: input.proposalId || null, mediaAssetId: input.mediaAssetId || null,
        contentReportId: input.contentReportId || null, category, status: restrict ? "RESTRICTED" : "UNDER_REVIEW",
        exposureOutcome: restrict ? "RESTRICTED" : "PRIVATE", reasonDetail: input.reasonDetail || null,
        openedByUserId: input.actorUserId, openedByRole: input.actorRole, restrictedAt: restrict ? now : null,
      },
  });
  if (restrict) {
    await tx.mediaLifecycleRestriction.create({
        data: {
          caseId: lifecycleCase.id, bookingId: input.bookingId, vendorId: input.vendorId,
          mediaAssetId: input.mediaAssetId || null, scope: "PUBLIC", outcome: "RESTRICTED",
          reasonCode: `DISPUTE_${category}`, active: true, appliedByUserId: input.actorUserId,
          appliedByRole: input.actorRole, evidenceHash: sha256(`${lifecycleCase.id}:PUBLIC:${category}`),
        },
    });
    await restrictPublicEligibility(tx, input.bookingId, `DISPUTE_${category}`, now);
  }
  await audit(tx, { ...input, caseId: lifecycleCase.id, eventType: "CASE_OPENED", resultingState: lifecycleCase.status, metadata: { category, restricted: restrict }, request: input.request });
  return lifecycleCase;
}

export async function openMediaLifecycleCase(input: {
  bookingId: string; vendorId: string; actorUserId: string; actorRole: string; category: string;
  reasonDetail?: string | null; packageId?: string | null; proposalId?: string | null; mediaAssetId?: string | null;
  contentReportId?: string | null; request?: Request | null; forcePublicRestriction?: boolean;
}) {
  return (prisma as any).$transaction(
    (tx: any) => openMediaLifecycleCaseInTransaction(tx, input),
    { isolationLevel: "Serializable" },
  );
}

export async function releaseContentReportPublicHold(input: {
  lifecycleCaseId: string;
  actorUserId: string;
  reason: string;
  request?: Request | null;
}) {
  return (prisma as any).$transaction(async (tx: any) => {
    const lifecycleCase = await tx.mediaLifecycleCase.findUnique({ where: { id: input.lifecycleCaseId } });
    if (!lifecycleCase) throw new Error("REPORT_PUBLIC_HOLD_NOT_FOUND");
    const now = new Date();
    await tx.mediaLifecycleRestriction.updateMany({
      where: { caseId: lifecycleCase.id, active: true, scope: "PUBLIC" },
      data: {
        active: false,
        releasedByUserId: input.actorUserId,
        releasedAt: now,
        releaseReason: input.reason,
      },
    });
    const updated = await tx.mediaLifecycleCase.update({
      where: { id: lifecycleCase.id },
      data: {
        status: "RESOLVED",
        exposureOutcome: "PRIVATE",
        decision: "HOLD_RELEASED",
        decisionReason: input.reason,
        decidedAt: now,
        finalizedAt: now,
      },
    });
    await audit(tx, {
      bookingId: lifecycleCase.bookingId,
      vendorId: lifecycleCase.vendorId,
      caseId: lifecycleCase.id,
      mediaAssetId: lifecycleCase.mediaAssetId,
      actorUserId: input.actorUserId,
      actorRole: "ADMIN",
      eventType: "PUBLIC_HOLD_RELEASED",
      priorState: lifecycleCase.status,
      resultingState: "RESOLVED",
      metadata: { reason: input.reason },
      request: input.request,
    });
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function requestMediaDeletion(input: {
  bookingId: string; vendorId: string; mediaAssetId: string; actorUserId: string; actorRole: string;
  reason?: string | null; request?: Request | null;
}) {
  const now = new Date();
  return (prisma as any).$transaction(async (tx: any) => {
    const current = await tx.mediaDeletionRequest.findFirst({
      where: { mediaAssetId: input.mediaAssetId, status: { in: [...ACTIVE_DELETION_STATUSES, "COMPLETED"] } },
      orderBy: { requestedAt: "desc" },
    });
    if (current) return current;
    const evidenceHash = sha256({ ...input, request: undefined, requestedAt: now.toISOString() });
    const deletion = await tx.mediaDeletionRequest.create({
      data: { ...input, request: undefined, status: "ACCESS_RESTRICTED", requestedAt: now, restrictedAt: now, evidenceHash },
    });
    await tx.mediaLifecycleRestriction.create({
      data: {
        bookingId: input.bookingId, vendorId: input.vendorId, mediaAssetId: input.mediaAssetId,
        scope: "ALL", outcome: "RESTRICTED", reasonCode: "DELETION_REQUESTED", active: true,
        appliedByUserId: input.actorUserId, appliedByRole: input.actorRole,
        evidenceHash: sha256(`${deletion.id}:ALL:DELETION_REQUESTED`),
      },
    });
    await restrictPublicEligibility(tx, input.bookingId, "DELETION_REQUESTED", now);
    await audit(tx, { ...input, eventType: "DELETION_REQUESTED", resultingState: "ACCESS_RESTRICTED", metadata: { deletionRequestId: deletion.id }, request: input.request });
    return deletion;
  });
}

export async function createEvidenceHold(input: {
  bookingId: string; vendorId: string; mediaAssetId?: string | null; caseId?: string | null;
  actorUserId: string; purpose: string; authority: string; reviewDueAt: Date; scope: Record<string, unknown>; request?: Request | null;
}) {
  return (prisma as any).$transaction(async (tx: any) => {
    const scopeJson = stableJson(input.scope);
    const hold = await tx.mediaEvidenceHold.create({
      data: {
        bookingId: input.bookingId, vendorId: input.vendorId, mediaAssetId: input.mediaAssetId || null,
        caseId: input.caseId || null, scopeJson, purpose: input.purpose, authority: input.authority,
        startedByUserId: input.actorUserId, reviewDueAt: input.reviewDueAt,
        evidenceHash: sha256(`${input.bookingId}:${input.mediaAssetId || "all"}:${scopeJson}:${input.reviewDueAt.toISOString()}`),
      },
    });
    await tx.mediaLifecycleRestriction.create({
      data: {
        caseId: input.caseId || null, bookingId: input.bookingId, vendorId: input.vendorId,
        mediaAssetId: input.mediaAssetId || null, scope: "PUBLIC", outcome: "HELD", reasonCode: "EVIDENCE_HOLD",
        active: true, appliedByUserId: input.actorUserId, appliedByRole: "ADMIN",
        evidenceHash: sha256(`${hold.id}:PUBLIC:HELD`),
      },
    });
    await restrictPublicEligibility(tx, input.bookingId, "EVIDENCE_HOLD", new Date());
    await audit(tx, { ...input, actorRole: "ADMIN", eventType: "HOLD_APPLIED", resultingState: "HELD", metadata: { holdId: hold.id, reviewDueAt: input.reviewDueAt.toISOString() }, request: input.request });
    return hold;
  });
}

export async function releaseEvidenceHold(input: { holdId: string; actorUserId: string; reason: string; request?: Request | null }) {
  return (prisma as any).$transaction(async (tx: any) => {
    const hold = await tx.mediaEvidenceHold.findUnique({ where: { id: input.holdId } });
    if (!hold || !["ACTIVE", "REVIEW_DUE", "EXTENDED"].includes(hold.status)) throw new Error("Active evidence hold not found");
    const now = new Date();
    const updated = await tx.mediaEvidenceHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedByUserId: input.actorUserId, releasedAt: now, releaseReason: input.reason } });
    await tx.mediaLifecycleRestriction.updateMany({ where: { caseId: hold.caseId || undefined, bookingId: hold.bookingId, mediaAssetId: hold.mediaAssetId || null, reasonCode: "EVIDENCE_HOLD", active: true }, data: { active: false, releasedByUserId: input.actorUserId, releasedAt: now, releaseReason: input.reason } });
    await audit(tx, { bookingId: hold.bookingId, vendorId: hold.vendorId, caseId: hold.caseId, mediaAssetId: hold.mediaAssetId, actorUserId: input.actorUserId, actorRole: "ADMIN", eventType: "HOLD_RELEASED", priorState: hold.status, resultingState: "RELEASED", metadata: { holdId: hold.id }, request: input.request });
    return updated;
  });
}

export async function decideDeletionRequest(input: { deletionRequestId: string; actorUserId: string; decision: "APPROVE" | "DENY"; reason: string; request?: Request | null }) {
  return (prisma as any).$transaction(async (tx: any) => {
    const deletion = await tx.mediaDeletionRequest.findUnique({ where: { id: input.deletionRequestId } });
    if (!deletion) throw new Error("Deletion request not found");
    if (["COMPLETED", "DENIED"].includes(deletion.status)) return deletion;
    const activeHold = await tx.mediaEvidenceHold.findFirst({ where: { bookingId: deletion.bookingId, OR: [{ mediaAssetId: deletion.mediaAssetId }, { mediaAssetId: null }], status: { in: ["ACTIVE", "REVIEW_DUE", "EXTENDED"] } } });
    const now = new Date();
    if (input.decision === "DENY") {
      const denied = await tx.mediaDeletionRequest.update({ where: { id: deletion.id }, data: { status: "DENIED", reviewedByUserId: input.actorUserId, reviewedAt: now, deniedReason: input.reason } });
      await audit(tx, { bookingId: deletion.bookingId, vendorId: deletion.vendorId, mediaAssetId: deletion.mediaAssetId, actorUserId: input.actorUserId, actorRole: "ADMIN", eventType: "DELETION_DENIED", priorState: deletion.status, resultingState: "DENIED", metadata: { deletionRequestId: deletion.id }, request: input.request });
      return denied;
    }
    const status = activeHold ? "HELD" : "QUEUED";
    const approved = await tx.mediaDeletionRequest.update({ where: { id: deletion.id }, data: { status, reviewedByUserId: input.actorUserId, reviewedAt: now } });
    if (!activeHold) {
      await tx.mediaDeletionJob.upsert({
        where: { deletionRequestId: deletion.id },
        create: { deletionRequestId: deletion.id, bookingId: deletion.bookingId, vendorId: deletion.vendorId, mediaAssetId: deletion.mediaAssetId, status: "QUEUED", nextAttemptAt: now },
        update: { status: "QUEUED", nextAttemptAt: now, leaseExpiresAt: null },
      });
    }
    await audit(tx, { bookingId: deletion.bookingId, vendorId: deletion.vendorId, mediaAssetId: deletion.mediaAssetId, actorUserId: input.actorUserId, actorRole: "ADMIN", eventType: activeHold ? "DELETION_HELD" : "DELETION_QUEUED", priorState: deletion.status, resultingState: status, metadata: { deletionRequestId: deletion.id, holdId: activeHold?.id || null }, request: input.request });
    return approved;
  });
}

export async function createLifecycleAppeal(input: { caseId: string; actorUserId: string; actorRole: string; reason: string; request?: Request | null }) {
  const lifecycleCase = await (prisma as any).mediaLifecycleCase.findUnique({ where: { id: input.caseId } });
  if (!lifecycleCase || !["DECIDED", "FINAL"].includes(lifecycleCase.status)) throw new Error("A decided case is required before appeal");
  return (prisma as any).$transaction(async (tx: any) => {
    const evidenceHash = sha256(`${input.caseId}:${input.actorUserId}:${input.reason}`);
    const appeal = await tx.mediaLifecycleAppeal.create({ data: { caseId: input.caseId, bookingId: lifecycleCase.bookingId, vendorId: lifecycleCase.vendorId, appellantUserId: input.actorUserId, appellantRole: input.actorRole, reason: input.reason, evidenceHash } });
    await tx.mediaLifecycleCase.update({ where: { id: input.caseId }, data: { status: "APPEALED", lifecycleVersion: { increment: 1 } } });
    await audit(tx, { bookingId: lifecycleCase.bookingId, vendorId: lifecycleCase.vendorId, caseId: input.caseId, mediaAssetId: lifecycleCase.mediaAssetId, actorUserId: input.actorUserId, actorRole: input.actorRole, eventType: "APPEAL_SUBMITTED", priorState: lifecycleCase.status, resultingState: "APPEALED", metadata: { appealId: appeal.id }, request: input.request });
    return appeal;
  });
}

export async function decideLifecycleCase(input: { caseId: string; actorUserId: string; decision: string; reason: string; final?: boolean; request?: Request | null }) {
  return (prisma as any).$transaction(async (tx: any) => {
    const lifecycleCase = await tx.mediaLifecycleCase.findUnique({ where: { id: input.caseId } });
    if (!lifecycleCase) throw new Error("Lifecycle case not found");
    const status = input.final ? "FINAL" : "DECIDED";
    const updated = await tx.mediaLifecycleCase.update({ where: { id: lifecycleCase.id }, data: { status, decision: input.decision, decisionReason: input.reason, assignedAdminUserId: input.actorUserId, decidedAt: new Date(), finalizedAt: input.final ? new Date() : null, lifecycleVersion: { increment: 1 } } });
    await audit(tx, { bookingId: lifecycleCase.bookingId, vendorId: lifecycleCase.vendorId, caseId: lifecycleCase.id, mediaAssetId: lifecycleCase.mediaAssetId, actorUserId: input.actorUserId, actorRole: "ADMIN", eventType: input.final ? "CASE_FINALIZED" : "CASE_DECIDED", priorState: lifecycleCase.status, resultingState: status, metadata: { decision: input.decision }, request: input.request });
    return updated;
  });
}

function addUtcMonths(value: Date, months: number): Date {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function addUtcYears(value: Date, years: number): Date {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

export async function ensureRetentionSchedulesForBooking(bookingId: string) {
  const db = prisma as any;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, vendorId: true, status: true, date: true, updatedAt: true,
      mediaSessions: { select: { mediaAssets: { where: { deletedAt: null }, select: { id: true } } } },
    },
  });
  if (!booking || String(booking.status).toUpperCase() !== "COMPLETED") return [];
  const assetIds = (booking.mediaSessions || []).flatMap((session: any) => (session.mediaAssets || []).map((asset: any) => String(asset.id)));
  if (!assetIds.length) return [];
  const publicRows = db.publicServiceVideoEligibility?.findMany
    ? await db.publicServiceVideoEligibility.findMany({ where: { bookingId, mediaAssetId: { in: assetIds }, status: "ACTIVE", invalidatedAt: null }, select: { mediaAssetId: true } })
    : [];
  const publicIds = new Set((publicRows || []).map((row: any) => String(row.mediaAssetId)));
  const completedAt = new Date(booking.date || booking.updatedAt);
  const privateRetainUntil = addUtcMonths(completedAt, 12);
  const evidenceRetainUntil = addUtcYears(completedAt, 7);
  return Promise.all(assetIds.map((mediaAssetId: string) => {
    const approvalActive = publicIds.has(mediaAssetId);
    return db.mediaRetentionSchedule.upsert({
      where: { mediaAssetId },
      create: { bookingId, vendorId: booking.vendorId, mediaAssetId, materialClass: approvalActive ? "PUBLIC_MEDIA" : "PRIVATE_MEDIA", status: "ACTIVE", retainUntil: approvalActive ? null : privateRetainUntil, evidenceRetainUntil, approvalActive },
      update: { materialClass: approvalActive ? "PUBLIC_MEDIA" : "PRIVATE_MEDIA", retainUntil: approvalActive ? null : privateRetainUntil, evidenceRetainUntil, approvalActive, lastEvaluatedAt: new Date(), dispositionReason: approvalActive ? "ACTIVE_PUBLIC_APPROVAL" : "PRIVATE_MEDIA_12_MONTH_RULE" },
    });
  }));
}

export async function processDueRetentionSchedules(limit = 25) {
  const db = prisma as any;
  const now = new Date();
  const schedules = await db.mediaRetentionSchedule.findMany({ where: { status: "ACTIVE", approvalActive: false, retainUntil: { lte: now } }, orderBy: { retainUntil: "asc" }, take: Math.max(1, Math.min(limit, 50)) });
  const results: Array<Record<string, unknown>> = [];
  for (const schedule of schedules) {
    const currentPublic = db.publicServiceVideoEligibility?.findFirst
      ? await db.publicServiceVideoEligibility.findFirst({ where: { mediaAssetId: schedule.mediaAssetId, status: "ACTIVE", invalidatedAt: null } })
      : null;
    if (currentPublic) {
      await db.mediaRetentionSchedule.update({ where: { id: schedule.id }, data: { approvalActive: true, retainUntil: null, materialClass: "PUBLIC_MEDIA", lastEvaluatedAt: now, dispositionReason: "ACTIVE_PUBLIC_APPROVAL" } });
      results.push({ scheduleId: schedule.id, status: "PUBLIC_APPROVAL_ACTIVE" });
      continue;
    }
    const activeHold = await db.mediaEvidenceHold.findFirst({ where: { bookingId: schedule.bookingId, OR: [{ mediaAssetId: schedule.mediaAssetId }, { mediaAssetId: null }], status: { in: ["ACTIVE", "REVIEW_DUE", "EXTENDED"] } } });
    if (activeHold) {
      await db.mediaRetentionSchedule.update({ where: { id: schedule.id }, data: { status: "HELD", lastEvaluatedAt: now, dispositionReason: "ACTIVE_EVIDENCE_HOLD" } });
      results.push({ scheduleId: schedule.id, status: "HELD" });
      continue;
    }
    await db.$transaction(async (tx: any) => {
      let deletion = await tx.mediaDeletionRequest.findFirst({ where: { mediaAssetId: schedule.mediaAssetId, status: { in: [...ACTIVE_DELETION_STATUSES, "COMPLETED"] } }, orderBy: { requestedAt: "desc" } });
      if (!deletion) {
        deletion = await tx.mediaDeletionRequest.create({ data: { bookingId: schedule.bookingId, vendorId: schedule.vendorId, mediaAssetId: schedule.mediaAssetId, requestedByUserId: "retention-worker", requestedByRole: "WORKER", status: "QUEUED", reason: "Private media retention period completed.", requestedAt: now, restrictedAt: now, reviewedByUserId: "retention-worker", reviewedAt: now, evidenceHash: sha256(`${schedule.id}:RETENTION_EXPIRED:${now.toISOString()}`) } });
        await tx.mediaLifecycleRestriction.create({ data: { bookingId: schedule.bookingId, vendorId: schedule.vendorId, mediaAssetId: schedule.mediaAssetId, scope: "ALL", outcome: "RESTRICTED", reasonCode: "RETENTION_EXPIRED", active: true, appliedByUserId: "retention-worker", appliedByRole: "WORKER", evidenceHash: sha256(`${deletion.id}:ALL:RETENTION_EXPIRED`) } });
      }
      if (deletion.status !== "COMPLETED") await tx.mediaDeletionJob.upsert({ where: { deletionRequestId: deletion.id }, create: { deletionRequestId: deletion.id, bookingId: schedule.bookingId, vendorId: schedule.vendorId, mediaAssetId: schedule.mediaAssetId, status: "QUEUED", nextAttemptAt: now }, update: { status: "QUEUED", nextAttemptAt: now, leaseExpiresAt: null } });
      await tx.mediaRetentionSchedule.update({ where: { id: schedule.id }, data: { status: deletion.status === "COMPLETED" ? "COMPLETED" : "DELETION_QUEUED", lastEvaluatedAt: now, dispositionReason: "PRIVATE_MEDIA_RETENTION_COMPLETED" } });
      await audit(tx, { bookingId: schedule.bookingId, vendorId: schedule.vendorId, mediaAssetId: schedule.mediaAssetId, actorRole: "WORKER", eventType: "RETENTION_DISPOSITION_QUEUED", priorState: "ACTIVE", resultingState: deletion.status === "COMPLETED" ? "COMPLETED" : "QUEUED", metadata: { retentionScheduleId: schedule.id, deletionRequestId: deletion.id } });
    });
    results.push({ scheduleId: schedule.id, status: "DELETION_QUEUED" });
  }
  return results;
}

export async function processMediaDeletionJobs(limit = 10) {
  const db = prisma as any;
  const now = new Date();
  const candidates = await db.mediaDeletionJob.findMany({
    where: { status: { in: ["QUEUED", "RETRY_REQUIRED"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 25)),
  });
  const results: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const activeHold = await db.mediaEvidenceHold.findFirst({ where: { bookingId: candidate.bookingId, OR: [{ mediaAssetId: candidate.mediaAssetId }, { mediaAssetId: null }], status: { in: ["ACTIVE", "REVIEW_DUE", "EXTENDED"] } } });
    if (activeHold) {
      await db.$transaction([
        db.mediaDeletionJob.update({ where: { id: candidate.id }, data: { status: "HELD", leaseExpiresAt: null, lastErrorCode: "ACTIVE_EVIDENCE_HOLD" } }),
        db.mediaDeletionRequest.update({ where: { id: candidate.deletionRequestId }, data: { status: "HELD" } }),
      ]);
      results.push({ jobId: candidate.id, status: "HELD" });
      continue;
    }
    const leased = await db.mediaDeletionJob.updateMany({ where: { id: candidate.id, status: candidate.status, leaseExpiresAt: candidate.leaseExpiresAt }, data: { status: "ATTEMPTING", leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000) } });
    if (Number(leased.count || 0) !== 1) continue;
    const attemptNumber = Number(candidate.attemptCount || 0) + 1;
    const attempt = await db.mediaDeletionAttempt.create({ data: { deletionJobId: candidate.id, attemptNumber, status: "ATTEMPTING" } });
    try {
      const asset = await db.mediaAsset.findUnique({ where: { id: candidate.mediaAssetId }, select: { id: true, blobKey: true } });
      if (!asset?.blobKey) throw new Error("MEDIA_ASSET_BLOB_REFERENCE_MISSING");
      const accepted = await deleteBlob(String(asset.blobKey));
      const properties = await getBlobProperties(String(asset.blobKey));
      if (!accepted || !properties || properties.exists) {
        throw new Error(properties?.exists ? "BLOB_STILL_PRESENT" : accepted ? "BLOB_ABSENCE_UNVERIFIABLE" : "DELETE_NOT_ACCEPTED");
      }
      const completedAt = new Date();
      await db.$transaction(async (tx: any) => {
        await tx.mediaDeletionAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", deleteAccepted: accepted, verifiedAbsent: true, finishedAt: completedAt } });
        await tx.mediaDeletionJob.update({ where: { id: candidate.id }, data: { status: "COMPLETED", attemptCount: attemptNumber, verifiedAbsentAt: completedAt, completedAt, leaseExpiresAt: null, nextAttemptAt: null, lastErrorCode: null, lastErrorDetail: null } });
        await tx.mediaDeletionRequest.update({ where: { id: candidate.deletionRequestId }, data: { status: "COMPLETED", completedAt } });
        await tx.mediaAsset.update({ where: { id: candidate.mediaAssetId }, data: { deletedAt: completedAt, archiveStatus: "deleted" } });
        await audit(tx, { bookingId: candidate.bookingId, vendorId: candidate.vendorId, mediaAssetId: candidate.mediaAssetId, actorRole: "WORKER", eventType: "PHYSICAL_DELETION_VERIFIED", priorState: "VERIFYING", resultingState: "COMPLETED", metadata: { deletionRequestId: candidate.deletionRequestId, deletionJobId: candidate.id, attemptNumber, verifiedAbsent: true } });
      });
      results.push({ jobId: candidate.id, status: "COMPLETED", verifiedAbsent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "UNKNOWN_DELETION_FAILURE";
      const retry = attemptNumber < Number(candidate.maxAttempts || 5);
      const status = retry ? "RETRY_REQUIRED" : "FAILED";
      await db.$transaction([
        db.mediaDeletionAttempt.update({ where: { id: attempt.id }, data: { status, errorCode: message.split(":")[0], errorDetail: message, finishedAt: new Date() } }),
        db.mediaDeletionJob.update({ where: { id: candidate.id }, data: { status, attemptCount: attemptNumber, nextAttemptAt: retry ? new Date(Date.now() + Math.min(60, 5 * attemptNumber) * 60 * 1000) : null, leaseExpiresAt: null, lastErrorCode: message.split(":")[0], lastErrorDetail: message } }),
        db.mediaDeletionRequest.update({ where: { id: candidate.deletionRequestId }, data: { status } }),
      ]);
      results.push({ jobId: candidate.id, status, verifiedAbsent: false });
    }
  }
  return results;
}
