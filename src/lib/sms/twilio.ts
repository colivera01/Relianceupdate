import twilio from 'twilio';
import { readNotificationEnv } from '@/lib/env/notification-config';

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult = {
  ok: boolean;
  provider?: 'twilio' | 'telnyx';
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
  trialRestriction?: boolean;
  senderVerificationRestriction?: boolean;
};

/**
 * Map common Twilio delivery and compliance errors into platform-safe messages.
 */
function mapTwilioError(err: unknown): {
  message: string;
  code?: string;
  trialRestriction?: boolean;
  senderVerificationRestriction?: boolean;
} {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: number | string }).code ?? '');
    const providerMessage = String((err as { message?: string }).message || '').trim();
    const trialRestriction = code === '21608' || code === '21614' || code === '21610';
    const senderVerificationRestriction = code === '30032';
    const fallbackMessage =
      code === '21211'
        ? 'Invalid phone number'
        : senderVerificationRestriction
          ? 'Twilio sender verification blocked delivery. Complete Toll-Free Verification or use an approved A2P 10DLC Messaging Service.'
          : trialRestriction
            ? 'Twilio trial restriction: recipient number is not verified for this account.'
            : 'twilio_error';
    const message = providerMessage || fallbackMessage;
    return { message, code, trialRestriction, senderVerificationRestriction };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const env = readNotificationEnv();
  const provider = env.smsProvider === 'telnyx' ? 'telnyx' : 'twilio';

  if (!env.smsEnabled) {
    console.info(`[sms:${provider}] skipped: SMS_ENABLED is false`);
    return { ok: false, provider, errorMessage: 'sms_disabled' };
  }

  if (provider === 'telnyx') return sendTelnyxSms(input, env);
  return sendTwilioSms(input, env);
}

async function sendTwilioSms(input: SendSmsInput, env: ReturnType<typeof readNotificationEnv>): Promise<SendSmsResult> {
  const logPrefix = '[sms:twilio]';
  const hasMessagingService = Boolean(env.twilioMessagingServiceSid);
  const hasDirectSender = Boolean(env.twilioPhoneNumber);
  if (!env.twilioAccountSid || !env.twilioAuthToken || (!hasMessagingService && !hasDirectSender)) {
    console.warn(`${logPrefix} missing Twilio configuration`);
    return { ok: false, provider: 'twilio', errorMessage: 'missing_twilio_config' };
  }

  try {
    const client = twilio(env.twilioAccountSid, env.twilioAuthToken);
    const msg = await client.messages.create(
      hasMessagingService
        ? {
            to: input.to,
            messagingServiceSid: env.twilioMessagingServiceSid,
            body: input.body,
          }
        : {
            to: input.to,
            from: env.twilioPhoneNumber,
            body: input.body,
          }
    );
    console.info(`${logPrefix} success`, {
      to: redactPhone(input.to),
      sender: hasMessagingService ? 'messaging_service' : 'phone_number',
      providerMessageId: msg.sid,
    });
    return { ok: true, provider: 'twilio', providerMessageId: msg.sid };
  } catch (err) {
    const { message, code, trialRestriction, senderVerificationRestriction } = mapTwilioError(err);
    console.error(`${logPrefix} failure`, { message, code, to: redactPhone(input.to) });
    return {
      ok: false,
      provider: 'twilio',
      errorMessage: message,
      errorCode: code,
      trialRestriction,
      senderVerificationRestriction,
    };
  }
}

async function sendTelnyxSms(input: SendSmsInput, env: ReturnType<typeof readNotificationEnv>): Promise<SendSmsResult> {
  const logPrefix = '[sms:telnyx]';
  if (!env.telnyxApiKey || !env.telnyxFromNumber) {
    console.warn(`${logPrefix} missing Telnyx configuration`);
    return { ok: false, provider: 'telnyx', errorMessage: 'missing_telnyx_config' };
  }

  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.telnyxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.telnyxFromNumber,
        to: input.to,
        text: input.body,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      data?: { id?: string };
      errors?: Array<{ code?: string; title?: string; detail?: string }>;
    } | null;

    if (!response.ok) {
      const firstError = payload?.errors?.[0];
      const message =
        firstError?.detail ||
        firstError?.title ||
        `telnyx_error_${response.status}`;
      const code = firstError?.code || String(response.status);
      console.error(`${logPrefix} failure`, { message, code, to: redactPhone(input.to) });
      return {
        ok: false,
        provider: 'telnyx',
        errorMessage: message,
        errorCode: code,
      };
    }

    const providerMessageId = payload?.data?.id;
    console.info(`${logPrefix} success`, {
      to: redactPhone(input.to),
      sender: redactPhone(env.telnyxFromNumber),
      providerMessageId,
    });
    return { ok: true, provider: 'telnyx', providerMessageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${logPrefix} failure`, { message, to: redactPhone(input.to) });
    return { ok: false, provider: 'telnyx', errorMessage: message };
  }
}

function redactPhone(to: string): string {
  const digits = to.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}
