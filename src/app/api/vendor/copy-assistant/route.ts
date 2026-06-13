import { NextResponse } from "next/server";
import { getUserIdFromRequest, getVendorIdFromRequest } from "@/lib/auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  getVendorCopyAssistantSuggestion,
  vendorCopyAssistantRequestSchema,
} from "@/lib/ai/vendor-copy-assistant";

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

    if (!isAiFeatureEnabled("vendor_copy_assistant")) {
      throw new AiFeatureDisabledError("AI vendor copy assistant is disabled");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = vendorCopyAssistantRequestSchema.safeParse({
      ...body,
      vendorId,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid vendor copy request",
          message: "Invalid vendor copy request",
          details: parsed.error.flatten(),
        },
        { status: 422 }
      );
    }

    const ai = await getVendorCopyAssistantSuggestion(parsed.data, actorUserId);

    return NextResponse.json({
      success: true,
      message: "AI vendor copy guidance generated",
      model: ai.model,
      requestId: ai.requestId,
      responseId: ai.responseId,
      promptVersion: "vendor-copy-v1",
      usage: ai.usage,
      suggestion: ai.data,
    });
  } catch (error: any) {
    console.error("[vendor/copy-assistant] POST error:", error);
    return buildAiFailureResponse(error, "Failed to generate AI vendor copy guidance");
  }
}
