import { NextResponse } from "next/server";

import { requireVendorManager } from "@/lib/membership-auth";
import { authorizationErrorResponse } from "@/lib/request-actor";
import { markVendorManagerNotificationRead } from "@/lib/vendor-manager-notifications";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ vendorId: string; notificationId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { vendorId, notificationId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const body = await request.json().catch(() => ({}));
    const transition = body?.transition == null ? "MARK_READ" : String(body.transition).toUpperCase();
    if (!["MARK_READ", "VIEW_DETAILS"].includes(transition)) {
      return NextResponse.json(
        { success: false, error: "VENDOR_MANAGER_NOTIFICATION_TRANSITION_INVALID" },
        { status: 422 },
      );
    }
    const result = await markVendorManagerNotificationRead(prisma as any, {
      id: notificationId,
      vendorId,
      membershipId: manager.membershipId,
      transition: transition as "MARK_READ" | "VIEW_DETAILS",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    const message = error instanceof Error ? error.message : "Unable to update notification.";
    const status = message.includes("Unauthorized") || message.includes("Forbidden")
      ? 403
      : message === "VENDOR_MANAGER_NOTIFICATION_NOT_FOUND"
        ? 404
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
