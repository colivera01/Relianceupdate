import { prisma } from "@/server/db";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import {
  maskPermissionEmail,
  maskPermissionPhone,
  normalizePermissionEmail,
  normalizePermissionPhone,
} from "@/lib/consent/recipient";
import { toBookingNotificationState } from "@/lib/booking-notification-delivery";

export const CUSTOMER_RECORDING_NOTICE_KIND = "CUSTOMER_RECORDING_NOTICE";

export function isCustomerRecordingNoticeKind(kind: string | null | undefined): boolean {
  const value = String(kind || "");
  return value === CUSTOMER_RECORDING_NOTICE_KIND || value.startsWith(`${CUSTOMER_RECORDING_NOTICE_KIND}:`);
}

type NoticeChannel = {
  channel: "email" | "sms";
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type RecordingNoticeInput = {
  notificationId: string;
  bookingId: string;
  actorUserId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  vendorName?: string | null;
  serviceName?: string | null;
  scopeHash?: string | null;
};

function deliveryStatus(channels: NoticeChannel[]): "FAILED" | "PARTIAL" | "SENT" {
  const attempted = channels.filter((channel) => channel.attempted);
  const successful = attempted.filter((channel) => channel.success);
  if (!successful.length) return "FAILED";
  return attempted.some((channel) => !channel.success) ? "PARTIAL" : "SENT";
}

function deliveryError(channels: NoticeChannel[]): string | null {
  const errors = channels
    .filter((channel) => channel.attempted && !channel.success)
    .map((channel) => channel.errorMessage || `${channel.channel}_delivery_failed`);
  return errors.length ? errors.join("; ") : null;
}

/**
 * Informational only. This notice never creates permission, changes the
 * recording gate, or implies that public sharing was approved.
 */
export async function sendRecordingNotice(input: RecordingNoticeInput) {
  const env = readNotificationEnv();
  const channels: NoticeChannel[] = [];
  const vendorName = String(input.vendorName || "Your service provider").trim();
  const serviceName = String(input.serviceName || "your service").trim();
  const customerName = String(input.customerName || "").trim();
  const email = normalizePermissionEmail(input.customerEmail);
  const phone = normalizePermissionPhone(input.customerPhone);
  const subject = `Reliance recording notice from ${vendorName}`;
  const text = [
    `Hello${customerName ? ` ${customerName}` : ""},`,
    "",
    `${vendorName} plans to create three short, video-only proof-of-service clips for ${serviceName}.`,
    "The approved scope is limited to vendor-owned property or a controlled work area. People, conversations, sensitive information, and customer identifiers are outside the approved scope.",
    "Audio is off. Recordings start Private. Public sharing would require a separate later decision.",
    "No response is required. Contact the service provider if the planned recording no longer matches this description.",
    "",
    "- Reliance Team",
  ].join("\n");
  const html = buildRelianceEmailHtml({
    eyebrow: "Recording notice",
    headline: "Private proof-of-service recording is planned",
    greeting: `Hello${customerName ? ` ${customerName}` : ""},`,
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong> plans to create three short, video-only proof-of-service clips.</p>
      <p style="margin:0 0 14px;">The approved scope is limited to vendor-owned property or a controlled work area. People, conversations, sensitive information, and customer identifiers are outside the approved scope.</p>
      <p style="margin:0 0 14px;">Audio is off. Recordings start Private. Public sharing would require a separate later decision.</p>
      <p style="margin:0;">No response is required. Contact the service provider if the planned recording no longer matches this description.</p>
    `,
    details: [{ label: "Service", value: serviceName }],
  });

  if (env.emailEnabled && email) {
    const result = await sendEmail({ to: email, subject, html, text });
    channels.push({
      channel: "email",
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: "recording_notice",
      channel: "email",
      recipient: email,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: "",
      errorMessage: result.errorMessage,
    });
  } else {
    channels.push({
      channel: "email",
      attempted: false,
      success: false,
      errorMessage: !email ? "no_customer_email" : "email_disabled",
    });
  }

  if (env.smsEnabled && phone) {
    const body = `Reliance: ${vendorName} plans video-only Private proof for ${serviceName}. Scope: vendor-owned property or controlled work area only; no people or audio. No response required. Reply STOP to opt out.`;
    const result = await sendSms({ to: phone, body });
    channels.push({
      channel: "sms",
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: "recording_notice",
      channel: "sms",
      recipient: phone,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: "",
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  } else {
    channels.push({
      channel: "sms",
      attempted: false,
      success: false,
      errorMessage: !phone ? "no_customer_phone" : "sms_disabled",
    });
  }
  return { channels, anySuccess: channels.some((channel) => channel.attempted && channel.success) };
}

export async function dispatchQueuedRecordingNotice(input: RecordingNoticeInput) {
  const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await (prisma as any).bookingNotification.updateMany({
    where: {
      id: input.notificationId,
      OR: [
        { status: "QUEUED" },
        { status: "FAILED" },
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
    const current = await (prisma as any).bookingNotification.findUnique({ where: { id: input.notificationId } });
    return { delivery: toBookingNotificationState(current), claimed: false };
  }

  try {
    const result = await sendRecordingNotice(input);
    const status = deliveryStatus(result.channels);
    const attemptNumber = Number(
      (
        await (prisma as any).bookingNotification.findUnique({
          where: { id: input.notificationId },
          select: { attemptCount: true },
        })
      )?.attemptCount || 1,
    );
    await Promise.all(
      result.channels.map((channel) =>
        (prisma as any).bookingNotificationAttempt.create({
          data: {
            notificationId: input.notificationId,
            consentRecordId: null,
            channel: channel.channel,
            destinationMasked:
              channel.channel === "email" ? maskPermissionEmail(emailOrNull(input.customerEmail)) : maskPermissionPhone(phoneOrNull(input.customerPhone)),
            status: channel.attempted ? (channel.success ? "SENT" : "FAILED") : "SKIPPED",
            attemptNumber,
            providerMessageId: channel.providerMessageId || null,
            errorCode: channel.errorCode || null,
            errorMessage: channel.errorMessage || null,
          },
        }),
      ),
    );
    const updated = await (prisma as any).bookingNotification.update({
      where: { id: input.notificationId },
      data: {
        status,
        channelsJson: JSON.stringify(result.channels),
        lastError: deliveryError(result.channels),
        ...(result.anySuccess ? { sentAt: new Date() } : {}),
        nextAttemptAt: result.anySuccess ? null : new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return { delivery: toBookingNotificationState(updated), claimed: true };
  } catch (error) {
    const updated = await (prisma as any).bookingNotification.update({
      where: { id: input.notificationId },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message.slice(0, 500) : "recording_notice_failed",
        nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return { delivery: toBookingNotificationState(updated), claimed: true };
  }
}

function emailOrNull(value: string | null | undefined) {
  return normalizePermissionEmail(value);
}

function phoneOrNull(value: string | null | undefined) {
  return normalizePermissionPhone(value);
}

export async function retryRecordingNotice(notificationId: string, actorUserId: string) {
  const notification = await (prisma as any).bookingNotification.findUnique({
    where: { id: notificationId },
    include: {
      booking: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          vendor: { select: { id: true, name: true, businessName: true } },
          service: { select: { id: true, name: true } },
          recordingAssessments: {
            where: { isCurrent: true },
            orderBy: { generation: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!notification || !isCustomerRecordingNoticeKind(notification.kind)) {
    throw new Error("Recording notice not found");
  }
  const assessment = notification.booking.recordingAssessments?.[0];
  if (!assessment || assessment.permissionRequired || assessment.riskLevel !== "LEVEL_1") {
    throw new Error("Recording notice no longer matches the current scope");
  }
  const customer = resolveBookingCustomer(notification.booking);
  return dispatchQueuedRecordingNotice({
    notificationId,
    bookingId: notification.bookingId,
    actorUserId,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    vendorName: notification.booking.vendor?.businessName || notification.booking.vendor?.name,
    serviceName: notification.booking.service?.name || notification.booking.title,
    scopeHash: assessment.scopeHash,
  });
}
