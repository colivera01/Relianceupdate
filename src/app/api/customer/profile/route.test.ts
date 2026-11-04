import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PUT } from './route';

const h = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  credentialFindByUserId: vi.fn(),
  addRegisteredUser: vi.fn(),
  syncRegisteredUsersFromDisk: vi.fn(),
  registeredUsers: [] as any[],
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findUnique: h.userFindUnique,
      update: h.userUpdate,
    },
  },
}));

vi.mock('@/lib/request-actor', () => ({
  requireRequestActor: vi.fn(async () => ({
    userId: 'customer-1',
    platformRoles: [],
    vendorMemberships: [],
  })),
  authorizationErrorResponse: vi.fn(() => null),
}));

vi.mock('@/lib/account-status', () => ({
  AccountStatusError: class AccountStatusError extends Error { statusCode = 403; },
  accountStatusErrorBody: vi.fn(() => ({ success: false })),
  isUserAccountRestricted: vi.fn(() => false),
}));

vi.mock('@/lib/geocoding', () => ({
  addressChanged: vi.fn(() => false),
  geocodeAddress: vi.fn(),
}));

vi.mock('@/lib/auth-credentials', () => ({
  findDbCredentialByUserId: h.credentialFindByUserId,
}));

vi.mock('@/lib/dev-registered-users', () => ({
  registeredUsers: h.registeredUsers,
  addRegisteredUser: h.addRegisteredUser,
  syncRegisteredUsersFromDisk: h.syncRegisteredUsersFromDisk,
}));

const existingUser = {
  id: 'customer-1',
  email: 'customer@example.com',
  name: 'Demo Customer',
  phone: '4075550100',
  profilePhoto: null,
  address: '407 Boxwood Circle',
  city: 'Winter Springs',
  state: 'FL',
  zipCode: '32708',
  accountStatus: 'active',
};

const persistedUser = {
  ...existingUser,
  name: 'Updated Customer',
  phone: '4075550199',
  latitude: null,
  longitude: null,
  geocodedAt: null,
  locationPreferenceEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function request(body: Record<string, unknown>) {
  return new NextRequest('https://beta.relianceonline.org/api/customer/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Updated',
      lastName: 'Customer',
      email: 'customer@example.com',
      phone: '4075550199',
      address: '407 Boxwood Circle',
      city: 'Winter Springs',
      state: 'FL',
      zipCode: '32708',
      locationPreferenceEnabled: true,
      ...body,
    }),
  });
}

function partialRequest(body: Record<string, unknown>) {
  return new NextRequest('https://beta.relianceonline.org/api/customer/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/customer/profile primary email protection', () => {
  beforeEach(() => {
    h.registeredUsers.splice(0);
    h.userFindUnique.mockReset().mockResolvedValue(existingUser);
    h.userUpdate.mockReset().mockResolvedValue(persistedUser);
    h.credentialFindByUserId.mockReset().mockResolvedValue({
      id: 'credential-1',
      email: 'customer@example.com',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    h.addRegisteredUser.mockReset();
    h.syncRegisteredUsersFromDisk.mockReset();
  });

  it.each(['new.customer@example.com', ' New.Customer@Example.com '])(
    'rejects a changed sign-in email %j before any profile or credential write',
    async (email) => {
      const response = await PUT(request({ email }));
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toMatchObject({
        success: false,
        code: 'PROFILE_EMAIL_CHANGE_REQUIRES_SUPPORT',
      });
      expect(h.userUpdate).not.toHaveBeenCalled();
      expect(h.credentialFindByUserId).not.toHaveBeenCalled();
      expect(h.addRegisteredUser).not.toHaveBeenCalled();
    },
  );

  it.each(['', 'not-an-email', 'customer@invalid'])('rejects invalid email %j before any write', async (email) => {
    const response = await PUT(request({ email }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({ success: false, code: 'PROFILE_EMAIL_INVALID' });
    expect(h.userUpdate).not.toHaveBeenCalled();
    expect(h.credentialFindByUserId).not.toHaveBeenCalled();
  });

  it.each([
    [{ firstName: '' }, 'PROFILE_FIRST_NAME_REQUIRED'],
    [{ lastName: '   ' }, 'PROFILE_LAST_NAME_REQUIRED'],
    [{ firstName: 'A'.repeat(101) }, 'PROFILE_NAME_TOO_LONG'],
  ] as const)('rejects invalid required name fields before writes', async (overrides, code) => {
    const response = await PUT(request(overrides));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({ success: false, code });
    expect(h.userUpdate).not.toHaveBeenCalled();
    expect(h.credentialFindByUserId).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'PROFILE_PHONE_REQUIRED'],
    ['407-55', 'PROFILE_PHONE_INVALID'],
    ['call 4074861397', 'PROFILE_PHONE_INVALID'],
    ['1'.repeat(33), 'PROFILE_PHONE_INVALID'],
  ])('rejects invalid phone %j before writes', async (phone, code) => {
    const response = await PUT(request({ phone }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({ success: false, code });
    expect(h.userUpdate).not.toHaveBeenCalled();
    expect(h.credentialFindByUserId).not.toHaveBeenCalled();
  });

  it('accepts the canonical email case-insensitively but never sends it in the update data', async () => {
    const response = await PUT(request({ email: ' CUSTOMER@EXAMPLE.COM ' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      profile: { email: 'customer@example.com', phone: '4075550199' },
    });
    expect(h.userUpdate).toHaveBeenCalledTimes(1);
    const updateData = h.userUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData).not.toHaveProperty('email');
    expect(h.credentialFindByUserId).toHaveBeenCalledWith('customer-1');
  });

  it('merges canonical required fields for partial profile updates without overwriting omitted values', async () => {
    const response = await PUT(partialRequest({ locationPreferenceEnabled: false }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    const updateData = h.userUpdate.mock.calls[0]?.[0]?.data;
    expect(updateData).toMatchObject({ locationPreferenceEnabled: false });
    expect(updateData).not.toHaveProperty('email');
    expect(updateData).not.toHaveProperty('name');
    expect(updateData).not.toHaveProperty('phone');
  });

  it('returns a phone-specific conflict without misreporting it as an email conflict', async () => {
    h.userUpdate.mockRejectedValueOnce(
      Object.assign(new Error('unique constraint'), {
        code: 'P2002',
        meta: { target: ['phone'] },
      }),
    );

    const response = await PUT(request({ phone: '4075550199' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      success: false,
      code: 'PROFILE_PHONE_IN_USE',
      error: 'That phone number is already connected to another account.',
    });
    expect(body.code).not.toBe('PROFILE_EMAIL_IN_USE');
    expect(h.credentialFindByUserId).not.toHaveBeenCalled();
  });
});
