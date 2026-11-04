import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const hoisted = vi.hoisted(() => ({
  findCredential: vi.fn(),
  sendVerification: vi.fn(),
}));

vi.mock('@/lib/auth-credentials', () => ({
  findDbCredentialByEmail: hoisted.findCredential,
}));

vi.mock('@/lib/auth-email-verification', () => ({
  sendOrPreviewRateLimitedEmailVerification: hoisted.sendVerification,
}));

function request(email: string) {
  return new NextRequest('https://attacker.example/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, nextPath: '/profile-settings' }),
  });
}

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    hoisted.findCredential.mockReset();
    hoisted.sendVerification.mockReset();
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the same public response shape for unknown and already-verified accounts', async () => {
    const { POST } = await import('./route');
    hoisted.findCredential.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'credential-verified',
      emailVerifiedAt: new Date(),
    });

    const unknown = await POST(request('unknown@example.com'));
    const verified = await POST(request('verified@example.com'));

    expect(unknown.status).toBe(200);
    expect(verified.status).toBe(200);
    expect(await unknown.json()).toEqual(await verified.json());
    expect(hoisted.sendVerification).not.toHaveBeenCalled();
  });

  it('does not expose delivery or throttle state for an unverified account', async () => {
    const { POST } = await import('./route');
    hoisted.findCredential.mockResolvedValue({
      id: 'credential-unverified',
      emailVerifiedAt: null,
    });
    hoisted.sendVerification.mockResolvedValue({ throttled: true });

    const response = await POST(request('customer@example.com'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'If an account with that email exists, a verification link has been sent.',
    });
    expect(hoisted.sendVerification).toHaveBeenCalledWith(expect.objectContaining({
      email: 'customer@example.com',
      credentialId: 'credential-unverified',
      nextPath: '/profile-settings',
    }));
  });
});
