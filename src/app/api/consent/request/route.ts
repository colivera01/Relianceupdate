import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { CONSENT_TYPES, generateConsentToken } from '@/lib/consent-flow';
import { createAdminAuditLog } from '@/lib/admin-audit';
import { getUserIdFromRequest } from '@/lib/auth';
import { resolveBookingCustomer } from '@/lib/booking-customer';
import { logNotificationEnvWarnings } from '@/lib/env/notification-config';
import {
  CUSTOMER_CONSENT_NOTIFICATION_KIND,
  dispatchQueuedConsentNotification,
} from '@/lib/booking-notification-delivery';

type ConsentRequestRecord = {
  id: string;
  token: string;
  bookingId: string;
  vendorId: string;
  mediaSessionId: string | null;
  consentType: string;
  status: string;
  requestedAt: Date;
  expiresAt: Date | null;
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

function isLocalhostOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return /^http:\/\/localhost(?::\d+)?$/i.test(String(origin).trim());
}

function resolveConsentBaseUrl(request: NextRequest, requestedOrigin?: string | null): string {
  const appBaseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return appBaseUrl;
  }
  const bodyOrigin = String(requestedOrigin || '').trim().replace(/\/+$/, '');
  if (isLocalhostOrigin(bodyOrigin)) return bodyOrigin;
  if (appBaseUrl) return appBaseUrl;
  const headerOrigin = String(request.headers.get('origin') || '').trim().replace(/\/+$/, '');
  if (headerOrigin) return headerOrigin;
  return 'http://localhost:3000';
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
    const origin = String(body?.origin || '').trim();
    const skipNotification = body?.skipNotification === true;
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
          title: true,
          scheduledFor: true,
          clientName: true,
          customerMetadata: true,
          vendor: { select: { businessName: true, name: true } },
          service: { select: { name: true } },
          user: { select: { email: true, phone: true, name: true } },
        },
      })
    );
    if (!booking || String(booking.vendorId) !== vendorId) {
      return NextResponse.json({ success: false, error: 'Invalid booking/vendor pair' }, { status: 404 });
    }
    const bookingMeta = parseCustomerMetadata(booking.customerMetadata || null);
    const customer = resolveBookingCustomer(booking);
    const customerEmail = customer.email || undefined;
    const customerPhone = customer.phone || undefined;
    const customerName = customer.name || undefined;
    const vendorName =
      (booking.vendor?.businessName && String(booking.vendor.businessName).trim()) ||
      (booking.vendor?.name && String(booking.vendor.name).trim()) ||
      undefined;
    const bookingTitle =
      (booking.title && String(booking.title).trim()) ||
      undefined;
    const serviceName =
      (booking.service?.name && String(booking.service.name).trim()) ||
      undefined;
    const serviceDate = booking.scheduledFor;
    const serviceTimeZone = String(bookingMeta.service_time_zone || '').trim() || null;

    const token = generateConsentToken();
    const requestState = await withTransientDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const previousRequested = await tx.consentRecord.findMany({
          where: {
            bookingId,
            status: { in: ['requested', 'pending'] },
          },
          select: { id: true },
        });
        if (previousRequested.length) {
          await tx.consentRecord.updateMany({
            where: { id: { in: previousRequested.map((item) => item.id) } },
            data: { status: 'superseded' },
          });
          await Promise.all(
            previousRequested.map((item) =>
              tx.consentEvent.create({
                data: {
                  consentRecordId: item.id,
                  eventType: 'superseded',
                  metadata: JSON.stringify({ replacementTokenCreatedAt: new Date().toISOString() }),
                },
              })
            )
          );
        }

        const record = await tx.consentRecord.create({
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
        await tx.consentEvent.create({
          data: {
            consentRecordId: record.id,
            eventType: previousRequested.length ? 'resent' : 'created',
            metadata: JSON.stringify({
              previousTokenCount: previousRequested.length,
              notificationStatus: 'QUEUED',
            }),
          },
        });

        const updatedMetadata = {
          ...bookingMeta,
          vendor_job_consent_token: token,
          vendor_job_consent_accepted: false,
          vendor_job_consent_status: 'requested',
          vendor_job_consent_notification_status: 'QUEUED',
          vendor_job_consent_last_requested_at: new Date().toISOString(),
        };
        await tx.booking.update({
          where: { id: bookingId },
          data: { customerMetadata: JSON.stringify(updatedMetadata) },
        });
        const notificationRecord = await tx.bookingNotification.upsert({
          where: {
            bookingId_kind: {
              bookingId,
              kind: CUSTOMER_CONSENT_NOTIFICATION_KIND,
            },
          },
          create: {
            bookingId,
            consentRecordId: record.id,
            kind: CUSTOMER_CONSENT_NOTIFICATION_KIND,
            status: 'QUEUED',
          },
          update: {
            consentRecordId: record.id,
            status: 'QUEUED',
            channelsJson: null,
            lastError: null,
            lastAttemptAt: null,
            sentAt: null,
          },
        });
        return { record, notificationRecord, previousTokenCount: previousRequested.length };
      })
    );
    const record = requestState.record as ConsentRequestRecord;

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
    const consentBaseUrl = resolveConsentBaseUrl(request, origin);
    let notification: Awaited<
      ReturnType<typeof dispatchQueuedConsentNotification>
    >['notification'] = null;
    let delivery: Awaited<
      ReturnType<typeof dispatchQueuedConsentNotification>
    >['delivery'] = null;
    let notificationError: string | null = null;
    if (!skipNotification) {
      try {
        const dispatched = await dispatchQueuedConsentNotification({
          notificationId: requestState.notificationRecord.id,
          consentRecordId: record.id,
          actorUserId: String(actorUserId),
          token,
          consentPath,
          absoluteBaseUrl: consentBaseUrl,
          customerEmail,
          customerPhone,
          customerName,
          vendorName,
          serviceName,
          bookingTitle,
          serviceDate,
          serviceTimeZone,
          consentTypeLabel: consentType.replace(/_/g, ' '),
        });
        notification = dispatched.notification;
        delivery = dispatched.delivery;
        notificationError = delivery?.lastError || null;
        const deliveryConfirmed =
          delivery?.status === 'SENT' || delivery?.status === 'PARTIAL';
        await withTransientDbRetry(() =>
          (prisma as any).consentEvent.create({
            data: {
              consentRecordId: record.id,
              eventType: deliveryConfirmed
                ? 'notification_dispatch'
                : 'notification_dispatch_failed',
              metadata: JSON.stringify({
                status: delivery?.status || 'FAILED',
                channels: delivery?.channels || [],
                absoluteFallbackLink: notification?.absoluteFallbackLink || null,
                error: notificationError,
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
    }

    return NextResponse.json({
      success: true,
      consent: record,
      consentUrl: consentPath,
      consentAbsoluteUrl: notification?.absoluteFallbackLink ?? null,
      notification,
      delivery,
      notificationError,
      previousTokenCount: requestState.previousTokenCount,
      manualLinkRequired:
        skipNotification
          ? false
          : delivery?.status !== 'SENT' && delivery?.status !== 'PARTIAL',
      message:
        delivery?.status === 'SENT' || delivery?.status === 'PARTIAL'
        ? undefined
        : skipNotification
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
