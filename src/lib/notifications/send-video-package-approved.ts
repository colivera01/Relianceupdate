import { readNotificationEnv } from "@/lib/env/notification-config";
import { sendEmail } from "@/lib/email/resend";
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from "@/lib/email/reliance-template";
import { logNotificationAttempt } from "@/lib/notifications/notification-audit";
import { sendSms } from "@/lib/sms/twilio";

export type VideoPackageApprovedNotificationInput = {
  bookingId: string;
  actorUserId: string;
  managerName?: string | null;
  managerEmail?: string | null;
  managerPhone?: string | null;
  managerReviewLink: string;
  vendorName: string;
  jobTitle: string;
  customerName?: string | null;
  visibilityLabel?: string | null;
};

export type VideoPackageApprovedNotificationResult = {
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

export async function sendVideoPackageApprovedNotification(
  input: VideoPackageApprovedNotificationInput
): Promise<VideoPackageApprovedNotificationResult> {
  const env = readNotificationEnv();
  const channels: VideoPackageApprovedNotificationResult["channels"] = [];
  const managerName = String(input.managerName || "").trim();
  const email = String(input.managerEmail || "").trim();
  const phone = normalizeE164ish(input.managerPhone);
  const vendorName = String(input.vendorName || "Reliance Vendor").trim();
  const jobTitle = String(input.jobTitle || "Service order").trim();
  const customerName = String(input.customerName || "").trim();
  const visibilityLabel = String(input.visibilityLabel || "customer-visible").trim();
  const link = input.managerReviewLink;
  const greeting = managerName ? `Hi ${managerName},` : "Hi,";

  if (env.emailEnabled && email) {
    const subject = `Reliance approved service video package: ${jobTitle}`;
    const text = [
      greeting,
      "",
      `Reliance admin approved the service video package for ${vendorName}.`,
      "",
      `Service order: ${jobTitle}`,
      customerName ? `Customer: ${customerName}` : "",
      `Visibility: ${visibilityLabel}`,
      "",
      "Open the service order in Reliance:",
      link,
      "",
      "- Reliance Team",
    ]
      .filter(Boolean)
      .join("\n");
    const html = buildRelianceEmailHtml({
      eyebrow: "Video package approved",
      headline: jobTitle,
      greeting,
      bodyHtml: `<p style="margin:0 0 18px;">Reliance admin approved the service-video package for <strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong>.</p>`,
      details: [
        { label: "Service order", value: jobTitle },
        ...(customerName ? [{ label: "Customer", value: customerName }] : []),
        { label: "Visibility", value: visibilityLabel },
      ],
      cta: { label: "Open Service Order", href: link },
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
      kind: "manager_video_package_approved",
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
    const body = `Reliance: Admin approved the service video package for ${jobTitle}. Visibility: ${visibilityLabel}. Open order: ${link} Reply STOP to opt out.`;
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
      kind: "manager_video_package_approved",
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
