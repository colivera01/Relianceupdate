import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userType } = body;

    console.log('Generating passkey registration options for:', userType);

    // Generate a random challenge
    const challenge = crypto.randomBytes(32);
    
    // Generate a random user ID
    const userId = crypto.randomBytes(16);

    const options = {
      challenge: Array.from(challenge),
      rp: {
        name: 'Reliance',
        id: 'localhost', // In production, use your actual domain
      },
      user: {
        id: Array.from(userId),
        name: `user@reliance.com`, // In production, use actual user email
        displayName: 'Reliance User', // In production, use actual user name
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
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        requireResidentKey: false,
      },
    };

    console.log('Passkey registration options generated successfully');

    return NextResponse.json(options);

  } catch (error) {
    console.error('Error generating passkey registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
} 