import { NextResponse } from "next/server";

import { requireVendorManager } from "@/lib/membership-auth";
import { markVendorManagerNotificationRead } from "@/lib/vendor-manager-notifications";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ vendorId: string; notificationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { vendorId, notificationId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const result = await markVendorManagerNotificationRead(prisma as any, {
      id: notificationId,
      vendorId,
      membershipId: manager.membershipId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notification.";
    const status = message.includes("Unauthorized") || message.includes("Forbidden")
      ? 403
      : message === "VENDOR_MANAGER_NOTIFICATION_NOT_FOUND"
        ? 404
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
