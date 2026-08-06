import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import {
  createEvidenceHold,
  decideDeletionRequest,
  decideLifecycleCase,
  releaseEvidenceHold,
} from "@/lib/media-lifecycle";
import { authorizationErrorResponse, AuthorizationError, requirePlatformRole } from "@/lib/request-actor";

export async function GET(request: Request) {
  try {
    await requirePlatformRole(request, "ADMIN");
    const [cases, deletions, holds, appeals, failedJobs] = await Promise.all([
      (prisma as any).mediaLifecycleCase.findMany({ where: { status: { notIn: ["FINAL"] } }, orderBy: { submittedAt: "asc" }, take: 100 }),
      (prisma as any).mediaDeletionRequest.findMany({ where: { status: { notIn: ["COMPLETED", "DENIED"] } }, orderBy: { requestedAt: "asc" }, take: 100 }),
      (prisma as any).mediaEvidenceHold.findMany({ where: { status: { in: ["ACTIVE", "REVIEW_DUE", "EXTENDED"] } }, orderBy: { reviewDueAt: "asc" }, take: 100 }),
      (prisma as any).mediaLifecycleAppeal.findMany({ where: { status: "SUBMITTED" }, orderBy: { submittedAt: "asc" }, take: 100 }),
      (prisma as any).mediaDeletionJob.findMany({ where: { status: { in: ["FAILED", "RETRY_REQUIRED"] } }, orderBy: { updatedAt: "asc" }, take: 100 }),
    ]);
    return NextResponse.json({ success: true, cases, deletions, holds, appeals, failedJobs });
  } catch (error) {
    return authorizationErrorResponse(error) || NextResponse.json({ success: false, error: "Lifecycle queue unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformRole(request, "ADMIN");
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim().toUpperCase();
    const reason = String(body.reason || "").trim();

    if (action === "DECIDE_CASE") {
      const caseId = String(body.caseId || "").trim();
      if (!caseId || !reason) return NextResponse.json({ success: false, error: "Case and decision reason are required." }, { status: 422 });
      const lifecycleCase = await decideLifecycleCase({ caseId, actorUserId: actor.userId, decision: String(body.decision || "RESTRICT").trim().toUpperCase(), reason, final: Boolean(body.final), request });
      return NextResponse.json({ success: true, message: "The case decision was recorded. Existing restrictions remain until a separately authorized action changes them.", case: lifecycleCase });
    }

    if (action === "APPLY_HOLD") {
      const bookingId = String(body.bookingId || "").trim();
      const vendorId = String(body.vendorId || "").trim();
      const reviewDueAt = new Date(String(body.reviewDueAt || ""));
      if (!bookingId || !vendorId || !reason || Number.isNaN(reviewDueAt.getTime())) return NextResponse.json({ success: false, error: "Work record, vendor, purpose, and review date are required." }, { status: 422 });
      const hold = await createEvidenceHold({ bookingId, vendorId, mediaAssetId: String(body.mediaAssetId || "").trim() || null, caseId: String(body.caseId || "").trim() || null, actorUserId: actor.userId, purpose: reason, authority: String(body.authority || "RELIANCE_CASE_REVIEW").trim(), reviewDueAt, scope: body.scope && typeof body.scope === "object" ? body.scope : { mediaAssetId: body.mediaAssetId || null }, request });
      return NextResponse.json({ success: true, message: "A scoped evidence hold is active. It does not preserve Public access.", hold }, { status: 201 });
    }

    if (action === "RELEASE_HOLD") {
      if (!reason) return NextResponse.json({ success: false, error: "A release reason is required." }, { status: 422 });
      const hold = await releaseEvidenceHold({ holdId: String(body.holdId || "").trim(), actorUserId: actor.userId, reason, request });
      return NextResponse.json({ success: true, message: "The hold was released. Public access was not restored.", hold });
    }

    if (action === "DECIDE_DELETION") {
      if (!reason) return NextResponse.json({ success: false, error: "A decision reason is required." }, { status: 422 });
      const deletion = await decideDeletionRequest({ deletionRequestId: String(body.deletionRequestId || "").trim(), actorUserId: actor.userId, decision: String(body.decision || "DENY").toUpperCase() === "APPROVE" ? "APPROVE" : "DENY", reason, request });
      return NextResponse.json({ success: true, message: deletion.status === "QUEUED" ? "Deletion is queued. It is not deleted until storage absence is verified." : deletion.status === "HELD" ? "Deletion is held while covered evidence must be preserved." : "The deletion decision was recorded.", deletion });
    }

    if (action === "DECIDE_APPEAL") {
      const appealId = String(body.appealId || "").trim();
      const appeal = await (prisma as any).mediaLifecycleAppeal.findUnique({ where: { id: appealId } });
      if (!appeal || appeal.status !== "SUBMITTED") return NextResponse.json({ success: false, error: "Open appeal not found." }, { status: 404 });
      const lifecycleCase = await (prisma as any).mediaLifecycleCase.findUnique({ where: { id: appeal.caseId } });
      if (lifecycleCase?.assignedAdminUserId === actor.userId) throw new AuthorizationError("FORBIDDEN", "A different admin must decide the appeal.", 403);
      if (!reason) return NextResponse.json({ success: false, error: "An appeal decision reason is required." }, { status: 422 });
      const decision = String(body.decision || "UPHOLD").trim().toUpperCase();
      const now = new Date();
      const updated = await (prisma as any).$transaction(async (tx: any) => {
        const result = await tx.mediaLifecycleAppeal.update({ where: { id: appeal.id }, data: { status: "DECIDED", reviewerUserId: actor.userId, decision, decisionReason: reason, decidedAt: now } });
        await tx.mediaLifecycleCase.update({ where: { id: appeal.caseId }, data: { status: "FINAL", finalizedAt: now, lifecycleVersion: { increment: 1 } } });
        await tx.mediaLifecycleAuditEvent.create({ data: { bookingId: appeal.bookingId, vendorId: appeal.vendorId, caseId: appeal.caseId, actorUserId: actor.userId, actorRole: "ADMIN", eventType: "APPEAL_DECIDED", priorState: "APPEALED", resultingState: "FINAL", evidenceHash: appeal.evidenceHash, metadataJson: JSON.stringify({ appealId: appeal.id, decision, publicAccessRestored: false }), ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: request.headers.get("user-agent")?.slice(0, 1000) || null } });
        return result;
      });
      return NextResponse.json({ success: true, message: "The appeal decision is final. Public access was not automatically restored.", appeal: updated });
    }

    if (action === "RETRY_DELETION") {
      const jobId = String(body.jobId || "").trim();
      const job = await (prisma as any).mediaDeletionJob.findUnique({ where: { id: jobId } });
      if (!job || !["FAILED", "RETRY_REQUIRED"].includes(job.status)) return NextResponse.json({ success: false, error: "Retryable deletion job not found." }, { status: 404 });
      const updated = await (prisma as any).mediaDeletionJob.update({ where: { id: job.id }, data: { status: "QUEUED", nextAttemptAt: new Date(), leaseExpiresAt: null } });
      return NextResponse.json({ success: true, message: "Deletion is queued for another verified attempt. It is not yet deleted.", job: updated });
    }

    return NextResponse.json({ success: false, error: "Unsupported lifecycle action." }, { status: 422 });
  } catch (error) {
    return authorizationErrorResponse(error) || NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Lifecycle action failed" }, { status: 500 });
  }
}
