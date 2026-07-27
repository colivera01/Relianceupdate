import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, hashConsentDocument } from '@/lib/consent-flow';
import { evaluateConsentRespondable } from '@/lib/consent-record-state';
import { formatAddress, geocodeAddress, hasCompleteAddress } from '@/lib/geocoding';
import { sendConsentDecisionNotifications } from '@/lib/notifications/send-consent-decision';

type ConsentRecordRow = {
  id: string;
  bookingId: string | null;
  status: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
};

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isTransientDbConnectivityError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');
  return (
    code === 'P1001' ||
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.toLowerCase().includes('prisma connect probe timeout')
  );
}

async function withTransientDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbConnectivityError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    return operation();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || '').trim();
    const termsAccepted = body?.termsAccepted === true;
    const termsVersion = String(body?.termsVersion || CURRENT_TERMS_VERSION).trim();
    const privacyVersion = String(body?.privacyVersion || CURRENT_PRIVACY_VERSION).trim();
    const visibilityChoice = String(body?.visibilityChoice || 'private').trim().toLowerCase();
    const normalizedVisibilityChoice = visibilityChoice === 'public' ? 'public' : 'private';
    if (!token) {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
    }
    const existing = await withTransientDbRetry<ConsentRecordRow | null>(() =>
      (prisma as any).consentRecord.findUnique({ where: { token } })
    );
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Consent record not found', code: 'CONSENT_NOT_FOUND' }, { status: 404 });
    }

    const respondable = evaluateConsentRespondable(existing.status, existing.expiresAt);
    if (!respondable.respondable) {
      if (respondable.reason === 'expired') {
        return NextResponse.json(
          { success: false, error: 'This consent request has expired', code: 'CONSENT_EXPIRED' },
          { status: 410 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Consent is already ${existing.status}`, code: 'CONSENT_NOT_PENDING' },
        { status: 409 }
      );
    }
    if (!termsAccepted || !termsVersion || !privacyVersion) {
      return NextResponse.json(
        { success: false, error: 'Terms of Service and Privacy Policy acceptance is required.', code: 'CONSENT_TERMS_REQUIRED' },
        { status: 422 }
      );
    }

    let bookingForConsent: { id: string; customerMetadata: string | null } | null = null;
    let customerBusinessLocationVerified = false;
    if (existing.bookingId) {
      bookingForConsent = await withTransientDbRetry(() =>
        prisma.booking.findUnique({
          where: { id: existing.bookingId as string },
          select: { id: true, customerMetadata: true },
        })
      );
      const metadata = parseMetadata(bookingForConsent?.customerMetadata);
      if (String(metadata.vendor_job_recording_location || '').trim() === 'customer-business') {
        const rawAddress = body?.customerBusinessAddress || {};
        const address = {
          address: String(rawAddress?.address || '').trim(),
          city: String(rawAddress?.city || '').trim(),
          state: String(rawAddress?.state || '').trim(),
          zipCode: String(rawAddress?.zipCode || '').trim(),
        };
        if (!hasCompleteAddress(address)) {
          return NextResponse.json(
            { success: false, error: 'Street address, city, state, and ZIP code are required.', code: 'CUSTOMER_BUSINESS_ADDRESS_REQUIRED' },
            { status: 422 }
          );
        }
        const geocode = await geocodeAddress(address);
        if (geocode.status !== 'success') {
          return NextResponse.json(
            { success: false, error: 'We could not verify that customer business address. Check it and try again.', code: 'CUSTOMER_BUSINESS_ADDRESS_NOT_VERIFIED' },
            { status: 422 }
          );
        }
        metadata.vendor_job_customer_business_address = address.address;
        metadata.vendor_job_customer_business_city = address.city;
        metadata.vendor_job_customer_business_state = address.state;
        metadata.vendor_job_customer_business_zip_code = address.zipCode;
        metadata.vendor_job_customer_business_latitude = geocode.latitude;
        metadata.vendor_job_customer_business_longitude = geocode.longitude;
        metadata.vendor_job_customer_business_geocoded_at = geocode.geocodedAt.toISOString();
        metadata.vendor_job_customer_business_formatted_address = geocode.formattedAddress || formatAddress(address);
        metadata.vendor_job_recording_location_snapshot = {
          type: 'customer-business',
          source: 'customer_supplied',
          status: 'verified_coordinates',
          address: address.address,
          city: address.city,
          state: address.state,
          zip_code: address.zipCode,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          geocoded_at: geocode.geocodedAt.toISOString(),
          captured_at: new Date().toISOString(),
        };
        bookingForConsent = { ...bookingForConsent!, customerMetadata: JSON.stringify(metadata) };
        customerBusinessLocationVerified = true;
      }
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;
    const documentHash = hashConsentDocument(`${termsVersion}|${privacyVersion}|${token}`);
    const ipStored = ipAddress ? String(ipAddress).split(',')[0].trim().slice(0, 255) : null;
    const uaStored = userAgent ? String(userAgent).slice(0, 1024) : null;

    const updated = await withTransientDbRetry<ConsentRecordRow>(() =>
      (prisma as any).consentRecord.update({
        where: { token },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          termsVersion: termsVersion || null,
          privacyVersion: privacyVersion || null,
          ipAddress: ipStored,
          userAgent: uaStored,
          documentHash,
        },
      })
    );

    if (existing.bookingId) {
      await withTransientDbRetry(async () => {
        const booking = bookingForConsent;
        if (!booking) return null;
        const metadata = parseMetadata(booking.customerMetadata);
        metadata.vendor_job_customer_visibility_choice = normalizedVisibilityChoice;
        metadata.vendor_job_customer_visibility_choice_at = new Date().toISOString();
        metadata.vendor_job_consent_accepted = true;
        metadata.vendor_job_consent_status = 'accepted';
        metadata.vendor_job_consent_accepted_at = new Date().toISOString();
        metadata.vendor_job_consent_terms_accepted = true;
        metadata.vendor_job_consent_terms_version = termsVersion;
        metadata.vendor_job_consent_privacy_version = privacyVersion;
        await prisma.booking.update({
          where: { id: booking.id },
          data: { customerMetadata: JSON.stringify(metadata) },
        });
        return null;
      });
    }

    await withTransientDbRetry(() =>
      (prisma as any).consentEvent.create({
        data: {
          consentRecordId: updated.id,
          eventType: 'accepted',
          metadata: JSON.stringify({
            termsVersion: termsVersion || null,
            privacyVersion: privacyVersion || null,
            ipAddress: ipStored,
            userAgent: uaStored,
            acceptedAt: updated.acceptedAt,
            visibilityChoice: normalizedVisibilityChoice,
            customerBusinessLocationVerified,
          }),
        },
      })
    );

    const notifications = existing.bookingId
      ? await sendConsentDecisionNotifications({
          request,
          bookingId: existing.bookingId,
          accepted: true,
          actorUserId: 'customer-consent',
        }).catch((notificationError) => {
          console.error('[consent/accept] decision notification failed', notificationError);
          return null;
        })
      : null;

    return NextResponse.json({ success: true, consent: updated, notifications });
  } catch (error) {
    console.error('[consent/accept] POST error:', error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: 'DB_UNAVAILABLE',
          message: 'The database is temporarily unavailable. Please try again.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to accept consent' }, { status: 500 });
  }
}
