import { NextRequest, NextResponse } from 'next/server';
import { registeredUsers } from '../../auth/login/route';

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

    // Find the vendor user (first vendor in the array)
    const vendorUser = registeredUsers.find(user => user.userType === 'vendor');
    
    if (!vendorUser) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Return vendor profile data
    const profileData = {
      // Personal information
      firstName: vendorUser.firstName,
      lastName: vendorUser.lastName,
      email: vendorUser.email,
      phone: vendorUser.phone,
      address: vendorUser.address,
      city: vendorUser.city,
      state: vendorUser.state,
      zipCode: vendorUser.zipCode,
      bio: vendorUser.bio,
      
      // Business information
      businessName: vendorUser.businessName,
      businessType: vendorUser.businessType,
      category: vendorUser.category,
      businessBio: vendorUser.businessBio,
      foundedYear: vendorUser.foundedYear,
      licenseNumber: vendorUser.licenseNumber,
      insuranceStatus: vendorUser.insuranceStatus,
      bondingStatus: vendorUser.bondingStatus,
      totalEmployees: vendorUser.totalEmployees,
      yearsInBusiness: vendorUser.yearsInBusiness,
      
      // Services and specializations
      serviceTypes: vendorUser.serviceTypes,
      specializations: vendorUser.specializations,
      serviceAreas: vendorUser.serviceAreas,
      
      // Contact and website
      website: vendorUser.website,
      emergencyContact: vendorUser.emergencyContact,
      responseTime: vendorUser.responseTime,
      
      // Profile image
      profileImage: vendorUser.profileImage || vendorUser.profilePhoto || '',
      
      // Account status
      isActive: vendorUser.isActive,
      isVerified: vendorUser.isVerified,
      isApproved: vendorUser.isApproved,
      approvalStatus: vendorUser.approvalStatus,
      
      // Business metrics
      rating: vendorUser.rating || 0,
      totalReviews: vendorUser.totalReviews || 0,
      totalBookings: vendorUser.totalBookings || 0,
      totalEarnings: vendorUser.totalEarnings || 0,
    };

    return NextResponse.json({
      success: true,
      profile: profileData
    });

  } catch (error) {
    console.error('Error fetching vendor profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor profile' },
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

    // Find the vendor user index
    const vendorIndex = registeredUsers.findIndex(user => user.userType === 'vendor');
    
    if (vendorIndex === -1) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Update the vendor's data
    registeredUsers[vendorIndex] = {
      ...registeredUsers[vendorIndex],
      ...body
    };

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: registeredUsers[vendorIndex]
    });

  } catch (error) {
    console.error('Error updating vendor profile:', error);
    return NextResponse.json(
      { error: 'Failed to update vendor profile' },
      { status: 500 }
    );
  }
} 