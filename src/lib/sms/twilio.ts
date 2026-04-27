import twilio from 'twilio';
import { readNotificationEnv } from '@/lib/env/notification-config';

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
  trialRestriction?: boolean;
};

/**
 * Twilio trial accounts cannot message unverified numbers — map common REST codes.
 */
function mapTwilioError(err: unknown): { message: string; code?: string; trialRestriction?: boolean } {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: number | string }).code ?? '');
    const providerMessage = String((err as { message?: string }).message || '').trim();
    const trialRestriction = code === '21608' || code === '21614' || code === '21610';
    const fallbackMessage =
      code === '21211'
        ? 'Invalid phone number'
        : trialRestriction
          ? 'Twilio trial restriction: recipient number is not verified for this account.'
          : 'twilio_error';
    const message = providerMessage || fallbackMessage;
    return { message, code, trialRestriction };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const env = readNotificationEnv();
  const logPrefix = '[sms:twilio]';

  if (!env.smsEnabled) {
    console.info(`${logPrefix} skipped: SMS_ENABLED is false`);
    return { ok: false, errorMessage: 'sms_disabled' };
  }
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioPhoneNumber) {
    console.warn(`${logPrefix} missing Twilio configuration`);
    return { ok: false, errorMessage: 'missing_twilio_config' };
  }

  try {
    const client = twilio(env.twilioAccountSid, env.twilioAuthToken);
    const msg = await client.messages.create({
      to: input.to,
      from: env.twilioPhoneNumber,
      body: input.body,
    });
    console.info(`${logPrefix} success`, {
      to: redactPhone(input.to),
      providerMessageId: msg.sid,
    });
    return { ok: true, providerMessageId: msg.sid };
  } catch (err) {
    const { message, code, trialRestriction } = mapTwilioError(err);
    console.error(`${logPrefix} failure`, { message, code, to: redactPhone(input.to) });
    return { ok: false, errorMessage: message, errorCode: code, trialRestriction };
  }
}

function redactPhone(to: string): string {
  const digits = to.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}
