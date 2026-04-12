import { NextRequest, NextResponse } from 'next/server';
import { validateResetToken } from "@/lib/password-reset-tokens";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    console.log('Validating reset token:', token);

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
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

    console.log('Reset token is valid for email:', resetToken.email);

    return NextResponse.json({
      success: true,
      message: 'Reset token is valid',
      email: resetToken.email
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate reset token' },
      { status: 500 }
    );
  }
} 