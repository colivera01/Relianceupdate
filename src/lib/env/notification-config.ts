/**
 * Notification-related environment variables (read only from process.env).
 * No secrets are logged; missing configuration produces console warnings.
 */

export type NotificationEnvSnapshot = {
  resendApiKey: string;
  emailFrom: string;
  emailReplyTo: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  appBaseUrl: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
};

function normalizeEmailFrom(raw: string | undefined): string {
  let value = String(raw || '').trim();
  if (!value) return '';
  // Guard against accidental env value like "EMAIL_FROM=Reliance <noreply@...>"
  value = value.replace(/^(EMAIL_FROM=)+/i, '').trim();
  // Strip wrapping quotes sometimes introduced in env files.
  value = value.replace(/^['"]+|['"]+$/g, '').trim();
  return value;
}

function parseEnvBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

export function readNotificationEnv(): NotificationEnvSnapshot {
  return {
    resendApiKey: (process.env.RESEND_API_KEY || '').trim(),
    emailFrom: normalizeEmailFrom(process.env.EMAIL_FROM),
    emailReplyTo: (process.env.EMAIL_REPLY_TO || '').trim(),
    twilioAccountSid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    twilioAuthToken: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    twilioPhoneNumber: (process.env.TWILIO_PHONE_NUMBER || '').trim(),
    appBaseUrl: (process.env.APP_BASE_URL || '').trim().replace(/\/+$/, ''),
    emailEnabled: parseEnvBoolean(process.env.EMAIL_ENABLED, true),
    smsEnabled: parseEnvBoolean(process.env.SMS_ENABLED, true),
  };
}

let warnedOnce = false;

/**
 * Logs one-time, startup-safe warnings for inconsistent or incomplete notification config.
 */
export function logNotificationEnvWarnings(): void {
  if (warnedOnce) return;
  warnedOnce = true;
  const e = readNotificationEnv();
  const lines: string[] = [];

  if (e.emailEnabled) {
    if (!e.resendApiKey) lines.push('EMAIL_ENABLED is true but RESEND_API_KEY is missing (email sends will fail).');
    if (!e.emailFrom) lines.push('EMAIL_ENABLED is true but EMAIL_FROM is missing.');
    if (e.emailFrom && !e.emailFrom.includes('@')) {
      lines.push('EMAIL_FROM does not look valid (expected "Name <email@domain>").');
    }
    if (e.emailFrom && /^email_from=/i.test(e.emailFrom)) {
      lines.push('EMAIL_FROM appears malformed; remove duplicated "EMAIL_FROM=" prefix from the value.');
    }
  }
  if (e.smsEnabled) {
    if (!e.twilioAccountSid) lines.push('SMS_ENABLED is true but TWILIO_ACCOUNT_SID is missing.');
    if (!e.twilioAuthToken) lines.push('SMS_ENABLED is true but TWILIO_AUTH_TOKEN is missing.');
    if (!e.twilioPhoneNumber) lines.push('SMS_ENABLED is true but TWILIO_PHONE_NUMBER is missing.');
  }
  if (!e.appBaseUrl) {
    lines.push('APP_BASE_URL is missing (absolute consent/review links in emails/SMS may be incomplete).');
  }
  if (e.appBaseUrl && !/^https?:\/\//i.test(e.appBaseUrl)) {
    lines.push('APP_BASE_URL should include protocol, e.g. https://your-domain.com');
  }
  if (e.appBaseUrl && /localhost|127\.0\.0\.1/i.test(e.appBaseUrl) && process.env.NODE_ENV === 'production') {
    lines.push('APP_BASE_URL points to localhost in production; external recipients will not be able to open links.');
  }
  if (e.emailReplyTo && !e.emailReplyTo.includes('@')) {
    lines.push('EMAIL_REPLY_TO does not look like a valid address.');
  }

  if (lines.length) {
    console.warn('[notification-env] Configuration warnings:\n- ' + lines.join('\n- '));
  }
}

export function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, '');
}
