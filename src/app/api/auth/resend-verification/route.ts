import { NextRequest, NextResponse } from "next/server";
import { findDbCredentialByEmail } from "@/lib/auth-credentials";
import { sendOrPreviewEmailVerification } from "@/lib/auth-email-verification";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const recipientName = String(body?.name || "").trim() || null;

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
        message: "Email is already verified.",
        alreadyVerified: true,
      });
    }

    const sendResult = await sendOrPreviewEmailVerification({
      email,
      credentialId: credential.id,
      recipientName,
      baseUrl: request.nextUrl.origin,
    });

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a verification link has been sent.",
      emailDeliveryQueued: sendResult.sendResult.ok,
      ...(process.env.NODE_ENV !== "production"
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
