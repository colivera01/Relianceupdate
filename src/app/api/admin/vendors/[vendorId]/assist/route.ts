import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AiFeatureDisabledError } from "@/lib/ai/errors";
import { isAiFeatureEnabled } from "@/lib/ai/feature-flags";
import { buildAiFailureResponse } from "@/lib/ai/http";
import {
  generateVendorApprovalAiStoredResult,
  resolveVendorApprovalAssistantContext,
  serializeVendorApprovalAiStoredResult,
} from "@/lib/ai/vendor-approval-review-store";
import { isTransientDbConnectivityError, PUBLIC_DB_UNAVAILABLE_CODE } from "@/lib/transient-db-errors";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

export async function POST(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { userId } = await requireAdmin(request);
    if (!isAiFeatureEnabled("vendor_approval_assistant")) {
      throw new AiFeatureDisabledError("AI vendor approval assistant is disabled");
    }

    const { vendorId } = await context.params;
    const resolution = await resolveVendorApprovalAssistantContext(String(vendorId));
    if (resolution.status === "vendor_not_found") {
      return NextResponse.json(
        { success: false, error: "Vendor not found", message: "Vendor not found" },
        { status: 404 }
      );
    }

    if (resolution.status !== "ok") {
      return NextResponse.json(
        {
          success: false,
          error: "No pending approval record found for this vendor",
          message: "No pending approval record found for this vendor",
        },
        { status: 422 }
      );
    }

    const storedResult = await generateVendorApprovalAiStoredResult(String(vendorId), {
      actorUserId: userId,
      source: "admin_vendor_approval_queue_manual_refresh",
      resolution,
    });
    if (!storedResult) {
      return NextResponse.json(
        {
          success: false,
          error: "No pending approval record found for this vendor",
          message: "No pending approval record found for this vendor",
        },
        { status: 422 }
      );
    }

    const payload = serializeVendorApprovalAiStoredResult(storedResult);

    return NextResponse.json({
      success: true,
      message: "AI vendor approval recommendation generated",
      promptVersion: payload?.promptVersion,
      model: payload?.model,
      responseId: payload?.aiRunId,
      usage: payload?.usage,
      suggestion: payload?.suggestion,
      applicationSnapshot: payload?.applicationSnapshot,
    });
  } catch (error: any) {
    console.error("[admin/vendors/:vendorId/assist] POST error:", error);
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
            "AI vendor approval assistance is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          message:
            "AI vendor approval assistance is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.",
          retryable: true,
        },
        { status: 503 }
      );
    }
    return buildAiFailureResponse(error, "Failed to generate AI vendor approval recommendation");
  }
}
