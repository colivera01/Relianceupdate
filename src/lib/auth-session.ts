import crypto from "crypto";

const SESSION_COOKIE_NAME = "reliance_session";
const ADMIN_UI_SESSION_COOKIE_NAME = "reliance_admin_session";
const ADMIN_API_SESSION_COOKIE_NAME = "reliance_admin_api_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEV_SESSION_SECRET = "reliance-dev-session-secret-change-me";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface AuthSessionClaims {
  userId: string;
  email?: string | null;
  userType: "customer" | "vendor" | "admin" | "both";
  availableProfiles: string[];
  issuedAt: number;
  expiresAt: number;
  version: 1;
}

function resolveSessionSecret(): string {
  const configured = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (configured) return configured;
  if (!IS_PRODUCTION) return DEV_SESSION_SECRET;
  throw new Error("AUTH_SESSION_SECRET is required in production");
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function sign(payloadBase64Url: string): string {
  return toBase64Url(
    crypto.createHmac("sha256", resolveSessionSecret()).update(payloadBase64Url).digest()
  );
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const parsed: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) continue;
    parsed[name] = decodeURIComponent(rest.join("=") || "");
  }
  return parsed;
}

export function createAuthSessionCookie(
  claimsInput: Pick<AuthSessionClaims, "userId" | "email" | "userType" | "availableProfiles">
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: AuthSessionClaims = {
    userId: claimsInput.userId,
    email: claimsInput.email ?? null,
    userType: claimsInput.userType,
    availableProfiles: Array.from(new Set(claimsInput.availableProfiles.filter(Boolean))),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
    version: 1,
  };

  const payload = toBase64Url(JSON.stringify(claims));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function createAuthBearerToken(
  claimsInput: Pick<AuthSessionClaims, "userId" | "email" | "userType" | "availableProfiles">
): string {
  return createAuthSessionCookie(claimsInput);
}

export function verifyAuthSessionCookie(token: string | null | undefined): AuthSessionClaims | null {
  const normalized = String(token || "").trim();
  if (!normalized) return null;

  const [payload, signature] = normalized.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as AuthSessionClaims;
    if (!claims?.userId || !claims?.expiresAt || claims.version !== 1) return null;
    if (claims.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function verifyAuthBearerToken(token: string | null | undefined): AuthSessionClaims | null {
  return verifyAuthSessionCookie(token);
}

export function getAuthSessionClaimsFromRequest(request: Request): AuthSessionClaims | null {
  const cookieMap = parseCookieHeader(request.headers.get("cookie"));
  return verifyAuthSessionCookie(cookieMap[SESSION_COOKIE_NAME]);
}

export function getAdminAuthSessionClaimsFromRequest(request: Request): AuthSessionClaims | null {
  const cookieMap = parseCookieHeader(request.headers.get("cookie"));
  const pathname = new URL(request.url).pathname;
  const scopedCookieNames = pathname.startsWith("/api/admin")
    ? [ADMIN_API_SESSION_COOKIE_NAME, ADMIN_UI_SESSION_COOKIE_NAME]
    : [ADMIN_UI_SESSION_COOKIE_NAME, ADMIN_API_SESSION_COOKIE_NAME];

  for (const cookieName of scopedCookieNames) {
    const claims = verifyAuthSessionCookie(cookieMap[cookieName]);
    if (claims) return claims;
  }

  return verifyAuthSessionCookie(cookieMap[SESSION_COOKIE_NAME]);
}

export function getAuthSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getAdminUiSessionCookieName(): string {
  return ADMIN_UI_SESSION_COOKIE_NAME;
}

export function getAdminApiSessionCookieName(): string {
  return ADMIN_API_SESSION_COOKIE_NAME;
}

export function getAuthSessionCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: IS_PRODUCTION,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function getAdminUiSessionCookieOptions() {
  return {
    ...getAuthSessionCookieOptions(),
    path: "/admin",
  };
}

export function getAdminApiSessionCookieOptions() {
  return {
    ...getAuthSessionCookieOptions(),
    path: "/api/admin",
  };
}
