import { NextResponse } from "next/server";
import {
  createAuthBearerToken,
  createAuthSessionCookie,
  getAdminAuthSessionClaimsFromRequest,
  getAdminApiSessionCookieName,
  getAdminApiSessionCookieOptions,
  getAdminUiSessionCookieName,
  getAdminUiSessionCookieOptions,
} from "@/lib/auth-session";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { isOwnerAdminUserId } from "@/lib/internal-identities";

export async function GET(request: Request) {
  try {
    const session = getAdminAuthSessionClaimsFromRequest(request);
    const hasAdminProfile =
      session?.userType === "admin" ||
      session?.availableProfiles?.includes("admin") ||
      isOwnerAdminUserId(session?.userId);

    if (!session?.userId || !session.email || !hasAdminProfile) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "No active admin session",
        },
        { status: 401 }
      );
    }

    const credential = await findDbCredentialByUserId(session.userId).catch(() => null);
    const user = await buildAuthLoginUserPayload({
      userId: session.userId,
      email: session.email,
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
