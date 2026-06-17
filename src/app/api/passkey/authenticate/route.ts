import { NextRequest, NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyPasskeyAuthentication } from "@/lib/auth-passkeys";
import { buildAuthLoginUserPayload } from "@/lib/auth-login-user";
import { buildSuccessfulLoginResponse } from "@/lib/auth-login-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const challengeId = String(body?.challengeId || "").trim();
    const response = body?.response as AuthenticationResponseJSON | undefined;

    if (!email || !challengeId || !response?.id) {
      return NextResponse.json(
        {
          error: "Passkey sign-in data was incomplete.",
          code: "PASSKEY_AUTH_PAYLOAD_INVALID",
        },
        { status: 400 }
      );
    }

    const result = await verifyPasskeyAuthentication({
      email,
      challengeId,
      response,
      request,
    });

    const user = await buildAuthLoginUserPayload({
      userId: result.authCredential.userId,
      email: result.authCredential.email,
      fallbackName: result.authCredential.user?.name || result.authCredential.email,
      emailVerifiedAt: result.authCredential.emailVerifiedAt,
    });

    return await buildSuccessfulLoginResponse({ user, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error completing passkey sign-in:", error);
    return NextResponse.json(
      {
        error:
          message === "PASSKEY_CHALLENGE_INVALID"
            ? "The passkey sign-in request expired. Start again."
            : message === "PASSKEY_NOT_REGISTERED" || message === "PASSKEY_AUTH_CREDENTIAL_NOT_FOUND"
              ? "No matching passkey was found for that account."
              : message === "PASSKEY_AUTHENTICATION_FAILED"
                ? "Passkey sign-in could not be verified."
                : "Failed to complete passkey sign-in.",
        code: message,
      },
      {
        status:
          message === "PASSKEY_CHALLENGE_INVALID" ||
          message === "PASSKEY_NOT_REGISTERED" ||
          message === "PASSKEY_AUTH_CREDENTIAL_NOT_FOUND" ||
          message === "PASSKEY_AUTHENTICATION_FAILED"
            ? 400
            : 500,
      }
    );
  }
}
