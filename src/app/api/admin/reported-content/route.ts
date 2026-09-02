import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { appendContentReportEvent } from "@/lib/content-reporting";
import { launchExcludedUserIds, launchExcludedVendorIds } from "@/lib/internal-identities";
import {
  createEvidenceHold,
  openMediaLifecycleCase,
  releaseContentReportPublicHold,
  releaseEvidenceHold,
} from "@/lib/media-lifecycle";
import { sendContentReportResolution } from "@/lib/notifications/send-content-report-resolution";
import { restoreImmediatePublicVisibilityAfterHold } from "@/lib/service-video-publication";
import { prisma } from "@/server/db";

const TARGET_TYPES = new Set(["review", "media_asset"]);
const REPORT_STATUSES = new Set(["open", "triaged", "under_review", "resolved_action_taken", "resolved_no_action", "dismissed"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const TERMINAL_STATUSES = new Set(["resolved_action_taken", "resolved_no_action", "dismissed"]);
const ACTION_STATUS: Record<string, string> = {
  mark_triaged: "triaged",
  begin_investigation: "under_review",
  resolve_no_violation: "resolved_no_action",
  resolve_action_taken: "resolved_action_taken",
  dismiss: "dismissed",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function forbidden(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

function moderationHref(report: any): string | null {
  if (report.targetType === "review") return `/admin/reviews?q=${encodeURIComponent(report.targetId)}`;
  if (report.targetType === "media_asset") return `/admin/media-moderation?search=${encodeURIComponent(report.targetId)}`;
  return null;
}

function buildWhere(searchParams: URLSearchParams) {
  const targetType = text(searchParams.get("targetType")).toLowerCase();
  const status = text(searchParams.get("status")).toLowerCase();
  const severity = text(searchParams.get("severity")).toLowerCase();
  const reasonCategory = text(searchParams.get("reasonCategory")).toLowerCase();
  const q = text(searchParams.get("q"));
  const includeInternal = text(searchParams.get("includeInternal")) === "1";
  const where: Record<string, any> = {};
  if (TARGET_TYPES.has(targetType)) where.targetType = targetType;
  if (REPORT_STATUSES.has(status)) where.status = status;
  if (SEVERITIES.has(severity)) where.severity = severity;
  if (reasonCategory) where.reasonCategory = reasonCategory;
  if (q) {
    where.OR = ["id", "caseReference", "targetId", "bookingId", "vendorId", "packageId", "reporterUserId", "reasonDetail"]
      .map((field) => ({ [field]: { contains: q } }));
  }
  if (!includeInternal) {
    where.AND = [
      { OR: [{ vendorId: null }, { vendorId: { notIn: launchExcludedVendorIds() } }] },
      { OR: [{ reportedVendorId: null }, { reportedVendorId: { notIn: launchExcludedVendorIds() } }] },
      { OR: [{ reporterVendorId: null }, { reporterVendorId: { notIn: launchExcludedVendorIds() } }] },
      { OR: [{ reportedUserId: null }, { reportedUserId: { notIn: launchExcludedUserIds() } }] },
      { OR: [{ reporterUserId: null }, { reporterUserId: { notIn: launchExcludedUserIds() } }] },
    ];
  }
  return { where, appliedFilters: { targetType: targetType || null, status: status || null, severity: severity || null, reasonCategory: reasonCategory || null, q: q || null, includeInternal } };
}

async function enrichReport(report: any) {
  const [events, activeRestriction, asset, booking] = await Promise.all([
    (prisma as any).contentReportCaseEvent.findMany({ where: { reportId: report.id }, orderBy: { createdAt: "asc" } }),
    report.bookingId
      ? (prisma as any).mediaLifecycleRestriction.findFirst({ where: { bookingId: report.bookingId, active: true, scope: { in: ["PUBLIC", "ALL"] } }, orderBy: { appliedAt: "desc" } })
      : null,
    report.targetType === "media_asset"
      ? (prisma as any).mediaAsset.findUnique({ where: { id: report.targetId }, select: { visibilityStatus: true, deletedAt: true } })
      : null,
    report.bookingId
      ? (prisma as any).booking.findUnique({ where: { id: report.bookingId }, select: { title: true, clientName: true, user: { select: { name: true } }, vendor: { select: { name: true, businessName: true } }, service: { select: { name: true } } } })
      : null,
  ]);
  return {
    ...report,
    createdAt: date(report.createdAt), updatedAt: date(report.updatedAt), resolvedAt: date(report.resolvedAt), closedAt: date(report.closedAt),
    notificationSentAt: date(report.notificationSentAt), publicHoldAppliedAt: date(report.publicHoldAppliedAt),
    currentVisibility: activeRestriction ? "PUBLIC_VISIBILITY_HOLD" : String(asset?.visibilityStatus || report.visibilityAtReport || "legacy / unavailable").toUpperCase(),
    publicHoldActive: Boolean(activeRestriction),
    serviceName: booking?.service?.name || booking?.title || null,
    customerName: booking?.user?.name || booking?.clientName || null,
    vendorName: booking?.vendor?.businessName || booking?.vendor?.name || null,
    events: events.map((event: any) => ({ ...event, createdAt: date(event.createdAt) })),
    moderationHref: moderationHref(report),
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "25", 10) || 25, 1), 100);
    const { where, appliedFilters } = buildWhere(searchParams);
    const [total, reports] = await Promise.all([
      (prisma as any).contentReport.count({ where }),
      (prisma as any).contentReport.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: (page - 1) * limit, take: limit }),
    ]);
    return NextResponse.json({ success: true, reports: await Promise.all(reports.map(enrichReport)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, appliedFilters });
  } catch (error: any) {
    console.error("[admin/reported-content] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) return forbidden(error);
    return NextResponse.json({ success: false, error: "Failed to fetch reported content" }, { status: 500 });
  }
}

async function applyPublicHold(report: any, adminUserId: string, reason: string, request: Request) {
  if (!report.bookingId || !report.vendorId || !report.packageId || report.targetType !== "media_asset") {
    throw new Error("REPORT_PUBLIC_HOLD_EVIDENCE_INCOMPLETE");
  }
  if (report.lifecycleCaseId) return report.lifecycleCaseId;
  const lifecycleCase = await openMediaLifecycleCase({
    bookingId: report.bookingId,
    vendorId: report.vendorId,
    actorUserId: adminUserId,
    actorRole: "ADMIN",
    category: report.policyCategory || "SAFETY",
    reasonDetail: reason,
    packageId: report.packageId,
    mediaAssetId: report.targetId,
    contentReportId: report.id,
    forcePublicRestriction: true,
    request,
  });
  const activeRestriction = await (prisma as any).mediaLifecycleRestriction.findFirst({ where: { caseId: lifecycleCase.id, active: true, scope: "PUBLIC" } });
  if (!activeRestriction) {
    await createEvidenceHold({
      bookingId: report.bookingId,
      vendorId: report.vendorId,
      mediaAssetId: report.targetId,
      caseId: lifecycleCase.id,
      actorUserId: adminUserId,
      purpose: "Reported Service Video investigation",
      authority: "RELIANCE_ADMIN",
      reviewDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      scope: { packageId: report.packageId, reportId: report.id, scope: "COMPLETE_SERVICE_VIDEO_PACKAGE" },
      request,
    });
  }
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.contentReport.update({ where: { id: report.id }, data: { lifecycleCaseId: lifecycleCase.id, publicHoldAppliedAt: new Date(), autoHidden: true } });
    await appendContentReportEvent(tx, { reportId: report.id, eventType: "PUBLIC_HOLD_APPLIED", actorUserId: adminUserId, actorRole: "ADMIN", priorStatus: report.status, resultingStatus: report.status, reason, metadata: { lifecycleCaseId: lifecycleCase.id } });
  });
  return lifecycleCase.id;
}

