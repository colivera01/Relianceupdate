import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory storage for password reset tokens (in production, this would be a database)
let passwordResetTokens: any[] = [];

// Function to generate a secure reset token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Function to check if user exists (import from login route)
function findUserByEmail(email: string) {
  // This would normally query a database
  // For now, we'll use a simple check against our test user
  const testUsers = [
    {
      id: 'test-user-1',
      firstName: 'Cesar',
      lastName: 'Olivera',
      email: 'colivera080124@gmail.com',
      password: 'Co080124!',
      userType: 'customer',
    }
  ];
  
  return testUsers.find(user => user.email === email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    console.log('Password reset request for email:', email);

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = findUserByEmail(email);
    
    if (!user) {
      // For security reasons, don't reveal if email exists or not
      console.log('Password reset requested for non-existent email:', email);
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token (in production, store in database)
    passwordResetTokens.push({
      email,
      token: resetToken,
      expiresAt,
      used: false
    });

    console.log('Password reset token generated for:', email);

    // TODO: Send email with reset link
    // In production, you would:
    // 1. Send an email with the reset link
    // 2. Use a proper email service (SendGrid, AWS SES, etc.)
    // 3. Include the reset token in the email link
    
    // For development, we'll just log the reset link
    const resetLink = `${request.nextUrl.origin}/auth/reset-password?token=${resetToken}`;
    console.log('Password reset link (development only):', resetLink);

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

// Function to validate reset token (used by reset password endpoint)
export function validateResetToken(token: string): any {
  const resetToken = passwordResetTokens.find(rt => 
    rt.token === token && 
    rt.expiresAt > new Date() && 
    !rt.used
  );
  
  return resetToken;
}

// Function to mark token as used
export function markTokenAsUsed(token: string) {
  const resetToken = passwordResetTokens.find(rt => rt.token === token);
  if (resetToken) {
    resetToken.used = true;
  }
} 