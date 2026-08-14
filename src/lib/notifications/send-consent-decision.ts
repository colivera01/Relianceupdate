import { prisma } from "@/server/db";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { releaseEmployeeServiceOrderWhenReady } from "@/lib/employee-service-order-release";
import { parseAssignmentMetadata } from "@/lib/job-assignment";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import {
  buildRelianceEmailHtml,
  escapeRelianceEmailHtml,
} from "@/lib/email/reliance-template";

function phone(value: unknown): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.startsWith("+")) return text;
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return digits ? `+${digits}` : null;
}

function baseUrl(request: Request): string {
  const configured = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(request.url).origin.replace(/\/+$/, "");
}

export function buildConsentDecisionEmailContent(input: {
  accepted: boolean;
  vendorName: string;
  jobTitle: string;
  recipientName: string;
}) {
  const decision = input.accepted ? "approved" : "declined";
  const subject = `Customer ${decision} service video access: ${input.jobTitle}`;
  const message = input.accepted
    ? `The verified recipient allowed Reliance recording for ${input.jobTitle}. Recordings start Private. The assigned employee can now open the secure service order when all other recording checks pass.`
    : `The verified recipient declined Reliance recording for ${input.jobTitle}. Recording stays locked. The service may continue without Reliance recording.`;
  const resultLabel = input.accepted ? "Recording allowed" : "Recording declined";
  const nextStep = input.accepted
    ? "The assigned employee may open the secure service order after the remaining recording checks pass."
    : "Do not record this service in Reliance. The service may continue without recording.";
  const greeting = `Hi ${input.recipientName || "there"},`;
  const text = [
    greeting,
    "",
    message,
    "",
    `Vendor: ${input.vendorName}`,
    `Service order: ${input.jobTitle}`,
    `Decision: ${resultLabel}`,
    "",
    `Next step: ${nextStep}`,
    "",
    "- Reliance Team",
  ].join("\n");
  const html = buildRelianceEmailHtml({
    eyebrow: "Recording permission update",
    headline: `${resultLabel}: ${input.jobTitle}`,
    greeting,
    bodyHtml: `<p style="margin:0;">${escapeRelianceEmailHtml(message)}</p>`,
    details: [
      { label: "Vendor", value: input.vendorName },
      { label: "Service order", value: input.jobTitle },
      { label: "Decision", value: resultLabel },
    ],
    secondaryHtml: `
      <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:800;">What happens next</p>
      <p style="margin:0;">${escapeRelianceEmailHtml(nextStep)}</p>
    `,
    footerNote: "This message confirms the verified recipient's recording-permission decision.",
  });

  return { subject, message, resultLabel, nextStep, text, html };
}

async function sendDecisionNotice(input: {
  actorUserId: string;
  bookingId: string;
  accepted: boolean;
  vendorName: string;
  jobTitle: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
}) {
  const env = readNotificationEnv();
  const decision = input.accepted ? "approved" : "declined";
  const content = buildConsentDecisionEmailContent(input);
  const channels = [];
  if (env.emailEnabled && input.recipientEmail) {
    const result = await sendEmail({
      to: input.recipientEmail,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    channels.push({ channel: "email", success: result.ok });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: `customer_consent_${decision}`,
      channel: "email",
      recipient: input.recipientEmail,
      success: result.ok,
      fallbackLink: "",
      errorMessage: result.errorMessage,
      providerMessageId: result.providerMessageId,
    });
  }
  const normalizedPhone = phone(input.recipientPhone);
  if (env.smsEnabled && normalizedPhone) {
    const result = await sendSms({ to: normalizedPhone, body: `Reliance: ${content.message}` });
    channels.push({ channel: "sms", success: result.ok });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: `customer_consent_${decision}`,
      channel: "sms",
      recipient: normalizedPhone,
      success: result.ok,
      fallbackLink: "",
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
      providerMessageId: result.providerMessageId,
    });
  }
  return channels;
}

export async function sendConsentDecisionNotifications(input: {
  request: Request;
  bookingId: string;
  accepted: boolean;
  actorUserId: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      title: true,
      clientName: true,
      scheduledFor: true,
      date: true,
      customerMetadata: true,
      service: { select: { name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      vendor: { select: { name: true, businessName: true, email: true, phone: true } },
    },
  });
  if (!booking) return { releasedMembershipIds: [], notifications: [] };

  const managers = await prisma.vendorMembership.findMany({
    where: { vendorId: booking.vendorId, role: "MANAGER", status: "ACTIVE" },
    select: { id: true, user: { select: { name: true, email: true, phone: true } } },
  });
  const vendorName = String(booking.vendor.businessName || booking.vendor.name || "Reliance Vendor");
  const jobTitle = String(booking.title || booking.service?.name || "Service order");
  const customer = resolveBookingCustomer(booking);
  const notifications = [];

  const managerRecipients = managers.length
    ? managers.map((manager) => manager.user)
    : [{ name: vendorName, email: booking.vendor.email, phone: booking.vendor.phone }];
  for (const recipient of managerRecipients) {
    notifications.push(
      await sendDecisionNotice({
        actorUserId: input.actorUserId,
        bookingId: booking.id,
        accepted: input.accepted,
        vendorName,
        jobTitle,
        recipientName: String(recipient?.name || vendorName),
        recipientEmail: recipient?.email || null,
        recipientPhone: recipient?.phone || null,
      })
    );
  }

  if (!input.accepted) {
    const assignment = parseAssignmentMetadata(booking.customerMetadata);
    const assignedMembers = assignment.assignedMembershipIds.length
      ? await prisma.vendorMembership.findMany({
          where: { id: { in: assignment.assignedMembershipIds }, vendorId: booking.vendorId },
          select: { user: { select: { name: true, email: true, phone: true } } },
        })
      : [];
    for (const assignedMember of assignedMembers) {
      notifications.push(
        await sendDecisionNotice({
          actorUserId: input.actorUserId,
          bookingId: booking.id,
          accepted: false,
          vendorName,
          jobTitle,
          recipientName: String(assignedMember.user?.name || "Team member"),
          recipientEmail: assignedMember.user?.email || null,
          recipientPhone: assignedMember.user?.phone || null,
        }),
      );
    }
  }

  const automaticRelease = input.accepted
    ? await releaseEmployeeServiceOrderWhenReady({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        actorUserId: input.actorUserId,
        baseUrl: baseUrl(input.request),
      })
    : null;
  if (automaticRelease) notifications.push(automaticRelease.results);
  return {
    releasedMembershipIds: automaticRelease?.releasedMembershipIds || [],
    notifications,
  };
}
