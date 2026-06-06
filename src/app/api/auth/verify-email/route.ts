import { NextRequest, NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/auth-email-verification";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required", code: "MISSING_VERIFICATION_TOKEN" },
        { status: 400 }
      );
    }

    const result = await consumeEmailVerificationToken(token);
    if (!result.ok) {
      const status = result.reason === "expired" || result.reason === "already_used" ? 400 : 404;
      return NextResponse.json(
        {
          error:
            result.reason === "expired"
              ? "Verification link has expired"
              : result.reason === "already_used"
              ? "Verification link has already been used"
              : "Verification link is invalid",
          code: "EMAIL_VERIFICATION_FAILED",
          reason: result.reason,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      email: result.credential.email,
      verifiedAt: result.credential.emailVerifiedAt?.toISOString?.() ?? null,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email", code: "EMAIL_VERIFICATION_EXCEPTION" },
      { status: 500 }
    );
  }
}
