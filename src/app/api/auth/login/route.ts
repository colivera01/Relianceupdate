import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for registered users (in production, this would be a database)
// This is just for development - replace with actual database queries
export let registeredUsers: any[] = [
  // Test user for development
  {
    id: 'test-user-1',
    firstName: 'Cesar',
    lastName: 'Olivera',
    email: 'colivera080124@gmail.com',
    password: 'Co080124!',
    userType: 'customer',
    address: '407 Boxwood Circle',
    city: 'Winter Springs',
    state: 'Florida',
    zipCode: '32824',
    bio: 'test test',
    createdAt: new Date().toISOString(),
    isActive: true,
  }
];

// Function to add a user to our storage (called from registration)
export function addRegisteredUser(userData: any) {
  registeredUsers.push(userData);
  console.log('User added to storage:', { ...userData, password: '[HIDDEN]' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('Login attempt for email:', email);

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user in our storage
    const user = registeredUsers.find(u => u.email === email);

    if (!user) {
      console.log('User not found:', email);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check password (in production, you'd hash and compare)
    if (user.password !== password) {
      console.log('Invalid password for user:', email);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log('Login successful for user:', email);

    // Return user data (without password)
    const userResponse = {
      id: user.id || 'temp-id',
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      userType: user.userType || 'customer',
      avatar: user.avatar || `https://randomuser.me/api/portraits/${user.userType === 'vendor' ? 'men' : 'women'}/44.jpg`,
    };

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      token: 'temp-jwt-token', // In production, generate actual JWT
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
} 