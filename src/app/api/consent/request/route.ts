import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { CONSENT_TYPES, generateConsentToken } from '@/lib/consent-flow';
import { createAdminAuditLog } from '@/lib/admin-audit';
import { getUserIdFromRequest } from '@/lib/auth';
import { sendConsentLinkNotification } from '@/lib/notifications/send-consent-link';
import { logNotificationEnvWarnings } from '@/lib/env/notification-config';

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

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { email: true, phone: true, name: true } } },
    });
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }

    const token = generateConsentToken();
    const record = await (prisma as any).consentRecord.create({
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
    });

    await (prisma as any).consentEvent.create({
      data: { consentRecordId: record.id, eventType: 'sent', metadata: null },
    });

    await createAdminAuditLog({
      actionType: 'consent_requested',
      entityType: 'consent',
      entityId: record.id,
      actorUserId: String(actorUserId),
      metadata: { bookingId, vendorId, mediaSessionId, consentType },
    });

    const consentPath = `/consent/${encodeURIComponent(token)}`;
    let notification: Awaited<ReturnType<typeof sendConsentLinkNotification>> | null = null;
    let notificationError: string | null = null;
    try {
      notification = await sendConsentLinkNotification({
        consentRecordId: record.id,
        actorUserId: String(actorUserId),
        token,
        consentPath,
        customerEmail: booking.user?.email,
        customerPhone: booking.user?.phone,
        customerName: booking.user?.name,
        consentTypeLabel: consentType.replace(/_/g, ' '),
      });
      await (prisma as any).consentEvent.create({
        data: {
          consentRecordId: record.id,
          eventType: 'notification_dispatch',
          metadata: JSON.stringify({
            anySuccess: notification.anySuccess,
            channels: notification.channels,
            absoluteFallbackLink: notification.absoluteFallbackLink,
          }),
        },
      });
    } catch (e) {
      notificationError = e instanceof Error ? e.message : String(e);
      console.error('[consent/request] notification error:', e);
      await (prisma as any).consentEvent.create({
        data: {
          consentRecordId: record.id,
          eventType: 'notification_dispatch_failed',
          metadata: JSON.stringify({ error: notificationError }),
        },
      });
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
    return NextResponse.json({ success: false, error: 'Failed to create consent request' }, { status: 500 });
  }
}
