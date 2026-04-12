export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logNotificationEnvWarnings } = await import('@/lib/env/notification-config');
    logNotificationEnvWarnings();
  }
}
