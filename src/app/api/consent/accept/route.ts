import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashConsentDocument } from '@/lib/consent-flow';
import { evaluateConsentRespondable } from '@/lib/consent-record-state';

type ConsentRecordRow = {
  id: string;
  status: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
};

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
    const termsVersion = String(body?.termsVersion || '').trim();
    const privacyVersion = String(body?.privacyVersion || '').trim();
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
          }),
        },
      })
    );

    return NextResponse.json({ success: true, consent: updated });
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
