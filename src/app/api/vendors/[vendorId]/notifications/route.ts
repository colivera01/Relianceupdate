import { NextResponse } from "next/server";

import { requireVendorManager } from "@/lib/membership-auth";
import { listVendorManagerNotificationHistory } from "@/lib/vendor-manager-notifications";
import { prisma } from "@/server/db";

type Context = { params: Promise<{ vendorId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { vendorId } = await context.params;
    const manager = await requireVendorManager(request, vendorId);
    const notifications = await listVendorManagerNotificationHistory(prisma as any, {
      vendorId,
      membershipId: manager.membershipId,
      limit: 100,
    });
    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load notification history.";
    const status = message.includes("Unauthorized") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
