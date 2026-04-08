// src/app/api/admin/notifications/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
// TODO: Add admin authentication check

/**
 * GET /api/admin/notifications
 * List all admin notifications (admin-only)
 */
export async function GET(): Promise<NextResponse> {
  try {
    // TODO: Add admin authentication check
    // const adminUser = await requireAdmin(request);

    const notifications = await (prisma as any).adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            businessName: true,
            name: true,
          },
        },
      },
      take: 100, // Limit to recent 100
    });

    return NextResponse.json({
      notifications: notifications.map((n: any) => ({
        id: n.id,
        vendorId: n.vendorId,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        read: n.read,
        createdAt: n.createdAt,
        vendor: n.vendor,
      })),
    });
  } catch (error: any) {
    console.error("[admin/notifications] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications", details: error.message },
      { status: 500 }
    );
  }
}

