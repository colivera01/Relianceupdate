import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const hoisted = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    service: {
      count: hoisted.count,
      findMany: hoisted.findMany,
    },
  },
}));

vi.mock('@/lib/request-actor', () => ({
  resolveRequestActor: vi.fn(async () => null),
  requireActorVendorMembership: vi.fn(),
  requireActorVendorManager: vi.fn(),
  requireRequestActor: vi.fn(),
  authorizationErrorResponse: vi.fn(() => null),
}));

describe('GET /api/services public inventory', () => {
  beforeEach(() => {
    hoisted.count.mockReset();
    hoisted.findMany.mockReset();
    hoisted.count.mockResolvedValue(0);
    hoisted.findMany.mockResolvedValue([]);
  });

  it('applies canonical demo exclusions to unauthenticated service listing', async () => {
    const response = await GET(new Request('http://localhost/api/services?limit=100') as any);

    expect(response.status).toBe(200);
    const where = hoisted.findMany.mock.calls[0][0].where;
    expect(where.demo).toBe(false);
    expect(where.vendor).toEqual(
      expect.objectContaining({
        demo: false,
        isPubliclyListed: true,
        accountStatus: 'active',
      }),
    );
  });

  it('matches an Electrician filter against Electro historical category values', async () => {
    await GET(new Request('http://localhost/api/services?category=Electrician') as any);

    const where = hoisted.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      {
        vendor: {
          category: {
            in: ['Electrician', 'Electrical', 'Electrical Services', 'Electrical service'],
          },
        },
      },
      {
        vendor: {
          businessType: {
            in: ['Electrician', 'Electrical', 'Electrical Services', 'Electrical service'],
          },
        },
      },
    ]);
  });
});
