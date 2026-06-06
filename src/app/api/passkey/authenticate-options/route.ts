import { NextRequest, NextResponse } from "next/server";
import { createPasskeyAuthenticationOptions } from "@/lib/auth-passkeys";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        {
          error: "Email is required to look up passkeys for sign-in.",
          code: "PASSKEY_EMAIL_REQUIRED",
        },
        { status: 400 }
      );
    }

    const result = await createPasskeyAuthenticationOptions({
      email,
      request,
    });

    if (!result) {
      return NextResponse.json(
        {
          error: "No passkey is available for that account.",
          code: "PASSKEY_NOT_AVAILABLE",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      challengeId: result.challengeId,
      options: result.options,
      email: result.authCredential.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating passkey authentication options:", error);
    return NextResponse.json(
      {
        error: "Failed to generate passkey sign-in options.",
        code: message,
      },
      { status: 500 }
    );
  }
}
