import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // In a real application, you would:
    // 1. Check if the user already has a vendor profile
    // 2. Check if they meet the requirements to create a vendor profile
    // 3. Return eligibility status and requirements

    // For now, we'll return a mock response
    return NextResponse.json({
      success: true,
      canCreateVendor: true,
      requirements: [
        'Valid business license',
        'Proof of insurance',
        'Business verification',
        'Service area definition'
      ],
      existingVendorProfile: false
    });

  } catch (error) {
    console.error('Vendor eligibility check error:', error);
    return NextResponse.json(
      { error: 'Failed to check vendor eligibility. Please try again.' },
      { status: 500 }
    );
  }
}



