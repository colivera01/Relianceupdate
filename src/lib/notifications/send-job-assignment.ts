import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const jobTitle = String(input.jobTitle || "Assigned job").trim();
  const customerName = String(input.customerName || "").trim();
  const scheduledFor = formatScheduledFor(input.scheduledFor);
  const link = input.employeeJobLink;

  if (env.emailEnabled && email) {
    const subject = `New Reliance job assigned: ${jobTitle}`;
    const greeting = employeeName ? `Hi ${employeeName},` : "Hi,";
    const text = [
      greeting,
      "",
      `${vendorName} assigned you a Reliance job.`,
      "",
      `Job: ${jobTitle}`,
      customerName ? `Customer: ${customerName}` : "",
      `Scheduled: ${scheduledFor}`,
      "",
      "Open this on the phone you will use at the job site:",
      link,
      "",
      "What to do next:",
      "- Open the secure job link",
      "- Tap Start Job when work begins",
      "- Capture Starting Condition, Work in Progress, and Final Result clips",
      "- Keep each public stage clip to 30 seconds or less",
      "- Submit the completed package for manager review",
      "",
      "This secure link only opens the Reliance job assigned to you.",
      "",
      "- Reliance Team",
    ]
      .filter(Boolean)
      .join("\n");
    const html = `
      <p>${escapeHtml(greeting)}</p>
      <p><strong>${escapeHtml(vendorName)}</strong> assigned you a Reliance job.</p>
      <ul>
        <li><strong>Job:</strong> ${escapeHtml(jobTitle)}</li>
        ${customerName ? `<li><strong>Customer:</strong> ${escapeHtml(customerName)}</li>` : ""}
        <li><strong>Scheduled:</strong> ${escapeHtml(scheduledFor)}</li>
      </ul>
      <p><a href="${escapeHtml(link)}">Open your assigned job on this phone</a></p>
      <p><strong>What to do next:</strong></p>
      <ol>
        <li>Open the secure job link.</li>
        <li>Tap Start Job when work begins.</li>
        <li>Capture Starting Condition, Work in Progress, and Final Result clips.</li>
        <li>Keep each public stage clip to 30 seconds or less.</li>
        <li>Submit the completed package for manager review.</li>
      </ol>
      <p>This secure link only opens the Reliance job assigned to you.</p>
      <p>- Reliance Team</p>
    `.trim();
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
    const body = `Reliance: New job assigned for ${vendorName} - ${jobTitle}. Open your employee job queue: ${link} Reply STOP to opt out.`;
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
