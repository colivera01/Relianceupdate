import { prisma } from "@/server/db";
import {
  ConsentLinkDeliveryInput,
  ConsentLinkDeliveryResult,
  sendConsentLinkNotification,
} from "@/lib/notifications/send-consent-link";
import { maskPermissionEmail, maskPermissionPhone, normalizePermissionEmail, normalizePermissionPhone } from "@/lib/consent/recipient";

export const CUSTOMER_CONSENT_NOTIFICATION_KIND = "CUSTOMER_CONSENT_REQUEST";

type DispatchConsentNotificationInput = ConsentLinkDeliveryInput & {
  notificationId: string;
};

export type BookingNotificationState = {
  status: "FAILED" | "PARTIAL" | "QUEUED" | "SENDING" | "SENT";
  attemptCount: number;
  channels: Array<Record<string, unknown>>;
  lastError: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
};

function parseChannels(value: string | null | undefined): Array<Record<string, unknown>> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
      : [];
  } catch {
    return [];
  }
}

export function toBookingNotificationState(record: any): BookingNotificationState | null {
  if (!record) return null;
  const rawStatus = String(record.status || "").trim().toUpperCase();
  const status: BookingNotificationState["status"] =
    rawStatus === "FAILED" ||
    rawStatus === "PARTIAL" ||
    rawStatus === "SENDING" ||
    rawStatus === "SENT"
      ? rawStatus
      : "QUEUED";
  return {
    status,
    attemptCount: Number(record.attemptCount || 0),
    channels: parseChannels(record.channelsJson),
    lastError: String(record.lastError || "").trim() || null,
    lastAttemptAt: record.lastAttemptAt?.toISOString?.() || null,
    sentAt: record.sentAt?.toISOString?.() || null,
  };
}

function deliveryStatus(result: ConsentLinkDeliveryResult): "FAILED" | "PARTIAL" | "SENT" {
  const attempted = result.channels.filter((channel) => channel.attempted);
  const successful = attempted.filter((channel) => channel.success);
  if (successful.length === 0) return "FAILED";
  return attempted.some((channel) => !channel.success) ? "PARTIAL" : "SENT";
}

function deliveryError(result: ConsentLinkDeliveryResult): string | null {
  const errors = result.channels
    .filter((channel) => channel.attempted && !channel.success)
    .map((channel) => channel.errorMessage || `${channel.channel}_delivery_failed`);
  return errors.length ? errors.join("; ") : null;
}

export async function dispatchQueuedConsentNotification(
  input: DispatchConsentNotificationInput
): Promise<{
  delivery: BookingNotificationState | null;
  notification: ConsentLinkDeliveryResult | null;
  claimed: boolean;
}> {
  const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await (prisma as any).bookingNotification.updateMany({
    where: {
      id: input.notificationId,
      OR: [
        { status: "QUEUED" },
        { status: "SENDING", lastAttemptAt: { lt: staleSendingBefore } },
      ],
    },
    data: {
      status: "SENDING",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });

  if (Number(claimed?.count || 0) !== 1) {
    const current = await (prisma as any).bookingNotification.findUnique({
      where: { id: input.notificationId },
    });
    return {
      delivery: toBookingNotificationState(current),
      notification: null,
      claimed: false,
    };
  }

  try {
    const notification = await sendConsentLinkNotification(input);
    const status = deliveryStatus(notification);
    const attemptNumber = Number((await (prisma as any).bookingNotification.findUnique({
      where: { id: input.notificationId },
      select: { attemptCount: true },
    }))?.attemptCount || 1);
    await Promise.all(
      notification.channels.map((channel) =>
        (prisma as any).bookingNotificationAttempt.create({
          data: {
            notificationId: input.notificationId,
            consentRecordId: input.consentRecordId,
            channel: channel.channel,
            destinationMasked:
              channel.channel === "email"
                ? maskPermissionEmail(normalizePermissionEmail(input.customerEmail))
                : maskPermissionPhone(normalizePermissionPhone(input.customerPhone)),
            status: channel.attempted ? (channel.success ? "SENT" : "FAILED") : "SKIPPED",
            attemptNumber,
            providerMessageId: channel.providerMessageId || null,
            errorCode: channel.errorCode || null,
            errorMessage: channel.errorMessage || null,
          },
        })
      )
    );
    const updated = await (prisma as any).bookingNotification.update({
      where: { id: input.notificationId },
      data: {
        status,
        channelsJson: JSON.stringify(notification.channels),
        lastError: deliveryError(notification),
        ...(notification.anySuccess ? { sentAt: new Date() } : {}),
        nextAttemptAt: notification.anySuccess ? null : new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    return {
      delivery: toBookingNotificationState(updated),
      notification,
      claimed: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated = await (prisma as any).bookingNotification.update({
      where: { id: input.notificationId },
      data: {
        status: "FAILED",
        lastError: message,
      },
    });
    return {
      delivery: toBookingNotificationState(updated),
      notification: null,
      claimed: true,
    };
  }
}
