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

  const subject = `Action required: Review your Reliance consent request`;
  const label = input.consentTypeLabel || 'requested consent';
  const greetingName = input.customerName ? ` ${escapeHtml(input.customerName)}` : '';
  const html = `
    <p>Hello${greetingName},</p>
    <p>You are receiving this message because your service provider requested consent through <strong>Reliance</strong>, our secure platform for service video access and compliance.</p>
    <p><strong>Why this request was sent:</strong> your provider needs your permission to continue the service video workflow (${escapeHtml(label)}).</p>
    <p>This consent applies to all service-related recordings (before, during, and after your service) and only needs to be completed once.</p>
    <p>This request is part of your active service and is required before your provider can proceed with video documentation.</p>
    <p><strong>What happens after you accept:</strong> your consent status is updated immediately so the provider can proceed, and your response is logged for compliance.</p>
    <p><a href="${escapeHtml(absoluteFallbackLink)}">Review and respond to consent request</a></p>
    <p>If the link above does not work, copy and paste this URL into your browser:<br/><code>${escapeHtml(absoluteFallbackLink)}</code></p>
    <p>If you did not expect this request, you can ignore this message.</p>
    <p>— Reliance Secure Service Video Platform</p>
  `.trim();
  const text = [
    `Hello${input.customerName ? ` ${input.customerName}` : ''},`,
    '',
    'You are receiving this message because your service provider requested consent through Reliance, our secure platform for service video access and compliance.',
    `Why this request was sent: your provider needs your permission to continue the service video workflow (${label}).`,
    'This consent applies to all service-related recordings (before, during, and after your service) and only needs to be completed once.',
    'This request is part of your active service and is required before your provider can proceed with video documentation.',
    'What happens after you accept: your consent status updates immediately so the provider can proceed, and your response is logged for compliance.',
    '',
    `Review and respond: ${absoluteFallbackLink}`,
    '',
    'If you did not expect this request, you can ignore this message.',
    '— Reliance Secure Service Video Platform',
  ].join('\n');

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
