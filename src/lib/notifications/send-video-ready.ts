import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';
import { resolveCustomerFacingServiceLabel } from '@/lib/notifications/customer-facing-service-label';

export type VideoReadyNotificationInput = {
  actorUserId: string;
  bookingId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  bookingTitle?: string | null;
  vendorName?: string | null;
  videoUrl: string;
};

export type VideoReadyNotificationResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  subject: string;
  message: string;
  videoUrl: string;
  channels: Array<{
    channel: 'email' | 'sms';
    attempted: boolean;
    success: boolean;
    providerMessageId?: string;
    errorMessage?: string;
    errorCode?: string;
  }>;
};

export async function sendVideoReadyNotification(
  input: VideoReadyNotificationInput
): Promise<VideoReadyNotificationResult> {
  const env = readNotificationEnv();
  const channels: VideoReadyNotificationResult['channels'] = [];
  const customerEmail = String(input.customerEmail || '').trim();
  const customerPhone = normalizeE164ish(input.customerPhone);
  const customerName = String(input.customerName || '').trim();
  const vendorName = String(input.vendorName || '').trim() || 'Your provider';
  const serviceLabel = resolveCustomerFacingServiceLabel({
    serviceName: input.serviceName,
    bookingTitle: input.bookingTitle,
    vendorName: input.vendorName,
    fallback: 'your service visit',
  });
  const subject = `Your service video from ${vendorName} is ready`;
  const message = `${vendorName} has shared your service video for ${serviceLabel}.`;

  if (env.emailEnabled && customerEmail) {
    const html = `
      <p>Hello${customerName ? ` ${customerName}` : ''},</p>
      <p>${message}</p>
      <p>You can now review the Starting Condition, Work in Progress, and Final Result service videos in Reliance.</p>
      <p><a href="${input.videoUrl}">Watch service video</a></p>
      <p>If the button does not open, paste this link into your browser:</p>
      <p><code>${input.videoUrl}</code></p>
    `.trim();
    const text = [
      `Hello${customerName ? ` ${customerName}` : ''},`,
      '',
      message,
      '',
      'You can now review the Starting Condition, Work in Progress, and Final Result service videos in Reliance.',
      '',
      `Watch service video: ${input.videoUrl}`,
    ].join('\n');

    const sendResult = await sendEmail({
      to: customerEmail,
      subject,
      html,
      text,
    });

    channels.push({
      channel: 'email',
      attempted: true,
      success: sendResult.ok,
      providerMessageId: sendResult.providerMessageId,
      errorMessage: sendResult.errorMessage,
    });

    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: 'proof_ready',
      channel: 'email',
      recipient: customerEmail,
      success: sendResult.ok,
      providerMessageId: sendResult.providerMessageId,
      fallbackLink: input.videoUrl,
      errorMessage: sendResult.errorMessage,
    });
  } else {
    const errorMessage = !customerEmail ? 'no_customer_email' : 'email_disabled';
    channels.push({
      channel: 'email',
      attempted: false,
      success: false,
      errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: 'proof_ready',
      channel: 'email',
      recipient: 'not_provided',
      success: false,
      fallbackLink: input.videoUrl,
      errorMessage,
    });
  }

  if (env.smsEnabled && customerPhone) {
    const body = `${vendorName} via Reliance: your service video for ${serviceLabel} is ready. View Starting Condition, Work in Progress, and Final Result here: ${input.videoUrl} Reply STOP to opt out.`;
    const smsResult = await sendSms({ to: customerPhone, body });
    channels.push({
      channel: 'sms',
      attempted: true,
      success: smsResult.ok,
      providerMessageId: smsResult.providerMessageId,
      errorMessage: smsResult.errorMessage,
      errorCode: smsResult.errorCode,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: 'proof_ready',
      channel: 'sms',
      recipient: customerPhone,
      success: smsResult.ok,
      providerMessageId: smsResult.providerMessageId,
      fallbackLink: input.videoUrl,
      errorMessage: smsResult.errorMessage,
      errorCode: smsResult.errorCode,
    });
  } else {
    const errorMessage = !customerPhone ? 'no_customer_phone' : 'sms_disabled';
    channels.push({
      channel: 'sms',
      attempted: false,
      success: false,
      errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: 'proof_ready',
      channel: 'sms',
      recipient: customerPhone || 'not_provided',
      success: false,
      fallbackLink: input.videoUrl,
      errorMessage,
    });
  }

  const successChannel = channels.find((channel) => channel.attempted && channel.success);
  const failedAttempt = channels.find((channel) => channel.attempted && !channel.success);

  return {
    ok: Boolean(successChannel),
    providerMessageId: successChannel?.providerMessageId,
    errorMessage: successChannel ? undefined : failedAttempt?.errorMessage || 'no_notification_channel_available',
    subject,
    message,
    videoUrl: input.videoUrl,
    channels,
  };
}

function normalizeE164ish(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const t = phone.trim();
  if (!t) return null;
  if (t.startsWith('+')) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith('1')) return `+${digits}`;
  return digits ? `+${digits}` : null;
}
