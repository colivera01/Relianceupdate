import { prisma } from '@/server/db';
import { sendReviewReminderNotification } from '@/lib/notifications/send-review-reminder';
import { sendReviewExpiredNotification } from '@/lib/notifications/send-review-expired';

type ReminderContext = {
  reviewWindowId: string;
  bookingId: string;
  vendorId: string;
  mediaSessionId: string;
};

/**
 * No durable job queue is configured. This performs an immediate best-effort
 * email/SMS reminder when transports are enabled (see return.reason).
 */
export async function scheduleReviewReminder(context: ReminderContext, delayMinutes = 30) {
  let delivery: Awaited<ReturnType<typeof sendReviewReminderNotification>> | null = null;
  let loadError: string | null = null;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: context.bookingId },
      include: {
        user: { select: { email: true, phone: true, name: true } },
        vendor: { select: { name: true, businessName: true } },
        service: { select: { name: true } },
      },
    });
    if (!booking) {
      loadError = 'booking_not_found';
    } else {
      delivery = await sendReviewReminderNotification({
        reviewWindowId: context.reviewWindowId,
        actorUserId: 'system',
        bookingId: context.bookingId,
        customerEmail: booking.user?.email,
        customerPhone: booking.user?.phone,
        customerName: booking.user?.name,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
        serviceName: booking.service?.name || null,
        bookingTitle: booking.title || null,
        scheduledDate: booking.scheduledFor || booking.date || null,
      });
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error('[review-notifications] scheduleReviewReminder error:', e);
  }

  return {
    queued: false,
    reason: 'no_background_scheduler',
    synchronousReminderAttempt: true,
    delayMinutes,
    context,
    delivery,
    loadError,
  };
}

export async function notifyReviewWindowClosedWithoutSubmission(context: ReminderContext) {
  let delivery: Awaited<ReturnType<typeof sendReviewExpiredNotification>> | null = null;
  let loadError: string | null = null;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: context.bookingId },
      include: {
        user: { select: { email: true, phone: true, name: true } },
        vendor: { select: { name: true, businessName: true } },
      },
    });
    if (!booking) {
      loadError = 'booking_not_found';
    } else {
      delivery = await sendReviewExpiredNotification({
        reviewWindowId: context.reviewWindowId,
        actorUserId: 'system',
        bookingId: context.bookingId,
        customerEmail: booking.user?.email,
        customerPhone: booking.user?.phone,
        customerName: booking.user?.name,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
      });
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    console.error('[review-notifications] notifyReviewWindowClosedWithoutSubmission error:', e);
  }

  return {
    sent: Boolean(delivery?.anySuccess),
    reason: delivery?.anySuccess ? 'notification_sent' : 'notification_partial_or_skipped',
    context,
    delivery,
    loadError,
  };
}
