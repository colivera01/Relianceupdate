import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { hashConsentDocument } from '@/lib/consent-flow';
import { evaluateConsentRespondable } from '@/lib/consent-record-state';

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
    const termsVersion = String(body?.termsVersion || '').trim();
    const privacyVersion = String(body?.privacyVersion || '').trim();
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
        const booking = await prisma.booking.findUnique({
          where: { id: existing.bookingId as string },
          select: { id: true, customerMetadata: true },
        });
        if (!booking) return null;
        const metadata = parseMetadata(booking.customerMetadata);
        metadata.vendor_job_customer_visibility_choice = normalizedVisibilityChoice;
        metadata.vendor_job_customer_visibility_choice_at = new Date().toISOString();
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
