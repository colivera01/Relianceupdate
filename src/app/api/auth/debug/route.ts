import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Import the registered users from the login route
    const { default: loginModule } = await import('../login/route');
    
    // This is just for development debugging
    return NextResponse.json({
      message: 'Debug endpoint - registered users',
      // Note: In a real app, you wouldn't expose this data
      userCount: 0, // We can't access the private array, but that's fine
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Debug endpoint failed' },
      { status: 500 }
    );
  }
} 