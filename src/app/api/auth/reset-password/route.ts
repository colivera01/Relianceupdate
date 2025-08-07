import { NextRequest, NextResponse } from 'next/server';
import { validateResetToken, markTokenAsUsed } from '../forgot-password/route';

// Function to update user password (in production, this would update the database)
function updateUserPassword(email: string, newPassword: string) {
  // This would normally update the database
  // For now, we'll just log the password change
  console.log('Password updated for user:', email);
  console.log('New password:', newPassword);
  
  // In production, you would:
  // 1. Hash the new password
  // 2. Update the user record in the database
  // 3. Invalidate any existing sessions
  // 4. Log the password change for audit purposes
}

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

    // Update the user's password
    updateUserPassword(resetToken.email, password);

    // Mark the token as used
    markTokenAsUsed(token);

    console.log('Password reset successful for:', resetToken.email);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
} 