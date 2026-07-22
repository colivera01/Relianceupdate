import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { evaluateConsentRespondable } from '@/lib/consent-record-state';

type RouteContext = {
  params: Promise<{ token: string }>;
};

type ConsentTokenBooking = {
  id: string;
  title: string | null;
  clientName: string | null;
  scheduledFor: Date | null;
  customerMetadata: string | null;
  service: { id: string; name: string; price: number | null } | null;
};

type ConsentTokenRecord = {
  id: string;
  token: string;
  status: string;
  consentType: string;
  requestedAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiresAt: Date | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  mediaSessionId: string;
  booking: ConsentTokenBooking;
  vendor: { id: string; name: string; businessName: string | null };
};

function isTransientDbConnectivityError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');
  return (
    code === 'P1001' ||
    code === 'P2024' ||
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('Timed out fetching a new connection from the connection pool') ||
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
    }

    let consent = await withTransientDbRetry<ConsentTokenRecord | null>(() =>
      (prisma as any).consentRecord.findUnique({
        where: { token: String(token) },
        include: {
          booking: {
            select: {
              id: true,
              title: true,
              clientName: true,
              scheduledFor: true,
              customerMetadata: true,
              service: { select: { id: true, name: true, price: true } },
            },
          },
          vendor: { select: { id: true, name: true, businessName: true } },
        },
      })
    );
    if (!consent) {
      return NextResponse.json({ success: false, error: 'Consent record not found', code: 'CONSENT_NOT_FOUND' }, { status: 404 });
    }

    const now = new Date();
    const pending = evaluateConsentRespondable(consent.status, consent.expiresAt, now);
    if (consent.status === 'requested' && pending.respondable === false && pending.reason === 'expired') {
      const consentId = consent.id;
      await withTransientDbRetry(() =>
        (prisma as any).consentRecord.update({
          where: { id: consentId },
          data: { status: 'expired' },
        })
      );
      await withTransientDbRetry(() =>
        (prisma as any).consentEvent.create({
          data: {
            consentRecordId: consentId,
            eventType: 'expired',
            metadata: JSON.stringify({ source: 'get_token_auto_expire' }),
          },
        })
      );
      consent = { ...consent, status: 'expired' };
    }

    const respondable = evaluateConsentRespondable(consent.status, consent.expiresAt, now);

    let bookingMetadata: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(consent.booking.customerMetadata || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) bookingMetadata = parsed;
    } catch {}

    const { customerMetadata: _customerMetadata, ...publicBooking } = consent.booking;

    return NextResponse.json({
      success: true,
      consent: {
        id: consent.id,
        token: consent.token,
        status: consent.status,
        consentType: consent.consentType,
        requestedAt: consent.requestedAt,
        acceptedAt: consent.acceptedAt,
        declinedAt: consent.declinedAt,
        expiresAt: consent.expiresAt,
        termsVersion: consent.termsVersion,
        privacyVersion: consent.privacyVersion,
        mediaSessionId: consent.mediaSessionId,
        vendor: consent.vendor,
        booking: publicBooking,
        recordingLocation: String(bookingMetadata.vendor_job_recording_location || '').trim() || null,
        canRespond: respondable.respondable,
        respondBlockedReason: respondable.respondable ? null : respondable.reason,
      },
    });
  } catch (error) {
    console.error('[consent/:token] GET error', error);
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: 'DB_UNAVAILABLE',
          error: 'The database is temporarily unavailable. Please try again.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch consent' }, { status: 500 });
  }
}
