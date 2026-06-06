import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';

export type ReviewExpiredInput = {
  reviewWindowId: string;
  actorUserId: string;
  bookingId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
};

export type ChannelDelivery = {
  channel: 'email' | 'sms';
  attempted: boolean;
  success: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
};

export type ReviewExpiredResult = {
  fallbackLink: string;
  absoluteFallbackLink: string;
  channels: ChannelDelivery[];
  anySuccess: boolean;
};

function reviewsPath(bookingId: string): string {
  return `/my-bookings`;
}

function buildAbsoluteUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

/**
 * Notifies customer that the review window closed without a submission (informational).
 */
export async function sendReviewExpiredNotification(input: ReviewExpiredInput): Promise<ReviewExpiredResult> {
  const env = readNotificationEnv();
  const path = reviewsPath(input.bookingId);
  const absoluteFallbackLink = buildAbsoluteUrl(env.appBaseUrl, path);
  const channels: ChannelDelivery[] = [];

  const subject = 'Your feedback window has closed';
  const html = `
    <p>Hello${input.customerName ? ` ${escapeHtml(String(input.customerName))}` : ''},</p>
    <p>Your feedback window for this service has ended without a submitted review.</p>
    <p>If you still need help, open My Services in Reliance or contact support from the app.</p>
    <p><a href="${escapeHtml(absoluteFallbackLink)}">Open My Services</a></p>
  `.trim();
  const text = `Reliance: your feedback window has closed. Open My Services: ${absoluteFallbackLink}`;

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
      kind: 'review_expired',
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
    const body = `Reliance: your feedback window has closed. Open My Services: ${absoluteFallbackLink}`;
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
      kind: 'review_expired',
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
