import { prisma } from "@/server/db";
import {
  getAdminAuthSessionClaimsFromRequest,
  getAuthSessionClaimsFromRequest,
  verifyAuthBearerToken,
  type AuthSessionClaims,
} from "@/lib/auth-session";
import { normalizeAccountStatus } from "@/lib/account-status-shared";

export type PlatformRole = "ADMIN";
export type VendorActorMembership = {
  id: string;
  vendorId: string;
  role: "MANAGER" | "EMPLOYEE";
};

export type RequestActor = {
  userId: string;
  email: string | null;
  accountStatus: "active";
  platformRoles: PlatformRole[];
  vendorMemberships: VendorActorMembership[];
};

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "ACCOUNT_RESTRICTED" | "FORBIDDEN",
    message: string,
    public readonly statusCode: 401 | 403
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getActivePlatformRolesForUser(userId: string): Promise<PlatformRole[]> {
  const grants = await (prisma as any).platformRoleGrant.findMany({
    where: {
      userId: String(userId),
      status: "ACTIVE",
    },
    select: { role: true },
  });
  return Array.from(
    new Set(
      (grants || [])
        .map((grant: any) => String(grant.role || "").trim().toUpperCase())
        .filter((role: string): role is PlatformRole => role === "ADMIN")
    )
  );
}

function bearerClaims(request: Request): AuthSessionClaims | null {
  const header = String(request.headers.get("authorization") || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ? verifyAuthBearerToken(match[1]) : null;
}

function candidateClaims(request: Request, adminScope: boolean): AuthSessionClaims | null {
  if (adminScope) {
    return getAdminAuthSessionClaimsFromRequest(request);
  }
  return getAuthSessionClaimsFromRequest(request) || bearerClaims(request);
}

export async function resolveRequestActor(
  request: Request,
  options: { adminScope?: boolean } = {}
): Promise<RequestActor | null> {
  const claims = candidateClaims(request, Boolean(options.adminScope));
  const userId = String(claims?.userId || "").trim();
  if (!userId) return null;

  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      platformRoleGrants: {
        where: { status: "ACTIVE" },
        select: { role: true },
      },
      memberships: {
        where: {
          status: "ACTIVE",
          vendor: { accountStatus: "active" },
        },
        select: {
          id: true,
          vendorId: true,
          role: true,
        },
      },
    },
  });

  if (!user) return null;
  const accountStatus = normalizeAccountStatus(user.accountStatus);
  if (accountStatus !== "active") {
    throw new AuthorizationError(
      "ACCOUNT_RESTRICTED",
      "This account is not currently available.",
      403
    );
  }

  const platformRoles = (user.platformRoleGrants || [])
    .map((grant: any) => String(grant.role || "").trim().toUpperCase())
    .filter((role: string): role is PlatformRole => role === "ADMIN");

  const vendorMemberships = (user.memberships || [])
    .map((membership: any) => ({
      id: String(membership.id),
      vendorId: String(membership.vendorId),
      role: String(membership.role || "").trim().toUpperCase(),
    }))
    .filter(
      (membership: any): membership is VendorActorMembership =>
        Boolean(membership.id && membership.vendorId) &&
        (membership.role === "MANAGER" || membership.role === "EMPLOYEE")
    );

  return {
    userId: String(user.id),
    email: user.email ? String(user.email) : null,
    accountStatus: "active",
    platformRoles: Array.from(new Set(platformRoles)),
    vendorMemberships,
  };
}

export async function requireRequestActor(
  request: Request,
  options: { adminScope?: boolean } = {}
): Promise<RequestActor> {
  const actor = await resolveRequestActor(request, options);
  if (!actor) {
    throw new AuthorizationError("UNAUTHENTICATED", "Sign in required.", 401);
  }
  return actor;
}

export async function requirePlatformRole(
  request: Request,
  role: PlatformRole
): Promise<RequestActor> {
  const actor = await requireRequestActor(request, { adminScope: true });
  if (!actor.platformRoles.includes(role)) {
    throw new AuthorizationError("FORBIDDEN", "Admin access required.", 403);
  }
  return actor;
}

export function requireActorVendorMembership(
  actor: RequestActor,
  vendorId: string
): VendorActorMembership {
  const membership = actor.vendorMemberships.find(
    (candidate) => candidate.vendorId === String(vendorId)
  );
  if (!membership) {
    throw new AuthorizationError("FORBIDDEN", "Vendor access required.", 403);
  }
  return membership;
}

export function requireActorVendorManager(
  actor: RequestActor,
  vendorId: string
): VendorActorMembership {
  const membership = requireActorVendorMembership(actor, vendorId);
  if (membership.role !== "MANAGER") {
    throw new AuthorizationError("FORBIDDEN", "Manager access required.", 403);
  }
  return membership;
}

export function authorizationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) return null;
  return Response.json(
    { success: false, code: error.code, error: error.message },
    { status: error.statusCode }
  );
}
