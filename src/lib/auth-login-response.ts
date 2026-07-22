import { NextResponse } from "next/server";
import {
  createAuthBearerToken,
  createAuthSessionCookie,
  getAdminApiSessionCookieName,
  getAdminApiSessionCookieOptions,
  getAdminUiSessionCookieName,
  getAdminUiSessionCookieOptions,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
} from "@/lib/auth-session";
import { isOwnerAdminUserId } from "@/lib/internal-identities";
import { sendVendorLoginAlert } from "@/lib/vendor-security";

export type AuthLoginUserPayload = {
  id: string;
  name: string;
  email: string;
  userType: "customer" | "vendor" | "admin" | "both";
  availableProfiles: string[];
  avatar?: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
};

export async function buildSuccessfulLoginResponse(params: {
  user: AuthLoginUserPayload;
  devWarning?: string;
  request?: Request;
}) {
  const response = NextResponse.json({
    success: true,
    message: "Login successful",
    user: params.user,
    emailVerificationRequired: !params.user.emailVerified,
    token: createAuthBearerToken({
      userId: params.user.id,
      email: params.user.email,
      userType: params.user.userType,
      availableProfiles: params.user.availableProfiles,
    }),
    ...(params.devWarning ? { devWarning: params.devWarning } : {}),
  });

  const sessionCookie = createAuthSessionCookie({
    userId: params.user.id,
    email: params.user.email,
    userType: params.user.userType,
    availableProfiles: params.user.availableProfiles,
  });
  const isAdminSession =
    params.user.userType === "admin" ||
    params.user.availableProfiles.includes("admin") ||
    isOwnerAdminUserId(params.user.id);

  if (isAdminSession) {
    response.cookies.set(
      getAdminUiSessionCookieName(),
      sessionCookie,
      getAdminUiSessionCookieOptions()
    );
    response.cookies.set(
      getAdminApiSessionCookieName(),
      sessionCookie,
      getAdminApiSessionCookieOptions()
    );
  } else {
    response.cookies.set(
      getAuthSessionCookieName(),
      sessionCookie,
      getAuthSessionCookieOptions()
    );
    response.cookies.set("userId", params.user.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
    response.cookies.set("session_user_id", params.user.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  }

  if (params.request) {
    try {
      await sendVendorLoginAlert({ user: params.user, request: params.request });
    } catch (error) {
      console.error("[auth-login-response] vendor login alert failed", error);
    }
  }

  return response;
}
