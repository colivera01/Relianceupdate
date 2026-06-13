import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import { generatePromotionReadinessAiStoredResult } from "@/lib/ai/promotion-readiness-review-store";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
} from "@/lib/transient-db-errors";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

export async function POST(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    if (!isAiFeatureEnabled("promotions_assistant")) {
      throw new AiFeatureDisabledError("AI promotions assistant is disabled");
    }

    const { campaignId } = await context.params;
    const result = await generatePromotionReadinessAiStoredResult(
      campaignId,
      userId,
      "admin_promoted_listings_manual_run"
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Promotion campaign not found",
          message: "Promotion campaign not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "AI promotion readiness recommendation generated",
      aiRunId: result.aiRunId,
      promptVersion: result.promptVersion,
      model: result.model,
      responseId: result.aiRunId,
      usage: result.usage,
      suggestion: result.suggestion,
    });
  } catch (error: any) {
    console.error("[admin/promoted-listings/:campaignId/assist] POST error:", error);
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
            "AI promotion readiness is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI promotion readiness is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return buildAiFailureResponse(
      error,
      "Failed to generate AI promotion readiness recommendation"
    );
  }
}
