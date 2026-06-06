import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  isAiOperatorFeedbackOutcome,
  logAiOperatorFeedback,
  type AiOperatorFeedbackSource,
} from "@/lib/ai/feedback";
import type { AiFeatureKey } from "@/lib/ai/config";

const FEATURE_KEYS = new Set<AiFeatureKey>([
  "moderation_assistant",
  "dispute_summary_assistant",
]);

const RELATED_ENTITY_TYPES = new Set(["booking", "content_report"]);
const FEEDBACK_SOURCES = new Set<AiOperatorFeedbackSource>([
  "admin_media_moderation",
  "admin_reported_content",
]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));

    const aiRunId = normalizeText(body?.aiRunId);
    const feature = normalizeText(body?.feature) as AiFeatureKey;
    const operation = normalizeText(body?.operation);
    const relatedEntityType = normalizeText(body?.relatedEntityType);
    const relatedEntityId = normalizeText(body?.relatedEntityId);
    const outcome = normalizeText(body?.outcome);
    const source = normalizeText(body?.source) as AiOperatorFeedbackSource;
    const promptVersion = normalizeText(body?.promptVersion) || null;
    const model = normalizeText(body?.model) || null;
    const recommendedAction = normalizeText(body?.recommendedAction) || null;
    const actualAction = normalizeText(body?.actualAction) || null;
    const notes = normalizeText(body?.notes) || null;

    if (!aiRunId || !operation || !relatedEntityId) {
      return NextResponse.json(
        {
          success: false,
          error: "aiRunId, operation, and relatedEntityId are required",
          message: "aiRunId, operation, and relatedEntityId are required",
        },
        { status: 422 }
      );
    }

    if (!FEATURE_KEYS.has(feature)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported AI feature",
          message: "Unsupported AI feature",
        },
        { status: 422 }
      );
    }

    if (!RELATED_ENTITY_TYPES.has(relatedEntityType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported relatedEntityType",
          message: "Unsupported relatedEntityType",
        },
        { status: 422 }
      );
    }

    if (!isAiOperatorFeedbackOutcome(outcome)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported feedback outcome",
          message: "Unsupported feedback outcome",
        },
        { status: 422 }
      );
    }

    if (!FEEDBACK_SOURCES.has(source)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported feedback source",
          message: "Unsupported feedback source",
        },
        { status: 422 }
      );
    }

    await logAiOperatorFeedback({
      aiRunId,
      actorUserId: userId,
      feature,
      operation,
      relatedEntityType: relatedEntityType as "booking" | "content_report",
      relatedEntityId,
      outcome,
      source,
      promptVersion,
      model,
      recommendedAction,
      actualAction,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: "AI operator feedback recorded",
    });
  } catch (error: any) {
    console.error("[admin/ai/feedback] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to record AI operator feedback",
        message: "Failed to record AI operator feedback",
      },
      { status: 500 }
    );
  }
}
