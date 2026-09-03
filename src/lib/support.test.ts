import { afterEach, describe, expect, it, vi } from 'vitest';

const APPROVED_SUPPORT_EMAIL = 'Relianceorg.support@gmail.com';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Reliance V1 support contact', () => {
  it('uses the approved mailbox when no deployment setting is present', async () => {
    vi.stubEnv('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL', '');

    const support = await import('./support');

    expect(support.HAS_LAUNCH_SUPPORT_EMAIL).toBe(true);
    expect(support.LAUNCH_SUPPORT_EMAIL).toBe(APPROVED_SUPPORT_EMAIL);
    expect(support.LAUNCH_SUPPORT_MAILTO).toBe(`mailto:${APPROVED_SUPPORT_EMAIL}`);
    expect(support.LAUNCH_SUPPORT_GMAIL_COMPOSE_URL).toContain(
      encodeURIComponent(APPROVED_SUPPORT_EMAIL)
    );
  });

  it('accepts the single canonical deployment setting', async () => {
    vi.stubEnv('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL', APPROVED_SUPPORT_EMAIL);

    const support = await import('./support');

    expect(support.LAUNCH_SUPPORT_EMAIL).toBe(APPROVED_SUPPORT_EMAIL);
  });

  it('fails fast when the canonical deployment setting is missing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL', '');

    await expect(import('./support')).rejects.toThrow(
      'NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL is required in production.'
    );
  });

  it('does not allow the retired server-only setting to define another mailbox', async () => {
    vi.stubEnv('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL', '');
    vi.stubEnv('LAUNCH_SUPPORT_EMAIL', 'different@example.com');

    const support = await import('./support');

    expect(support.LAUNCH_SUPPORT_EMAIL).toBe(APPROVED_SUPPORT_EMAIL);
  });

  it('fails fast when the deployment setting conflicts with the approved mailbox', async () => {
    vi.stubEnv('NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL', 'different@example.com');

    await expect(import('./support')).rejects.toThrow(
      'NEXT_PUBLIC_LAUNCH_SUPPORT_EMAIL does not match the approved Reliance V1 support mailbox.'
    );
  });
});
