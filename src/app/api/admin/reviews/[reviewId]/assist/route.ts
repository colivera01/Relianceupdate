import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  generateReviewModerationAiStoredResult,
} from "@/lib/ai/review-moderation-review-store";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
} from "@/lib/transient-db-errors";

interface RouteParams {
  params: Promise<{ reviewId: string }>;
}

export async function POST(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    if (!isAiFeatureEnabled("review_moderation_assistant")) {
      throw new AiFeatureDisabledError("AI review moderation assistant is disabled");
    }

    const { reviewId } = await context.params;
    const result = await generateReviewModerationAiStoredResult(
      reviewId,
      userId,
      "admin_review_moderation_manual_run"
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Review not found", message: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "AI review moderation recommendation generated",
      aiRunId: result.aiRunId,
      promptVersion: result.promptVersion,
      model: result.model,
      responseId: result.aiRunId,
      usage: result.usage,
      suggestion: result.suggestion,
    });
  } catch (error: any) {
    console.error("[admin/reviews/:reviewId/assist] POST error:", error);
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
            "AI review moderation is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI review moderation is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return buildAiFailureResponse(
      error,
      "Failed to generate AI review moderation recommendation"
    );
  }
}
