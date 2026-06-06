// src/app/api/admin/notifications/read-all/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

/**
 * POST /api/admin/notifications/read-all
 * Mark all notifications as read (admin-only)
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    await (prisma as any).adminNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    console.error("[admin/notifications/read-all] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to mark all as read", details: error.message },
      { status: 500 }
    );
  }
}

