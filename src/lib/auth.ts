// import jwt from 'jsonwebtoken'; // Uncomment when ready to use real JWT

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

/**
 * Extract userId from request in this order:
 * 1) JWT bearer token payload
 * 2) cookie/session values
 * 3) temporary fallback header x-user-id
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const bearerToken = getBearerTokenFromRequest(request);
  if (bearerToken) {
    try {
      const payload = await verifyJwt(bearerToken);
      const jwtUserId = (payload.userId || payload.sub) as string | undefined;
      if (jwtUserId) return jwtUserId;
    } catch {
      // Fall through to cookie/header extraction for compatibility.
    }
  }

  const cookieMap = parseCookieHeader(request);
  const cookieUserId = getCookieCandidate(cookieMap, [
    "userId",
    "user_id",
    "uid",
    "session_user_id",
  ]);
  if (cookieUserId) return cookieUserId;

  const headerUserId = request.headers.get("x-user-id");
  if (headerUserId && headerUserId.trim()) return headerUserId.trim();

  return null;
}

/**
 * Extract vendorId from request in this order:
 * 1) JWT bearer token payload
 * 2) cookie/session values
 * 3) temporary fallback header x-vendor-id
 */
export async function getVendorIdFromRequest(request: Request): Promise<string | null> {
  const bearerToken = getBearerTokenFromRequest(request);
  if (bearerToken) {
    try {
      const payload = await verifyJwt(bearerToken);
      const jwtVendorId = payload.vendorId as string | undefined;
      if (jwtVendorId) return jwtVendorId;
    } catch {
      // Fall through to cookie/header extraction for compatibility.
    }
  }

  const cookieMap = parseCookieHeader(request);
  const cookieVendorId = getCookieCandidate(cookieMap, [
    "vendorId",
    "vendor_id",
    "vid",
    "session_vendor_id",
  ]);
  if (cookieVendorId) return cookieVendorId;

  const headerVendorId = request.headers.get("x-vendor-id");
  if (headerVendorId && headerVendorId.trim()) return headerVendorId.trim();

  return null;
}
