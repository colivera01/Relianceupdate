import { NextRequest, NextResponse } from 'next/server';
import { addRegisteredUser } from '../../auth/login/route';

// reCAPTCHA Secret Key - Update this with your actual secret key
const RECAPTCHA_SECRET_KEY = '6LdAapYrAAAAAEuuGMIKNjSNv0PE1yeMtWO1rKKk';

async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success && data.score >= 0.5; // reCAPTCHA v3 returns a score
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  console.log('Customer registration API called');
  try {
    const body = await request.json();
    console.log('Request body received:', { ...body, password: '[HIDDEN]' });
    
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      address,
      city,
      state,
      zipCode,
      bio,
      recaptchaToken,
      userType
    } = body;

    // Temporarily disable reCAPTCHA verification for development
    // TODO: Re-enable reCAPTCHA verification in production
    /*
    // Validate reCAPTCHA token
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA token is required' },
        { status: 400 }
      );
    }

    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }
    */

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // TODO: Hash the password before storing
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare customer data for storage
    const customerData = {
      firstName,
      lastName,
      email,
      phone,
      password, // In production, store hashedPassword instead
      address,
      city,
      state,
      zipCode,
      bio: bio || '',
      userType: 'customer',
      createdAt: new Date().toISOString(),
      isActive: true,
      // Additional fields for customer profile
      preferences: {
        notifications: true,
        emailMarketing: false,
      },
      favorites: [],
      bookingHistory: [],
      reviews: [],
    };

    // Store customer data for login system
    addRegisteredUser(customerData);

    // TODO: Store customer data in your database
    // Example with a hypothetical database:
    // const customer = await db.customers.create(customerData);

    // For now, just log the data
    console.log('Customer registration data:', {
      ...customerData,
      password: '[HIDDEN]', // Don't log actual passwords
    });

    // TODO: Send welcome email
    // await sendWelcomeEmail(email, firstName);

    console.log('Returning success response');
    return NextResponse.json({
      success: true,
      message: 'Customer registered successfully',
      customerId: 'temp-id', // Replace with actual customer ID from database
    });

  } catch (error) {
    console.error('Customer registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
} 