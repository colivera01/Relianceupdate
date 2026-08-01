import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { dispatchQueuedConsentNotification } from "@/lib/booking-notification-delivery";
import {
  permissionAuthorizationStatus,
  requirePermissionManagerForBooking,
} from "@/lib/consent/authorization";
import { createVerifiedPermissionRequest } from "@/lib/consent/request-service";
import { logNotificationEnvWarnings } from "@/lib/env/notification-config";

function consentBaseUrl(request: NextRequest): string {
  const configured = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(request.url).origin.replace(/\/+$/, "");
}
function safeDelivery(delivery: any) {
  if (!delivery) return null;
  return {
    status: delivery.status,
    attemptCount: delivery.attemptCount,
    channels: Array.isArray(delivery.channels)
      ? delivery.channels.map((channel: any) => ({
          channel: channel.channel,
          attempted: Boolean(channel.attempted),
          success: Boolean(channel.success),
          errorCode: channel.errorCode || null,
          errorMessage: channel.errorMessage || null,
        }))
      : [],
    lastError: delivery.lastError || null,
    lastAttemptAt: delivery.lastAttemptAt || null,
    sentAt: delivery.sentAt || null,
  };
}

export async function POST(request: NextRequest) {
  logNotificationEnvWarnings();
  try {
    const body = await request.json();
    const bookingId = String(body?.bookingId || "").trim();
    const mediaSessionId = String(body?.mediaSessionId || "").trim() || null;
    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required" }, { status: 400 });
    }

    const { manager } = await requirePermissionManagerForBooking(request, bookingId);
    const created = await createVerifiedPermissionRequest({
      bookingId,
      actorUserId: manager.userId,
      mediaSessionId,
      reason: "create",
    });

    let delivery: any = null;
    if (created.actionSecret && created.actionPath && created.notificationId) {
      const booking = created.booking;
      const dispatched = await dispatchQueuedConsentNotification({
        notificationId: created.notificationId,
        consentRecordId: created.consentRecordId,
        actorUserId: manager.userId,
        consentPath: created.actionPath,
        absoluteBaseUrl: consentBaseUrl(request),
        customerEmail: created.recipient.email,
        customerPhone: created.recipient.phone,
        customerName: created.recipient.name,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
        serviceName: booking.service?.name || null,
        bookingTitle: booking.title || null,
        serviceDate: booking.scheduledFor || booking.date || null,
        consentTypeLabel: "recording permission",
      });
      delivery = dispatched.delivery;
      const delivered = delivery?.status === "SENT" || delivery?.status === "PARTIAL";
      await (prisma as any).consentRecord.update({
        where: { id: created.consentRecordId },
        data: { lifecycleStatus: delivered ? "DELIVERED" : "DELIVERY_FAILED" },
      });
      await (prisma as any).consentEvent.create({
        data: {
          consentRecordId: created.consentRecordId,
          eventType: delivered ? "notification_delivered" : "notification_delivery_failed",
          metadata: JSON.stringify({
            status: delivery?.status || "FAILED",
            channels: safeDelivery(delivery)?.channels || [],
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      permission: {
        id: created.consentRecordId,
        state:
          created.state === "pending" && delivery
            ? delivery.status === "SENT" || delivery.status === "PARTIAL"
              ? "delivered"
              : "delivery_failed"
            : created.state,
        generation: created.generation,
        recipient: {
          name: created.recipient.name,
          email: created.recipient.emailMasked,
          phone: created.recipient.phoneMasked,
        },
        audioEnabled: false,
        initialAudience: "private",
      },
      delivery: safeDelivery(delivery),
    });
  } catch (error) {
    const status = permissionAuthorizationStatus(error);
    if (status !== 500) {
      return NextResponse.json(
        { success: false, error: status === 404 ? "Work record not found" : "Permission denied" },
        { status }
      );
    }
    console.error("[permission/request] POST failed", error);
    return NextResponse.json(
      { success: false, error: "Unable to create the recording permission request" },
      { status: 500 }
    );
  }
}
