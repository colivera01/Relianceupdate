import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    reviewWindow: {
      findFirst: hoisted.findFirst,
      findUnique: hoisted.findUnique,
      create: hoisted.create,
      update: hoisted.update,
    },
  },
}));

import { assertReviewWindowActive, getOrCreateActiveReviewWindow } from './review-capture';

describe('deadline-free review availability', () => {
  beforeEach(() => {
    hoisted.findFirst.mockReset();
    hoisted.findUnique.mockReset();
    hoisted.create.mockReset();
    hoisted.update.mockReset();
  });

  it('does not reject an active review opportunity whose legacy timestamp is older than 72 hours', async () => {
    const legacy = {
      id: 'rw-active-old',
      bookingId: 'booking-1',
      vendorId: 'vendor-1',
      mediaSessionId: 'media-1',
      status: 'active',
      reviewId: null,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    };
    hoisted.findUnique.mockResolvedValue(legacy);

    const result = await assertReviewWindowActive(legacy.id);

    expect(result.ok).toBe(true);
    expect(hoisted.update).not.toHaveBeenCalled();
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it.each(['expired', 'closed'])('normalizes an old %s unsubmitted row without creating a review', async (status) => {
    const legacy = {
      id: `rw-${status}`,
      bookingId: 'booking-1',
      vendorId: 'vendor-1',
      mediaSessionId: 'media-1',
      status,
      reviewId: null,
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      closedAt: new Date('2020-01-02T00:00:00.000Z'),
    };
    const normalized = {
      ...legacy,
      status: 'active',
      closedAt: null,
      expiresAt: new Date('9999-12-31T23:59:59.999Z'),
    };
    hoisted.findUnique.mockResolvedValue(legacy);
    hoisted.update.mockResolvedValue(normalized);

    const result = await assertReviewWindowActive(legacy.id);

    expect(result.ok).toBe(true);
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: legacy.id },
      data: {
        status: 'active',
        expiresAt: new Date('9999-12-31T23:59:59.999Z'),
        closedAt: null,
      },
    });
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it('creates new compatibility rows without a real review deadline', async () => {
    hoisted.findFirst.mockResolvedValue(null);
    hoisted.create.mockImplementation(async ({ data }) => ({ id: 'rw-new', ...data }));

    const result = await getOrCreateActiveReviewWindow({
      bookingId: 'booking-1',
      vendorId: 'vendor-1',
      mediaSessionId: 'media-1',
    });

    expect(result.created).toBe(true);
    expect(hoisted.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'active',
        expiresAt: new Date('9999-12-31T23:59:59.999Z'),
      }),
    });
  });
});
