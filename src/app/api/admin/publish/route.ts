import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminPublishOverview } from "@/lib/admin-publish-controls";

/**
 * GET /api/admin/publish
 * Admin-only publish control overview for vendors and services.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "");
    const { vendors, services } = await getAdminPublishOverview(q);

    return NextResponse.json({
      success: true,
      message: "Publish control overview fetched successfully",
      vendors,
      services,
    });
  } catch (error: any) {
    console.error("[admin/publish] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ success: false, error: error.message, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch publish controls", message: "Failed to fetch publish controls" },
      { status: 500 }
    );
  }
}
