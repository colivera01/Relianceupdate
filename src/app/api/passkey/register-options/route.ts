import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { userType } = await request.json();

    // Generate a random challenge
    const challenge = crypto.randomBytes(32);

    // Create registration options
    const options = {
      challenge: Array.from(challenge),
      rp: {
        name: 'Reliance',
        id: process.env.NODE_ENV === 'production' 
          ? 'yourdomain.com' // Replace with your actual domain
          : 'localhost',
      },
      user: {
        id: Array.from(crypto.randomBytes(16)), // Generate a random user ID
        name: `user@reliance.com`, // This should be the actual user's email
        displayName: userType === 'vendor' ? 'Vendor User' : 'Customer User',
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: -7, // ES256
        },
        {
          type: 'public-key',
          alg: -257, // RS256
        },
      ],
      timeout: 60000, // 60 seconds
      attestation: 'direct',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        requireResidentKey: false,
      },
      excludeCredentials: [], // No existing credentials to exclude for new registration
    };

    // Store the challenge in session/database for verification later
    // This is where you'd typically store the challenge associated with the user

    return NextResponse.json(options);
  } catch (error) {
    console.error('Error generating registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
} 