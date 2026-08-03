import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { createAdminNotificationWithEmail } from "@/lib/admin-notifications";
import {
  accountStatusErrorBody,
  AccountStatusError,
} from "@/lib/account-status";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";
import {
  authorizationErrorResponse,
  AuthorizationError,
  requireRequestActor,
} from "@/lib/request-actor";

const TARGET_TYPES = new Set(["review", "media_asset"]);
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
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTargetType(value: unknown): string {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "media" || normalized === "proof_video" || normalized === "proof_asset") {
    return "media_asset";
  }
  return normalized;
}

async function resolveReporter(request: Request, body: any) {
  const actor = await requireRequestActor(request);
  const requestedRole = normalizeString(body?.reporterRole).toLowerCase();
  const explicitVendorId = normalizeString(body?.reporterVendorId);

  if (actor.platformRoles.includes("ADMIN")) {
    return { reporterRole: "admin", reporterUserId: actor.userId, reporterVendorId: null };
  }

  if (requestedRole === "vendor") {
    const vendorId = explicitVendorId ||
      (actor.vendorMemberships.length === 1 ? actor.vendorMemberships[0].vendorId : "");
    const membership = actor.vendorMemberships.find(
      (candidate) => candidate.vendorId === vendorId
    );
    if (!membership) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "Vendor membership required.",
        403
      );
    }
    return {
      reporterRole: "vendor",
      reporterUserId: actor.userId,
      reporterVendorId: membership.vendorId,
    };
  }

  return { reporterRole: "customer", reporterUserId: actor.userId, reporterVendorId: null };
}

async function resolveTarget(targetType: string, targetId: string) {
  if (targetType === "review") {
    const review = await (prisma as any).review.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        userId: true,
        vendorId: true,
        bookingId: true,
        moderationStatus: true,
        visibilityStatus: true,
      },
    });
    if (!review) return null;
    return {
      target: review,
      bookingId: review.bookingId || null,
      vendorId: review.vendorId || null,
      reportedUserId: review.userId || null,
      reportedVendorId: review.vendorId || null,
    };
  }

  const mediaAsset = await (prisma as any).mediaAsset.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      vendorId: true,
      mediaSessionId: true,
      moderationStatus: true,
      visibilityStatus: true,
      mediaSession: {
        select: {
          bookingId: true,
          userId: true,
          vendorId: true,
        },
      },
    },
  });
  if (!mediaAsset) return null;
  const mediaVendorId = mediaAsset.vendorId || mediaAsset.mediaSession?.vendorId || null;
  return {
    target: mediaAsset,
    bookingId: mediaAsset.mediaSession?.bookingId || null,
    vendorId: mediaVendorId,
    reportedUserId: mediaAsset.mediaSession?.userId || null,
    reportedVendorId: mediaVendorId,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const reporter = await resolveReporter(request, body);
    if (!reporter) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required for content reports",
          message: "Guest reporting is deferred for this foundation pass.",
        },
        { status: 401 }
      );
    }

    const targetType = normalizeTargetType(body?.targetType);
    const targetId = normalizeString(body?.targetId);
    const reasonCategory = normalizeString(body?.reasonCategory).toLowerCase();
    const reasonDetail = normalizeString(body?.reasonDetail);
    const severity = normalizeString(body?.severity).toLowerCase() || "medium";

    if (!TARGET_TYPES.has(targetType) || !targetId) {
      return NextResponse.json(
        { success: false, error: "targetType must be review or media_asset and targetId is required" },
        { status: 400 }
      );
    }
    if (!reasonCategory || !REASONS.has(reasonCategory)) {
      return NextResponse.json(
        { success: false, error: "A supported reasonCategory is required" },
        { status: 422 }
      );
    }
    if (!SEVERITIES.has(severity)) {
      return NextResponse.json(
        { success: false, error: "severity must be low, medium, high, or critical" },
        { status: 422 }
      );
    }

    const resolvedTarget = await resolveTarget(targetType, targetId);
    if (!resolvedTarget) {
      return NextResponse.json({ success: false, error: "Reported target not found" }, { status: 404 });
    }

    const report = await (prisma as any).contentReport.create({
      data: {
        targetType,
        targetId,
        bookingId: resolvedTarget.bookingId,
        vendorId: resolvedTarget.vendorId,
        reportedUserId: resolvedTarget.reportedUserId,
        reportedVendorId: resolvedTarget.reportedVendorId,
        reporterUserId: reporter.reporterUserId,
        reporterVendorId: reporter.reporterVendorId,
        reporterRole: reporter.reporterRole,
        reasonCategory,
        reasonDetail: reasonDetail || null,
        status: "open",
        severity,
        autoHidden: false,
      },
    });

    const notificationResult = await createAdminNotificationWithEmail({
      vendorId: resolvedTarget.vendorId,
      type: "CONTENT_REPORT",
      title: `New ${targetType.replace("_", " ")} report`,
      message: `${reporter.reporterRole} reported ${targetType} ${targetId} for ${reasonCategory}.`,
      metadata: {
        reportId: report.id,
        targetType,
        targetId,
        reasonCategory,
        severity,
        reporterRole: reporter.reporterRole,
        reporterUserId: reporter.reporterUserId,
        reporterVendorId: reporter.reporterVendorId,
        bookingId: resolvedTarget.bookingId,
        vendorId: resolvedTarget.vendorId,
      },
      surfaceHref: "/admin/reported-content",
      baseUrl: new URL(request.url).origin,
      actorUserId: reporter.reporterUserId || reporter.reporterVendorId || "system",
    });

    const reportWithNotification = await (prisma as any).contentReport.update({
      where: { id: report.id },
      data: { notificationSentAt: new Date() },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        bookingId: true,
        vendorId: true,
        reportedUserId: true,
        reportedVendorId: true,
        reporterUserId: true,
        reporterVendorId: true,
        reporterRole: true,
        reasonCategory: true,
        reasonDetail: true,
        status: true,
        severity: true,
        autoHidden: true,
        notificationSentAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Content report submitted for admin review",
        report: reportWithNotification,
        notificationId: notificationResult.notification?.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("[reports/content] POST error:", error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: "Content reporting is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Failed to submit content report" }, { status: 500 });
  }
}
