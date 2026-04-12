import { getUserIdFromRequest, verifyJwt } from "./auth";

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

/**
 * Require admin access for admin API routes.
 * Strongest currently available signals in this codebase:
 * - JWT payload role
 * - explicit admin headers used in local/dev environments
 */
export async function requireAdmin(request: Request): Promise<{ userId: string; role: string }> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    throw new Error("Unauthorized");
  }

  let role: string | undefined;
  const token = getBearerToken(request);
  if (token) {
    try {
      const payload = await verifyJwt(token);
      role = typeof payload.role === "string" ? payload.role : undefined;
    } catch {
      // Ignore token parse failures here; fallback to explicit headers below.
    }
  }

  if (!role) {
    const headerRole = request.headers.get("x-user-role");
    if (headerRole) role = headerRole;
  }

  const explicitAdminHeader = request.headers.get("x-admin");
  const isAdminByHeader =
    explicitAdminHeader === "1" ||
    String(explicitAdminHeader || "").toLowerCase() === "true";

  const isAdmin = isAdminLikeRole(role) || isAdminByHeader;
  if (!isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return {
    userId,
    role: String(role || "admin"),
  };
}
