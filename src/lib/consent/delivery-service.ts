import { prisma } from "@/server/db";
import { dispatchQueuedConsentNotification } from "@/lib/booking-notification-delivery";
import { PERMISSION_CONTENT_VERSION } from "@/lib/consent/content-version";

export async function deliverVerifiedPermissionRequest(input: {
  request: Request;
  notificationId: string;
  consentRecordId: string;
  actorUserId: string;
  actionPath: string;
  recipient: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  booking: any;
}) {
  const configured = String(process.env.APP_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const baseUrl =
    configured || new URL(input.request.url).origin.replace(/\/+$/, "");
  const consentModel = (prisma as any).consentRecord;
  const current = consentModel?.findUnique
    ? await consentModel.findUnique({
        where: { id: input.consentRecordId },
        select: { contentVersion: { select: { version: true } } },
      })
    : null;
  const dispatched = await dispatchQueuedConsentNotification({
    notificationId: input.notificationId,
    consentRecordId: input.consentRecordId,
    actorUserId: input.actorUserId,
    consentPath: input.actionPath,
    absoluteBaseUrl: baseUrl,
    customerEmail: input.recipient.email,
    customerPhone: input.recipient.phone,
    customerName: input.recipient.name,
    vendorName:
      input.booking.vendor?.businessName || input.booking.vendor?.name || null,
    serviceName: input.booking.service?.name || null,
    bookingTitle: input.booking.title || null,
    serviceDate: input.booking.scheduledFor || input.booking.date || null,
    consentTypeLabel: "recording permission",
    contentVersion: current?.contentVersion?.version || PERMISSION_CONTENT_VERSION,
  });
  const delivery = dispatched.delivery;
  const delivered =
    delivery?.status === "SENT" || delivery?.status === "PARTIAL";
  await (prisma as any).consentRecord.update({
    where: { id: input.consentRecordId },
    data: { lifecycleStatus: delivered ? "DELIVERED" : "DELIVERY_FAILED" },
  });
  await (prisma as any).consentEvent.create({
    data: {
      consentRecordId: input.consentRecordId,
      eventType: delivered
        ? "notification_delivered"
        : "notification_delivery_failed",
      metadata: JSON.stringify({
        status: delivery?.status || "FAILED",
        channels: Array.isArray(delivery?.channels)
          ? delivery.channels.map((channel: any) => ({
              channel: channel.channel,
              attempted: Boolean(channel.attempted),
              success: Boolean(channel.success),
              errorCode: channel.errorCode || null,
            }))
          : [],
      }),
    },
  });
  return delivery;
}
