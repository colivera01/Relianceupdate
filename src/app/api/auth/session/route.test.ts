import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { getAuthSessionClaimsFromRequest, createAuthBearerToken } from '@/lib/auth-session';
import { findDbCredentialByUserId } from '@/lib/auth-credentials';
import { buildAuthLoginUserPayload } from '@/lib/auth-login-user';

vi.mock('@/lib/auth-session', () => ({
  getAuthSessionClaimsFromRequest: vi.fn(),
  createAuthBearerToken: vi.fn(),
}));

vi.mock('@/lib/auth-credentials', () => ({
  findDbCredentialByUserId: vi.fn(),
}));

vi.mock('@/lib/auth-login-user', () => ({
  buildAuthLoginUserPayload: vi.fn(),
}));

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.mocked(getAuthSessionClaimsFromRequest).mockReset();
    vi.mocked(findDbCredentialByUserId).mockReset();
    vi.mocked(buildAuthLoginUserPayload).mockReset();
    vi.mocked(createAuthBearerToken).mockReset();
  });

  it('returns 401 when no signed session exists', async () => {
    vi.mocked(getAuthSessionClaimsFromRequest).mockReturnValue(null as any);

    const response = await GET(new Request('http://localhost/api/auth/session'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: false,
    });
  });

  it('returns hydrated user data from the signed session', async () => {
    vi.mocked(getAuthSessionClaimsFromRequest).mockReturnValue({
      userId: 'user-1',
      email: 'customer@example.com',
      userType: 'customer',
      availableProfiles: ['customer'],
      issuedAt: 1,
      expiresAt: 2,
      version: 1,
    });
    vi.mocked(findDbCredentialByUserId).mockResolvedValue({
      id: 'cred-1',
      userId: 'user-1',
      email: 'customer@example.com',
      passwordHash: 'hash',
      emailVerifiedAt: new Date('2026-06-01T00:00:00.000Z'),
      passwordUpdatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    vi.mocked(buildAuthLoginUserPayload).mockResolvedValue({
      id: 'user-1',
      name: 'Customer Example',
      email: 'customer@example.com',
      userType: 'customer',
      availableProfiles: ['customer'],
      emailVerified: true,
      emailVerifiedAt: '2026-06-01T00:00:00.000Z',
      avatar: 'https://example.com/avatar.png',
    });
    vi.mocked(createAuthBearerToken).mockReturnValue('signed-bearer-token');

    const response = await GET(new Request('http://localhost/api/auth/session'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      token: 'signed-bearer-token',
      user: {
        id: 'user-1',
        email: 'customer@example.com',
      },
    });
  });
});
