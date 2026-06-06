import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { verifyAndStorePasskeyRegistration, shapePasskeySummary } from "@/lib/auth-passkeys";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: "You must be signed in to register a passkey.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const challengeId = String(body?.challengeId || "").trim();
    const response = body?.response as RegistrationResponseJSON | undefined;

    if (!challengeId || !response?.id) {
      return NextResponse.json(
        {
          error: "Passkey registration data was incomplete.",
          code: "PASSKEY_REGISTRATION_PAYLOAD_INVALID",
        },
        { status: 400 }
      );
    }

    const result = await verifyAndStorePasskeyRegistration({
      userId,
      challengeId,
      response,
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Passkey registered successfully.",
      passkey: shapePasskeySummary(result.passkey),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error registering passkey:", error);
    return NextResponse.json(
      {
        error:
          message === "PASSKEY_CHALLENGE_INVALID"
            ? "The passkey registration request expired. Start again."
            : message === "PASSKEY_REGISTRATION_FAILED"
              ? "Passkey registration could not be verified."
              : "Failed to register passkey.",
        code: message,
      },
      {
        status:
          message === "PASSKEY_CHALLENGE_INVALID" || message === "PASSKEY_REGISTRATION_FAILED"
            ? 400
            : 500,
      }
    );
  }
}
