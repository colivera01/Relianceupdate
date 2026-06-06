import { NextResponse } from "next/server";
import { getUserIdFromRequest, getVendorIdFromRequest } from "@/lib/auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  getVendorCoachingSummarySuggestion,
  vendorCoachingAssistantRequestSchema,
} from "@/lib/ai/vendor-coaching-summary-assistant";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
} from "@/lib/transient-db-errors";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const vendorId = await getVendorIdFromRequest(request);
    const actorUserId = await getUserIdFromRequest(request);

    if (!vendorId || !actorUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isAiFeatureEnabled("vendor_coaching")) {
      throw new AiFeatureDisabledError("AI vendor coaching summary is disabled");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = vendorCoachingAssistantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid coaching summary request",
          message: "Invalid coaching summary request",
          details: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    if (!parsed.data.trustScore.scored || parsed.data.trustScore.totalScorePct === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Trust Score is not yet ready for AI coaching summary",
          message: "Trust Score is not yet ready for AI coaching summary",
        },
        { status: 422 }
      );
    }

    const ai = await getVendorCoachingSummarySuggestion(parsed.data, actorUserId, vendorId);

    return NextResponse.json({
      success: true,
      message: "AI vendor coaching summary generated",
      model: ai.model,
      requestId: ai.requestId,
      responseId: ai.responseId,
      promptVersion: "vendor-coaching-summary-v1",
      usage: ai.usage,
      suggestion: ai.data,
    });
  } catch (error: any) {
    console.error("[vendor/coaching-summary] POST error:", error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error:
            "AI coaching summary is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI coaching summary is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }

    return buildAiFailureResponse(error, "Failed to generate AI coaching summary");
  }
}
