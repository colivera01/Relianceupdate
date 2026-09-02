import { prisma } from '@/server/db';

const VALID_WINDOW_STATUSES = new Set(['active', 'submitted', 'expired', 'closed']);
// ReviewWindow.expiresAt remains required by the current schema for compatibility.
// Phase 1 no longer uses it for eligibility or closes review opportunities by time.
const NON_EXPIRING_COMPATIBILITY_DATE = new Date('9999-12-31T23:59:59.999Z');
const VALID_PROMPT_EVENTS = new Set([
  'soft_prompt_shown',
  'reinforcement_prompt_shown',
  'exit_prompt_shown',
  'dismissed',
  'clicked_positive',
  'clicked_neutral',
  'clicked_negative',
  'quick_review_opened',
  'quick_review_submitted',
  'private_feedback_opened',
]);
const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);
const VALID_SUBMITTED_VIA = new Set(['video_overlay', 'email_link', 'sms_link', 'manual', 'service_record']);

export function isValidPromptEvent(eventType: string) {
  return VALID_PROMPT_EVENTS.has(eventType);
}

export function isValidSentiment(sentiment: string) {
  return VALID_SENTIMENTS.has(sentiment);
}

export function isValidSubmittedVia(value: string) {
  return VALID_SUBMITTED_VIA.has(value);
}

export async function getOrCreateActiveReviewWindow(input: {
  bookingId: string;
  vendorId: string;
  mediaSessionId: string;
}): Promise<{ window: any; created: boolean }> {
  const existing = await (prisma as any).reviewWindow.findFirst({
    where: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      mediaSessionId: input.mediaSessionId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const normalizedStatus = String(existing.status || '').trim().toLowerCase();
    const canNormalize =
      !existing.reviewId && ['active', 'expired', 'closed'].includes(normalizedStatus);

    if (canNormalize) {
      if (normalizedStatus === 'active') {
        return { window: existing, created: false };
      }
      const normalized = await (prisma as any).reviewWindow.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          expiresAt: NON_EXPIRING_COMPATIBILITY_DATE,
          closedAt: null,
        },
      });
      return { window: normalized, created: false };
    }
  }

  try {
    const createdRow = await (prisma as any).reviewWindow.create({
      data: {
        bookingId: input.bookingId,
        vendorId: input.vendorId,
        mediaSessionId: input.mediaSessionId,
        status: 'active',
        openedAt: new Date(),
        expiresAt: NON_EXPIRING_COMPATIBILITY_DATE,
      },
    });
    return { window: createdRow, created: true };
  } catch (error: any) {
    // Handle race/constraint cases where another row now exists for this tuple.
    if (String(error?.code || '').toUpperCase() === 'P2002') {
      const fallback = await (prisma as any).reviewWindow.findFirst({
        where: {
          bookingId: input.bookingId,
          vendorId: input.vendorId,
          mediaSessionId: input.mediaSessionId,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (fallback) {
        const normalizedStatus = String(fallback.status || '').trim().toLowerCase();
        const canNormalize =
          !fallback.reviewId && ['active', 'expired', 'closed'].includes(normalizedStatus);
        if (canNormalize) {
          if (normalizedStatus === 'active') {
            return { window: fallback, created: false };
          }
          const normalized = await (prisma as any).reviewWindow.update({
            where: { id: fallback.id },
            data: {
              status: 'active',
              expiresAt: NON_EXPIRING_COMPATIBILITY_DATE,
              closedAt: null,
            },
          });
          return { window: normalized, created: false };
        }
        return { window: fallback, created: false };
      }
    }
    throw error;
  }
}

export async function assertReviewWindowActive(reviewWindowId: string) {
  let window = await (prisma as any).reviewWindow.findUnique({
    where: { id: reviewWindowId },
  });
  if (!window) return { ok: false as const, error: 'Review opportunity not found', status: 404 };
  if (!VALID_WINDOW_STATUSES.has(String(window.status || ''))) {
    return { ok: false as const, error: 'Invalid review opportunity status', status: 409 };
  }
  if (window.reviewId || String(window.status || '').toLowerCase() === 'submitted') {
    return { ok: false as const, error: 'A review already exists for this service', status: 409 };
  }
  if (['expired', 'closed'].includes(String(window.status || '').toLowerCase())) {
    window = await (prisma as any).reviewWindow.update({
      where: { id: reviewWindowId },
      data: {
        status: 'active',
        expiresAt: NON_EXPIRING_COMPATIBILITY_DATE,
        closedAt: null,
      },
    });
  }
  return { ok: true as const, window };
}

export async function assertReviewWindowActiveForUser(
  reviewWindowId: string,
  userId: string
) {
  const state = await assertReviewWindowActive(reviewWindowId);
  if (!state.ok) return state;

  const booking = await (prisma as any).booking.findUnique({
    where: { id: String(state.window.bookingId || "") },
    select: { userId: true },
  });

  if (!booking) {
    return { ok: false as const, error: 'Booking not found for this review opportunity', status: 404 };
  }

  if (String(booking.userId || "") !== String(userId || "")) {
    return {
      ok: false as const,
      error: 'Forbidden: review opportunity does not belong to this user',
      status: 403,
    };
  }

  return state;
}
