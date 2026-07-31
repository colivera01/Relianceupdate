import { prisma } from '@/server/db';
import { sendReviewInvitationNotification } from '@/lib/notifications/send-review-invitation';

type ReminderContext = {
  reviewWindowId: string;
  bookingId: string;
  vendorId: string;
  mediaSessionId: string;
};

/**
 * Sends the single ordinary invitation when review availability first begins.
 * No deadline-driven follow-up or repeated reminder is scheduled.
 */
export async function sendReviewInvitation(context: ReminderContext) {
  let delivery: Awaited<ReturnType<typeof sendReviewInvitationNotification>> | null = null;
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
      delivery = await sendReviewInvitationNotification({
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
    console.error('[review-notifications] sendReviewInvitation error:', e);
  }

  return {
    queued: false,
    reason: 'single_invitation_best_effort',
    synchronousInvitationAttempt: true,
    context,
    delivery,
    loadError,
  };
}
