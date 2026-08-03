import { NextRequest, NextResponse } from "next/server";
import { getAuthSessionClaimsFromRequest, getAuthSessionCookieName, getAuthSessionCookieOptions } from "@/lib/auth-session";
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
    const actor = await requireRequestActor(request);
    const session = getAuthSessionClaimsFromRequest(request)!;

    if (actor.vendorMemberships.length === 0) {
      return NextResponse.json({
        ok: true,
        applies: false,
        message: "This session is not using vendor access.",
      });
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
