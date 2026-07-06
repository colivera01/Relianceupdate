import { NextRequest, NextResponse } from "next/server";
import {
  findAnyAuthUserByEmail,
  storePasswordResetToken,
} from "@/lib/password-reset-tokens";
import { appendAuthNext, sanitizeAuthNextPath } from "@/lib/auth-next";
import { sendEmail } from "@/lib/email/resend";
import {
  buildRelianceEmailHtml,
  getPublicEmailBaseUrl,
} from "@/lib/email/reliance-template";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    const safeNextPath = sanitizeAuthNextPath(
      typeof body?.next === "string" ? body.next : null
    );

    console.log("Password reset request for email:", email);

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const user = await findAnyAuthUserByEmail(email);

    const isDev = process.env.NODE_ENV !== "production";

    if (!user.exists) {
      console.log(
        "Password reset requested for non-existent email:",
        email
      );
      return NextResponse.json({
        success: true,
        message:
          "If an account with that email exists, we have sent a password reset link.",
      });
    }

    const resetToken = await storePasswordResetToken(email);

    console.log("Password reset token generated for:", email);

    const resetPath = appendAuthNext(`/auth/reset-password?token=${resetToken}`, safeNextPath);
    const publicBaseUrl = getPublicEmailBaseUrl(request.nextUrl.origin);
    const resetLink = `${publicBaseUrl}${resetPath}`;
    if (isDev) {
      console.log("Password reset link (development only):", resetLink);
    }

    const html = buildRelianceEmailHtml({
      eyebrow: "Password reset",
      headline: "Reset your Reliance password",
      greeting: "Hi there,",
      bodyHtml: `
        <p style="margin:0 0 14px;">We received a request to reset the password for this Reliance account.</p>
        <p style="margin:0;">Use the secure button below to choose a new password and return to Reliance.</p>
      `,
      cta: { label: "Reset Password", href: resetLink },
      secondaryHtml: `
        <p style="margin:0 0 8px;color:#ffffff;font-weight:800;">Link expiration</p>
        <p style="margin:0;">This reset link expires in 1 hour. If you did not request it, you can ignore this email.</p>
      `,
      fallbackHref: resetLink,
      footerNote: `This password reset was requested for ${email}.`,
      baseUrl: publicBaseUrl,
    });
    const text = [
      "Password reset",
      "",
      "We received a request to reset the password for this Reliance account.",
      "",
      "Reset your password:",
      resetLink,
      "",
      "This reset link expires in 1 hour. If you did not request it, you can ignore this email.",
    ].join("\n");

    const sendResult = await sendEmail({
      to: email,
      subject: "Reset your Reliance password",
      html,
      text,
    });

    if (!sendResult.ok) {
      console.error("Password reset email send failed:", sendResult.errorMessage);
      return NextResponse.json(
        {
          error: "Password reset email could not be sent right now. Please try again in a moment.",
          code: "PASSWORD_RESET_EMAIL_FAILED",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      emailDeliveryQueued: sendResult.ok,
      message:
        "If an account with that email exists, we have sent a password reset link.",
      ...(isDev
        ? {
            resetLinkPreview: resetLink,
            resetTokenPreview: resetToken,
          }
        : {}),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
