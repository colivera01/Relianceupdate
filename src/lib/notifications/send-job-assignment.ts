import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";

export type JobAssignmentNotificationInput = {
  bookingId: string;
  actorUserId: string;
  employeeName?: string | null;
  employeeEmail?: string | null;
  employeePhone?: string | null;
  employeeJobLink: string;
  vendorName: string;
  jobTitle: string;
  customerName?: string | null;
  scheduledFor?: string | Date | null;
};

export type JobAssignmentNotificationResult = {
  anySuccess: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  phoneNumberUsed: string | null;
  channels: Array<{
    channel: "email" | "sms";
    attempted: boolean;
    success: boolean;
    providerMessageId?: string;
    errorMessage?: string;
    errorCode?: string;
    trialRestriction?: boolean;
  }>;
};

function normalizeE164ish(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : null;
}

function formatScheduledFor(value: string | Date | null | undefined): string {
  if (!value) return "Date/time not set yet";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date/time not set yet";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeServiceOrderTitle(jobTitle: string, customerName: string): string {
  const title = String(jobTitle || "Assigned service").trim();
  const customer = String(customerName || "").trim();
  if (customer && title.toLowerCase().startsWith(`${customer.toLowerCase()} - `)) {
    return title.slice(customer.length + 3).trim() || title;
  }
  return title;
}

export async function sendJobAssignmentNotification(
  input: JobAssignmentNotificationInput
): Promise<JobAssignmentNotificationResult> {
  const env = readNotificationEnv();
  const channels: JobAssignmentNotificationResult["channels"] = [];
  const employeeName = String(input.employeeName || "").trim();
  const email = String(input.employeeEmail || "").trim();
  const phone = normalizeE164ish(input.employeePhone);
  const vendorName = String(input.vendorName || "Reliance Vendor").trim();
  const customerName = String(input.customerName || "").trim();
  const serviceOrderTitle = normalizeServiceOrderTitle(input.jobTitle || "", customerName);
  const scheduledFor = formatScheduledFor(input.scheduledFor);
  const link = input.employeeJobLink;

  if (env.emailEnabled && email) {
    const subject = `Reliance service order link: ${serviceOrderTitle}`;
    const greeting = employeeName ? `Hi ${employeeName},` : "Hi,";
    const text = [
      greeting,
      "",
      `${vendorName} assigned you a service order.`,
      "",
      `Job: ${serviceOrderTitle}`,
      customerName ? `Customer: ${customerName}` : "",
      `Scheduled: ${scheduledFor}`,
      "",
      "Open this service order link on the phone you will use at the job site:",
      link,
      "",
      "What to do next:",
      "- Open the secure service order link",
      "- Tap Start Job when work begins",
      "- Capture Starting Condition, Work in Progress, and Final Result clips",
      "- Keep each public stage clip to 30 seconds or less",
      "- Submit the completed package for manager review",
      "",
      "This secure link only opens the Reliance service order assigned to you.",
      "",
      "- Reliance Team",
    ]
      .filter(Boolean)
      .join("\n");
    const html = buildRelianceEmailHtml({
      eyebrow: "Service order link",
      headline: serviceOrderTitle,
      greeting,
      bodyHtml: `<p style="margin:0 0 18px;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong> assigned you a service order.</p>`,
      details: [
        { label: "Assigned service", value: serviceOrderTitle },
        ...(customerName ? [{ label: "Customer", value: customerName }] : []),
        { label: "Scheduled", value: scheduledFor },
      ],
      cta: { label: "Open Service Order", href: link },
      secondaryHtml: `
        <p style="margin:0 0 10px;color:#ffffff;font-size:15px;font-weight:800;">What to do next:</p>
        <ol style="margin:0 0 18px 20px;padding:0;">
          <li>Open the secure service order link.</li>
          <li>Tap Start Job when work begins.</li>
          <li>Capture Starting Condition, Work in Progress, and Final Result clips.</li>
          <li>Keep each public stage clip to 30 seconds or less.</li>
          <li>Submit the completed package for manager review.</li>
        </ol>
        <p style="margin:0;">This secure link only opens the Reliance service order assigned to you.</p>
      `,
      fallbackHref: link,
    });
    const result = await sendEmail({ to: email, subject, text, html });
    channels.push({
      channel: "email",
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: "employee_job_assignment",
      channel: "email",
      recipient: email,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: link,
      errorMessage: result.errorMessage,
    });
  } else {
    channels.push({
      channel: "email",
      attempted: false,
      success: false,
      errorMessage: !email ? "no_employee_email" : "email_disabled",
    });
  }

  if (env.smsEnabled && phone) {
    const body = `Reliance: Service order assigned for ${vendorName} - ${serviceOrderTitle}. Open your service order link: ${link} Reply STOP to opt out.`;
    const result = await sendSms({ to: phone, body });
    channels.push({
      channel: "sms",
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
      trialRestriction: result.trialRestriction,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: "employee_job_assignment",
      channel: "sms",
      recipient: phone,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: link,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
    });
  } else {
    channels.push({
      channel: "sms",
      attempted: false,
      success: false,
      errorMessage: !phone ? "no_employee_phone" : "sms_disabled",
    });
  }

  return {
    anySuccess: channels.some((channel) => channel.attempted && channel.success),
    smsEnabled: env.smsEnabled,
    emailEnabled: env.emailEnabled,
    phoneNumberUsed: phone,
    channels,
  };
}
