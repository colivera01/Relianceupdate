import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  generateSupportInboxTriageAiStoredResult,
  getLatestSupportInboxTriageAiStoredResult,
  resolveSupportInboxTriageAssistantContext,
} from "@/lib/ai/support-inbox-triage-store";
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
} from "@/lib/transient-db-errors";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const [context, latest] = await Promise.all([
      resolveSupportInboxTriageAssistantContext(),
      getLatestSupportInboxTriageAiStoredResult(),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        unreadCount: context.unreadCount,
        totalCount: context.totalCount,
      },
      latestRecommendation: latest,
    });
  } catch (error: any) {
    console.error("[admin/support-triage] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AI support triage state",
        message: "Failed to fetch AI support triage state",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    if (!isAiFeatureEnabled("support_inbox_triage")) {
      throw new AiFeatureDisabledError("AI support inbox triage is disabled");
    }

    const result = await generateSupportInboxTriageAiStoredResult(
      userId,
      "admin_notifications_manual_run"
    );

    return NextResponse.json({
      success: true,
      message: "AI support triage generated",
      aiRunId: result.aiRunId,
      promptVersion: result.promptVersion,
      model: result.model,
      responseId: result.aiRunId,
      usage: result.usage,
      suggestion: result.suggestion,
    });
  } catch (error: any) {
    console.error("[admin/support-triage] POST error:", error);
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
            "AI support triage is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI support triage is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return buildAiFailureResponse(error, "Failed to generate AI support triage");
  }
}
