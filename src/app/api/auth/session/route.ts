import { NextResponse } from "next/server";
import { getAuthSessionClaimsFromRequest, createAuthBearerToken } from "@/lib/auth-session";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";

export async function GET(request: Request) {
  try {
    const session = getAuthSessionClaimsFromRequest(request);
    if (!session?.userId || !session.email) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "No active session",
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

    return NextResponse.json({
      authenticated: true,
      user,
      token: createAuthBearerToken({
        userId: user.id,
        email: user.email,
        userType: user.userType,
        availableProfiles: user.availableProfiles,
      }),
    });
  } catch (error) {
    console.error("[auth/session] GET error", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to resolve active session",
      },
      { status: 500 }
    );
  }
}
