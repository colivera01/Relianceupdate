import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as favoritesGET, POST as favoritesPOST } from './route';
import { DELETE as favoriteDELETE } from './[id]/route';
import { getUserIdFromRequest } from '@/lib/auth';
import { getVendorReviewAggregatesForPublic } from '@/lib/public-review-aggregates';

const hoisted = vi.hoisted(() => {
  const favoriteCount = vi.fn();
  const favoriteFindMany = vi.fn();
  const favoriteUpsert = vi.fn();
  const favoriteFindFirst = vi.fn();
  const favoriteDelete = vi.fn();
  const mediaAssetFindMany = vi.fn();
  const serviceFindUnique = vi.fn();
  const userUpsert = vi.fn();

  const prisma = {
    favorite: {
      count: favoriteCount,
      findMany: favoriteFindMany,
      upsert: favoriteUpsert,
      findFirst: favoriteFindFirst,
      delete: favoriteDelete,
    },
    mediaAsset: { findMany: mediaAssetFindMany },
    service: { findUnique: serviceFindUnique },
    user: { upsert: userUpsert },
  };

  return {
    prisma,
    favoriteCount,
    favoriteFindMany,
    favoriteUpsert,
    favoriteFindFirst,
    favoriteDelete,
    mediaAssetFindMany,
    serviceFindUnique,
    userUpsert,
  };
});

vi.mock('@/server/db', () => ({
  prisma: hoisted.prisma,
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock('@/lib/public-review-aggregates', () => ({
  getVendorReviewAggregatesForPublic: vi.fn(),
}));

function getJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

const sampleFavoriteRow = () => ({
  id: 'fav-1',
  createdAt: new Date('2024-03-01T10:00:00.000Z'),
  service: {
    id: 'svc-1',
    name: 'Deep clean',
    description: 'Full home',
    price: 199,
    vendorId: 'ven-1',
    isPublished: true,
    vendor: {
      id: 'ven-1',
      name: 'Acme',
      businessName: 'Acme Co',
      businessType: 'residential',
      category: 'Cleaning',
      city: 'Tampa',
      state: 'FL',
      isPubliclyListed: true,
    },
  },
});

describe('GET /api/users/favorites', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.favoriteCount.mockReset();
    hoisted.favoriteFindMany.mockReset();
    hoisted.mediaAssetFindMany.mockReset();
    vi.mocked(getVendorReviewAggregatesForPublic).mockReset();
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(new Map());
  });

  it('returns 401 when no identity (no auth, no userId query)', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/users/favorites');
    const res = await favoritesGET(req);
    expect(res.status).toBe(401);
    const j = await getJson(res);
    expect(j.error).toBe('Authentication required');
    expect(hoisted.favoriteCount).not.toHaveBeenCalled();
  });

  it('returns 200 with empty favorites when user has none', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('user-1');
    hoisted.favoriteCount.mockResolvedValue(0);
    hoisted.favoriteFindMany.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/users/favorites?userId=user-1');
    const res = await favoritesGET(req);
    expect(res.status).toBe(200);
    const j = await getJson(res);
    expect(j.success).toBe(true);
    expect(j.favorites).toEqual([]);
    expect(hoisted.mediaAssetFindMany).not.toHaveBeenCalled();
    expect(hoisted.favoriteCount).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('scopes list to authenticated user when query userId differs (auth wins)', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('alice');
    hoisted.favoriteCount.mockResolvedValue(1);
    hoisted.favoriteFindMany.mockResolvedValue([sampleFavoriteRow()]);
    hoisted.mediaAssetFindMany.mockResolvedValue([]);
    const req = new NextRequest(
      'http://localhost/api/users/favorites?userId=bob&page=1&limit=20'
    );
    const res = await favoritesGET(req);
    expect(res.status).toBe(200);
    expect(hoisted.favoriteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'alice' },
      })
    );
    const j = await getJson(res);
    const favorites = j.favorites as Record<string, unknown>[];
    expect(favorites).toHaveLength(1);
    expect(favorites[0].favoriteId).toBe('fav-1');
    expect(favorites[0].serviceId).toBe('svc-1');
    expect(favorites[0].vendorName).toBe('Acme Co');
    expect((j.pagination as { total: number }).total).toBe(1);
  });

  it('returns 200 with normalized favorites and preview when media exists', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('user-1');
    hoisted.favoriteCount.mockResolvedValue(1);
    hoisted.favoriteFindMany.mockResolvedValue([sampleFavoriteRow()]);
    hoisted.mediaAssetFindMany.mockResolvedValue([
      {
        blobUrl: 'https://cdn.example/p.jpg',
        mediaSession: { serviceId: 'svc-1' },
      },
    ]);
    const agg = new Map([
      ['ven-1', { vendorId: 'ven-1', rating: 4.5, reviewCount: 10 }],
    ]);
    vi.mocked(getVendorReviewAggregatesForPublic).mockResolvedValue(agg);

    const req = new NextRequest('http://localhost/api/users/favorites');
    const res = await favoritesGET(req);
    expect(res.status).toBe(200);
    const j = await getJson(res);
    const favorites = j.favorites as Record<string, unknown>[];
    expect(favorites[0].previewMediaUrl).toBe('https://cdn.example/p.jpg');
    expect(favorites[0].rating).toBe(4.5);
    expect(favorites[0].reviewCount).toBe(10);
    expect(hoisted.mediaAssetFindMany).toHaveBeenCalled();
  });
});

