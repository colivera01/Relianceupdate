import { createOpaqueSecret, hashOpaqueSecret } from "./token";

export const PERMISSION_DECISION_COOKIE = "reliance_permission_decision";
export const PERMISSION_DECISION_SESSION_TTL_MINUTES = 20;

export function createPermissionDecisionSessionSecret() {
  const secret = createOpaqueSecret();
  return { secret, secretHash: hashOpaqueSecret(secret) };
}

export function readPermissionDecisionCookie(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PERMISSION_DECISION_COOKIE)
      return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function permissionDecisionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/consent",
    maxAge: PERMISSION_DECISION_SESSION_TTL_MINUTES * 60,
  };
}
