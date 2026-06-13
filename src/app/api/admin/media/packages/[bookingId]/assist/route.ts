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
import { getMediaModerationAssistantSuggestion } from "@/lib/ai/moderation-assistant";
import { normalizeVendorJobVideoStage, type VendorJobVideoStage } from "@/lib/vendor-job-video-stages";

interface RouteParams {
  params: Promise<{ bookingId: string }>;
}

const REQUIRED_STAGES: VendorJobVideoStage[] = ["INTRO", "IN_PROGRESS", "COMPLETED"];

/**
 * POST /api/admin/media/packages/[bookingId]/assist
 * Returns an admin-only, metadata-based moderation recommendation for a complete staged package.
 */
export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    if (!isAiFeatureEnabled("moderation_assistant")) {
      throw new AiFeatureDisabledError("AI moderation assistant is disabled");
    }

    const { bookingId } = await context.params;

    const booking = await withTransientDbRetry(() =>
      prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          vendorId: true,
          title: true,
          status: true,
          vendor: {
            select: {
              name: true,
              businessName: true,
            },
          },
          service: {
            select: {
              name: true,
            },
          },
        },
      })
    );

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", message: "Booking not found" },
        { status: 404 }
      );
    }

    const packageAssets = (await withTransientDbRetry(() =>
      (prisma as any).mediaAsset.findMany({
        where: {
          deletedAt: null,
          mediaSession: {
            bookingId,
            sessionType: "JOB_SERVICE_VIDEO",
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          mimeType: true,
          bytes: true,
          moderationStatus: true,
          visibilityStatus: true,
          moderationReason: true,
          createdAt: true,
          mediaSession: {
            select: {
              vendorJobVideoStage: true,
              title: true,
              description: true,
              employee: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })
    )) as any[];

    const latestByStage = new Map<
      VendorJobVideoStage,
      {
        mimeType: string;
        bytes: bigint | number | string;
        moderationStatus: string | null;
        visibilityStatus: string | null;
        moderationReason: string | null;
        createdAt: Date | null;
        title: string | null;
        description: string | null;
        employeeName: string | null;
      }
    >();

    for (const asset of packageAssets) {
      const stage = normalizeVendorJobVideoStage(asset.mediaSession?.vendorJobVideoStage);
      if (!stage || !REQUIRED_STAGES.includes(stage)) continue;
      if (!latestByStage.has(stage)) {
        latestByStage.set(stage, {
          mimeType: String(asset.mimeType || ""),
          bytes: asset.bytes,
          moderationStatus: asset.moderationStatus ? String(asset.moderationStatus) : null,
          visibilityStatus: asset.visibilityStatus ? String(asset.visibilityStatus) : null,
          moderationReason: asset.moderationReason ? String(asset.moderationReason) : null,
          createdAt: asset.createdAt instanceof Date ? asset.createdAt : null,
          title: asset.mediaSession?.title ? String(asset.mediaSession.title) : null,
          description: asset.mediaSession?.description ? String(asset.mediaSession.description) : null,
          employeeName: asset.mediaSession?.employee?.name
            ? String(asset.mediaSession.employee.name)
            : null,
        });
      }
    }

    if (!REQUIRED_STAGES.every((stage) => latestByStage.has(stage))) {
      return NextResponse.json(
        {
          success: false,
          error: "Incomplete package",
          message: "Package must have Starting Condition, Work in Progress, and Final Result stages",
        },
        { status: 422 }
      );
    }

    const stages = REQUIRED_STAGES.map((stageKey) => {
      const stage = latestByStage.get(stageKey)!;
      return {
        stageKey,
        title: stage.title || `${stageKey} service video`,
        description: stage.description,
        mimeType: stage.mimeType,
        fileSizeBytes:
          typeof stage.bytes === "bigint" ? stage.bytes.toString() : String(stage.bytes || "0"),
        uploadedAt: stage.createdAt ? stage.createdAt.toISOString() : null,
        currentModerationStatus: stage.moderationStatus || "pending_review",
        currentVisibilityStatus: stage.visibilityStatus || "private",
        currentModerationReason: stage.moderationReason,
        employeeName: stage.employeeName,
      };
    });

    const ai = await getMediaModerationAssistantSuggestion(
      {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
        jobTitle: booking.title || "Untitled Job",
        bookingStatus: booking.status || null,
        serviceName: booking.service?.name || null,
        stages,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      message: "AI moderation recommendation generated",
      aiRunId: ai.responseId,
      analysisScope: "metadata_only",
      promptVersion: "media-package-metadata-v1",
      model: ai.model,
      requestId: ai.requestId,
      responseId: ai.responseId,
      usage: ai.usage,
      suggestion: ai.data,
    });
  } catch (error: any) {
    console.error("[admin/media/packages/:bookingId/assist] POST error:", error);
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
            "AI moderation assistance is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI moderation assistance is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return buildAiFailureResponse(error, "Failed to generate AI moderation recommendation");
  }
}
