import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';
import { formatCustomerFacingServiceDate } from '@/lib/notifications/customer-facing-date';
import { resolveCustomerFacingServiceLabel } from '@/lib/notifications/customer-facing-service-label';
import { buildRelianceEmailHtml, escapeRelianceEmailHtml } from '@/lib/email/reliance-template';
import { createReviewEmailToken } from '@/lib/review-email-token';

export type ReviewInvitationInput = {
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

export type ReviewInvitationResult = {
  fallbackLink: string;
  absoluteFallbackLink: string;
  channels: ChannelDelivery[];
  anySuccess: boolean;
  synchronousBestEffort: true;
};

function reviewsPath(bookingId: string, rating?: number): string {
  const safeBookingId = encodeURIComponent(String(bookingId));
  const query = new URLSearchParams({ returnTo: '/reviews' });
  if (Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5) {
    query.set('rating', String(rating));
  }
  return `/my-bookings/${safeBookingId}?${query.toString()}`;
}

function buildAbsoluteUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function quickReviewPath(reviewWindowId: string, rating: number): string {
  const token = createReviewEmailToken({ reviewWindowId });
  return `/reviews/quick?${new URLSearchParams({ token, rating: String(rating) }).toString()}`;
}

export async function sendReviewInvitationNotification(
  input: ReviewInvitationInput
): Promise<ReviewInvitationResult> {
  const env = readNotificationEnv();
  const path = reviewsPath(input.bookingId);
  const absoluteFallbackLink = buildAbsoluteUrl(env.appBaseUrl, path);
  const inlineRatingLinks = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    url: buildAbsoluteUrl(env.appBaseUrl, quickReviewPath(input.reviewWindowId, rating)),
  }));
  const channels: ChannelDelivery[] = [];
  const vendorName = String(input.vendorName || '').trim();
  const hasVendorName = Boolean(vendorName);
  const serviceLabel = resolveCustomerFacingServiceLabel({
    serviceName: input.serviceName,
    bookingTitle: input.bookingTitle,
    vendorName: input.vendorName,
    fallback: 'Recent service visit',
  });
  const scheduledDateLabel = formatCustomerFacingServiceDate({
    value: input.scheduledDate,
    timeZone: input.serviceTimeZone,
    fallback: 'Recent booking',
  });
  const subject = hasVendorName
    ? `How was your service with ${vendorName}?`
    : 'How was your recent service?';
  const ratingHtml = inlineRatingLinks
    .map(
      (item) =>
        `<a href="${escapeHtml(item.url)}" aria-label="Start a ${item.rating} out of 5 star review" style="display:inline-block;margin:0 8px 8px 0;padding:9px 12px;border-radius:999px;border:1px solid #2b5aa5;background:#0d1b33;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;"><span style="display:inline-block;min-width:12px;text-align:center;">${item.rating}</span><span style="color:#facc15;margin-left:4px;">&#9733;</span></a>`
    )
    .join('');
  const html = buildRelianceEmailHtml({
    eyebrow: 'Optional service feedback',
    headline: 'Your service is complete',
    greeting: `Hello${input.customerName ? ` ${String(input.customerName)}` : ''},`,
    bodyHtml: `
      <p style="margin:0 0 14px;">You may leave an optional review for your recent service${hasVendorName ? ` with <strong style="color:#ffffff;">${escapeRelianceEmailHtml(vendorName)}</strong>` : ''}.</p>
      <p style="margin:0;">If you do not leave a review, nothing is posted and your completed service record remains unchanged.</p>
    `,
    details: [
      { label: 'Service', value: serviceLabel },
      { label: 'Date', value: scheduledDateLabel },
    ],
    cta: { label: 'Leave an Optional Review', href: absoluteFallbackLink },
    secondaryHtml: `
      <p style="margin:0 0 8px;color:#ffffff;font-weight:800;">Start with a quick rating:</p>
      <p style="margin:0 0 14px;">${ratingHtml}</p>
      <p style="margin:0;">You can watch your service video, confirm the rating, and leave feedback in one place.</p>
    `,
    fallbackHref: absoluteFallbackLink,
  });
  const text = [
    `Hello${input.customerName ? ` ${String(input.customerName).trim()}` : ''},`,
    '',
    `Your service is complete. You may leave an optional review${hasVendorName ? ` for your service with ${vendorName}` : ''}.`,
    'If you do not leave a review, nothing is posted and your completed service record remains unchanged.',
    '',
    'Service details:',
    `- Service: ${serviceLabel}`,
    `- Date: ${scheduledDateLabel}`,
    '',
    `Leave an optional review: ${absoluteFallbackLink}`,
    '',
    'Start with a quick rating:',
    ...inlineRatingLinks.map((item) => `${item.rating} star${item.rating > 1 ? 's' : ''}: ${item.url}`),
    '',
    `If the button does not work, copy and paste this link into your browser: ${absoluteFallbackLink}`,
  ].join('\n');

  const email = (input.customerEmail || '').trim();
  if (env.emailEnabled && email) {
    const result = await sendEmail({ to: email, subject, html, text });
    channels.push({
      channel: 'email',
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.reviewWindowId, {
      kind: 'review_invitation',
      channel: 'email',
      recipient: email,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: absoluteFallbackLink,
      errorMessage: result.errorMessage,
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
    const body = hasVendorName
      ? `Reliance: Your service with ${vendorName} is complete. You may leave an optional review for ${serviceLabel}: ${absoluteFallbackLink} Reply STOP to opt out.`
      : `Reliance: Your service is complete. You may leave an optional review here: ${absoluteFallbackLink} Reply STOP to opt out.`;
    const result = await sendSms({ to: phone, body });
    channels.push({
      channel: 'sms',
      attempted: true,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
    });
    await logNotificationAttempt(input.actorUserId, input.reviewWindowId, {
      kind: 'review_invitation',
      channel: 'sms',
      recipient: phone,
      success: result.ok,
      providerMessageId: result.providerMessageId,
      fallbackLink: absoluteFallbackLink,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
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
    anySuccess: channels.some((channel) => channel.attempted && channel.success),
    synchronousBestEffort: true,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeE164ish(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}
