import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  storePasswordResetToken,
} from "@/lib/password-reset-tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

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

    const user = findUserByEmail(email);

    if (!user) {
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

    const resetToken = storePasswordResetToken(email);

    console.log("Password reset token generated for:", email);

    const resetLink = `${request.nextUrl.origin}/auth/reset-password?token=${resetToken}`;
    console.log("Password reset link (development only):", resetLink);

    return NextResponse.json({
      success: true,
      message:
        "If an account with that email exists, we have sent a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