async function releasePublicHold(report: any, adminUserId: string, reason: string, request: Request) {
  if (!report.lifecycleCaseId) return { released: false, restored: false };
  const hold = await (prisma as any).mediaEvidenceHold.findFirst({ where: { caseId: report.lifecycleCaseId, status: { in: ["ACTIVE", "REVIEW_DUE", "EXTENDED"] } }, orderBy: { startedAt: "desc" } });
  if (hold) await releaseEvidenceHold({ holdId: hold.id, actorUserId: adminUserId, reason, request });
  await releaseContentReportPublicHold({ lifecycleCaseId: report.lifecycleCaseId, actorUserId: adminUserId, reason, request });
  let restored = false;
  try {
    restored = Boolean((await restoreImmediatePublicVisibilityAfterHold({ bookingId: report.bookingId, actorUserId: adminUserId })).restored);
  } catch {
    restored = false;
  }
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.contentReport.update({ where: { id: report.id }, data: { autoHidden: false } });
    await appendContentReportEvent(tx, { reportId: report.id, eventType: "PUBLIC_HOLD_RELEASED", actorUserId: adminUserId, actorRole: "ADMIN", priorStatus: report.status, resultingStatus: report.status, reason, metadata: { lifecycleCaseId: report.lifecycleCaseId, publicVisibilityRestored: restored } });
  });
  return { released: true, restored };
}

