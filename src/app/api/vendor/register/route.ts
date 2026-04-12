import { NextRequest, NextResponse } from 'next/server';
import {
  addRegisteredUser,
  registeredUsers,
} from "@/lib/dev-registered-users";

// reCAPTCHA Secret Key - Update this with your actual secret key
const RECAPTCHA_SECRET_KEY = '6LdAapYrAAAAAEuuGMIKNjSNv0PE1yeMtWO1rKKk'; // Updated with actual secret key

// Helper function to check if user already exists
async function checkExistingUser(email: string) {
  return registeredUsers.find(user => user.email === email);
}

// Helper function to update existing user
function updateRegisteredUser(userId: string, updatedData: any) {
  const userIndex = registeredUsers.findIndex(user => user.id === userId);
  if (userIndex !== -1) {
    registeredUsers[userIndex] = updatedData;
    console.log('User updated in storage:', { ...updatedData, password: '[HIDDEN]' });
  }
}

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
  try {
    const body = await request.json();
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
      // Vendor-specific fields
      businessName,
      businessType,
      category,
      businessBio,
      foundedYear,
      licenseNumber,
      insuranceStatus,
      bondingStatus,
      totalEmployees,
      yearsInBusiness,
      serviceTypes,
      specializations,
      serviceAreas,
      website,
      emergencyContact,
      responseTimeSettings,
      responseTime,
      profilePhoto,
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

    // Validate vendor-specific required fields
    if (!businessName || !businessType || !category || !businessBio || !foundedYear || !totalEmployees || !yearsInBusiness) {
      return NextResponse.json(
        { error: 'All business information fields are required' },
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

    // Validate business data
    const currentYear = new Date().getFullYear();
    if (foundedYear < 1900 || foundedYear > currentYear) {
      return NextResponse.json(
        { error: 'Invalid founded year' },
        { status: 400 }
      );
    }

    if (totalEmployees < 1) {
      return NextResponse.json(
        { error: 'Total employees must be at least 1' },
        { status: 400 }
      );
    }

    if (yearsInBusiness < 0 || yearsInBusiness > 100) {
      return NextResponse.json(
        { error: 'Invalid years in business' },
        { status: 400 }
      );
    }

    // TODO: Hash the password before storing
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare vendor data for storage
    const vendorData = {
      // Personal information
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
      
      // Business information
      businessName,
      businessType,
      category,
      foundedYear: parseInt(foundedYear),
      licenseNumber: licenseNumber || '',
      insuranceStatus: insuranceStatus || false,
      bondingStatus: bondingStatus || false,
      totalEmployees: parseInt(totalEmployees),
      yearsInBusiness: parseInt(yearsInBusiness),
      
      // Services and specializations
      serviceTypes: serviceTypes || [],
      specializations: specializations || [],
      serviceAreas: serviceAreas || [],
      
      // Contact and website
      website: website || '',
      emergencyContact: emergencyContact || '',
      responseTimeSettings: responseTimeSettings || '',
      
      // Account metadata
      userType: 'vendor',
      createdAt: new Date().toISOString(),
      isActive: false, // Inactive until approved
      isVerified: false, // Requires manual verification
      isApproved: false, // Requires approval process
      approvalStatus: 'pending', // pending, approved, rejected
      approvalDate: null,
      approvedBy: null,
      rejectionReason: null,
      
      // Business metrics
      rating: 0,
      totalReviews: 0,
      totalBookings: 0,
      totalEarnings: 0,
      
      // Business settings
      availability: {
        monday: { start: '09:00', end: '17:00', available: true },
        tuesday: { start: '09:00', end: '17:00', available: true },
        wednesday: { start: '09:00', end: '17:00', available: true },
        thursday: { start: '09:00', end: '17:00', available: true },
        friday: { start: '09:00', end: '17:00', available: true },
        saturday: { start: '09:00', end: '17:00', available: true },
        sunday: { start: '09:00', end: '17:00', available: false },
      },
      
      // Business profile
      profileImage: profilePhoto || '',
      businessImages: [],
      videoProfile: false,
      videoUrl: '',
      businessBio: businessBio || '',
      responseTime: responseTime || responseTimeSettings || '',
      
      // Pricing and services
      pricing: {},
      services: [],
      
      // Reviews and ratings
      reviews: [],
      
      // Analytics and performance
      analytics: {
        profileViews: 0,
        contactClicks: 0,
        bookingRequests: 0,
        responseRate: 0,
        averageResponseTime: 0,
      },
    };

    // Check if user already exists (for adding vendor profile to existing customer account)
    const existingUser = await checkExistingUser(email);
    
    if (existingUser) {
      // Update existing user with vendor data
      const updatedUser = {
        ...existingUser,
        ...vendorData,
        userType: 'both', // User now has both customer and vendor profiles
        updatedAt: new Date().toISOString()
      };
      
      // Update the user in storage
      updateRegisteredUser(existingUser.id, updatedUser);
      
      console.log('Vendor profile added to existing customer account:', {
        ...updatedUser,
        password: '[HIDDEN]',
      });
    } else {
      // Store new vendor data for login system
      addRegisteredUser(vendorData);
    }

    // TODO: Store vendor data in your database
    // Example with a hypothetical database:
    // const vendor = await db.vendors.create(vendorData);

    // For now, just log the data
    console.log('Vendor registration data:', {
      ...vendorData,
      password: '[HIDDEN]', // Don't log actual passwords
    });

    // TODO: Send welcome email
    // await sendVendorWelcomeEmail(email, firstName, businessName);

    // TODO: Send notification to admin for approval
    // await sendNewVendorNotificationEmail(vendorData, ['admin@reliance.com']);

    return NextResponse.json({
      success: true,
      message: 'Vendor registered successfully. Your account is pending approval and will be reviewed by our team.',
      vendorId: 'temp-id', // Replace with actual vendor ID from database
      requiresApproval: true,
    });

  } catch (error) {
    console.error('Vendor registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
} 