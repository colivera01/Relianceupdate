import { NextRequest, NextResponse } from 'next/server';
import { registeredUsers } from "@/lib/dev-registered-users";

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // For development, accept any token
    // In production, validate the JWT token
    if (token !== 'temp-jwt-token') {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Find the customer user (first customer in the array)
    const customerUser = registeredUsers.find(user => user.userType === 'customer');
    
    if (!customerUser) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    // Return customer profile data
    const profileData = {
      // Personal information
      firstName: customerUser.firstName,
      lastName: customerUser.lastName,
      email: customerUser.email,
      phone: customerUser.phone,
      address: customerUser.address,
      city: customerUser.city,
      state: customerUser.state,
      zipCode: customerUser.zipCode,
      bio: customerUser.bio,
      
      // Account information
      userType: customerUser.userType,
      createdAt: customerUser.createdAt,
      isActive: customerUser.isActive,
      
      // Preferences
      preferences: customerUser.preferences || {
        notifications: true,
        emailMarketing: false,
      },
      
      // User activity
      favorites: customerUser.favorites || [],
      bookingHistory: customerUser.bookingHistory || [],
      reviews: customerUser.reviews || [],
    };

    return NextResponse.json({
      success: true,
      profile: profileData
    });

  } catch (error) {
    console.error('Error fetching customer profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // For development, accept any token
    if (token !== 'temp-jwt-token') {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Find the customer user index
    const customerIndex = registeredUsers.findIndex(user => user.userType === 'customer');
    
    if (customerIndex === -1) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    // Update the customer's data
    registeredUsers[customerIndex] = {
      ...registeredUsers[customerIndex],
      ...body
    };

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: registeredUsers[customerIndex]
    });

  } catch (error) {
    console.error('Error updating customer profile:', error);
    return NextResponse.json(
      { error: 'Failed to update customer profile' },
      { status: 500 }
    );
  }
} 