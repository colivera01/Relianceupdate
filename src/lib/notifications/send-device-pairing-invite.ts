import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/sms/twilio";
import { readNotificationEnv } from "@/lib/env/notification-config";

export type DevicePairingInviteInput = {
  vendorName: string;
  inviteeEmail?: string | null;
  inviteePhone?: string | null;
  pairingUrl: string;
  pairingCode: string;
  expiresAtIso: string;
  linkAccessMode?: "public" | "local_only";
};

export type DevicePairingInviteResult = {
  anySuccess: boolean;
  email: {
    attempted: boolean;
    success: boolean;
    errorMessage?: string;
    providerMessageId?: string;
  };
  sms: {
    attempted: boolean;
    success: boolean;
    errorMessage?: string;
    providerMessageId?: string;
    errorCode?: string;
    trialRestriction?: boolean;
  };
  summaryMessage: string | null;
};

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function formatExpiry(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "soon";
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function sendDevicePairingInvite(
  input: DevicePairingInviteInput,
): Promise<DevicePairingInviteResult> {
  const env = readNotificationEnv();
  const email = String(input.inviteeEmail || "").trim();
  const phone = normalizePhone(input.inviteePhone);
  const vendorName = String(input.vendorName || "Reliance vendor").trim();
  const expiresText = formatExpiry(input.expiresAtIso);
  const linkAccessMode = input.linkAccessMode || "public";
  const localOnlyWarning =
    "This Reliance environment is still using a local-only address, so the link will only open on the same machine. Set APP_BASE_URL or enter a phone-reachable pairing URL in the vendor pairing modal before using email or text invites off-device.";

  const emailResult: DevicePairingInviteResult["email"] = {
    attempted: false,
    success: false,
  };
  const smsResult: DevicePairingInviteResult["sms"] = {
    attempted: false,
    success: false,
  };

  if (email) {
    emailResult.attempted = true;
    if (linkAccessMode === "local_only") {
      emailResult.success = false;
      emailResult.errorMessage = "local_only_pairing_link";
    } else {
      const subject = `Pair this phone to ${vendorName} on Reliance`;
      const text = [
        `You have been invited to pair this phone with ${vendorName} on Reliance.`,
        "",
        "Open this message on the phone you want to use for Reliance service videos, then tap the pairing link below:",
        input.pairingUrl,
        "",
        `Backup code: ${input.pairingCode}`,
        `Expires: ${expiresText}`,
        "",
        "If the button does not open, copy and paste the link into your mobile browser.",
        "",
        "- Reliance",
      ].join("\n");
      const html = `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
          <p>You have been invited to pair this phone with <strong>${escapeHtml(vendorName)}</strong> on Reliance.</p>
          <p>Open this message on the phone you want to use for Reliance service videos, then tap the button below.</p>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(input.pairingUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
              Pair This Phone
            </a>
          </p>
          <p><strong>Backup code:</strong> ${escapeHtml(input.pairingCode)}<br/>
          <strong>Expires:</strong> ${escapeHtml(expiresText)}</p>
          <p>If the button does not open, copy and paste this link into your mobile browser:</p>
          <p><a href="${escapeHtml(input.pairingUrl)}">${escapeHtml(input.pairingUrl)}</a></p>
          <p style="color:#6b7280;font-size:14px;">- Reliance</p>
        </div>
      `.trim();
      const sendResult = await sendEmail({ to: email, subject, text, html });
      emailResult.success = sendResult.ok;
      emailResult.errorMessage = sendResult.errorMessage;
      emailResult.providerMessageId = sendResult.providerMessageId;
    }
  }

  if (phone) {
    smsResult.attempted = true;
    if (linkAccessMode === "local_only") {
      smsResult.success = false;
      smsResult.errorMessage = "local_only_pairing_link";
    } else if (!env.smsEnabled) {
      smsResult.success = false;
      smsResult.errorMessage = "sms_disabled";
    } else {
      const body = `${vendorName} via Reliance: pair this phone for service-video work. Link: ${input.pairingUrl} Backup code: ${input.pairingCode} Reply STOP to opt out.`;
      const sendResult = await sendSms({ to: phone, body });
      smsResult.success = sendResult.ok;
      smsResult.errorMessage = sendResult.errorMessage;
      smsResult.providerMessageId = sendResult.providerMessageId;
      smsResult.errorCode = sendResult.errorCode;
      smsResult.trialRestriction = sendResult.trialRestriction;
    }
  }

  const anySuccess = (emailResult.attempted && emailResult.success) || (smsResult.attempted && smsResult.success);
  const summaryMessage = anySuccess
    ? [
        emailResult.success ? `Email sent to ${email}.` : null,
        smsResult.success ? `Text sent to ${phone}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : linkAccessMode === "local_only" && (emailResult.attempted || smsResult.attempted)
      ? localOnlyWarning
    : emailResult.attempted || smsResult.attempted
      ? "Invite send did not complete, but the link and backup code are ready to share manually."
      : null;

  return {
    anySuccess,
    email: emailResult,
    sms: smsResult,
    summaryMessage,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
