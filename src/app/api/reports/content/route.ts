import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { createAdminNotificationWithEmail } from "@/lib/admin-notifications";
import {
  appendContentReportEvent,
  ContentReportError,
  contentReportHash,
  createServiceVideoReportCase,
  normalizeContentReportReason,
  resolveReportableMediaEvidence,
  safeReportStatus,
} from "@/lib/content-reporting";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";
import { authorizationErrorResponse, requireRequestActor } from "@/lib/request-actor";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function reporterRole(actor: any): string {
  if (actor.platformRoles.includes("ADMIN")) return "admin";
  if (actor.vendorMemberships.length) return "vendor";
  return "customer";
}

function reportResponse(report: any) {
  return {
    caseReference: report.caseReference || `Legacy ${report.id}`,
    status: safeReportStatus(report.status),
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireRequestActor(request);
    const { searchParams } = new URL(request.url);
    const targetType = text(searchParams.get("targetType")).toLowerCase();
    const targetId = text(searchParams.get("targetId"));
    if (!targetId || !["media_asset", "review"].includes(targetType)) {
      return NextResponse.json({ success: false, error: "A report target is required." }, { status: 400 });
    }
    const reports = await (prisma as any).contentReport.findMany({
      where: { reporterUserId: actor.userId, targetType, targetId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return NextResponse.json({ success: true, reports: reports.map(reportResponse) });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ success: false, error: "Unable to load report status." }, { status: 500 });
  }
}

async function notifyAdmin(request: Request, report: any) {
  const attemptedAt = new Date();
  try {
    await (prisma as any).contentReport.update({ where: { id: report.id }, data: { notificationAttemptedAt: attemptedAt } });
  } catch (error) {
    console.error("[reports/content] notification attempt could not be recorded", { reportId: report.id, error });
    return { notification: null, emailSent: false };
  }
  let result: any;
  try {
    result = await createAdminNotificationWithEmail({
      vendorId: report.vendorId,
      type: "CONTENT_REPORT",
      title: `Service Video report ${report.caseReference}`,
      message: `A signed-in user reported a Service Video stage for ${report.reasonCategory}. Open the case queue for the protected evidence snapshot.`,
      metadata: {
        caseReference: report.caseReference,
        reportId: report.id,
        bookingId: report.bookingId,
        packageId: report.packageId,
        stage: report.stage,
        severity: report.severity,
      },
      surfaceHref: `/admin/reported-content?q=${encodeURIComponent(report.caseReference || report.id)}`,
      baseUrl: new URL(request.url).origin,
      actorUserId: report.reporterUserId,
    });
  } catch (error) {
    result = { notification: null, emailSent: false, emailError: String(error) };
  }
  const now = new Date();
  try {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.contentReport.update({
        where: { id: report.id },
        data: {
          notificationSentAt: result.emailSent ? now : null,
          notificationFailedAt: result.emailSent ? null : now,
          notificationProviderResult: JSON.stringify({ adminNotificationId: result.notification?.id || null, emailSent: result.emailSent, emailError: result.emailError || null }),
        },
      });
      await appendContentReportEvent(tx, {
        reportId: report.id,
        eventType: result.emailSent ? "ADMIN_NOTIFICATION_SENT" : "ADMIN_NOTIFICATION_FAILED",
        actorUserId: report.reporterUserId,
        actorRole: "SYSTEM",
        resultingStatus: report.status,
        metadata: { adminNotificationId: result.notification?.id || null, emailSent: result.emailSent },
      });
    });
  } catch (trackingError) {
    console.error("[reports/content] notification result could not be recorded", { reportId: report.id, result, trackingError });
  }
  return result;
}

