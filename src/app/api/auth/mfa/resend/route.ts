import { NextRequest, NextResponse } from "next/server";
import { resendLoginMfaChallenge } from "@/lib/auth-mfa";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId = String(body?.challengeId || "").trim();

    if (!challengeId) {
      return NextResponse.json(
        {
          error: "challengeId is required",
          code: "MFA_CHALLENGE_REQUIRED",
        },
        { status: 400 }
      );
    }

    const resent = await resendLoginMfaChallenge({
      challengeId,
      baseUrl: request.nextUrl.origin,
    });

    if (!resent.ok) {
      const status =
        resent.reason === "not_found" ? 404 :
        400;
      return NextResponse.json(
        {
          error:
            resent.reason === "already_used"
              ? "This sign-in challenge has already been completed."
              : resent.reason === "expired"
              ? "This sign-in challenge has expired. Start over."
              : "This sign-in challenge is invalid.",
          code: "MFA_RESEND_FAILED",
          reason: resent.reason,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "A new sign-in code was sent to your email.",
      challengeId: resent.challengeId,
    });
  } catch (error) {
    console.error("MFA resend error:", error);
    return NextResponse.json(
      {
        error: "Failed to resend sign-in code",
        code: "MFA_RESEND_EXCEPTION",
      },
      { status: 500 }
    );
  }
}
