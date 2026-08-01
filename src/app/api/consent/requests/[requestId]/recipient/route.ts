import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { requirePermissionManagerForBooking, permissionAuthorizationStatus } from "@/lib/consent/authorization";
import { deliverVerifiedPermissionRequest } from "@/lib/consent/delivery-service";
import { createVerifiedPermissionRequest } from "@/lib/consent/request-service";

type Context = { params: Promise<{ requestId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { requestId } = await context.params;
    const existing = await (prisma as any).consentRecord.findUnique({
      where: { id: requestId },
      select: { bookingId: true, mediaSessionId: true, decisionEvidence: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "Permission request not found" }, { status: 404 });
    if (existing.decisionEvidence) return NextResponse.json({ success: false, error: "A final decision cannot be reassigned" }, { status: 409 });
    const { manager } = await requirePermissionManagerForBooking(request, existing.bookingId);
    const body = await request.json().catch(() => ({}));
    const recipient = {
      name: String(body?.name || "").trim() || null,
      email: String(body?.email || "").trim() || null,
      phone: String(body?.phone || "").trim() || null,
    };
    if (!recipient.email && !recipient.phone) {
      return NextResponse.json({ success: false, error: "Provide an email address or mobile phone" }, { status: 422 });
    }
    const created = await createVerifiedPermissionRequest({
      bookingId: existing.bookingId,
      actorUserId: manager.userId,
      mediaSessionId: existing.mediaSessionId,
      reason: "recipient_correction",
      recipientOverride: recipient,
    });
    let delivery = null;
    if (created.actionPath && created.notificationId) {
      delivery = await deliverVerifiedPermissionRequest({
        request,
        notificationId: created.notificationId,
        consentRecordId: created.consentRecordId,
        actorUserId: manager.userId,
        actionPath: created.actionPath,
        recipient: created.recipient,
        booking: created.booking,
      });
    }
    return NextResponse.json({
      success: true,
      permission: {
        id: created.consentRecordId,
        state: created.state === "pending" && delivery
          ? delivery.status === "SENT" || delivery.status === "PARTIAL" ? "delivered" : "delivery_failed"
          : created.state,
        recipient: { name: created.recipient.name, email: created.recipient.emailMasked, phone: created.recipient.phoneMasked },
      },
    });
  } catch (error) {
    const status = permissionAuthorizationStatus(error);
    if (status !== 500) return NextResponse.json({ success: false, error: "Permission denied" }, { status });
    console.error("[permission/recipient] PATCH failed", error);
    return NextResponse.json({ success: false, error: "Unable to correct the recipient" }, { status: 500 });
  }
}
