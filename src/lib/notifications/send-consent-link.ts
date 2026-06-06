import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';
import { formatCustomerFacingServiceDate } from '@/lib/notifications/customer-facing-date';
import { resolveCustomerFacingServiceLabel } from '@/lib/notifications/customer-facing-service-label';

export type ConsentLinkDeliveryInput = {
  consentRecordId: string;
  actorUserId: string;
  token: string;
  /** Plain path e.g. /consent/abc */
  consentPath: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  vendorName?: string | null;
  serviceName?: string | null;
  bookingTitle?: string | null;
  serviceDate?: Date | string | null;
  serviceTimeZone?: string | null;
  consentTypeLabel?: string;
  absoluteBaseUrl?: string | null;
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

function formatConsentRequestLabel(value: string | null | undefined): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  if (!normalized || normalized === 'requested consent') return 'service video approval';
  if (normalized === 'video access') return 'service video approval';
  return normalized;
}

/**
 * Sends consent link via enabled channels. Always returns a manual fallback link.
 */
export async function sendConsentLinkNotification(input: ConsentLinkDeliveryInput): Promise<ConsentLinkDeliveryResult> {
  const env = readNotificationEnv();
  const absoluteFallbackLink = buildAbsoluteUrl(
    String(input.absoluteBaseUrl || '').trim() || env.appBaseUrl,
    input.consentPath
  );
  const channels: ChannelDelivery[] = [];

  const vendorName = String(input.vendorName || '').trim() || 'Your provider';
  const serviceName = resolveCustomerFacingServiceLabel({
    serviceName: input.serviceName,
    bookingTitle: input.bookingTitle,
    vendorName: input.vendorName,
    fallback: 'your service visit',
  });
  const serviceDate = formatCustomerFacingServiceDate({
    value: input.serviceDate,
    timeZone: input.serviceTimeZone,
    fallback: '',
  });
  const subject = `Review your service video request from ${vendorName}`;
  const label = formatConsentRequestLabel(input.consentTypeLabel || 'requested consent');
  const greetingName = input.customerName ? ` ${escapeHtml(input.customerName)}` : '';
  const serviceDateLine = serviceDate ? `<p><strong>Service date:</strong> ${escapeHtml(serviceDate)}</p>` : '';
  const html = `
    <p>Hello${greetingName},</p>
    <p><strong>${escapeHtml(vendorName)}</strong> is asking for your permission to record and share service videos for this appointment through Reliance.</p>
    <p><strong>Service:</strong> ${escapeHtml(serviceName)}</p>
    ${serviceDateLine}
    <p>If you approve, the provider can continue the Reliance service-video workflow and you will be able to review the videos afterward.</p>
    <p><strong>Request type:</strong> ${escapeHtml(label)}.</p>
    <p><a href="${escapeHtml(absoluteFallbackLink)}">Review video consent request</a></p>
    <p>If the link above does not work, copy and paste this URL into your browser:<br/><code>${escapeHtml(absoluteFallbackLink)}</code></p>
    <p>If you did not expect this request, you can ignore this message.</p>
    <p>- ${escapeHtml(vendorName)} via Reliance</p>
  `.trim();
  const text = [
    `Hello${input.customerName ? ` ${input.customerName}` : ''},`,
    '',
    `${vendorName} is asking for your permission to record and share service videos for this appointment through Reliance.`,
    `Service: ${serviceName}`,
    ...(serviceDate ? [`Service date: ${serviceDate}`] : []),
    'If you approve, the provider can continue the Reliance service-video workflow and you will be able to review the videos afterward.',
    `Request type: ${label}.`,
    '',
    `Review video consent request: ${absoluteFallbackLink}`,
    '',
    'If you did not expect this request, you can ignore this message.',
    `- ${vendorName} via Reliance`,
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
    const body = `Reliance: ${vendorName} sent a service video consent request. Review it here: ${absoluteFallbackLink}`;
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