async function notifyReporter(report: any, request: Request) {
  if (!report.reporterUserId || !report.caseReference) return;
  const user = await (prisma as any).user.findUnique({ where: { id: report.reporterUserId }, select: { email: true } });
  if (!user?.email) return;
  const attemptedAt = new Date();
  try {
    await (prisma as any).contentReport.update({ where: { id: report.id }, data: { reporterNotificationAttemptedAt: attemptedAt } });
  } catch (error) {
    console.error("[admin/reported-content] reporter notification attempt could not be recorded", { reportId: report.id, error });
    return;
  }
  const result = await sendContentReportResolution({ reportId: report.id, caseReference: report.caseReference, recipient: user.email, actionTaken: report.status === "resolved_action_taken", baseUrl: new URL(request.url).origin }).catch((error) => ({ ok: false, errorMessage: String(error) }));
  const now = new Date();
  try {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.contentReport.update({ where: { id: report.id }, data: { reporterNotificationSentAt: result.ok ? now : null, reporterNotificationFailedAt: result.ok ? null : now, reporterNotificationProviderResult: JSON.stringify({ sent: result.ok, error: result.errorMessage || null }) } });
      await appendContentReportEvent(tx, { reportId: report.id, eventType: result.ok ? "REPORTER_RESOLUTION_NOTIFICATION_SENT" : "REPORTER_RESOLUTION_NOTIFICATION_FAILED", actorRole: "SYSTEM", resultingStatus: report.status, metadata: { sent: result.ok } });
    });
  } catch (error) {
    console.error("[admin/reported-content] reporter notification result could not be recorded", { reportId: report.id, error });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const { userId: adminUserId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const reportId = text(body?.reportId);
    const requestedAction = text(body?.action).toLowerCase();
    const requestedStatus = text(body?.status).toLowerCase();
    const action = requestedAction || Object.entries(ACTION_STATUS).find(([, value]) => value === requestedStatus)?.[0] || "";
    const notes = text(body?.resolutionNotes);
    if (!reportId) return NextResponse.json({ success: false, error: "reportId is required" }, { status: 400 });
    const report = await (prisma as any).contentReport.findUnique({ where: { id: reportId } });
    if (!report) return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    const nextStatus = ACTION_STATUS[action];
    if (TERMINAL_STATUSES.has(report.status) && nextStatus) {
      if (nextStatus === report.status) {
        return NextResponse.json({ success: true, idempotent: true, report: { id: report.id, status: report.status, resolutionNotes: report.resolutionNotes, resolvedAt: date(report.resolvedAt), updatedAt: date(report.updatedAt) } });
      }
      return NextResponse.json({ success: false, error: "This report case is already closed." }, { status: 409 });
    }
    if (["resolve_no_violation", "resolve_action_taken", "dismiss", "apply_public_hold", "release_public_hold"].includes(action) && !notes) {
      return NextResponse.json({ success: false, error: "Resolution notes are required for this action." }, { status: 422 });
    }
    if (action === "apply_public_hold") {
      const lifecycleCaseId = await applyPublicHold(report, adminUserId, notes, request);
      return NextResponse.json({ success: true, report: { id: report.id, status: report.status, lifecycleCaseId, publicHoldActive: true } });
    }
    if (action === "release_public_hold") {
      const release = await releasePublicHold(report, adminUserId, notes, request);
      return NextResponse.json({ success: true, report: { id: report.id, status: report.status, publicHoldActive: false, publicVisibilityRestored: release.restored } });
    }
    if (!nextStatus || !REPORT_STATUSES.has(nextStatus)) return NextResponse.json({ success: false, error: "Unsupported report action" }, { status: 422 });
    if (["resolve_no_violation", "dismiss"].includes(action) && report.lifecycleCaseId) await releasePublicHold(report, adminUserId, notes, request);
    const now = new Date();
    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const row = await tx.contentReport.update({ where: { id: report.id }, data: { status: nextStatus, adminOwnerUserId: adminUserId, resolutionNotes: TERMINAL_STATUSES.has(nextStatus) ? notes : report.resolutionNotes, resolvedAt: TERMINAL_STATUSES.has(nextStatus) ? now : null, closedAt: TERMINAL_STATUSES.has(nextStatus) ? now : null } });
      await appendContentReportEvent(tx, { reportId: report.id, eventType: action.toUpperCase(), actorUserId: adminUserId, actorRole: "ADMIN", priorStatus: report.status, resultingStatus: nextStatus, reason: notes || null, metadata: { lifecycleCaseId: report.lifecycleCaseId || null } });
      return row;
    }, { isolationLevel: "Serializable" });
    if (TERMINAL_STATUSES.has(nextStatus)) await notifyReporter(updated, request);
    return NextResponse.json({ success: true, report: { id: updated.id, status: updated.status, resolutionNotes: updated.resolutionNotes, resolvedAt: date(updated.resolvedAt), updatedAt: date(updated.updatedAt) } });
  } catch (error: any) {
    console.error("[admin/reported-content] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) return forbidden(error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update reported content" }, { status: 500 });
  }
}
