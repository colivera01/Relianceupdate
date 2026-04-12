import { readNotificationEnv } from '@/lib/env/notification-config';

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
};

type ResendCreateResponse = {
  id?: string;
  message?: string;
};

type ResendErrorBody = {
  message?: string;
  name?: string;
};

/**
 * Sends email via Resend REST API (supports reply_to from EMAIL_REPLY_TO / input).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = readNotificationEnv();
  const logPrefix = '[email:resend]';

  if (!env.emailEnabled) {
    console.info(`${logPrefix} skipped: EMAIL_ENABLED is false`);
    return { ok: false, errorMessage: 'email_disabled' };
  }
  if (!env.resendApiKey) {
    console.warn(`${logPrefix} missing RESEND_API_KEY`);
    return { ok: false, errorMessage: 'missing_resend_api_key' };
  }
  if (!env.emailFrom) {
    console.warn(`${logPrefix} missing EMAIL_FROM`);
    return { ok: false, errorMessage: 'missing_email_from' };
  }

  const htmlBody = (input.html || (input.text ? `<pre>${escapeForPre(input.text)}</pre>` : '')).trim();
  const textBody = (input.text || '').trim() || undefined;
  const replyTo = (input.replyTo || env.emailReplyTo || '').trim() || undefined;

  const payload: Record<string, unknown> = {
    from: env.emailFrom,
    to: [input.to],
    subject: input.subject,
    html: htmlBody || '<p>(no body)</p>',
  };
  if (textBody) payload.text = textBody;
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json()) as ResendCreateResponse & ResendErrorBody;

    if (!res.ok) {
      const msg = json.message || json.name || `http_${res.status}`;
      console.error(`${logPrefix} send failed`, { status: res.status, message: msg });
      return { ok: false, errorMessage: msg };
    }

    const id = json.id;
    console.info(`${logPrefix} success`, { to: redactRecipient(input.to), providerMessageId: id });
    return { ok: true, providerMessageId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${logPrefix} exception`, { message });
    return { ok: false, errorMessage: message };
  }
}

function redactRecipient(to: string): string {
  if (to.includes('@')) return to.replace(/(^.).*(@.*$)/, '$1***$2');
  return to.replace(/(\d{2})\d+(\d{2})$/, '$1***$2');
}

function escapeForPre(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
