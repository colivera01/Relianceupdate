import { NextResponse } from "next/server";
import {
  createAuthBearerToken,
  createAuthSessionCookie,
  getAdminApiSessionCookieName,
  getAdminApiSessionCookieOptions,
  getAdminUiSessionCookieName,
  getAdminUiSessionCookieOptions,
} from "@/lib/auth-session";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { requirePlatformRole } from "@/lib/request-actor";

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformRole(request, "ADMIN");
    if (!actor.email) {
      return NextResponse.json({ authenticated: false, error: "No active admin session" }, { status: 401 });
    }

    const credential = await findDbCredentialByUserId(actor.userId).catch(() => null);
    const user = await buildAuthLoginUserPayload({
      userId: actor.userId,
      email: actor.email,
      emailVerifiedAt: credential?.emailVerifiedAt ?? null,
    });

    const response = NextResponse.json({
      authenticated: true,
      user,
      token: createAuthBearerToken({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        availableProfiles: user.availableProfiles,
      }),
    });
    const refreshedSessionCookie = createAuthSessionCookie({
      userId: user.id,
      email: user.email,
      userType: user.userType,
      availableProfiles: user.availableProfiles,
    });
    response.cookies.set(
      getAdminUiSessionCookieName(),
      refreshedSessionCookie,
      getAdminUiSessionCookieOptions()
    );
    response.cookies.set(
      getAdminApiSessionCookieName(),
      refreshedSessionCookie,
      getAdminApiSessionCookieOptions()
    );
    return response;
  } catch (error) {
    console.error("[admin/session] GET error", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to resolve active admin session",
      },
      { status: 500 }
    );
  }
}
