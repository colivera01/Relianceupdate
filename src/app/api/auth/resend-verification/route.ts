import { NextRequest, NextResponse } from "next/server";
import { findDbCredentialByEmail } from "@/lib/auth-credentials";
import { sendOrPreviewRateLimitedEmailVerification } from "@/lib/auth-email-verification";
import { sanitizeAuthNextPath } from "@/lib/auth-next";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const recipientName = String(body?.name || "").trim() || null;
    const nextPath = sanitizeAuthNextPath(body?.nextPath);

    if (!email) {
      return NextResponse.json(
        { error: "Email is required", code: "MISSING_EMAIL" },
        { status: 400 }
      );
    }

    const credential = await findDbCredentialByEmail(email).catch(() => null);
    if (!credential) {
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a verification link has been sent.",
      });
    }

    if (credential.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a verification link has been sent.",
      });
    }

    const sendResult = await sendOrPreviewRateLimitedEmailVerification({
      email,
      credentialId: credential.id,
      recipientName,
      baseUrl: request.nextUrl.origin,
      nextPath,
    });

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a verification link has been sent.",
      ...(process.env.NODE_ENV !== "production" && !sendResult.throttled
        ? {
            verificationLinkPreview: sendResult.verificationLink,
            verificationTokenPreview: sendResult.verificationTokenPreview,
          }
        : {}),
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email", code: "RESEND_VERIFICATION_EXCEPTION" },
      { status: 500 }
    );
  }
}
