import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';
import { formatCustomerFacingServiceDate } from '@/lib/notifications/customer-facing-date';
import { resolveCustomerFacingServiceLabel } from '@/lib/notifications/customer-facing-service-label';
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from '@/lib/email/reliance-template';
import { isSimplifiedV1PermissionVersion } from '@/lib/consent/content-version';

export type ConsentLinkDeliveryInput = {
  consentRecordId: string;
  actorUserId: string;
  /** Ephemeral action path. It must never be persisted or returned by an API. */
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
  contentVersion?: string | null;
  audioEnabled?: boolean | null;
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
  const subject = `Recording permission request from ${vendorName}`;
  const label = formatConsentRequestLabel(input.consentTypeLabel || 'recording permission');
  const simplifiedV1 = isSimplifiedV1PermissionVersion(input.contentVersion);
  const audioEnabled =
    typeof input.audioEnabled === 'boolean'
      ? input.audioEnabled
      : String(input.contentVersion || '').trim() === 'recording-permission-v3-video-audio';
  const audioEmailCopy = audioEnabled
    ? 'This Service Video will include video and audio because sound is part of documenting the service.'
    : 'Audio will not be recorded.';
  const audioSmsCopy = audioEnabled
    ? 'Video and audio are included.'
    : 'Audio will not be recorded.';
  const decisionCopy = simplifiedV1
    ? 'You may allow recording, decline recording, or report that this request was sent to the wrong person. If you take no action, recording remains blocked.'
    : 'You may allow, decline, or decide later. The service may continue without Reliance recording.';
  const html = buildRelianceEmailHtml({
    eyebrow: 'Recording permission request',
    headline: 'Choose whether Reliance may record this service',
    greeting: `Hello${input.customerName ? ` ${input.customerName}` : ''},`,
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong> is asking for permission to create one Service Video work record with three stages: Starting Condition, Work in Progress, and Final Result.</p>
      <p style="margin:0 0 14px;">${escapeRelianceEmailHtml(audioEmailCopy)} The Service Video starts Private. Public sharing would require a separate later customer decision.</p>
      <p style="margin:0;">${escapeRelianceEmailHtml(decisionCopy)}</p>
    `,
    details: [
      { label: 'Service', value: serviceName },
      ...(serviceDate ? [{ label: 'Service date', value: serviceDate }] : []),
      { label: 'Request type', value: label },
    ],
    cta: { label: 'Review Recording Request', href: absoluteFallbackLink },
    fallbackHref: absoluteFallbackLink,
    footerNote: 'If this request is not for you, use the secure link to report the wrong recipient.',
  });
  const text = [
    `Hello${input.customerName ? ` ${input.customerName}` : ''},`,
    '',
    `${vendorName} is asking for permission to create one Service Video work record with three stages: Starting Condition, Work in Progress, and Final Result.`,
    `Service: ${serviceName}`,
    ...(serviceDate ? [`Service date: ${serviceDate}`] : []),
    `${audioEmailCopy} The Service Video starts Private. Public sharing requires a separate later customer decision.`,
    decisionCopy,
    `Request type: ${label}.`,
    '',
    `Review recording request: ${absoluteFallbackLink}`,
    '',
    'If this request is not for you, use the link to report the wrong recipient.',
    '- Reliance Team',
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
    const smsActions = simplifiedV1
      ? "Allow recording, decline recording, or report wrong recipient"
      : "Allow, decline, or decide later";
    const body = `Reliance: ${vendorName} requests permission for one three-stage Service Video for ${serviceName}. ${audioSmsCopy} It starts Private. ${smsActions}: ${absoluteFallbackLink} Reply STOP to opt out.`;
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
