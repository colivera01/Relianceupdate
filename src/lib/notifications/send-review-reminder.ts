import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';

export type ReviewReminderInput = {
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

export type ReviewReminderResult = {
  fallbackLink: string;
  absoluteFallbackLink: string;
  channels: ChannelDelivery[];
  anySuccess: boolean;
  /** True when no background job exists; immediate send was attempted instead. */
  synchronousBestEffort: true;
};

function reviewsPath(bookingId: string): string {
  return `/reviews?bookingId=${encodeURIComponent(bookingId)}`;
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
  const channels: ChannelDelivery[] = [];

  const subject = 'Reminder: share feedback on your Reliance visit';
  const html = `
    <p>Hello${input.customerName ? ` ${escapeHtml(String(input.customerName))}` : ''},</p>
    <p>Your review window is open. When you have a moment, please leave feedback.</p>
    <p><a href="${escapeHtml(absoluteFallbackLink)}">Open reviews</a></p>
    <p>Link: <code>${escapeHtml(absoluteFallbackLink)}</code></p>
  `.trim();
  const text = `Reliance review reminder: ${absoluteFallbackLink}`;

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
