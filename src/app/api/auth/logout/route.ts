import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionCookieName, getAuthSessionCookieOptions } from "@/lib/auth-session";
import { getTrustedDeviceCookieName, getTrustedDeviceCookieOptions } from "@/lib/auth-mfa";

export async function POST(request: NextRequest) {
  try {
    console.log('Logout API called');

    // In a real implementation, you would:
    // 1. Invalidate the JWT token on the server
    // 2. Clear any server-side session data
    // 3. Log the logout event for audit purposes

    // For now, we'll just return success
    // TODO: Implement proper token invalidation when you have a database
    // await invalidateToken(token);
    // await logLogoutEvent(userId);

    console.log('User logged out successfully');

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    response.cookies.set(getAuthSessionCookieName(), "", {
      ...getAuthSessionCookieOptions(),
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
    response.cookies.set(getTrustedDeviceCookieName(), "", {
      ...getTrustedDeviceCookieOptions(),
      maxAge: 0,
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
} 
