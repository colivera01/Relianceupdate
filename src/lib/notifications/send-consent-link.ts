import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';

export type ConsentLinkDeliveryInput = {
  consentRecordId: string;
  actorUserId: string;
  token: string;
  /** Plain path e.g. /consent/abc */
  consentPath: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  consentTypeLabel?: string;
};

export type ChannelDelivery = {
  channel: 'email' | 'sms';
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
};

export type ConsentLinkDeliveryResult = {
  fallbackLink: string;
  absoluteFallbackLink: string;
  channels: ChannelDelivery[];
  anySuccess: boolean;
};

function buildAbsoluteUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

/**
 * Sends consent link via enabled channels. Always returns a manual fallback link.
 */
export async function sendConsentLinkNotification(input: ConsentLinkDeliveryInput): Promise<ConsentLinkDeliveryResult> {
  const env = readNotificationEnv();
  const absoluteFallbackLink = buildAbsoluteUrl(env.appBaseUrl, input.consentPath);
  const channels: ChannelDelivery[] = [];

  const subject = `Action needed: consent for your Reliance booking`;
  const label = input.consentTypeLabel || 'requested consent';
  const html = `
    <p>Hello${input.customerName ? ` ${escapeHtml(input.customerName)}` : ''},</p>
    <p>Please review and respond to ${escapeHtml(label)}.</p>
    <p><a href="${escapeHtml(absoluteFallbackLink)}">Open consent page</a></p>
    <p>If the button does not work, copy this link:<br/><code>${escapeHtml(absoluteFallbackLink)}</code></p>
  `.trim();
  const text = `Please complete ${label}: ${absoluteFallbackLink}`;

  const email = (input.customerEmail || '').trim();
  if (env.emailEnabled && email) {
    const r = await sendEmail({
      to: email,
      subject,
      html,
      text,
    });
    channels.push({
      channel: 'email',
      attempted: true,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      errorMessage: r.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.consentRecordId, {
      kind: 'consent_link',
      channel: 'email',
      recipient: email,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      fallbackLink: absoluteFallbackLink,
      errorMessage: r.errorMessage,
    });
  } else {
    const skipReason = !email ? 'no_customer_email' : 'email_disabled';
    channels.push({
      channel: 'email',
      attempted: false,
      success: false,
      errorMessage: skipReason,
    });
    await logNotificationAttempt(input.actorUserId, input.consentRecordId, {
      kind: 'consent_link',
      channel: 'email',
      recipient: email || 'not_provided',
      success: false,
      fallbackLink: absoluteFallbackLink,
      errorMessage: skipReason,
    });
  }

  const phone = normalizeE164ish(input.customerPhone);
  if (env.smsEnabled && phone) {
    const body = `Reliance: please complete ${label}: ${absoluteFallbackLink}`;
    const r = await sendSms({ to: phone, body });
    channels.push({
      channel: 'sms',
      attempted: true,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
    });
    await logNotificationAttempt(input.actorUserId, input.consentRecordId, {
      kind: 'consent_link',
      channel: 'sms',
      recipient: phone,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      fallbackLink: absoluteFallbackLink,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
    });
  } else {
    const skipReason = !phone ? 'no_customer_phone' : 'sms_disabled';
    channels.push({
      channel: 'sms',
      attempted: false,
      success: false,
      errorMessage: skipReason,
    });
    await logNotificationAttempt(input.actorUserId, input.consentRecordId, {
      kind: 'consent_link',
      channel: 'sms',
      recipient: phone || 'not_provided',
      success: false,
      fallbackLink: absoluteFallbackLink,
      errorMessage: skipReason,
    });
  }

  const anySuccess = channels.some((c) => c.attempted && c.success);
  return {
    fallbackLink: input.consentPath,
    absoluteFallbackLink,
    channels,
    anySuccess,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeE164ish(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const t = phone.trim();
  if (!t) return null;
  if (t.startsWith('+')) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith('1')) return `+${digits}`;
  return t.startsWith('+') ? t : `+${digits}`;
}
