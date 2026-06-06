import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { createPasskeyRegistrationOptions } from "@/lib/auth-passkeys";

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

    const result = await createPasskeyRegistrationOptions({
      userId,
      request,
    });

    return NextResponse.json({
      challengeId: result.challengeId,
      options: result.options,
      email: result.authCredential.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating passkey registration options:", error);
    return NextResponse.json(
      {
        error:
          message === "PASSKEY_CREDENTIAL_NOT_FOUND"
            ? "A saved sign-in credential is required before adding a passkey."
            : "Failed to generate passkey registration options.",
        code: message,
      },
      { status: message === "PASSKEY_CREDENTIAL_NOT_FOUND" ? 403 : 500 }
    );
  }
}
