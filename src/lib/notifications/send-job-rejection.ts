import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { sendSms } from "@/lib/sms/twilio";

export type JobRejectionNotificationInput = {
  bookingId: string;
  actorUserId: string;
  employeeName?: string | null;
  employeeEmail?: string | null;
  employeePhone?: string | null;
  employeeJobLink: string;
  vendorName: string;
  jobTitle: string;
  rejectionReason: string;
};

export type JobRejectionNotificationResult = {
  anySuccess: boolean;
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

export async function sendJobRejectionNotification(
  input: JobRejectionNotificationInput
): Promise<JobRejectionNotificationResult> {
  const env = readNotificationEnv();
  const channels: JobRejectionNotificationResult["channels"] = [];
  const employeeName = String(input.employeeName || "").trim();
  const email = String(input.employeeEmail || "").trim();
  const phone = normalizeE164ish(input.employeePhone);
  const vendorName = String(input.vendorName || "Reliance Vendor").trim();
  const jobTitle = String(input.jobTitle || "Assigned job").trim();
  const rejectionReason = String(input.rejectionReason || "").trim();
  const link = input.employeeJobLink;
  const greeting = employeeName ? `Hi ${employeeName},` : "Hi,";

  if (env.emailEnabled && email) {
    const subject = `Reliance video changes requested: ${jobTitle}`;
    const text = [
      greeting,
      "",
      `${vendorName} requested changes to your submitted service video package.`,
      "",
      `Job: ${jobTitle}`,
      `Reason: ${rejectionReason}`,
      "",
      "Open your service order link, replace the video stage that needs correction, and submit the package again:",
      link,
      "",
      "This secure link only opens the Reliance service order assigned to you.",
      "",
      "- Reliance Team",
    ].join("\n");
    const html = buildRelianceEmailHtml({
      eyebrow: "Video changes requested",
      headline: jobTitle,
      greeting,
      bodyHtml: `<p style="margin:0 0 18px;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong> requested changes to your submitted service video package.</p>`,
      details: [
        { label: "Assigned service", value: jobTitle },
        { label: "Reason", value: rejectionReason },
      ],
      cta: { label: "Open Service Order", href: link },
      secondaryHtml: `
        <p style="margin:0 0 10px;color:#ffffff;font-size:15px;font-weight:800;">What to do next:</p>
        <ol style="margin:0 0 18px 20px;padding:0;">
          <li>Open the secure service order link.</li>
          <li>Replace the stage video that needs correction.</li>
          <li>Submit the package again for manager review.</li>
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
      kind: "employee_job_rejection",
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
    const body = `Reliance: ${vendorName} requested changes for ${jobTitle}. Reason: ${rejectionReason}. Open your service order link to replace the needed video stage and resubmit: ${link} Reply STOP to opt out.`;
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
      kind: "employee_job_rejection",
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
    phoneNumberUsed: phone,
    channels,
  };
}
