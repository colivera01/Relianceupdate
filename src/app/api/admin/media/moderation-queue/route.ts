import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminMediaModerationQueue } from "@/lib/admin-media-moderation-queue";

/**
 * GET /api/admin/media/moderation-queue
 * Admin-only moderation queue listing for complete 3-stage job packages.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const moderationStatus = searchParams.get("moderationStatus");
    const vendorId = searchParams.get("vendorId");
    const uploadedByMembershipId = searchParams.get("uploadedByMembershipId");
    const date = searchParams.get("date"); // YYYY-MM-DD
    const search = searchParams.get("search");
    const includeInternal = searchParams.get("includeInternal") === "1";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "120", 10) || 120, 1), 200);
    const filteredBySearch = await getAdminMediaModerationQueue({
      moderationStatus,
      vendorId,
      uploadedByMembershipId,
      date,
      search,
      includeInternal,
      limit,
    });

    return NextResponse.json({
      success: true,
      message: "Moderation queue fetched successfully",
      packages: filteredBySearch,
    });
  } catch (error: any) {
    console.error("[admin/media/moderation-queue] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch moderation queue",
        message: "Failed to fetch moderation queue",
      },
      { status: 500 }
    );
  }
}
