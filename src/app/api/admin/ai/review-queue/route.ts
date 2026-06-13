import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAiOwnerQueueSnapshot } from "@/lib/ai/review-queue";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const snapshot = await getAiOwnerQueueSnapshot();
    return NextResponse.json({
      success: true,
      ...snapshot,
    });
  } catch (error: any) {
    console.error("[admin/ai/review-queue] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AI review queue",
        message: "Failed to fetch AI review queue",
      },
      { status: 500 }
    );
  }
}
