import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
  getPublicEmailBaseUrl,
} from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { sendSms } from "@/lib/sms/twilio";
import { prisma } from "@/server/db";

type DeliveryChannel = {
  channel: "email" | "sms";
  recipientMembershipId: string;
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
};

export const EMPLOYEE_PARTICIPATION_DECLINED_NOTIFICATION_KIND =
  "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED:";

export function isEmployeeParticipationDeclinedNotificationKind(kind: string): boolean {
  return String(kind || "").startsWith(EMPLOYEE_PARTICIPATION_DECLINED_NOTIFICATION_KIND);
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : null;
}

function deliveryStatus(channels: DeliveryChannel[]): "FAILED" | "PARTIAL" | "SENT" {
  const attempted = channels.filter((channel) => channel.attempted);
  const successful = attempted.filter((channel) => channel.success);
  if (!successful.length) return "FAILED";
  return successful.length === attempted.length ? "SENT" : "PARTIAL";
}

export async function dispatchEmployeeParticipationDeclinedNotification(input: {
  notificationId: string;
  actorUserId: string;
  baseUrl?: string | null;
}) {
  const claimed = await (prisma as any).bookingNotification.updateMany({
    where: {
      id: input.notificationId,
      status: { in: ["QUEUED", "FAILED"] },
      deadLetteredAt: null,
    },
    data: {
      status: "SENDING",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
  if (Number(claimed?.count || 0) !== 1) {
    return { claimed: false, status: "already_processed", channels: [] as DeliveryChannel[] };
  }

  try {
    const notification = await (prisma as any).bookingNotification.findFirst({
      where: {
        id: input.notificationId,
        kind: { startsWith: EMPLOYEE_PARTICIPATION_DECLINED_NOTIFICATION_KIND },
      },
      select: {
        bookingId: true,
        booking: {
          select: {
            id: true,
            title: true,
            vendorId: true,
            service: { select: { name: true } },
            vendor: { select: { name: true, businessName: true } },
          },
        },
      },
    });
    if (!notification?.booking) {
      throw new Error("EMPLOYEE_PARTICIPATION_DECLINE_NOTIFICATION_CONTEXT_MISSING");
    }

    const managers = await (prisma as any).vendorMembership.findMany({
      where: {
        vendorId: notification.booking.vendorId,
        role: "MANAGER",
        status: "ACTIVE",
      },
      select: {
        id: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    const env = readNotificationEnv();
    const serviceName = String(
      notification.booking.title || notification.booking.service?.name || "Service Order",
    ).trim();
    const vendorName = String(
      notification.booking.vendor?.businessName ||
        notification.booking.vendor?.name ||
        "Reliance Vendor",
    ).trim();
    const jobUrl = `${getPublicEmailBaseUrl(input.baseUrl)}/vendor/jobs/${encodeURIComponent(notification.bookingId)}`;
    const channels: DeliveryChannel[] = [];

    for (const manager of managers) {
      const name = String(manager.user?.name || "Vendor Manager").trim();
      const email = String(manager.user?.email || "").trim().toLowerCase();
      const phone = normalizePhone(manager.user?.phone);
      if (env.emailEnabled && email) {
        const result = await sendEmail({
          to: email,
          subject: `Employee recording participation declined: ${serviceName}`,
          text: [
            `Hi ${name},`,
            "",
            `An assigned employee declined recording participation for ${serviceName}.`,
            "Recording remains blocked. The underlying service is not automatically canceled.",
            "",
            `Open Manage Job: ${jobUrl}`,
          ].join("\n"),
          html: buildRelianceEmailHtml({
            eyebrow: "Recording participation",
            headline: "Employee recording participation declined",
            greeting: `Hi ${name},`,
            bodyHtml: `<p style="margin:0 0 14px;">An assigned employee declined recording participation for <strong style="color:#ffffff;">${escapeRelianceEmailHtml(serviceName)}</strong>.</p><p style="margin:0;">Recording remains blocked. The underlying service is not automatically canceled.</p>`,
            details: [
              { label: "Business", value: vendorName },
              { label: "Service order", value: serviceName },
              { label: "Recording", value: "Blocked" },
            ],
            cta: { label: "Open Manage Job", href: jobUrl },
            fallbackHref: jobUrl,
          }),
        });
        channels.push({
          channel: "email",
          recipientMembershipId: manager.id,
          attempted: true,
          success: result.ok,
          providerMessageId: result.providerMessageId,
          errorMessage: result.errorMessage,
        });
        await logNotificationAttempt(input.actorUserId, notification.bookingId, {
          kind: "employee_recording_participation_declined",
          channel: "email",
          recipient: email,
          success: result.ok,
          providerMessageId: result.providerMessageId,
          fallbackLink: jobUrl,
          errorMessage: result.errorMessage,
        });
      } else {
        channels.push({
          channel: "email",
          recipientMembershipId: manager.id,
          attempted: false,
          success: false,
          errorMessage: email ? "email_disabled" : "no_manager_email",
        });
      }

      if (env.smsEnabled && phone) {
        const result = await sendSms({
          to: phone,
          body: `Reliance: Employee recording participation was declined for ${serviceName}. Recording is blocked. Manage Job: ${jobUrl}`,
        });
        channels.push({
          channel: "sms",
          recipientMembershipId: manager.id,
          attempted: true,
          success: result.ok,
          providerMessageId: result.providerMessageId,
          errorMessage: result.errorMessage,
          errorCode: result.errorCode,
        });
        await logNotificationAttempt(input.actorUserId, notification.bookingId, {
          kind: "employee_recording_participation_declined",
          channel: "sms",
          recipient: phone,
          success: result.ok,
          providerMessageId: result.providerMessageId,
          fallbackLink: jobUrl,
          errorMessage: result.errorMessage,
          errorCode: result.errorCode,
        });
      } else {
        channels.push({
          channel: "sms",
          recipientMembershipId: manager.id,
          attempted: false,
          success: false,
          errorMessage: phone ? "sms_disabled" : "no_manager_phone",
        });
      }
    }

    const status = deliveryStatus(channels);
    const errors = channels
      .filter((channel) => channel.attempted && !channel.success)
      .map((channel) => channel.errorMessage || `${channel.channel}_delivery_failed`);
    await (prisma as any).bookingNotification.update({
      where: { id: input.notificationId },
      data: {
        status,
        channelsJson: JSON.stringify(channels),
        lastError: errors.length ? errors.join("; ").slice(0, 2000) : null,
        sentAt: status === "SENT" || status === "PARTIAL" ? new Date() : null,
        nextAttemptAt: status === "FAILED" ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });
    return { claimed: true, status, channels };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await (prisma as any).bookingNotification.update({
      where: { id: input.notificationId },
      data: {
        status: "FAILED",
        lastError: message.slice(0, 2000),
        nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return { claimed: true, status: "FAILED" as const, channels: [] as DeliveryChannel[] };
  }
}
