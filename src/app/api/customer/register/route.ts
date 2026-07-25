import { NextRequest, NextResponse } from 'next/server';
import { addRegisteredUser } from "@/lib/dev-registered-users";
import { hashPassword } from "@/lib/auth-password";
import { upsertDbCredential } from "@/lib/auth-credentials";
import { sendOrPreviewEmailVerification } from "@/lib/auth-email-verification";
import { prisma } from "@/server/db";
import { geocodeAddress, hasCompleteAddress } from "@/lib/geocoding";
import {
  getCustomerServiceVideoIntent,
  sanitizeAuthNextPath,
} from "@/lib/auth-next";
import {
  markCustomerBookingClaimed,
  parseCustomerBookingClaimMetadata,
  validateCustomerBookingClaim,
} from "@/lib/customer-booking-claim";

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "";

async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    if (!RECAPTCHA_SECRET_KEY) {
      console.error("reCAPTCHA verification skipped because RECAPTCHA_SECRET_KEY is not configured.");
      return false;
    }

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
    console.log('Request body received:', {
      ...body,
      password: '[HIDDEN]',
      registrationNextPath: body?.registrationNextPath ? '[PRESENT]' : undefined,
    });
    
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
      userType,
      registrationNextPath
    } = body;
    const safeNextPath = sanitizeAuthNextPath(registrationNextPath);
    const serviceVideoIntent = getCustomerServiceVideoIntent(safeNextPath);

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

    const passwordHash = hashPassword(password);
    const isProductionRuntime = process.env.NODE_ENV === "production";

    const registryFallbackId = crypto.randomUUID();
    let claimBooking:
      | {
          id: string;
          userId: string;
          customerMetadata: string | null;
          user: { email: string | null } | null;
        }
      | null = null;

    if (serviceVideoIntent) {
      try {
        claimBooking = await prisma.booking.findUnique({
          where: { id: serviceVideoIntent.bookingId },
          select: {
            id: true,
            userId: true,
            customerMetadata: true,
            user: { select: { email: true } },
          },
        });
      } catch (claimLookupError) {
        console.error("Customer service-record claim lookup failed:", claimLookupError);
        return NextResponse.json(
          {
            error:
              "The service record could not be confirmed right now. Please try again in a moment.",
            code: "CUSTOMER_BOOKING_CLAIM_LOOKUP_FAILED",
          },
          { status: 503 }
        );
      }

      if (!claimBooking) {
        return NextResponse.json(
          {
            error: "This completed service record could not be found.",
            code: "CUSTOMER_BOOKING_CLAIM_NOT_FOUND",
          },
          { status: 404 }
        );
      }

      const claimValidation = validateCustomerBookingClaim({
        metadata: parseCustomerBookingClaimMetadata(
          claimBooking.customerMetadata
        ),
        bookingUserEmail: claimBooking.user?.email,
        accountEmail: email,
        claimToken: serviceVideoIntent.claimToken,
      });
      if (!claimValidation.ok) {
        return NextResponse.json(
          {
            error: claimValidation.error,
            code: claimValidation.code,
          },
          {
            status:
              claimValidation.code === "BOOKING_ALREADY_CLAIMED" ? 409 : 403,
          }
        );
      }
    }

    // Prepare customer data for storage
    const customerData = {
      id: registryFallbackId,
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
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

    if (!isProductionRuntime) {
      addRegisteredUser(customerData);
    }

    let persistedCustomerId = registryFallbackId;
    let verification:
      | Awaited<ReturnType<typeof sendOrPreviewEmailVerification>>
      | null = null;

    try {
      const addressInput = {
        address: String(address || "").trim(),
        city: String(city || "").trim(),
        state: String(state || "").trim(),
        zipCode: String(zipCode || "").trim(),
      };
      const geocodeResult = hasCompleteAddress(addressInput)
        ? await geocodeAddress(addressInput)
        : null;
      const coordinateData =
        geocodeResult?.status === "success"
          ? {
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              geocodedAt: geocodeResult.geocodedAt,
            }
          : {};
      const staleCoordinateClear = { latitude: null, longitude: null, geocodedAt: null };
      const persistedUser = await (prisma as any).user.upsert({
        where: { email },
        create: {
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone,
          address: addressInput.address || null,
          city: addressInput.city || null,
          state: addressInput.state || null,
          zipCode: addressInput.zipCode || null,
          locationPreferenceEnabled: false,
          ...coordinateData,
        },
        update: {
          name: `${firstName} ${lastName}`.trim(),
          phone,
          address: addressInput.address || null,
          city: addressInput.city || null,
          state: addressInput.state || null,
          zipCode: addressInput.zipCode || null,
          ...(geocodeResult?.status === "success" ? coordinateData : staleCoordinateClear),
        },
        select: {
          id: true,
        },
      });
      persistedCustomerId = String(persistedUser?.id || registryFallbackId);
      const credential = await upsertDbCredential({
        userId: persistedCustomerId,
        email,
        passwordHash,
      });
      if (claimBooking) {
        const claimMetadata = parseCustomerBookingClaimMetadata(
          claimBooking.customerMetadata
        );
        const claimed = await prisma.booking.updateMany({
          where: {
            id: claimBooking.id,
            userId: claimBooking.userId,
          },
          data: {
            userId: persistedCustomerId,
            customerMetadata: JSON.stringify(
              markCustomerBookingClaimed(
                claimMetadata,
                persistedCustomerId
              )
            ),
          },
        });
        if (claimed.count !== 1) {
          throw new Error("CUSTOMER_BOOKING_CLAIM_CONFLICT");
        }
      }
      if (!isProductionRuntime) {
        addRegisteredUser({
          ...customerData,
          id: persistedCustomerId,
        });
      }
      verification = await sendOrPreviewEmailVerification({
        email,
        credentialId: String(credential.id),
        recipientName: `${firstName} ${lastName}`.trim() || null,
        baseUrl: request.nextUrl.origin,
        audience: "customer",
        nextPath: safeNextPath,
      }).catch((sendError) => {
        console.error("Customer verification email send error:", sendError);
        return null;
      });
    } catch (dbError) {
      console.error("Customer registration DB persistence failed:", dbError);
      if (isProductionRuntime) {
        return NextResponse.json(
          {
            error:
              "Registration could not be completed right now. Please try again in a moment.",
            code: "CUSTOMER_REGISTRATION_DB_PERSISTENCE_FAILED",
          },
          { status: 503 }
        );
      }
      console.warn("Customer registration is using the local development fallback registry.");
    }

    // TODO: Store customer data in your database
    // Example with a hypothetical database:
    // const customer = await db.customers.create(customerData);

    // For now, just log the data
    console.log('Customer registration data:', {
      ...customerData,
      passwordHash: '[HASHED]',
    });

    // TODO: Send welcome email
    // await sendWelcomeEmail(email, firstName);

    console.log('Returning success response');
    return NextResponse.json({
      success: true,
      message: 'Customer registered successfully',
      customerId: persistedCustomerId,
      emailVerificationRequired: true,
      emailDeliveryQueued: Boolean(verification?.sendResult.ok),
      ...(process.env.NODE_ENV !== "production" && verification
        ? {
            verificationLinkPreview: verification.verificationLink,
            verificationTokenPreview: verification.verificationTokenPreview,
          }
        : {}),
    });

  } catch (error) {
    console.error('Customer registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
} 
