import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { sendSms } from "@/lib/sms/twilio";

export type JobCorrectionReadyNotificationInput = {
  bookingId: string;
  actorUserId: string;
  managerName?: string | null;
  managerEmail?: string | null;
  managerPhone?: string | null;
  managerReviewLink: string;
  vendorName: string;
  jobTitle: string;
  employeeName?: string | null;
};

export type JobCorrectionReadyNotificationResult = {
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

export async function sendJobCorrectionReadyNotification(
  input: JobCorrectionReadyNotificationInput
): Promise<JobCorrectionReadyNotificationResult> {
  const env = readNotificationEnv();
  const channels: JobCorrectionReadyNotificationResult["channels"] = [];
  const managerName = String(input.managerName || "").trim();
  const email = String(input.managerEmail || "").trim();
  const phone = normalizeE164ish(input.managerPhone);
  const vendorName = String(input.vendorName || "Reliance Vendor").trim();
  const jobTitle = String(input.jobTitle || "Service order").trim();
  const employeeName = String(input.employeeName || "The assigned employee").trim();
  const link = input.managerReviewLink;
  const greeting = managerName ? `Hi ${managerName},` : "Hi,";

  if (env.emailEnabled && email) {
    const subject = `Reliance corrected video ready: ${jobTitle}`;
    const text = [
      greeting,
      "",
      `${employeeName} submitted corrected service videos for ${vendorName}.`,
      "",
      `Job: ${jobTitle}`,
      "",
      "Open the review package to approve completion or request another change:",
      link,
      "",
      "- Reliance Team",
    ].join("\n");
    const html = buildRelianceEmailHtml({
      eyebrow: "Corrected package ready",
      headline: jobTitle,
      greeting,
      bodyHtml: `<p style="margin:0 0 18px;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(employeeName)}</strong> submitted corrected service videos for <strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong>.</p>`,
      details: [{ label: "Service order", value: jobTitle }],
      cta: { label: "Review Corrected Package", href: link },
      secondaryHtml: `<p style="margin:0;">Open the package to approve completion or request another change.</p>`,
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
      kind: "manager_job_correction_ready",
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
      errorMessage: !email ? "no_manager_email" : "email_disabled",
    });
  }

  if (env.smsEnabled && phone) {
    const body = `Reliance: Corrected service videos are ready for ${jobTitle}. Review package: ${link} Reply STOP to opt out.`;
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
      kind: "manager_job_correction_ready",
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
      errorMessage: !phone ? "no_manager_phone" : "sms_disabled",
    });
  }

  return {
    anySuccess: channels.some((channel) => channel.attempted && channel.success),
    phoneNumberUsed: phone,
    channels,
  };
}
