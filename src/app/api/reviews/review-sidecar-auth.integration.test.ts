import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as promptEventPOST } from './prompt-event/route';
import { POST as sentimentPOST } from './sentiment/route';
import { getUserIdFromRequest } from '@/lib/auth';
import { ensureUserAccountCanAct } from '@/lib/account-status';

const hoisted = vi.hoisted(() => {
  const reviewWindowFindUnique = vi.fn();
  const bookingFindUnique = vi.fn();
  const reviewPromptEventCreate = vi.fn();
  const reviewSentimentCreate = vi.fn();
  return {
    prisma: {
      reviewWindow: {
        findUnique: reviewWindowFindUnique,
      },
      booking: {
        findUnique: bookingFindUnique,
      },
      reviewPromptEvent: {
        create: reviewPromptEventCreate,
      },
      reviewSentiment: {
        create: reviewSentimentCreate,
      },
    },
    reviewWindowFindUnique,
    bookingFindUnique,
    reviewPromptEventCreate,
    reviewSentimentCreate,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock('@/lib/account-status', () => ({
  AccountStatusError: class AccountStatusError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 403) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  accountStatusErrorBody: (error: { message: string }) => ({
    success: false,
    error: error.message,
  }),
  ensureUserAccountCanAct: vi.fn(),
}));

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('review sidecar ownership enforcement', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(ensureUserAccountCanAct).mockReset();
    vi.mocked(ensureUserAccountCanAct).mockResolvedValue(undefined as never);
    hoisted.reviewWindowFindUnique.mockReset();
    hoisted.bookingFindUnique.mockReset();
    hoisted.reviewPromptEventCreate.mockReset();
    hoisted.reviewSentimentCreate.mockReset();
  });

  it('requires customer auth for prompt events', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);

    const res = await promptEventPOST(
      jsonRequest('http://localhost/api/reviews/prompt-event', {
        reviewWindowId: 'rw1',
        eventType: 'soft_prompt_shown',
      }) as any
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/customer context is required/i);
    expect(hoisted.reviewPromptEventCreate).not.toHaveBeenCalled();
  });

  it('blocks prompt events when the review window does not belong to the requester', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'booking-1',
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    });
    hoisted.bookingFindUnique.mockResolvedValue({ userId: 'different-customer' });

    const res = await promptEventPOST(
      jsonRequest('http://localhost/api/reviews/prompt-event', {
        reviewWindowId: 'rw1',
        eventType: 'soft_prompt_shown',
      }) as any
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/does not belong to this user/i);
    expect(hoisted.reviewPromptEventCreate).not.toHaveBeenCalled();
  });

  it('requires customer auth for sentiment writes', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);

    const res = await sentimentPOST(
      jsonRequest('http://localhost/api/reviews/sentiment', {
        reviewWindowId: 'rw1',
        sentiment: 'positive',
      }) as any
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/customer context is required/i);
    expect(hoisted.reviewSentimentCreate).not.toHaveBeenCalled();
  });

  it('allows sentiment writes only when the active review window belongs to the requester', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('customer-1');
    hoisted.reviewWindowFindUnique.mockResolvedValue({
      id: 'rw1',
      bookingId: 'booking-1',
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    });
    hoisted.bookingFindUnique.mockResolvedValue({ userId: 'customer-1' });
    hoisted.reviewSentimentCreate.mockResolvedValue({ id: 'sent-1', reviewWindowId: 'rw1', sentiment: 'positive' });
    hoisted.reviewPromptEventCreate.mockResolvedValue({ id: 'evt-1' });

    const res = await sentimentPOST(
      jsonRequest('http://localhost/api/reviews/sentiment', {
        reviewWindowId: 'rw1',
        sentiment: 'positive',
      }) as any
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(hoisted.reviewSentimentCreate).toHaveBeenCalledWith({
      data: { reviewWindowId: 'rw1', sentiment: 'positive' },
    });
    expect(hoisted.reviewPromptEventCreate).toHaveBeenCalled();
  });
});
