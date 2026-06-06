// src/app/api/admin/notifications/[id]/read/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/notifications/[id]/read
 * Mark a notification as read (admin-only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await params;

    const notification = await (prisma as any).adminNotification.update({
      where: { id },
      data: { read: true },
    });

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        read: notification.read,
      },
    });
  } catch (error: any) {
    console.error("[admin/notifications/read] POST error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to mark notification as read", details: error.message },
      { status: 500 }
    );
  }
}

