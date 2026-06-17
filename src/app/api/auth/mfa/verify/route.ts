import { NextRequest, NextResponse } from "next/server";
import {
  getTrustedDeviceCookieName,
  getTrustedDeviceCookieOptions,
  issueTrustedDevice,
  verifyLoginMfaChallenge,
} from "@/lib/auth-mfa";
import { findDbCredentialByUserId } from "@/lib/auth-credentials";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { buildSuccessfulLoginResponse } from "@/lib/auth-login-response";

const IS_DEV = process.env.NODE_ENV !== "production";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body?.challengeId || "").trim();
    const code = String(body?.code || "").trim();
    const rememberDevice = body?.rememberDevice === true;

    if (!challengeId || !code) {
      return NextResponse.json(
        {
          error: "challengeId and code are required",
          code: "MFA_FIELDS_REQUIRED",
        },
        { status: 400 }
      );
    }

    const result = await verifyLoginMfaChallenge({ challengeId, code });
    if (!result.ok) {
      const status =
        result.reason === "missing_fields" ? 400 :
        result.reason === "not_found" ? 404 :
        400;
      return NextResponse.json(
        {
          error:
            result.reason === "invalid_code"
              ? "The sign-in code is incorrect."
              : result.reason === "expired"
              ? "The sign-in code has expired."
              : result.reason === "already_used"
              ? "This sign-in code has already been used."
              : "The sign-in challenge is invalid.",
          code: "MFA_VERIFICATION_FAILED",
          reason: result.reason,
        },
        { status }
      );
    }

    let credential = null;
    try {
      credential = await findDbCredentialByUserId(result.userId);
    } catch (error) {
      if (!IS_DEV) {
        throw error;
      }
      console.warn("MFA verify credential lookup fell back to local dev user snapshot:", error);
    }

    if (!credential && !result.userSnapshot) {
      return NextResponse.json(
        {
          error: "Credential not found for MFA challenge user",
          code: "MFA_CREDENTIAL_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const user =
      result.userSnapshot && !credential
        ? result.userSnapshot
        : await buildAuthLoginUserPayload({
            userId: result.userId,
            email: credential!.email,
            emailVerifiedAt: credential!.emailVerifiedAt,
          });

    const response = await buildSuccessfulLoginResponse({ user, request });

    if (rememberDevice && credential) {
      const trustedDevice = await issueTrustedDevice({
        credentialId: credential.id,
        userId: credential.userId,
        label: "Remembered login device",
      });
      response.cookies.set(
        getTrustedDeviceCookieName(),
        trustedDevice.rawToken,
        getTrustedDeviceCookieOptions()
      );
    }

    return response;
  } catch (error) {
    console.error("MFA verify error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify sign-in code",
        code: "MFA_VERIFY_EXCEPTION",
      },
      { status: 500 }
    );
  }
}
