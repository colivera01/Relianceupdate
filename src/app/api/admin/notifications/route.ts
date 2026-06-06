// src/app/api/admin/notifications/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/admin-auth";
import { launchExcludedUserIds, launchExcludedVendorIds } from "@/lib/internal-identities";

function forbiddenResponse(error: any) {
  const message = error?.message || "Forbidden";
  return NextResponse.json({ success: false, error: message, message }, { status: 403 });
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/notifications
 * List all admin notifications (admin-only)
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const excludedVendorIds = new Set(launchExcludedVendorIds());
    const excludedUserIds = new Set(launchExcludedUserIds());
    const notifications = (await (prisma as any).adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            businessName: true,
            name: true,
          },
        },
      },
      take: 100,
    })).filter((notification: any) => {
      if (notification.vendorId && excludedVendorIds.has(String(notification.vendorId))) {
        return false;
      }

      const metadata = parseMetadata(notification.metadata);
      const metadataVendorIds = [metadata?.vendorId, metadata?.reportedVendorId, metadata?.reporterVendorId]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (metadataVendorIds.some((id) => excludedVendorIds.has(id))) {
        return false;
      }

      const metadataUserIds = [metadata?.reporterUserId, metadata?.reportedUserId, metadata?.userId]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (metadataUserIds.some((id) => excludedUserIds.has(id))) {
        return false;
      }

      return true;
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
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return forbiddenResponse(error);
    }
    return NextResponse.json(
      { error: "Failed to fetch notifications", details: error.message },
      { status: 500 }
    );
  }
}
