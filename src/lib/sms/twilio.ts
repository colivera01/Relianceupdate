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
  const logPrefix = '[sms:twilio]';

  if (!env.smsEnabled) {
    console.info(`${logPrefix} skipped: SMS_ENABLED is false`);
    return { ok: false, errorMessage: 'sms_disabled' };
  }

  const hasMessagingService = Boolean(env.twilioMessagingServiceSid);
  const hasDirectSender = Boolean(env.twilioPhoneNumber);
  if (!env.twilioAccountSid || !env.twilioAuthToken || (!hasMessagingService && !hasDirectSender)) {
    console.warn(`${logPrefix} missing Twilio configuration`);
    return { ok: false, errorMessage: 'missing_twilio_config' };
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
    return { ok: true, providerMessageId: msg.sid };
  } catch (err) {
    const { message, code, trialRestriction, senderVerificationRestriction } = mapTwilioError(err);
    console.error(`${logPrefix} failure`, { message, code, to: redactPhone(input.to) });
    return {
      ok: false,
      errorMessage: message,
      errorCode: code,
      trialRestriction,
      senderVerificationRestriction,
    };
  }
}

function redactPhone(to: string): string {
  const digits = to.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}
