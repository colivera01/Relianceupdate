import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";
import {
  getDisputeSummaryAssistantSuggestion,
} from "@/lib/ai/dispute-summary-assistant";
import { DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION } from "@/lib/ai/prompt-registry";
import { normalizeVendorJobVideoStage } from "@/lib/vendor-job-video-stages";

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

/**
 * POST /api/admin/reported-content/[reportId]/assist
 * Returns an admin-only case summary recommendation for a stored content report.
 */
export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    if (!isAiFeatureEnabled("dispute_summary_assistant")) {
      throw new AiFeatureDisabledError("AI dispute summary assistant is disabled");
    }

    const { reportId } = await context.params;
    const report = (await withTransientDbRetry(() =>
      (prisma as any).contentReport.findUnique({
        where: { id: reportId },
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
          createdAt: true,
          resolvedAt: true,
          resolutionNotes: true,
        },
      })
    )) as any;

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Report not found", message: "Report not found" },
        { status: 404 }
      );
    }

    const [booking, vendor, relatedTargetReportCount, review, mediaAsset] = (await withTransientDbRetry(
      () =>
        Promise.all([
          report.bookingId
            ? prisma.booking.findUnique({
                where: { id: String(report.bookingId) },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  service: {
                    select: {
                      name: true,
                    },
                  },
                  vendor: {
                    select: {
                      name: true,
                      businessName: true,
                    },
                  },
                },
              })
            : Promise.resolve(null),
          report.vendorId || report.reportedVendorId
            ? prisma.vendor.findUnique({
                where: { id: String(report.vendorId || report.reportedVendorId) },
                select: {
                  name: true,
                  businessName: true,
                },
              })
            : Promise.resolve(null),
          (prisma as any).contentReport.count({
            where: {
              targetType: report.targetType,
              targetId: report.targetId,
            },
          }),
          report.targetType === "review"
            ? (prisma as any).review.findUnique({
                where: { id: report.targetId },
                select: {
                  rating: true,
                  comment: true,
                  moderationStatus: true,
                  visibilityStatus: true,
                  moderationReason: true,
                  createdAt: true,
                  source: true,
                  jobType: true,
                  assignedEmployeeName: true,
                },
              })
            : Promise.resolve(null),
          report.targetType === "media_asset"
            ? (prisma as any).mediaAsset.findUnique({
                where: { id: report.targetId },
                select: {
                  mimeType: true,
                  bytes: true,
                  moderationStatus: true,
                  visibilityStatus: true,
                  moderationReason: true,
                  createdAt: true,
                  mediaSession: {
                    select: {
                      sessionType: true,
                      vendorJobVideoStage: true,
                      title: true,
                      description: true,
                      deviceType: true,
                      employee: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              })
            : Promise.resolve(null),
        ])
    )) as [any, any, number, any, any];

    const ai = await getDisputeSummaryAssistantSuggestion(
      {
        reportId: report.id,
        targetType: String(report.targetType || ""),
        targetId: String(report.targetId || ""),
        reportStatus: String(report.status || "open"),
        severity: String(report.severity || "medium"),
        reasonCategory: String(report.reasonCategory || "other"),
        reasonDetail: report.reasonDetail ? String(report.reasonDetail) : null,
        reporterRole: String(report.reporterRole || "unknown"),
        autoHidden: Boolean(report.autoHidden),
        createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : null,
        resolvedAt: report.resolvedAt instanceof Date ? report.resolvedAt.toISOString() : null,
        resolutionNotes: report.resolutionNotes ? String(report.resolutionNotes) : null,
        relatedTargetReportCount: Number(relatedTargetReportCount || 0),
        bookingId: report.bookingId ? String(report.bookingId) : null,
        bookingTitle: booking?.title ? String(booking.title) : null,
        bookingStatus: booking?.status ? String(booking.status) : null,
        serviceName: booking?.service?.name ? String(booking.service.name) : null,
        vendorId: (report.vendorId || report.reportedVendorId)
          ? String(report.vendorId || report.reportedVendorId)
          : null,
        vendorName:
          booking?.vendor?.businessName ||
          booking?.vendor?.name ||
          vendor?.businessName ||
          vendor?.name ||
          null,
        linkedReview: review
          ? {
              rating: review.rating == null ? null : Number(review.rating),
              comment: review.comment ? String(review.comment) : null,
              moderationStatus: review.moderationStatus ? String(review.moderationStatus) : null,
              visibilityStatus: review.visibilityStatus ? String(review.visibilityStatus) : null,
              moderationReason: review.moderationReason ? String(review.moderationReason) : null,
              createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : null,
              source: review.source ? String(review.source) : null,
              jobType: review.jobType ? String(review.jobType) : null,
              assignedEmployeeName: review.assignedEmployeeName
                ? String(review.assignedEmployeeName)
                : null,
            }
          : null,
        linkedMediaAsset: mediaAsset
          ? {
              mimeType: mediaAsset.mimeType ? String(mediaAsset.mimeType) : null,
              fileSizeBytes:
                typeof mediaAsset.bytes === "bigint"
                  ? mediaAsset.bytes.toString()
                  : mediaAsset.bytes != null
                    ? String(mediaAsset.bytes)
                    : null,
              moderationStatus: mediaAsset.moderationStatus
                ? String(mediaAsset.moderationStatus)
                : null,
              visibilityStatus: mediaAsset.visibilityStatus
                ? String(mediaAsset.visibilityStatus)
                : null,
              moderationReason: mediaAsset.moderationReason
                ? String(mediaAsset.moderationReason)
                : null,
              createdAt:
                mediaAsset.createdAt instanceof Date ? mediaAsset.createdAt.toISOString() : null,
              sessionType: mediaAsset.mediaSession?.sessionType
                ? String(mediaAsset.mediaSession.sessionType)
                : null,
              stageKey: normalizeVendorJobVideoStage(mediaAsset.mediaSession?.vendorJobVideoStage),
              sessionTitle: mediaAsset.mediaSession?.title
                ? String(mediaAsset.mediaSession.title)
                : null,
              sessionDescription: mediaAsset.mediaSession?.description
                ? String(mediaAsset.mediaSession.description)
                : null,
              deviceType: mediaAsset.mediaSession?.deviceType
                ? String(mediaAsset.mediaSession.deviceType)
                : null,
              employeeName: mediaAsset.mediaSession?.employee?.name
                ? String(mediaAsset.mediaSession.employee.name)
                : null,
            }
          : null,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      message: "AI dispute summary generated",
      aiRunId: ai.responseId,
      analysisScope: "content_report_and_linked_records",
      promptVersion: DISPUTE_SUMMARY_ASSISTANT_PROMPT_VERSION,
      model: ai.model,
      requestId: ai.requestId,
      responseId: ai.responseId,
      usage: ai.usage,
      suggestion: ai.data,
    });
  } catch (error: any) {
    console.error("[admin/reported-content/:reportId/assist] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: 403 }
      );
    }
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error:
            "AI dispute assistance is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI dispute assistance is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return buildAiFailureResponse(error, "Failed to generate AI dispute summary");
  }
}
