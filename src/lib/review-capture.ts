import { prisma } from '@/server/db';

const VALID_WINDOW_STATUSES = new Set(['active', 'submitted', 'expired', 'closed']);
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
const VALID_SUBMITTED_VIA = new Set(['video_overlay', 'email_link', 'sms_link', 'manual']);

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

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  if (existing) {
    const normalizedStatus = String(existing.status || "").trim().toLowerCase();
    const expiresAtMs = existing.expiresAt ? new Date(existing.expiresAt).getTime() : Number.NaN;
    const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();
    const canReopen = !existing.reviewId && (normalizedStatus === "active" || normalizedStatus === "expired" || normalizedStatus === "closed");

    if (normalizedStatus === "active" && !isExpired) {
      return { window: existing, created: false };
    }

    if (canReopen) {
      const reopened = await (prisma as any).reviewWindow.update({
        where: { id: existing.id },
        data: {
          status: "active",
          openedAt: new Date(),
          expiresAt,
          closedAt: null,
        },
      });
      return { window: reopened, created: false };
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
        expiresAt,
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
        const normalizedStatus = String(fallback.status || "").trim().toLowerCase();
        const fallbackExpiresAtMs = fallback.expiresAt ? new Date(fallback.expiresAt).getTime() : Number.NaN;
        const fallbackExpired = Number.isFinite(fallbackExpiresAtMs) && fallbackExpiresAtMs < Date.now();
        const canReopen = !fallback.reviewId && (normalizedStatus === "active" || normalizedStatus === "expired" || normalizedStatus === "closed");
        if (canReopen && fallbackExpired) {
          const reopened = await (prisma as any).reviewWindow.update({
            where: { id: fallback.id },
            data: {
              status: "active",
              openedAt: new Date(),
              expiresAt,
              closedAt: null,
            },
          });
          return { window: reopened, created: false };
        }
        return { window: fallback, created: false };
      }
    }
    throw error;
  }
}

export async function closeExpiredReviewWindows(now = new Date()) {
  return (prisma as any).reviewWindow.updateMany({
    where: {
      status: 'active',
      expiresAt: { lt: now },
    },
    data: {
      status: 'expired',
      closedAt: now,
    },
  });
}

export async function assertReviewWindowActive(reviewWindowId: string) {
  const window = await (prisma as any).reviewWindow.findUnique({
    where: { id: reviewWindowId },
  });
  if (!window) return { ok: false as const, error: 'Review window not found', status: 404 };
  if (!VALID_WINDOW_STATUSES.has(String(window.status || ''))) {
    return { ok: false as const, error: 'Invalid review window status', status: 409 };
  }
  if (window.status !== 'active') {
    return { ok: false as const, error: `Review window is ${window.status}`, status: 409 };
  }
  if (window.expiresAt && new Date(window.expiresAt).getTime() < Date.now()) {
    await (prisma as any).reviewWindow.update({
      where: { id: reviewWindowId },
      data: { status: 'expired', closedAt: new Date() },
    });
    return { ok: false as const, error: 'Review window expired', status: 409 };
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
    return { ok: false as const, error: "Booking not found for this review window", status: 404 };
  }

  if (String(booking.userId || "") !== String(userId || "")) {
    return {
      ok: false as const,
      error: "Forbidden: review window does not belong to this user",
      status: 403,
    };
  }

  return state;
}
