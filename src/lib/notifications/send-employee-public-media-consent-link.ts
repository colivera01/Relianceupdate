import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { sendEmail } from "@/lib/email/resend";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { sendSms } from "@/lib/sms/twilio";

export type EmployeePublicMediaConsentLinkNotificationInput = {
  membershipId: string;
  actorUserId: string;
  employeeName?: string | null;
  employeeEmail?: string | null;
  employeePhone?: string | null;
  vendorName: string;
  participationLink: string;
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

export async function sendEmployeePublicMediaConsentLinkNotification(
  input: EmployeePublicMediaConsentLinkNotificationInput,
) {
  const env = readNotificationEnv();
  const channels: Array<{
    channel: "email" | "sms";
    attempted: boolean;
    success: boolean;
    providerMessageId?: string;
    errorMessage?: string;
    errorCode?: string;
    trialRestriction?: boolean;
  }> = [];
  const name = String(input.employeeName || "").trim();
  const email = String(input.employeeEmail || "").trim();
  const phone = normalizeE164ish(input.employeePhone);
  const vendorName = String(input.vendorName || "Reliance business").trim();
  const greeting = name ? `Hi ${name},` : "Hi,";

  if (env.emailEnabled && email) {
    const subject = `Manage Public Service Video participation for ${vendorName}`;
    const text = [
      greeting,
      "",
      `${vendorName} sent you a secure Reliance link to manage your standing Public Service Video participation choice.`,
      "",
      "Only you can choose Allow or Do Not Allow. The business cannot choose for you.",
      "Your choice covers your image, likeness, voice, and audio for eligible Service Videos. Customers still decide whether each Service Video is shared publicly.",
      "",
      "Open your secure participation link:",
      input.participationLink,
      "",
      "This link expires in one hour. If it expires, ask the business to send a fresh link.",
      "",
      "- Reliance Team",
    ].join("\n");
    const html = buildRelianceEmailHtml({
      eyebrow: "Employee privacy choice",
      headline: "Public Service Video Participation",
      greeting,
      bodyHtml: `<p><strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong> sent you a secure link to manage your standing participation choice.</p><p>Only you can choose Allow or Do Not Allow. The business cannot choose for you.</p>`,
      cta: { label: "Manage My Participation", href: input.participationLink },
      secondaryHtml: "<p>Your choice covers your image, likeness, voice, and audio for eligible Service Videos. Customers still decide whether each Service Video is shared publicly.</p><p>This link expires in one hour. If it expires, ask the business to send a fresh link.</p>",
      fallbackHref: input.participationLink,
    });
    const result = await sendEmail({ to: email, subject, text, html });
    channels.push({
      channel: "email",
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.membershipId, {
      kind: "employee_public_media_consent_link",
      channel: "email",
      recipient: email,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: input.participationLink,
      errorMessage: result.errorMessage,
    });
  } else {
    channels.push({
      channel: "email",
      attempted: false,
      success: false,
      errorMessage: email ? "email_disabled" : "no_employee_email",
    });
  }

  if (env.smsEnabled && phone) {
    const body = `Reliance: Manage your Public Service Video participation for ${vendorName}. Only you can choose. Secure link (expires in 1 hour): ${input.participationLink} Reply STOP to opt out.`;
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
    await logNotificationAttempt(input.actorUserId, input.membershipId, {
      kind: "employee_public_media_consent_link",
      channel: "sms",
      recipient: phone,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: input.participationLink,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
    });
  } else {
    channels.push({
      channel: "sms",
      attempted: false,
      success: false,
      errorMessage: phone ? "sms_disabled" : "no_employee_phone",
    });
  }

  return {
    anySuccess: channels.some((channel) => channel.attempted && channel.success),
    channels,
  };
}
