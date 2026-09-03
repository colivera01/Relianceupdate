export const RELIANCE_V1_SUPPORT_EMAIL = 'Relianceorg.support@gmail.com';

const configuredLaunchSupportEmail = process.env.NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL?.trim();

if (process.env.NODE_ENV === 'production' && !configuredLaunchSupportEmail) {
  throw new Error('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL is required in production.');
}

if (
  configuredLaunchSupportEmail &&
  configuredLaunchSupportEmail.toLowerCase() !== RELIANCE_V1_SUPPORT_EMAIL.toLowerCase()
) {
  throw new Error('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL does not match the approved Reliance V1 support mailbox.');
}

export const HAS_LAUNCH_SUPPORT_EMAIL = true;
export const LAUNCH_SUPPORT_EMAIL = RELIANCE_V1_SUPPORT_EMAIL;
export const LAUNCH_SUPPORT_MAILTO = `mailto:${RELIANCE_V1_SUPPORT_EMAIL}`;
export const LAUNCH_SUPPORT_GMAIL_COMPOSE_URL =
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(RELIANCE_V1_SUPPORT_EMAIL)}`;
export const LAUNCH_SUPPORT_RESPONSE_TIME = 'within 1-2 business days';
