import { sendEmail } from '@/lib/email/resend';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';
import { resolveCustomerFacingServiceLabel } from '@/lib/notifications/customer-facing-service-label';

export type VideoReadyNotificationInput = {
  actorUserId: string;
  bookingId: string;
  customerEmail?: string | null;
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
};

export async function sendVideoReadyNotification(
  input: VideoReadyNotificationInput
): Promise<VideoReadyNotificationResult> {
  const customerEmail = String(input.customerEmail || '').trim();
  const customerName = String(input.customerName || '').trim();
  const serviceLabel = resolveCustomerFacingServiceLabel({
    serviceName: input.serviceName,
    bookingTitle: input.bookingTitle,
    vendorName: input.vendorName,
    fallback: 'your service visit',
  });
  const subject = 'Your service video is ready';
  const message = `Your service video for ${serviceLabel} is now ready to watch.`;

  if (!customerEmail) {
    await logNotificationAttempt(input.actorUserId, input.bookingId, {
      kind: 'proof_ready',
      channel: 'email',
      recipient: 'not_provided',
      success: false,
      fallbackLink: input.videoUrl,
      errorMessage: 'no_customer_email',
    });
    return {
      ok: false,
      errorMessage: 'no_customer_email',
      subject,
      message,
      videoUrl: input.videoUrl,
    };
  }

  const html = `
    <p>Hello${customerName ? ` ${customerName}` : ''},</p>
    <p>${message}</p>
    <p>You can now review the completed service video in Reliance.</p>
    <p><a href="${input.videoUrl}">Watch service video</a></p>
    <p>If the button does not open, paste this link into your browser:</p>
    <p><code>${input.videoUrl}</code></p>
  `.trim();
  const text = [
    `Hello${customerName ? ` ${customerName}` : ''},`,
    '',
    message,
    '',
    'You can now review the completed service video in Reliance.',
    '',
    `Watch service video: ${input.videoUrl}`,
  ].join('\n');

  const sendResult = await sendEmail({
    to: customerEmail,
    subject,
    html,
    text,
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

  return {
    ok: sendResult.ok,
    providerMessageId: sendResult.providerMessageId,
    errorMessage: sendResult.errorMessage,
    subject,
    message,
    videoUrl: input.videoUrl,
  };
}
