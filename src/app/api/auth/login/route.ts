import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for registered users (in production, this would be a database)
// This is just for development - replace with actual database queries
export let registeredUsers: any[] = [
  // Test customer user for development
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
  },
  // Test vendor user for development
  {
    id: 'test-vendor-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@sparkleclean.com',
    password: 'vendor123!',
    userType: 'vendor',
    address: '123 Business Ave',
    city: 'Orlando',
    state: 'Florida',
    zipCode: '32801',
    bio: 'Professional cleaning services',
    businessName: 'Sparkle Clean Pro',
    businessType: 'Cleaning Services',
    category: 'Home Cleaners',
    businessBio: 'Professional cleaning services for homes and offices',
    foundedYear: '2020',
    licenseNumber: 'FL-CLEAN-12345',
    insuranceStatus: 'Insured',
    bondingStatus: 'Bonded',
    totalEmployees: '5',
    yearsInBusiness: '4',
    serviceTypes: 'Residential Cleaning, Commercial Cleaning, Deep Cleaning',
    specializations: 'Eco-friendly cleaning, Move-in/out cleaning, Post-construction cleaning',
    serviceAreas: 'Orlando, Winter Park, Maitland, Winter Springs',
    website: 'https://sparklecleanpro.com',
    emergencyContact: '407-555-0123',
    responseTime: '2 hours',
    profileImage: '',
    isActive: true,
    isVerified: true,
    isApproved: true,
    approvalStatus: 'Approved',
    rating: 4.8,
    totalReviews: 127,
    totalBookings: 89,
    totalEarnings: 15420,
    createdAt: new Date().toISOString(),
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

    // Determine available profiles for this user
    let availableProfiles: string[] = [];
    
    // Check if user is a vendor
    if (user.userType === 'vendor' || user.businessName || user.category || user.serviceTypes) {
      availableProfiles.push('vendor');
    }
    
    // Check if user is a customer
    if (user.userType === 'customer' || !user.businessName) {
      availableProfiles.push('customer');
    }
    
    // If user has both profiles, set userType to 'both'
    if (availableProfiles.length > 1) {
      user.userType = 'both';
    } else if (availableProfiles.length === 1) {
      user.userType = availableProfiles[0];
    }

    // Return user data (without password)
    const userResponse = {
      id: user.id || 'temp-id',
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      userType: user.userType || 'customer',
      availableProfiles,
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