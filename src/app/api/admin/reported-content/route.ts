import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import {
  launchExcludedUserIds,
  launchExcludedVendorIds,
} from "@/lib/internal-identities";
import {
  BOOKING_SERVICE_ISSUE_TYPES,
  tryRecordBookingServiceIssue,
} from "@/lib/trust-score-outcome-foundation";
import { tryRecalculateVendorTrustScore } from "@/lib/trust-score-calculator";

const TARGET_TYPES = new Set(["review", "media_asset"]);
const REPORT_STATUSES = new Set([
  "open",
  "triaged",
  "under_review",
  "resolved_action_taken",
  "resolved_no_action",
  "dismissed",
]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const REASONS = new Set([
  "harassment",
  "hate",
  "nudity",
  "violence",
  "spam",
  "fraud",
  "copyright",
  "privacy",
  "misleading",
  "other",
]);
const RESOLVED_STATUSES = new Set([
  "resolved_action_taken",
  "resolved_no_action",
  "dismissed",
]);

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value || "25", 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 100);
}

function serializeDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

function buildModerationHref(report: any): string | null {
  if (report.targetType === "review") {
    return `/admin/reviews?q=${encodeURIComponent(report.targetId)}`;
  }
  if (report.targetType === "media_asset") {
    const search = report.bookingId || report.targetId;
    return `/admin/media-moderation?search=${encodeURIComponent(search)}`;
  }
  return null;
}

