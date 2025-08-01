import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { credential, userType } = await request.json();

    // Validate the credential data
    if (!credential || !credential.id || !credential.response) {
      return NextResponse.json(
        { error: 'Invalid credential data' },
        { status: 400 }
      );
    }

    // Here you would typically:
    // 1. Verify the attestation signature
    // 2. Extract the public key from the attestation object
    // 3. Store the credential ID and public key in your database
    // 4. Associate the credential with the user's account

    // For now, we'll just log the credential data
    console.log('Received passkey registration:', {
      credentialId: credential.id,
      userType,
      // In a real implementation, you'd store this securely
      // publicKey: extractedPublicKey,
      // userHandle: credential.response.userHandle,
    });

    // TODO: Implement actual credential verification and storage
    // This is where you'd:
    // - Verify the attestation signature using a WebAuthn library
    // - Extract the public key from the attestation object
    // - Store the credential ID and public key in your database
    // - Associate it with the user's account

    // Example of what you might store in your database:
    const credentialData = {
      id: credential.id,
      type: credential.type,
      userType,
      createdAt: new Date().toISOString(),
      // publicKey: extractedPublicKey,
      // userHandle: credential.response.userHandle,
    };

    // Store in database (implement this based on your database setup)
    // await db.passkeys.create(credentialData);

    return NextResponse.json({
      success: true,
      message: 'Passkey registered successfully',
    });
  } catch (error) {
    console.error('Error registering passkey:', error);
    return NextResponse.json(
      { error: 'Failed to register passkey' },
      { status: 500 }
    );
  }
} 