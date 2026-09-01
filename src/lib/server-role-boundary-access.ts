import {
  getAuthSessionTokenFromRequest,
  verifyAuthSessionCookie,
  type AuthSessionClaims,
} from '@/lib/auth-session';
import {
  AuthorizationError,
  resolveRequestActor,
  type RequestActor,
} from '@/lib/request-actor';
import {
  resolveVendorAccessForUser,
  type VendorAccessContext,
} from '@/lib/vendor-context';

export type ParticipantRole = 'customer' | 'vendor';

type UnauthenticatedReason = 'MISSING_SESSION' | 'INVALID_OR_EXPIRED_SESSION';
type ForbiddenReason =
  | 'ACCOUNT_RESTRICTED'
  | 'ADMIN_ACCOUNT'
  | 'CANONICAL_FORBIDDEN'
  | 'VENDOR_ROLE_REQUIRED'
  | 'VENDOR_MEMBERSHIP_REQUIRED';
type ResolutionFailureReason =
  | 'SESSION_VERIFICATION_FAILED'
  | 'ACTOR_NOT_RESOLVED'
  | 'ACTOR_RESOLUTION_FAILED'
  | 'MALFORMED_ACTOR_STATE'
  | 'VENDOR_ACCESS_RESOLUTION_FAILED';

export type ServerRoleBoundaryOutcome =
  | { status: 'allowed'; actor: RequestActor }
  | { status: 'unauthenticated'; reason: UnauthenticatedReason }
  | { status: 'forbidden'; reason: ForbiddenReason }
  | {
      status: 'resolution_failure';
      reason: ResolutionFailureReason;
      errorName?: string;
    };

type Dependencies = {
  getSessionToken: (request: Request) => string | null;
  verifySessionToken: (token: string) => AuthSessionClaims | null;
  resolveActor: (request: Request) => Promise<RequestActor | null>;
  resolveVendorAccess: (userId: string) => Promise<VendorAccessContext>;
};

const DEFAULT_DEPENDENCIES: Dependencies = {
  getSessionToken: getAuthSessionTokenFromRequest,
  verifySessionToken: verifyAuthSessionCookie,
  resolveActor: resolveRequestActor,
  resolveVendorAccess: resolveVendorAccessForUser,
};

function errorName(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  return 'UnknownError';
}

export async function resolveServerRoleBoundaryAccess(
  request: Request,
  options: {
    role: ParticipantRole;
    allowPendingVendorOnboarding?: boolean;
    requiredVendorRole?: 'MANAGER' | 'EMPLOYEE';
  },
  dependencies: Dependencies = DEFAULT_DEPENDENCIES
): Promise<ServerRoleBoundaryOutcome> {
  let sessionToken: string | null;
  try {
    sessionToken = dependencies.getSessionToken(request);
  } catch {
    return { status: 'unauthenticated', reason: 'INVALID_OR_EXPIRED_SESSION' };
  }
  if (!sessionToken) {
    return { status: 'unauthenticated', reason: 'MISSING_SESSION' };
  }

  let sessionClaims: AuthSessionClaims | null;
  try {
    sessionClaims = dependencies.verifySessionToken(sessionToken);
  } catch (error) {
    return {
      status: 'resolution_failure',
      reason: 'SESSION_VERIFICATION_FAILED',
      errorName: errorName(error),
    };
  }
  if (!sessionClaims) {
    return { status: 'unauthenticated', reason: 'INVALID_OR_EXPIRED_SESSION' };
  }

  let actor: RequestActor | null;
  try {
    actor = await dependencies.resolveActor(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === 'ACCOUNT_RESTRICTED') {
        return { status: 'forbidden', reason: 'ACCOUNT_RESTRICTED' };
      }
      if (error.code === 'FORBIDDEN') {
        return { status: 'forbidden', reason: 'CANONICAL_FORBIDDEN' };
      }
      if (error.code === 'UNAUTHENTICATED' || error.code === 'VENDOR_SESSION_TIMEOUT') {
        return { status: 'unauthenticated', reason: 'INVALID_OR_EXPIRED_SESSION' };
      }
    }
    return {
      status: 'resolution_failure',
      reason: 'ACTOR_RESOLUTION_FAILED',
      errorName: errorName(error),
    };
  }

  if (!actor) {
    return { status: 'resolution_failure', reason: 'ACTOR_NOT_RESOLVED' };
  }
  if (
    actor.userId !== sessionClaims.userId ||
    !Array.isArray(actor.platformRoles) ||
    !Array.isArray(actor.vendorMemberships)
  ) {
    return { status: 'resolution_failure', reason: 'MALFORMED_ACTOR_STATE' };
  }
  if (actor.platformRoles.includes('ADMIN')) {
    return { status: 'forbidden', reason: 'ADMIN_ACCOUNT' };
  }
  if (options.role === 'customer') {
    return { status: 'allowed', actor };
  }
  if (
    actor.vendorMemberships.length > 0 &&
    (!options.requiredVendorRole ||
      actor.vendorMemberships.some((membership) => membership.role === options.requiredVendorRole))
  ) {
    return { status: 'allowed', actor };
  }
  if (actor.vendorMemberships.length > 0 && options.requiredVendorRole) {
    return { status: 'forbidden', reason: 'VENDOR_ROLE_REQUIRED' };
  }

  if (options.allowPendingVendorOnboarding) {
    try {
      const vendorAccess = await dependencies.resolveVendorAccess(actor.userId);
      if (vendorAccess.state === 'PENDING') {
        return { status: 'allowed', actor };
      }
      if (vendorAccess.state === 'ACTIVE') {
        return { status: 'resolution_failure', reason: 'MALFORMED_ACTOR_STATE' };
      }
      if (vendorAccess.state === 'RESTRICTED') {
        return { status: 'forbidden', reason: 'ACCOUNT_RESTRICTED' };
      }
    } catch (error) {
      return {
        status: 'resolution_failure',
        reason: 'VENDOR_ACCESS_RESOLUTION_FAILED',
        errorName: errorName(error),
      };
    }
  }

  return { status: 'forbidden', reason: 'VENDOR_MEMBERSHIP_REQUIRED' };
}

export function serverRoleBoundaryLogDetails(
  outcome: Exclude<ServerRoleBoundaryOutcome, { status: 'allowed' }>,
  role: ParticipantRole,
  correlationId?: string
) {
  return {
    correlationId: correlationId || null,
    role,
    outcome: outcome.status,
    reason: outcome.reason,
    errorName: outcome.status === 'resolution_failure' ? outcome.errorName || null : null,
  };
}
