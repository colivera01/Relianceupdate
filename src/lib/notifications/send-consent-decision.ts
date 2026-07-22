import { prisma } from "@/server/db";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { sendJobAssignmentNotification } from "@/lib/notifications/send-job-assignment";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import { parseAssignmentMetadata, parseCustomerMetadata } from "@/lib/job-assignment";
import { resolveBookingCustomer } from "@/lib/booking-customer";

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
  const subject = `Customer ${decision} service video access: ${input.jobTitle}`;
  const message = input.accepted
    ? `The customer approved service video access for ${input.jobTitle}. The assigned employee can now open the secure service order.`
    : `The customer declined service video access for ${input.jobTitle}. Recording is locked and the service order cannot continue.`;
  const channels = [];
  if (env.emailEnabled && input.recipientEmail) {
    const result = await sendEmail({
      to: input.recipientEmail,
      subject,
      text: `Hi ${input.recipientName || "there"},\n\n${message}\n\nVendor: ${input.vendorName}\n\n- Reliance Team`,
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
    const result = await sendSms({ to: normalizedPhone, body: `Reliance: ${message}` });
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

  const assignment = parseAssignmentMetadata(booking.customerMetadata);
  const members = assignment.assignedMembershipIds.length
    ? await prisma.vendorMembership.findMany({
        where: { id: { in: assignment.assignedMembershipIds }, vendorId: booking.vendorId },
        select: { id: true, user: { select: { name: true, email: true, phone: true } } },
      })
    : [];
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

  const releasedMembershipIds: string[] = [];
  for (const member of members) {
    if (input.accepted) {
      const link = appendEmployeeCaptureToken(
        `${baseUrl(input.request)}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
        createEmployeeCaptureToken({ vendorId: booking.vendorId, bookingId: booking.id, membershipId: member.id })
      );
      const delivery = await sendJobAssignmentNotification({
        bookingId: booking.id,
        actorUserId: input.actorUserId,
        employeeName: member.user?.name || null,
        employeeEmail: member.user?.email || null,
        employeePhone: member.user?.phone || null,
        employeeJobLink: link,
        vendorName,
        jobTitle,
        customerName: customer.name,
        scheduledFor: booking.scheduledFor || booking.date,
      });
      notifications.push(delivery.channels);
      if (delivery.anySuccess) releasedMembershipIds.push(member.id);
    } else {
      notifications.push(
        await sendDecisionNotice({
          actorUserId: input.actorUserId,
          bookingId: booking.id,
          accepted: false,
          vendorName,
          jobTitle,
          recipientName: String(member.user?.name || "Team member"),
          recipientEmail: member.user?.email || null,
          recipientPhone: member.user?.phone || null,
        })
      );
    }
  }

  if (input.accepted && releasedMembershipIds.length > 0) {
    const metadata = parseCustomerMetadata(booking.customerMetadata);
    metadata.vendor_job_service_order_released_membership_ids = Array.from(new Set(releasedMembershipIds));
    metadata.vendor_job_service_order_released_at = new Date().toISOString();
    await prisma.booking.update({ where: { id: booking.id }, data: { customerMetadata: JSON.stringify(metadata) } });
  }
  return { releasedMembershipIds, notifications };
}
