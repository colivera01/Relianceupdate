// src/app/api/admin/notifications/[id]/read/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
// TODO: Add admin authentication check

interface RouteParams {
  params: { id: string };
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
    // TODO: Add admin authentication check
    const { id } = params;

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
    return NextResponse.json(
      { error: "Failed to mark notification as read", details: error.message },
      { status: 500 }
    );
  }
}

