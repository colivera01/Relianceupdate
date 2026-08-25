import { prisma } from "@/server/db";
import { tryEmailExistingAdminNotification } from "@/lib/admin-notifications";
import { sendVideoReadyNotification } from "@/lib/notifications/send-video-ready";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { readNotificationEnv } from "@/lib/env/notification-config";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";

type DeliveryChannel = {
  channel: "email" | "sms";
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
};

function nextStatus(channels: DeliveryChannel[]): "FAILED" | "PARTIAL" | "SENT" {
  const attempted = channels.filter((channel) => channel.attempted);
  const successful = attempted.filter((channel) => channel.success);
  if (!successful.length) return "FAILED";
  return successful.length === attempted.length ? "SENT" : "PARTIAL";
}

async function claimNotification(notificationId: string): Promise<boolean> {
  const claimed = await (prisma as any).bookingNotification.updateMany({
    where: { id: notificationId, status: { in: ["QUEUED", "FAILED"] }, deadLetteredAt: null },
    data: {
      status: "SENDING",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
  return Number(claimed?.count || 0) === 1;
}

async function finishNotification(notificationId: string, channels: DeliveryChannel[]) {
  const status = nextStatus(channels);
  const errors = channels
    .filter((channel) => channel.attempted && !channel.success)
    .map((channel) => channel.errorMessage || `${channel.channel}_delivery_failed`);
  return (prisma as any).bookingNotification.update({
    where: { id: notificationId },
    data: {
      status,
      channelsJson: JSON.stringify(channels),
      lastError: errors.length ? errors.join("; ") : null,
      sentAt: status === "SENT" || status === "PARTIAL" ? new Date() : undefined,
      nextAttemptAt: status === "FAILED" ? new Date(Date.now() + 15 * 60 * 1000) : null,
    },
  });
}

export async function sendCoreAdminAuditReadyNotification(input: {
  notificationId: string;
  bookingNotificationId: string;
  bookingId: string;
  vendorId: string;
  packageId: string;
  packageVersion: number;
  actorUserId: string;
  baseUrl?: string | null;
}) {
  if (!(await claimNotification(input.bookingNotificationId))) {
    return { claimed: false, status: "already_processed" };
  }
  try {
    const result = await tryEmailExistingAdminNotification({
      notificationId: input.notificationId,
      type: "SERVICE_VIDEO_ADMIN_AUDIT_REQUIRED",
      title: "Service Video package requires Reliance Audit",
      message: "A vendor manager submitted a complete three-stage Service Video package for final Reliance Audit.",
      metadata: {
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        packageId: input.packageId,
        packageVersion: input.packageVersion,
      },
      surfaceHref: "/admin/media-moderation",
      baseUrl: input.baseUrl,
      actorUserId: input.actorUserId,
    });
    const channels: DeliveryChannel[] = [{
      channel: "email",
      attempted: true,
      success: result.emailSent,
      errorMessage: result.emailError,
    }];
    const record = await finishNotification(input.bookingNotificationId, channels);
    return { claimed: true, status: record.status, emailSent: result.emailSent };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishNotification(input.bookingNotificationId, [{
      channel: "email",
      attempted: true,
      success: false,
      errorMessage: message,
    }]);
    return { claimed: true, status: "FAILED", emailSent: false, error: message };
  }
}

export async function sendCorePrivateProofReadyNotification(input: {
  notificationId: string;
  actorUserId: string;
  bookingId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  bookingTitle?: string | null;
  vendorName?: string | null;
  completedAt?: Date | string | null;
  serviceTimeZone?: string | null;
  videoUrl: string;
}) {
  if (!(await claimNotification(input.notificationId))) {
    return { claimed: false, status: "already_processed" };
  }
  try {
    const result = await sendVideoReadyNotification(input);
    const record = await finishNotification(input.notificationId, result.channels);
    return { claimed: true, status: record.status, channels: result.channels };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishNotification(input.notificationId, [{
      channel: "email",
      attempted: true,
      success: false,
      errorMessage: message,
    }]);
    return { claimed: true, status: "FAILED", error: message };
  }
}

export async function sendCorePrivateProofRejectedNotification(input: {
  notificationId: string;
  actorUserId: string;
  bookingId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  vendorName?: string | null;
}) {
  if (!(await claimNotification(input.notificationId))) {
    return { claimed: false, status: "already_processed" };
  }
  const env = readNotificationEnv();
  const customerEmail = String(input.customerEmail || "").trim();
  const customerPhone = String(input.customerPhone || "").trim();
  const customerName = String(input.customerName || "").trim();
  const serviceName = String(input.serviceName || "your service").trim();
  const vendorName = String(input.vendorName || "Your service provider").trim();
  const channels: DeliveryChannel[] = [];
  const subject = `Update about your ${serviceName} Service Videos`;
  const message = `The Service Videos for ${serviceName} were not released to your Reliance account. This does not change the underlying service with ${vendorName}.`;

  if (env.emailEnabled && customerEmail) {
    const result = await sendEmail({
      to: customerEmail,
      subject,
      html: buildRelianceEmailHtml({
        eyebrow: "Service Video update",
        headline: "Service Videos were not released",
        greeting: `Hello${customerName ? ` ${escapeRelianceEmailHtml(customerName)}` : ""},`,
        bodyHtml: `<p style="margin:0 0 14px;">${escapeRelianceEmailHtml(message)}</p><p style="margin:0;">No action is required from you.</p>`,
        details: [
          { label: "Service", value: serviceName },
          { label: "Service provider", value: vendorName },
          { label: "Private Service Video", value: "Not released" },
        ],
      }),
      text: `${message}\n\nNo action is required from you.`,
    });
    channels.push({ channel: "email", attempted: true, success: result.ok, providerMessageId: result.providerMessageId, errorMessage: result.errorMessage });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: "private_proof_not_released",
      channel: "email",
      recipient: customerEmail,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: "",
      errorMessage: result.errorMessage,
    });
  } else {
    channels.push({ channel: "email", attempted: false, success: false, errorMessage: customerEmail ? "email_disabled" : "no_customer_email" });
  }

  if (env.smsEnabled && customerPhone) {
    const result = await sendSms({ to: customerPhone, body: `Reliance: ${message}` });
    channels.push({ channel: "sms", attempted: true, success: result.ok, providerMessageId: result.providerMessageId, errorMessage: result.errorMessage, errorCode: result.errorCode });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: "private_proof_not_released",
      channel: "sms",
      recipient: customerPhone,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: "",
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
    });
  } else {
    channels.push({ channel: "sms", attempted: false, success: false, errorMessage: customerPhone ? "sms_disabled" : "no_customer_phone" });
  }

  const record = await finishNotification(input.notificationId, channels);
  return { claimed: true, status: record.status, channels };
}