async function createLegacyReviewReport(input: { actor: any; requestId: string; targetId: string; reasonCategory: string; reasonDetail: string }) {
  const review = await (prisma as any).review.findFirst({ where: { id: input.targetId, moderationStatus: "approved", visibilityStatus: "public" } });
  if (!review) throw new ContentReportError("REPORT_REVIEW_NOT_PUBLIC", "This review is not available for reporting.", 404);
  const payloadHash = contentReportHash({ targetType: "review", targetId: input.targetId, reasonCategory: input.reasonCategory, reasonDetail: input.reasonDetail || null });
  const idempotencyKey = contentReportHash({ reporterUserId: input.actor.userId, requestId: input.requestId });
  const semanticKey = contentReportHash({ reporterUserId: input.actor.userId, targetType: "review", targetId: input.targetId, payloadHash, fiveMinuteBucket: Math.floor(Date.now() / (5 * 60 * 1000)) });
  return (prisma as any).$transaction(async (tx: any) => {
    const prior = await tx.contentReportRequest.findUnique({ where: { idempotencyKey } });
    if (prior) {
      if (prior.payloadHash !== payloadHash) throw new ContentReportError("REPORT_IDEMPOTENCY_CONFLICT", "This request conflicts with an existing report.", 409);
      return { report: await tx.contentReport.findUnique({ where: { id: prior.reportId } }), idempotent: true };
    }
    const duplicate = await tx.contentReportRequest.findUnique({ where: { semanticKey } });
    if (duplicate) return { report: await tx.contentReport.findUnique({ where: { id: duplicate.reportId } }), idempotent: true };
    const report = await tx.contentReport.create({
      data: {
        targetType: "review", targetId: review.id, bookingId: review.bookingId || null, vendorId: review.vendorId,
        reportedUserId: review.userId, reportedVendorId: review.vendorId, reporterUserId: input.actor.userId,
        reporterVendorId: null, reporterRole: reporterRole(input.actor), reasonCategory: input.reasonCategory,
        reasonDetail: input.reasonDetail || null, status: "open", severity: "medium",
        caseReference: `RP-${randomBytes(4).toString("hex").toUpperCase()}`, contractVersion: 2,
        accessBasis: "AUTHENTICATED_PUBLIC_VIEWER",
      },
    });
    await appendContentReportEvent(tx, { reportId: report.id, eventType: "REPORT_CREATED", actorUserId: input.actor.userId, actorRole: reporterRole(input.actor), resultingStatus: "open", metadata: { targetType: "review" } });
    await tx.contentReportRequest.create({ data: { idempotencyKey, semanticKey, requestId: input.requestId, reporterUserId: input.actor.userId, targetType: "review", targetId: review.id, payloadHash, reportId: report.id } });
    return { report, idempotent: false };
  }, { isolationLevel: "Serializable" });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRequestActor(request);
    const body = await request.json().catch(() => ({}));
    const requestedTarget = text(body?.targetType).toLowerCase();
    const targetType = requestedTarget === "media" ? "media_asset" : requestedTarget;
    const targetId = text(body?.targetId);
    const requestId = text(body?.requestId);
    const reason = normalizeContentReportReason(body?.reasonCategory);
    const reasonDetail = text(body?.reasonDetail).slice(0, 2000);
    if (!targetId || !["media_asset", "review"].includes(targetType)) {
      return NextResponse.json({ success: false, error: "A valid report target is required." }, { status: 400 });
    }
    if (!requestId || requestId.length > 200) {
      return NextResponse.json({ success: false, error: "A valid report request ID is required." }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ success: false, error: "Choose a supported reason." }, { status: 422 });

    const created = targetType === "media_asset"
      ? await createServiceVideoReportCase({
          request,
          reporterUserId: actor.userId,
          reporterRole: reporterRole(actor),
          requestId,
          reasonCategory: reason,
          reasonDetail: reasonDetail || null,
          evidence: await resolveReportableMediaEvidence({ mediaAssetId: targetId, reporterUserId: actor.userId }),
        })
      : await createLegacyReviewReport({ actor, requestId, targetId, reasonCategory: reason, reasonDetail });

    if (!created.idempotent) await notifyAdmin(request, created.report);
    return NextResponse.json({
      success: true,
      message: "We received your report. Reliance will review the concern.",
      report: reportResponse(created.report),
      idempotent: created.idempotent,
      publicHoldApplied: Boolean((created as any).publicHoldApplied),
    }, { status: created.idempotent ? 200 : 201 });
  } catch (error: any) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    if (error instanceof ContentReportError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.statusCode });
    }
    console.error("[reports/content] POST error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json({ success: false, code: PUBLIC_DB_UNAVAILABLE_CODE, error: "Content reporting is temporarily unavailable. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: "Failed to submit content report" }, { status: 500 });
  }
}
