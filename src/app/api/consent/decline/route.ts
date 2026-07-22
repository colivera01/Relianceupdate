import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { evaluateConsentRespondable } from '@/lib/consent-record-state';
import { sendConsentDecisionNotifications } from '@/lib/notifications/send-consent-decision';
import { parseCustomerMetadata } from '@/lib/job-assignment';

type ConsentRecordRow = {
  id: string;
  bookingId: string | null;
  status: string;
  expiresAt: Date | null;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || '').trim();
    const reason = String(body?.reason || '').trim();
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
    const ipStored = ipAddress ? String(ipAddress).split(',')[0].trim().slice(0, 255) : null;

    const updated = await withTransientDbRetry<ConsentRecordRow>(() =>
      (prisma as any).consentRecord.update({
        where: { token },
        data: {
          status: 'declined',
          declinedAt: new Date(),
        },
      })
    );
    await withTransientDbRetry(() =>
      (prisma as any).consentEvent.create({
        data: {
          consentRecordId: updated.id,
          eventType: 'declined',
          metadata: JSON.stringify({
            reason: reason || null,
            ipAddress: ipStored,
            userAgent: userAgent ? String(userAgent).slice(0, 1024) : null,
          }),
        },
      })
    );

    if (existing.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: existing.bookingId },
        select: { customerMetadata: true },
      });
      if (booking) {
        const metadata = parseCustomerMetadata(booking.customerMetadata);
        metadata.vendor_job_consent_accepted = false;
        metadata.vendor_job_consent_status = 'declined';
        metadata.vendor_job_consent_declined_at = new Date().toISOString();
        if (reason) metadata.vendor_job_consent_decline_reason = reason;
        delete metadata.vendor_job_service_order_released_membership_ids;
        delete metadata.vendor_job_service_order_released_at;
        await prisma.booking.update({
          where: { id: existing.bookingId },
          data: { customerMetadata: JSON.stringify(metadata) },
        });
      }
      await sendConsentDecisionNotifications({
        request,
        bookingId: existing.bookingId,
        accepted: false,
        actorUserId: 'customer-consent',
      }).catch((notificationError) => {
        console.error('[consent/decline] decision notification failed', notificationError);
      });
    }

    return NextResponse.json({ success: true, consent: updated });
  } catch (error) {
    console.error('[consent/decline] POST error:', error);
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
    return NextResponse.json({ success: false, error: 'Failed to decline consent' }, { status: 500 });
  }
}
