import { NextRequest, NextResponse } from 'next/server';
import {
  markTokenAsUsed,
  findAnyAuthUserByEmail,
  updateAnyAuthUserPassword,
  validateResetToken,
} from "@/lib/password-reset-tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    console.log('Password reset request with token');

    // Validate input
    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    if (!/[a-z]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one lowercase letter' },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter' },
        { status: 400 }
      );
    }

    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one number' },
        { status: 400 }
      );
    }

    // Validate the reset token
    const resetToken = validateResetToken(token);

    if (!resetToken) {
      console.log('Invalid or expired reset token');
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    console.log('Resetting password for user:', resetToken.email);

    const resetUser = await findAnyAuthUserByEmail(resetToken.email);
    if (!resetUser.exists) {
      return NextResponse.json(
        { error: 'Account not found for this reset link' },
        { status: 404 }
      );
    }

    const updated = await updateAnyAuthUserPassword(resetToken.email, password);
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Mark the token as used
    markTokenAsUsed(token);

    console.log('Password reset successful for:', resetToken.email);

    const response = NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });
    response.cookies.set("reliance_session", "", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 0,
    });
    response.cookies.set("userId", "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });
    response.cookies.set("session_user_id", "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });

    return response;

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
} 
