import { NextRequest, NextResponse } from "next/server";
import {
  getAuthSessionClaimsFromRequest,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
  getAuthSessionTokenFromRequest,
  refreshAuthSessionCookie,
  verifyAuthSessionCookie,
} from "@/lib/auth-session";
import { getVendorSessionTimeoutStatus } from "@/lib/vendor-security";
import {
  authorizationErrorResponse,
  requireRequestActor,
} from "@/lib/request-actor";

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(getAuthSessionCookieName(), "", {
    ...getAuthSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set("userId", "", {
    path: "/",
    sameSite: "lax",
    maxAge: 0,
  });
  response.cookies.set("session_user_id", "", {
    path: "/",
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireRequestActor(request, { allowExpiredVendorSession: true });
    const session = getAuthSessionClaimsFromRequest(request)!;

    if (actor.vendorMemberships.length === 0) {
      return NextResponse.json({
        ok: true,
        applies: false,
        message: "This session is not using vendor access.",
      });
    }

    if (session.version === 1 || !session.lastActivityAt) {
      return renewVendorSession(request, actor.vendorMemberships.length);
    }

    const status = await getVendorSessionTimeoutStatus(session);
    if (status.expired) {
      const response = NextResponse.json(
        {
          ok: false,
          code: "VENDOR_SESSION_TIMEOUT",
          message: "Your vendor session timed out. Sign in again to continue.",
          timeoutMinutes: status.timeoutMinutes,
          expiresAt: status.expiresAtMs ? new Date(status.expiresAtMs).toISOString() : null,
        },
        { status: 401 }
      );
      clearAuthCookies(response);
      return response;
    }

    return NextResponse.json({
      ok: true,
      applies: status.applies,
      timeoutMinutes: status.timeoutMinutes,
      expiresAt: status.expiresAtMs ? new Date(status.expiresAtMs).toISOString() : null,
      idleExpiresAt: status.idleExpiresAtMs ? new Date(status.idleExpiresAtMs).toISOString() : null,
      absoluteExpiresAt: status.absoluteExpiresAtMs ? new Date(status.absoluteExpiresAtMs).toISOString() : null,
      warningAt: status.warningAtMs ? new Date(status.warningAtMs).toISOString() : null,
      nextCheckInMs: status.expiresAtMs
        ? Math.max(15_000, Math.min(60_000, status.expiresAtMs - Date.now()))
        : 60_000,
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse as NextResponse;
    console.error("[vendor/session-guard] GET error", error);
    return NextResponse.json(
      {
        ok: false,
        code: "VENDOR_SESSION_GUARD_ERROR",
        message: "Reliance could not confirm the active vendor session.",
      },
      { status: 500 }
    );
  }
}

async function renewVendorSession(request: NextRequest, membershipCount?: number) {
  const actor = membershipCount == null
    ? await requireRequestActor(request, { allowExpiredVendorSession: true })
    : null;
  const effectiveMembershipCount = membershipCount ?? actor?.vendorMemberships.length ?? 0;
  if (effectiveMembershipCount === 0) {
    return NextResponse.json({ ok: true, applies: false, message: "This session is not using vendor access." });
  }

  const currentClaims = getAuthSessionClaimsFromRequest(request);
  const currentStatus = await getVendorSessionTimeoutStatus(currentClaims);
  const isLegacySession = currentClaims?.version === 1 || !currentClaims?.lastActivityAt;
  if (!isLegacySession && currentStatus.expired) {
    const response = NextResponse.json(
      { ok: false, code: "VENDOR_SESSION_TIMEOUT", message: "Your vendor session timed out due to inactivity. Sign in again to continue." },
      { status: 401 }
    );
    clearAuthCookies(response);
    return response;
  }

  const currentToken = getAuthSessionTokenFromRequest(request);
  const refreshedToken = refreshAuthSessionCookie(currentToken);
  const refreshedClaims = verifyAuthSessionCookie(refreshedToken);
  if (!refreshedToken || !refreshedClaims) {
    const response = NextResponse.json(
      { ok: false, code: "VENDOR_SESSION_TIMEOUT", message: "Your vendor session expired. Sign in again to continue." },
      { status: 401 }
    );
    clearAuthCookies(response);
    return response;
  }

  const status = await getVendorSessionTimeoutStatus(refreshedClaims);
  const response = NextResponse.json({
    ok: true,
    applies: status.applies,
    renewed: true,
    timeoutMinutes: status.timeoutMinutes,
    expiresAt: status.expiresAtMs ? new Date(status.expiresAtMs).toISOString() : null,
    idleExpiresAt: status.idleExpiresAtMs ? new Date(status.idleExpiresAtMs).toISOString() : null,
    absoluteExpiresAt: status.absoluteExpiresAtMs ? new Date(status.absoluteExpiresAtMs).toISOString() : null,
    warningAt: status.warningAtMs ? new Date(status.warningAtMs).toISOString() : null,
    nextCheckInMs: status.warningAtMs
      ? Math.max(15_000, Math.min(60_000, status.warningAtMs - Date.now()))
      : 60_000,
  });
  response.cookies.set(getAuthSessionCookieName(), refreshedToken, {
    ...getAuthSessionCookieOptions(),
    maxAge: Math.max(0, refreshedClaims.expiresAt - Math.floor(Date.now() / 1000)),
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    return await renewVendorSession(request);
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse as NextResponse;
    console.error("[vendor/session-guard] POST error", error);
    return NextResponse.json(
      { ok: false, code: "VENDOR_SESSION_GUARD_ERROR", message: "Reliance could not renew the active vendor session." },
      { status: 500 }
    );
  }
}
