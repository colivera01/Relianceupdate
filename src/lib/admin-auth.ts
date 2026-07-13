import { getUserIdFromRequest, verifyJwt } from "./auth";
import { getAuthSessionClaimsFromRequest, verifyAuthBearerToken } from "./auth-session";
import {
  isOwnerAdminEmail,
  isOwnerAdminPhone,
  isOwnerAdminUserId,
} from "@/lib/internal-identities";
import { prisma } from "@/server/db";

const IS_DEV = process.env.NODE_ENV !== "production";

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function isAdminLikeRole(role: string | null | undefined): boolean {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "superadmin";
}

async function isOwnerAdminIdentity(params: {
  userId: string | null | undefined;
  email?: string | null;
}): Promise<boolean> {
  const userId = String(params.userId || "").trim();
  if (isOwnerAdminUserId(userId) || isOwnerAdminEmail(params.email)) {
    return true;
  }

  if (!userId) return false;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
      },
    });

    return isOwnerAdminEmail(user?.email) || isOwnerAdminPhone(user?.phone);
  } catch (error) {
    console.error("[admin-auth] owner identity fallback failed", error);
    return false;
  }
}

/**
 * Require admin access for admin API routes.
 * Strongest currently available signals in this codebase:
 * - JWT payload role
 * - explicit admin headers used in local/dev environments
 */
export async function requireAdmin(request: Request): Promise<{ userId: string; role: string }> {
  const access = await readAdminAccess(request);
  if (!access.userId) {
    throw new Error("Unauthorized");
  }
  if (!access.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return {
    userId: access.userId,
    role: String(access.role || "admin"),
  };
}

export async function readAdminAccess(request: Request): Promise<{
  userId: string | null;
  role: string | null;
  isAdmin: boolean;
}> {
  const signedSession = getAuthSessionClaimsFromRequest(request);
  const userId = signedSession?.userId || (await getUserIdFromRequest(request));

  let role: string | undefined = signedSession?.availableProfiles?.includes("admin")
    ? "admin"
    : signedSession?.userType;
  const token = getBearerToken(request);
  if (token) {
    const signedClaims = verifyAuthBearerToken(token);
    if (signedClaims) {
      role = signedClaims.availableProfiles?.includes("admin") ? "admin" : signedClaims.userType;
    }
  }

  if (token && !role && IS_DEV) {
    try {
      const payload = await verifyJwt(token);
      role = typeof payload.role === "string" ? payload.role : undefined;
    } catch {
      // Ignore token parse failures here; fallback to explicit headers below in dev only.
    }
  }

  if (!role && IS_DEV) {
    const headerRole = request.headers.get("x-user-role");
    if (headerRole) role = headerRole;
  }

  const explicitAdminHeader = request.headers.get("x-admin");
  const isAdminByHeader =
    IS_DEV &&
    (explicitAdminHeader === "1" ||
      String(explicitAdminHeader || "").toLowerCase() === "true");

  return {
    userId: userId || null,
    role: role || null,
    isAdmin:
      Boolean(userId) &&
      (isAdminLikeRole(role) ||
        isAdminByHeader ||
        (await isOwnerAdminIdentity({
          userId,
          email: signedSession?.email || undefined,
        }))),
  };
}
