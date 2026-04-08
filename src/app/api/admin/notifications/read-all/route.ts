// src/app/api/admin/notifications/read-all/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
// TODO: Add admin authentication check

/**
 * POST /api/admin/notifications/read-all
 * Mark all notifications as read (admin-only)
 */
export async function POST(): Promise<NextResponse> {
  try {
    // TODO: Add admin authentication check

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
    return NextResponse.json(
      { error: "Failed to mark all as read", details: error.message },
      { status: 500 }
    );
  }
}