function buildWhere(searchParams: URLSearchParams) {
  const targetType = normalizeString(searchParams.get("targetType")).toLowerCase();
  const status = normalizeString(searchParams.get("status")).toLowerCase();
  const severity = normalizeString(searchParams.get("severity")).toLowerCase();
  const reasonCategory = normalizeString(searchParams.get("reasonCategory")).toLowerCase();
  const q = normalizeString(searchParams.get("q"));
  const includeInternal = normalizeString(searchParams.get("includeInternal")) === "1";

  const where: Record<string, unknown> = {};
  const andClauses: Record<string, unknown>[] = [];
  if (TARGET_TYPES.has(targetType)) where.targetType = targetType;
  if (REPORT_STATUSES.has(status)) where.status = status;
  if (SEVERITIES.has(severity)) where.severity = severity;
  if (REASONS.has(reasonCategory)) where.reasonCategory = reasonCategory;
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { targetId: { contains: q } },
      { bookingId: { contains: q } },
      { vendorId: { contains: q } },
      { reportedUserId: { contains: q } },
      { reportedVendorId: { contains: q } },
      { reporterUserId: { contains: q } },
      { reporterVendorId: { contains: q } },
      { reasonDetail: { contains: q } },
    ];
  }

  if (!includeInternal) {
    andClauses.push(
      { OR: [{ vendorId: null }, { vendorId: { notIn: launchExcludedVendorIds() } }] },
      {
        OR: [
          { reportedVendorId: null },
          { reportedVendorId: { notIn: launchExcludedVendorIds() } },
        ],
      },
      {
        OR: [
          { reporterVendorId: null },
          { reporterVendorId: { notIn: launchExcludedVendorIds() } },
        ],
      },
      { OR: [{ reportedUserId: null }, { reportedUserId: { notIn: launchExcludedUserIds() } }] },
      { OR: [{ reporterUserId: null }, { reporterUserId: { notIn: launchExcludedUserIds() } }] }
    );
  }

  if (andClauses.length) {
    where.AND = andClauses;
  }

  return {
    where,
    appliedFilters: {
      targetType: TARGET_TYPES.has(targetType) ? targetType : null,
      status: REPORT_STATUSES.has(status) ? status : null,
      severity: SEVERITIES.has(severity) ? severity : null,
      reasonCategory: REASONS.has(reasonCategory) ? reasonCategory : null,
      q: q || null,
      includeInternal,
    },
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = parseLimit(searchParams.get("limit"));
    const skip = (page - 1) * limit;
    const { where, appliedFilters } = buildWhere(searchParams);

    const [total, reports] = await Promise.all([
      (prisma as any).contentReport.count({ where }),
      (prisma as any).contentReport.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      reports: reports.map((report: any) => ({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        bookingId: report.bookingId,
        vendorId: report.vendorId,
        reportedUserId: report.reportedUserId,
        reportedVendorId: report.reportedVendorId,
        reporterUserId: report.reporterUserId,
        reporterVendorId: report.reporterVendorId,
        reporterRole: report.reporterRole,
        reasonCategory: report.reasonCategory,
        reasonDetail: report.reasonDetail,
        status: report.status,
        severity: report.severity,
        autoHidden: Boolean(report.autoHidden),
        notificationSentAt: serializeDate(report.notificationSentAt),
        createdAt: serializeDate(report.createdAt),
        updatedAt: serializeDate(report.updatedAt),
        resolvedAt: serializeDate(report.resolvedAt),
        resolutionNotes: report.resolutionNotes,
        moderationHref: buildModerationHref(report),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      appliedFilters,
    });
  } catch (error: any) {
    console.error("[admin/reported-content] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch reported content" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const { userId: adminOwnerUserId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const reportId = normalizeString(body?.reportId);
    const status = normalizeString(body?.status).toLowerCase();
    const resolutionNotes = normalizeString(body?.resolutionNotes);

    if (!reportId) {
      return NextResponse.json({ success: false, error: "reportId is required" }, { status: 400 });
    }
    if (!REPORT_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Unsupported report status" }, { status: 422 });
    }
    if (RESOLVED_STATUSES.has(status) && !resolutionNotes) {
      return NextResponse.json(
        { success: false, error: "resolutionNotes is required when resolving or dismissing a report" },
        { status: 422 }
      );
    }

    const updated = await (prisma as any).contentReport.update({
      where: { id: reportId },
      data: {
        status,
        adminOwnerUserId,
        resolutionNotes: resolutionNotes || null,
        resolvedAt: RESOLVED_STATUSES.has(status) ? new Date() : null,
      },
    });

    // Trust Score Phase 1A: only a report that an admin finalized WITH action taken
    // (and that is tied to a concrete booking + vendor) maps to a finalized, score-affecting
    // BookingServiceIssue. Dismissed / no-action / non-booking reports never become a service issue.
    const resolvedVendorId =
      (updated?.vendorId && String(updated.vendorId)) ||
      (updated?.reportedVendorId && String(updated.reportedVendorId)) ||
      "";
    if (
      status === "resolved_action_taken" &&
      updated?.bookingId &&
      resolvedVendorId
    ) {
      const validatedAt = updated?.resolvedAt instanceof Date ? updated.resolvedAt : new Date();
      await tryRecordBookingServiceIssue(prisma as any, {
        bookingId: String(updated.bookingId),
        vendorId: resolvedVendorId,
        issueType: BOOKING_SERVICE_ISSUE_TYPES.VALIDATED_DISPUTE,
        status: "VALIDATED",
        sourceEntityType: "content_report",
        sourceEntityId: String(updated.id),
        reportedByUserId: updated?.reporterUserId ? String(updated.reporterUserId) : null,
        validatedAt,
        finalizedAt: validatedAt,
        finalizedByUserId: adminOwnerUserId,
        resolutionNotes: resolutionNotes || null,
        metadata: {
          reasonCategory: updated?.reasonCategory ?? null,
          targetType: updated?.targetType ?? null,
          severity: updated?.severity ?? null,
        },
      });

      // Internal-only, non-blocking Trust Score recalculation.
      await tryRecalculateVendorTrustScore(
        prisma as any,
        resolvedVendorId,
        "reported_content_resolved",
        "reported_content"
      );
    }

    return NextResponse.json({
      success: true,
      report: {
        id: updated.id,
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
        resolvedAt: serializeDate(updated.resolvedAt),
        updatedAt: serializeDate(updated.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[admin/reported-content] PATCH error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json(
      { success: false, error: "Failed to update reported content" },
      { status: 500 }
    );
  }
}
