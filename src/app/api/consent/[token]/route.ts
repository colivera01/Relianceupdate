import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { evaluateConsentRespondable } from '@/lib/consent-record-state';

type RouteContext = {
  params: Promise<{ token: string }>;
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

    let consent = await withTransientDbRetry(() =>
      (prisma as any).consentRecord.findUnique({
        where: { token: String(token) },
        include: {
          booking: {
            select: {
              id: true,
              title: true,
              clientName: true,
              scheduledFor: true,
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
      await withTransientDbRetry(() =>
        (prisma as any).consentRecord.update({
          where: { id: consent.id },
          data: { status: 'expired' },
        })
      );
      await withTransientDbRetry(() =>
        (prisma as any).consentEvent.create({
          data: {
            consentRecordId: consent.id,
            eventType: 'expired',
            metadata: JSON.stringify({ source: 'get_token_auto_expire' }),
          },
        })
      );
      consent = { ...consent, status: 'expired' };
    }

    const respondable = evaluateConsentRespondable(consent.status, consent.expiresAt, now);

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
        booking: consent.booking,
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
