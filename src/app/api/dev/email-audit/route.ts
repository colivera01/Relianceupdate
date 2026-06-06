import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sendConsentLinkNotification } from '@/lib/notifications/send-consent-link';
import { sendReviewReminderNotification } from '@/lib/notifications/send-review-reminder';
import { sendReviewExpiredNotification } from '@/lib/notifications/send-review-expired';
import { sendEmployeeInviteNotification } from '@/lib/notifications/send-employee-invite';
import { sendVideoReadyNotification } from '@/lib/notifications/send-video-ready';

function buildAbsoluteUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

function resolveBaseUrl(request: NextRequest): string {
  const explicit = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const origin = String(request.headers.get('origin') || '').trim().replace(/\/+$/, '');
  if (origin) return origin;
  return 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 404 });
  }

  try {
    const { userId } = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim();
    const customerName = String(body?.customerName || 'Email Audit Customer').trim();
    const vendorName = String(body?.vendorName || 'Metro Home Care Pros').trim();
    const serviceName = String(body?.serviceName || 'Metro Apartment Deep Clean').trim();
    const bookingTitle = String(body?.bookingTitle || 'Fresh recount validation 20260528000304').trim();
    const serviceDate = body?.serviceDate ? new Date(String(body.serviceDate)) : new Date('2026-05-29T10:00:00-04:00');
    const baseUrl = resolveBaseUrl(request);

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Provide an explicit email in the request body. This dev audit route no longer defaults to a real inbox.',
        },
        { status: 400 }
      );
    }

    const consentPath = '/consent/dev-email-audit-consent';
    const inviteLink = buildAbsoluteUrl(baseUrl, '/employee/invite/dev-email-audit-invite');
    const reviewPathBookingId = 'dev-email-audit-booking';
    const videoUrl = buildAbsoluteUrl(baseUrl, `/my-bookings/${reviewPathBookingId}?videoReady=1`);

    const consent = await sendConsentLinkNotification({
      consentRecordId: 'dev-email-audit-consent',
      actorUserId: userId,
      token: 'dev-email-audit-consent',
      consentPath,
      absoluteBaseUrl: baseUrl,
      customerEmail: email,
      customerName,
      vendorName,
      serviceName,
      bookingTitle,
      serviceDate,
      consentTypeLabel: 'video_access',
    });

    const reviewReminder = await sendReviewReminderNotification({
      reviewWindowId: 'dev-email-audit-review-window',
      actorUserId: userId,
      bookingId: reviewPathBookingId,
      customerEmail: email,
      customerName,
      vendorName,
      serviceName,
      bookingTitle,
      scheduledDate: serviceDate,
    });

    const reviewExpired = await sendReviewExpiredNotification({
      reviewWindowId: 'dev-email-audit-review-window',
      actorUserId: userId,
      bookingId: reviewPathBookingId,
      customerEmail: email,
      customerName,
    });

    const employeeInvite = await sendEmployeeInviteNotification({
      inviteId: 'dev-email-audit-employee-invite',
      actorUserId: userId,
      inviteLink,
      vendorName,
      inviteeName: customerName,
      inviteeEmail: email,
    });

    const videoReady = await sendVideoReadyNotification({
      actorUserId: userId,
      bookingId: reviewPathBookingId,
      customerEmail: email,
      customerName,
      serviceName,
      bookingTitle,
      vendorName,
      videoUrl,
    });

    return NextResponse.json({
      success: true,
      baseUrl,
      email,
      deliveries: {
        consent,
        reviewReminder,
        reviewExpired,
        employeeInvite,
        videoReady,
      },
    });
  } catch (error: any) {
    console.error('[dev/email-audit] POST error:', error);
    if (error.message === 'Unauthorized' || String(error.message).includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to send audit emails' }, { status: 500 });
  }
}
