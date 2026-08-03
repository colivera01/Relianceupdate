// import jwt from 'jsonwebtoken'; // Uncomment when ready to use real JWT
import { prisma } from "@/server/db";
import { registeredUsers, syncRegisteredUsersFromDisk } from "@/lib/dev-registered-users";
import { getAuthSessionClaimsFromRequest, verifyAuthBearerToken } from "@/lib/auth-session";
import { getVendorSessionTimeoutStatus, hasVendorAccessInSession } from "@/lib/vendor-security";
import { resolveRequestActor } from "@/lib/request-actor";

export interface JWTPayload {
  sub?: string;
  userId?: string;
  vendorId?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Decode JWT payload without signature verification.
 * NOTE: This is an interim parser for ID extraction only.
 * Replace with full signature verification before production hardening.
 */
export async function verifyJwt(token: string): Promise<JWTPayload> {
  if (!token) {
    throw new Error("Missing token");
  }

  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Invalid token");
  }

  try {
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payloadBase64.padEnd(
      payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4),
      "="
    );
    const payloadJson = Buffer.from(normalized, "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as JWTPayload;
    return payload;
  } catch {
    throw new Error("Invalid token");
  }
}

function getBearerTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function parseCookieHeader(request: Request): Record<string, string> {
  const raw = request.headers.get("cookie");
  if (!raw) return {};

  const cookies: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join("=") || "");
  }
  return cookies;
}

function getCookieCandidate(
  cookieMap: Record<string, string>,
  names: string[]
): string | null {
  for (const name of names) {
    const value = cookieMap[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

const IS_DEV = process.env.NODE_ENV !== "production";

async function isVendorSessionTimedOut(claims: ReturnType<typeof getAuthSessionClaimsFromRequest>): Promise<boolean> {
  if (!claims || !hasVendorAccessInSession(claims)) return false;
  try {
    const status = await getVendorSessionTimeoutStatus(claims);
    return status.expired;
  } catch (error) {
    console.error("[auth] vendor session timeout check failed", error);
    return false;
  }
}

async function resolveDevRegistryUserId(userId: string | null): Promise<string | null> {
  const normalized = typeof userId === "string" ? userId.trim() : "";
  if (!IS_DEV || !normalized) return normalized || null;

  syncRegisteredUsersFromDisk();
  const registryUser = registeredUsers.find((candidate) => String(candidate?.id || "").trim() === normalized);
  if (!registryUser?.email) return normalized;

  try {
    const dbUser = await prisma.user.findFirst({
      where: { email: String(registryUser.email).trim().toLowerCase() },
      select: { id: true },
    });
    return dbUser?.id ? String(dbUser.id) : normalized;
  } catch {
    return normalized;
  }
}

/**
 * Extract userId from request in this order:
 * 1) signed session cookie
 * 2) signed bearer token
 * 3) dev-only unsigned JWT compatibility
 * 4) dev-only cookie/session compatibility values
 * 5) dev-only x-user-id fallback
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  try {
    const actor = await resolveRequestActor(request);
    if (actor?.userId) return actor.userId;
  } catch {
    return null;
  }

  if (!IS_DEV) return null;

  const cookieMap = parseCookieHeader(request);
  const cookieUserId = getCookieCandidate(cookieMap, [
    "userId",
    "user_id",
    "uid",
    "session_user_id",
  ]);
  if (cookieUserId) return await resolveDevRegistryUserId(cookieUserId);

  const headerUserId = request.headers.get("x-user-id");
  if (IS_DEV && headerUserId && headerUserId.trim()) {
    return await resolveDevRegistryUserId(headerUserId.trim());
  }

  return null;
}

/**
 * Extract vendorId from request in this order:
 * 1) signed session / signed bearer context
 * 2) dev-only unsigned JWT compatibility
 * 3) dev-only cookie/session compatibility values
 * 4) dev-only x-vendor-id fallback
 */
export async function getVendorIdFromRequest(request: Request): Promise<string | null> {
  let actor = null;
  try {
    actor = await resolveRequestActor(request);
  } catch {
    return null;
  }
  if (!actor) return null;

  const signedSession = getAuthSessionClaimsFromRequest(request);
  if (await isVendorSessionTimedOut(signedSession)) return null;

  const memberships = actor.vendorMemberships;
  if (memberships.length === 1) return memberships[0].vendorId;

  if (!IS_DEV) return null;

  const cookieMap = parseCookieHeader(request);
  const cookieVendorId = getCookieCandidate(cookieMap, [
    "vendorId",
    "vendor_id",
    "vid",
    "session_vendor_id",
  ]);
  if (
    cookieVendorId &&
    memberships.some((membership) => membership.vendorId === cookieVendorId)
  ) {
    return cookieVendorId;
  }

  const headerVendorId = request.headers.get("x-vendor-id");
  if (
    headerVendorId &&
    memberships.some((membership) => membership.vendorId === headerVendorId.trim())
  ) {
    return headerVendorId.trim();
  }

  return null;
}
