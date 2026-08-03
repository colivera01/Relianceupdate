import { resolveRequestActor } from "@/lib/request-actor";

/**
 * Require admin access for admin API routes.
 * The admin-scoped signed session identifies the candidate user. Current
 * database account state and an ACTIVE ADMIN platform grant authorize access.
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
  try {
    const actor = await resolveRequestActor(request, { adminScope: true });
    const isAdmin = Boolean(actor?.platformRoles.includes("ADMIN"));
    return {
      userId: actor?.userId || null,
      role: isAdmin ? "admin" : null,
      isAdmin,
    };
  } catch {
    return { userId: null, role: null, isAdmin: false };
  }
}