describe('POST /api/users/favorites', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.serviceFindUnique.mockReset();
    hoisted.userUpsert.mockReset();
    hoisted.favoriteUpsert.mockReset();
  });

  it('returns 401 when no user identity', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/users/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });
    const res = await favoritesPOST(req);
    expect(res.status).toBe(401);
    expect(hoisted.serviceFindUnique).not.toHaveBeenCalled();
  });

  it('resolves user from x-user-id when auth cookie is absent', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    hoisted.serviceFindUnique.mockResolvedValue({ id: 'svc-1', vendor: { id: 'v1' } });
    hoisted.userUpsert.mockResolvedValue({ id: 'header-user' });
    hoisted.favoriteUpsert.mockResolvedValue({
      id: 'f-new',
      serviceId: 'svc-1',
      createdAt: new Date('2024-04-01T12:00:00.000Z'),
    });
    const req = new NextRequest('http://localhost/api/users/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'header-user',
      },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });
    const res = await favoritesPOST(req);
    expect(res.status).toBe(200);
    expect(hoisted.userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'header-user' },
      })
    );
    expect(hoisted.favoriteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_serviceId: { userId: 'header-user', serviceId: 'svc-1' } },
      })
    );
  });

  it('returns 400 when serviceId is missing', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    const req = new NextRequest('http://localhost/api/users/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await favoritesPOST(req);
    expect(res.status).toBe(400);
    const j = await getJson(res);
    expect(j.error).toBe('serviceId is required');
  });

  it('returns 404 when service does not exist', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.serviceFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/users/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'missing-svc' }),
    });
    const res = await favoritesPOST(req);
    expect(res.status).toBe(404);
    expect(hoisted.userUpsert).not.toHaveBeenCalled();
  });

  it('returns 200 on upsert (idempotent / duplicate-friendly)', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.serviceFindUnique.mockResolvedValue({ id: 'svc-1', vendor: { id: 'ven-1' } });
    hoisted.userUpsert.mockResolvedValue({ id: 'u1' });
    hoisted.favoriteUpsert.mockResolvedValue({
      id: 'existing-fav',
      serviceId: 'svc-1',
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
    });
    const req = new NextRequest('http://localhost/api/users/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'svc-1' }),
    });
    const res = await favoritesPOST(req);
    expect(res.status).toBe(200);
    const j = await getJson(res);
    expect(j.success).toBe(true);
    expect((j.favorite as { favoriteId: string }).favoriteId).toBe('existing-fav');
    expect(hoisted.favoriteUpsert).toHaveBeenCalledTimes(1);
  });

  it('accepts service_id alias in JSON body', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.serviceFindUnique.mockResolvedValue({ id: 'svc-2', vendor: { id: 'v1' } });
    hoisted.userUpsert.mockResolvedValue({ id: 'u1' });
    hoisted.favoriteUpsert.mockResolvedValue({
      id: 'f2',
      serviceId: 'svc-2',
      createdAt: new Date(),
    });
    const req = new NextRequest('http://localhost/api/users/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: 'svc-2' }),
    });
    const res = await favoritesPOST(req);
    expect(res.status).toBe(200);
    expect(hoisted.serviceFindUnique).toHaveBeenCalledWith({
      where: { id: 'svc-2' },
      select: expect.any(Object),
    });
  });
});

describe('DELETE /api/users/favorites/[id]', () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    hoisted.favoriteFindFirst.mockReset();
    hoisted.favoriteDelete.mockReset();
  });

  it('returns 401 when no user identity', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/users/favorites/fav-1', { method: 'DELETE' });
    const res = await favoriteDELETE(req, { params: Promise.resolve({ id: 'fav-1' }) });
    expect(res.status).toBe(401);
    expect(hoisted.favoriteFindFirst).not.toHaveBeenCalled();
  });

  it('returns 400 when id param is empty', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    const req = new NextRequest('http://localhost/api/users/favorites/', { method: 'DELETE' });
    const res = await favoriteDELETE(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
    expect(hoisted.favoriteFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when favorite not found for user', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.favoriteFindFirst.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/users/favorites/unknown', { method: 'DELETE' });
    const res = await favoriteDELETE(req, { params: Promise.resolve({ id: 'unknown' }) });
    expect(res.status).toBe(404);
    expect(hoisted.favoriteDelete).not.toHaveBeenCalled();
    expect(hoisted.favoriteFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        OR: [{ id: 'unknown' }, { serviceId: 'unknown' }],
      },
      select: { id: true, serviceId: true },
    });
  });

  it('returns 200 and deletes by favorite id', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.favoriteFindFirst.mockResolvedValue({ id: 'fav-internal', serviceId: 'svc-9' });
    hoisted.favoriteDelete.mockResolvedValue({});
    const req = new NextRequest('http://localhost/api/users/favorites/fav-internal', {
      method: 'DELETE',
    });
    const res = await favoriteDELETE(req, { params: Promise.resolve({ id: 'fav-internal' }) });
    expect(res.status).toBe(200);
    const j = await getJson(res);
    expect(j.success).toBe(true);
    expect((j.removed as { favoriteId: string }).favoriteId).toBe('fav-internal');
    expect(hoisted.favoriteDelete).toHaveBeenCalledWith({ where: { id: 'fav-internal' } });
  });

  it('returns 200 when matching by serviceId (OR branch)', async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue('u1');
    hoisted.favoriteFindFirst.mockResolvedValue({ id: 'fav-real', serviceId: 'svc-x' });
    hoisted.favoriteDelete.mockResolvedValue({});
    const req = new NextRequest('http://localhost/api/users/favorites/svc-x', { method: 'DELETE' });
    const res = await favoriteDELETE(req, { params: Promise.resolve({ id: 'svc-x' }) });
    expect(res.status).toBe(200);
    expect(hoisted.favoriteFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        OR: [{ id: 'svc-x' }, { serviceId: 'svc-x' }],
      },
      select: { id: true, serviceId: true },
    });
    expect(hoisted.favoriteDelete).toHaveBeenCalledWith({ where: { id: 'fav-real' } });
  });
});
