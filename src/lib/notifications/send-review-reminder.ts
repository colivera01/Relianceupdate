import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';
import { formatCustomerFacingServiceDate } from '@/lib/notifications/customer-facing-date';

export type ReviewReminderInput = {
  reviewWindowId: string;
  actorUserId: string;
  bookingId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  vendorName?: string | null;
  serviceName?: string | null;
  bookingTitle?: string | null;
  scheduledDate?: Date | string | null;
  serviceTimeZone?: string | null;
};

export type ChannelDelivery = {
  channel: 'email' | 'sms';
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
};

export type ReviewReminderResult = {
  fallbackLink: string;
  absoluteFallbackLink: string;
  channels: ChannelDelivery[];
  anySuccess: boolean;
  /** True when no background job exists; immediate send was attempted instead. */
  synchronousBestEffort: true;
};

function reviewsPath(bookingId: string, rating?: number): string {
  const query = new URLSearchParams({ bookingId: String(bookingId) });
  if (Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5) {
    query.set('rating', String(rating));
  }
  return `/reviews?${query.toString()}`;
}

function buildAbsoluteUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

/**
 * Immediate reminder (scheduler is not wired). Uses email/SMS when enabled and contact exists.
 */
export async function sendReviewReminderNotification(input: ReviewReminderInput): Promise<ReviewReminderResult> {
  const env = readNotificationEnv();
  const path = reviewsPath(input.bookingId);
  const absoluteFallbackLink = buildAbsoluteUrl(env.appBaseUrl, path);
  const inlineRatingLinks = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    url: buildAbsoluteUrl(env.appBaseUrl, reviewsPath(input.bookingId, rating)),
  }));
  const channels: ChannelDelivery[] = [];
  const vendorName = String(input.vendorName || '').trim();
  const hasVendorName = Boolean(vendorName);
  const serviceLabel =
    String(input.serviceName || '').trim() ||
    String(input.bookingTitle || '').trim() ||
    'Recent service';
  const scheduledDateLabel = formatCustomerFacingServiceDate({
    value: input.scheduledDate,
    timeZone: input.serviceTimeZone,
    fallback: 'Recent booking',
  });

  const subject = hasVendorName
    ? `How did ${vendorName} do? Your feedback helps others`
    : 'How was your recent service? Your feedback helps others';
  const html = `
    <p>Hello${input.customerName ? ` ${escapeHtml(String(input.customerName))}` : ''},</p>
    <p>How was your recent service${hasVendorName ? ` with ${escapeHtml(vendorName)}` : ''}?</p>
    <p>Your feedback helps improve service quality and gives others confidence when choosing a provider.</p>
    <p><strong>Service Details:</strong></p>
    <ul>
      <li>Service: ${escapeHtml(serviceLabel)}</li>
      <li>Date: ${escapeHtml(scheduledDateLabel)}</li>
    </ul>
    <p>Your review window is open for a limited time.</p>
    <p>You can review your service proof and leave feedback in one place.</p>
    <p>
      <a href="${escapeHtml(absoluteFallbackLink)}" style="display:inline-block;padding:10px 14px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">
        Leave your feedback now
      </a>
    </p>
    <p>Quickly rate your experience:</p>
    <p style="margin:0 0 6px 0;">
      ${inlineRatingLinks
        .map(
          (item) =>
            `<a href="${escapeHtml(item.url)}" aria-label="Rate ${item.rating} out of 5" style="text-decoration:none;display:inline-block;margin:0 10px 6px 0;">${'⭐'.repeat(item.rating)}</a>`
        )
        .join('')}
    </p>
    <p>If the button does not work, copy and paste this link: <code>${escapeHtml(absoluteFallbackLink)}</code></p>
  `.trim();
  const text = [
    `Hello${input.customerName ? ` ${String(input.customerName).trim()}` : ''},`,
    '',
    `How was your recent service${hasVendorName ? ` with ${vendorName}` : ''}?`,
    'Your feedback helps improve service quality and gives others confidence when choosing a provider.',
    '',
    'Service Details:',
    `- Service: ${serviceLabel}`,
    `- Date: ${scheduledDateLabel}`,
    '',
    'Your review window is open for a limited time.',
    'You can review your service proof and leave feedback in one place.',
    '',
    `Leave your feedback now: ${absoluteFallbackLink}`,
    '',
    'Quickly rate your experience:',
    ...inlineRatingLinks.map((item) => `${item.rating} star${item.rating > 1 ? 's' : ''}: ${'⭐'.repeat(item.rating)} ${item.url}`),
    '',
    `If the button does not work, copy and paste this link: ${absoluteFallbackLink}`,
  ].join('\n');

  const email = (input.customerEmail || '').trim();
  if (env.emailEnabled && email) {
    const r = await sendEmail({ to: email, subject, html, text });
    channels.push({
      channel: 'email',
      attempted: true,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      errorMessage: r.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.reviewWindowId, {
      kind: 'review_reminder',
      channel: 'email',
      recipient: email,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      fallbackLink: absoluteFallbackLink,
      errorMessage: r.errorMessage,
    });
  } else {
    channels.push({
      channel: 'email',
      attempted: false,
      success: false,
      errorMessage: !email ? 'no_customer_email' : 'email_disabled',
    });
  }

  const phone = normalizeE164ish(input.customerPhone);
  if (env.smsEnabled && phone) {
    const body = `Reliance: review reminder ${absoluteFallbackLink}`;
    const r = await sendSms({ to: phone, body });
    channels.push({
      channel: 'sms',
      attempted: true,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
    });
    await logNotificationAttempt(input.actorUserId, input.reviewWindowId, {
      kind: 'review_reminder',
      channel: 'sms',
      recipient: phone,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      fallbackLink: absoluteFallbackLink,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
    });
  } else {
    channels.push({
      channel: 'sms',
      attempted: false,
      success: false,
      errorMessage: !phone ? 'no_customer_phone' : 'sms_disabled',
    });
  }

  return {
    fallbackLink: path,
    absoluteFallbackLink,
    channels,
    anySuccess: channels.some((c) => c.attempted && c.success),
    synchronousBestEffort: true,
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
