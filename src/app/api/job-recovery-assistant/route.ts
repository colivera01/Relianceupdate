import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  getJobRecoveryAssistantSuggestion,
  jobRecoveryAssistantRequestSchema,
} from "@/lib/ai/job-recovery-assistant";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actorUserId = await getUserIdFromRequest(request);
    if (!actorUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!isAiFeatureEnabled("job_recovery_assistant")) {
      throw new AiFeatureDisabledError("AI job recovery assistant is disabled");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = jobRecoveryAssistantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid job recovery request",
          message: "Invalid job recovery request",
          details: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const ai = await getJobRecoveryAssistantSuggestion(parsed.data, actorUserId);

    return NextResponse.json({
      success: true,
      message: "AI job recovery guidance generated",
      model: ai.model,
      requestId: ai.requestId,
      responseId: ai.responseId,
      promptVersion: "job-recovery-v1",
      usage: ai.usage,
      suggestion: ai.data,
    });
  } catch (error: any) {
    console.error("[job-recovery-assistant] POST error:", error);
    return buildAiFailureResponse(error, "Failed to generate AI job recovery guidance");
  }
}
