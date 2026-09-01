import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError, type RequestActor } from './request-actor';
import {
  resolveServerRoleBoundaryAccess,
  serverRoleBoundaryLogDetails,
} from './server-role-boundary-access';

vi.mock('@/server/db', () => ({ prisma: {} }));

const claims = {
  userId: 'manager-1',
  email: 'manager@example.com',
  userType: 'both' as const,
  availableProfiles: ['customer', 'vendor'],
  issuedAt: 1,
  expiresAt: 9_999_999_999,
  version: 2 as const,
};

const managerActor: RequestActor = {
  userId: 'manager-1',
  email: 'manager@example.com',
  accountStatus: 'active',
  platformRoles: [],
  vendorMemberships: [
    { id: 'membership-1', vendorId: 'vendor-1', role: 'MANAGER' },
  ],
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    getSessionToken: vi.fn(() => 'valid-session'),
    verifySessionToken: vi.fn(() => claims),
    resolveActor: vi.fn(async () => managerActor),
    resolveVendorAccess: vi.fn(async () => ({
      state: 'ACTIVE' as const,
      userId: 'manager-1',
      vendorId: 'vendor-1',
      membershipId: 'membership-1',
      membershipStatus: 'ACTIVE',
      accountStatus: 'active',
      restrictedAccountType: null,
      role: 'MANAGER',
      businessName: 'Electro LLC',
    })),
    ...overrides,
  } as any;
}

const request = new Request('http://localhost/vendor/jobs', {
  headers: { cookie: 'reliance_session=valid-session' },
});

describe('server role boundary access', () => {
  it('classifies a missing session as unauthenticated', async () => {
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({ getSessionToken: vi.fn(() => null) })
    );

    expect(outcome).toEqual({ status: 'unauthenticated', reason: 'MISSING_SESSION' });
  });

  it('classifies an invalid or expired session as unauthenticated', async () => {
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({ verifySessionToken: vi.fn(() => null) })
    );

    expect(outcome).toEqual({
      status: 'unauthenticated',
      reason: 'INVALID_OR_EXPIRED_SESSION',
    });
  });

  it('separates a server-side session verification failure from an invalid token', async () => {
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({
        verifySessionToken: vi.fn(() => {
          throw new Error('session verifier unavailable');
        }),
      })
    );

    expect(outcome).toEqual({
      status: 'resolution_failure',
      reason: 'SESSION_VERIFICATION_FAILED',
      errorName: 'Error',
    });
  });

  it('allows an active Vendor Manager after Admin PASS because authority remains membership-based', async () => {
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies()
    );

    expect(outcome).toEqual({ status: 'allowed', actor: managerActor });
  });

  it('preserves linked Customer and Vendor access for the same canonical actor', async () => {
    const deps = dependencies();

    await expect(
      resolveServerRoleBoundaryAccess(request, { role: 'customer' }, deps)
    ).resolves.toEqual({ status: 'allowed', actor: managerActor });
    await expect(
      resolveServerRoleBoundaryAccess(request, { role: 'vendor' }, deps)
    ).resolves.toEqual({ status: 'allowed', actor: managerActor });
  });

  it.each(['customer-only', 'employee-with-revoked-membership', 'inactive-membership'])(
    'denies Vendor access for %s without an active canonical membership',
    async () => {
      const actor = { ...managerActor, vendorMemberships: [] };
      const outcome = await resolveServerRoleBoundaryAccess(
        request,
        { role: 'vendor' },
        dependencies({ resolveActor: vi.fn(async () => actor) })
      );

      expect(outcome).toEqual({
        status: 'forbidden',
        reason: 'VENDOR_MEMBERSHIP_REQUIRED',
      });
    }
  );

  it('denies an employee-only membership at the Vendor Manager Manage Jobs boundary', async () => {
    const employeeActor: RequestActor = {
      ...managerActor,
      vendorMemberships: [
        { id: 'membership-employee', vendorId: 'vendor-1', role: 'EMPLOYEE' },
      ],
    };
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor', requiredVendorRole: 'MANAGER' },
      dependencies({ resolveActor: vi.fn(async () => employeeActor) })
    );

    expect(outcome).toEqual({ status: 'forbidden', reason: 'VENDOR_ROLE_REQUIRED' });
  });

  it('does not grant participant access to an Admin actor', async () => {
    const actor = { ...managerActor, platformRoles: ['ADMIN'] as const };
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({ resolveActor: vi.fn(async () => actor) })
    );

    expect(outcome).toEqual({ status: 'forbidden', reason: 'ADMIN_ACCOUNT' });
  });

  it('separates account restriction from transient resolution failure', async () => {
    const restricted = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({
        resolveActor: vi.fn(async () => {
          throw new AuthorizationError('ACCOUNT_RESTRICTED', 'restricted', 403);
        }),
      })
    );
    const transient = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({
        resolveActor: vi.fn(async () => {
          const error = new Error('database unavailable');
          error.name = 'PrismaClientKnownRequestError';
          throw error;
        }),
      })
    );

    expect(restricted).toEqual({ status: 'forbidden', reason: 'ACCOUNT_RESTRICTED' });
    expect(transient).toEqual({
      status: 'resolution_failure',
      reason: 'ACTOR_RESOLUTION_FAILED',
      errorName: 'PrismaClientKnownRequestError',
    });
  });

  it('fails safely when a valid session cannot resolve a canonical actor', async () => {
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({ resolveActor: vi.fn(async () => null) })
    );

    expect(outcome).toEqual({
      status: 'resolution_failure',
      reason: 'ACTOR_NOT_RESOLVED',
    });
  });

  it('fails safely when actor identity does not match the verified session', async () => {
    const outcome = await resolveServerRoleBoundaryAccess(
      request,
      { role: 'vendor' },
      dependencies({
        resolveActor: vi.fn(async () => ({ ...managerActor, userId: 'different-user' })),
      })
    );

    expect(outcome).toEqual({
      status: 'resolution_failure',
      reason: 'MALFORMED_ACTOR_STATE',
    });
  });

  it('logs only safe outcome metadata and a non-sensitive correlation reference', () => {
    const details = serverRoleBoundaryLogDetails(
      {
        status: 'resolution_failure',
        reason: 'ACTOR_RESOLUTION_FAILED',
        errorName: 'PrismaClientKnownRequestError',
      },
      'vendor',
      'correlation-1'
    );

    expect(details).toEqual({
      correlationId: 'correlation-1',
      role: 'vendor',
      outcome: 'resolution_failure',
      reason: 'ACTOR_RESOLUTION_FAILED',
      errorName: 'PrismaClientKnownRequestError',
    });
    expect(JSON.stringify(details)).not.toContain('valid-session');
    expect(JSON.stringify(details)).not.toContain('manager@example.com');
  });
});
