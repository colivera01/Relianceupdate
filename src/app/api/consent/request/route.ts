import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { CONSENT_TYPES, generateConsentToken } from '@/lib/consent-flow';
import { createAdminAuditLog } from '@/lib/admin-audit';
import { getUserIdFromRequest } from '@/lib/auth';
import { sendConsentLinkNotification } from '@/lib/notifications/send-consent-link';
import { logNotificationEnvWarnings } from '@/lib/env/notification-config';

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

function parseCustomerMetadata(value: string | null | undefined): Record<string, unknown> {
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

export async function POST(request: NextRequest) {
  logNotificationEnvWarnings();
  try {
    const actorUserId = (await getUserIdFromRequest(request)) || 'system';
    const body = await request.json();
    const bookingId = String(body?.bookingId || '').trim();
    const vendorId = String(body?.vendorId || '').trim();
    const mediaSessionId = String(body?.mediaSessionId || '').trim();
    const consentType = String(body?.consentType || '').trim();
    const expiresAtInput = body?.expiresAt ? new Date(String(body.expiresAt)) : null;
    const defaultExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const expiresAt =
      expiresAtInput && !Number.isNaN(expiresAtInput.getTime()) ? expiresAtInput : defaultExpiresAt;

    if (!bookingId || !vendorId || !mediaSessionId || !consentType) {
      return NextResponse.json(
        { success: false, error: 'bookingId, vendorId, mediaSessionId, and consentType are required' },
        { status: 400 }
      );
    }
    if (!CONSENT_TYPES.has(consentType)) {
      return NextResponse.json({ success: false, error: 'Invalid consentType' }, { status: 400 });
    }

    const booking = await withTransientDbRetry(() =>
      prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          vendorId: true,
          clientName: true,
          customerMetadata: true,
          user: { select: { email: true, phone: true, name: true } },
        },
      })
    );
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }
    const bookingMeta = parseCustomerMetadata(booking.customerMetadata || null);
    const customerEmail =
      (booking.user?.email && String(booking.user.email).trim()) ||
      (bookingMeta.client_email ? String(bookingMeta.client_email).trim() : '') ||
      undefined;
    const customerPhone =
      (booking.user?.phone && String(booking.user.phone).trim()) ||
      (bookingMeta.client_phone ? String(bookingMeta.client_phone).trim() : '') ||
      undefined;
    const customerName =
      (booking.user?.name && String(booking.user.name).trim()) ||
      (booking.clientName ? String(booking.clientName).trim() : '') ||
      undefined;

    const token = generateConsentToken();
    const record = await withTransientDbRetry(() =>
      (prisma as any).consentRecord.create({
        data: {
          token,
          bookingId,
          vendorId,
          mediaSessionId,
          consentType,
          status: 'requested',
          requestedAt: new Date(),
          expiresAt,
        },
      })
    );

    await withTransientDbRetry(() =>
      (prisma as any).consentEvent.create({
        data: { consentRecordId: record.id, eventType: 'sent', metadata: null },
      })
    );

    try {
      await withTransientDbRetry(() =>
        createAdminAuditLog({
          actionType: 'consent_requested',
          entityType: 'consent',
          entityId: record.id,
          actorUserId: String(actorUserId),
          metadata: { bookingId, vendorId, mediaSessionId, consentType },
        })
      );
    } catch (e) {
      console.error('[consent/request] admin audit logging failed (non-blocking)', e);
    }

    const consentPath = `/consent/${encodeURIComponent(token)}`;
    let notification: Awaited<ReturnType<typeof sendConsentLinkNotification>> | null = null;
    let notificationError: string | null = null;
    try {
      notification = await sendConsentLinkNotification({
        consentRecordId: record.id,
        actorUserId: String(actorUserId),
        token,
        consentPath,
        customerEmail,
        customerPhone,
        customerName,
        consentTypeLabel: consentType.replace(/_/g, ' '),
      });
      await withTransientDbRetry(() =>
        (prisma as any).consentEvent.create({
          data: {
            consentRecordId: record.id,
            eventType: 'notification_dispatch',
            metadata: JSON.stringify({
              anySuccess: notification.anySuccess,
              channels: notification.channels,
              absoluteFallbackLink: notification.absoluteFallbackLink,
            }),
          },
        })
      );
    } catch (e) {
      notificationError = e instanceof Error ? e.message : String(e);
      console.error('[consent/request] notification dispatch failed:', e);
      await withTransientDbRetry(() =>
        (prisma as any).consentEvent.create({
          data: {
            consentRecordId: record.id,
            eventType: 'notification_dispatch_failed',
            metadata: JSON.stringify({ error: notificationError }),
          },
        })
      );
    }

    return NextResponse.json({
      success: true,
      consent: record,
      consentUrl: consentPath,
      consentAbsoluteUrl: notification?.absoluteFallbackLink ?? null,
      notification,
      notificationError,
      manualLinkRequired: !notification?.anySuccess,
      message: notification?.anySuccess
        ? undefined
        : 'Delivery was not confirmed via email/SMS; share the consent link manually.',
    });
  } catch (error) {
    console.error('[consent/request] POST error:', error);
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
    return NextResponse.json({ success: false, error: 'Failed to create consent request' }, { status: 500 });
  }
}
