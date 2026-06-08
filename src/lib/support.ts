const configuredLaunchSupportEmail =
  process.env.NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL?.trim() ||
  process.env.LAUNCH_SUPPORT_EMAIL?.trim() ||
  '';

export const HAS_LAUNCH_SUPPORT_EMAIL = configuredLaunchSupportEmail.length > 0;
export const LAUNCH_SUPPORT_EMAIL = configuredLaunchSupportEmail;
export const LAUNCH_SUPPORT_MAILTO = HAS_LAUNCH_SUPPORT_EMAIL ? `mailto:${configuredLaunchSupportEmail}` : '';
export const LAUNCH_SUPPORT_RESPONSE_TIME = 'within 1-2 business days';
