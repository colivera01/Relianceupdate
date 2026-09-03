import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  isVendorAccountRestricted,
} from '@/lib/account-status';
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from '@/lib/media-visibility';
import { getVendorReviewAggregatesForPublic } from '@/lib/public-review-aggregates';
import { resolveCanonicalPublicAssetIds } from '@/lib/service-video-publication';
import { cleanPublicServiceDescription } from '@/lib/launch-content-cleanup';

type FavoriteType = 'service' | 'vendor' | 'all';

function positiveInt(value: string | null, fallback: number, max = 50): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function favoriteType(value: string | null): FavoriteType {
  const normalized = String(value || 'service').toLowerCase();
  return normalized === 'vendor' || normalized === 'all' ? normalized : 'service';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = String(searchParams.get('userId') || '').trim();
    const countsOnly = searchParams.get('countsOnly') === '1';
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (requestedUserId && requestedUserId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await ensureUserAccountCanAct(userId);

    const type = favoriteType(searchParams.get('type'));
    const search = String(searchParams.get('search') || '').trim();
    const vendorId = String(searchParams.get('vendorId') || '').trim();
    const serviceId = String(searchParams.get('serviceId') || '').trim();
    const requestedPage = positiveInt(searchParams.get('page'), 1, 100000);
    const limit = positiveInt(searchParams.get('limit'), 20);
    const serviceWhere: any = {
      userId,
      ...(serviceId ? { serviceId } : {}),
      ...(search
        ? { OR: [{ service: { name: { contains: search } } }, { service: { vendor: { name: { contains: search } } } }, { service: { vendor: { businessName: { contains: search } } } }] }
        : {}),
    };
    const vendorWhere: any = {
      userId,
      ...(vendorId ? { vendorId } : {}),
      ...(search ? { OR: [{ vendor: { name: { contains: search } } }, { vendor: { businessName: { contains: search } } }] } : {}),
    };

    const [serviceTotal, vendorTotal] = await Promise.all([
      prisma.favorite.count({ where: serviceWhere }),
      (prisma as any).vendorFavorite.count({ where: vendorWhere }),
    ]);
    if (countsOnly) {
      const [serviceVendorRows, directVendorRows] = await Promise.all([
        prisma.favorite.findMany({
          where: { userId },
          select: { service: { select: { vendorId: true } } },
        }),
        (prisma as any).vendorFavorite.findMany({
          where: { userId },
          select: { vendorId: true },
        }),
      ]);
      const uniqueVendorCount = new Set([
        ...serviceVendorRows.map((row: any) => String(row?.service?.vendorId || '')).filter(Boolean),
        ...directVendorRows.map((row: any) => String(row?.vendorId || '')).filter(Boolean),
      ]).size;
      return NextResponse.json({
        success: true,
        summary: { total: serviceTotal + vendorTotal, serviceTotal, vendorTotal, uniqueVendorCount },
      });
    }

    const total = type === 'service' ? serviceTotal : type === 'vendor' ? vendorTotal : serviceTotal + vendorTotal;
    const totalPages = total ? Math.ceil(total / limit) : 0;
    const page = totalPages ? Math.min(requestedPage, totalPages) : 1;
    const skip = (page - 1) * limit;

    const fetchCount = type === 'all' ? skip + limit : limit;
    const [serviceRows, vendorRows] = await Promise.all([
      type === 'vendor'
        ? []
        : prisma.favorite.findMany({
            where: serviceWhere,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: type === 'all' ? 0 : skip,
            take: fetchCount,
            select: {
              id: true,
              createdAt: true,
              service: {
                select: {
                  id: true, name: true, description: true, price: true, vendorId: true, isPublished: true,
                  vendor: { select: { id: true, name: true, businessName: true, businessType: true, category: true, city: true, state: true, isPubliclyListed: true } },
                },
              },
            },
          }),
      type === 'service'
        ? []
        : (prisma as any).vendorFavorite.findMany({
            where: vendorWhere,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: type === 'all' ? 0 : skip,
            take: fetchCount,
            select: {
              id: true,
              createdAt: true,
              vendor: {
                select: {
                  id: true, name: true, businessName: true, businessType: true, category: true, city: true, state: true, isPubliclyListed: true,
                  _count: { select: { services: { where: { isPublished: true } } } },
                },
              },
            },
          }),
    ]);

    const serviceIds = serviceRows.map((row: any) => String(row.service.id));
    const canonicalPublicAssetIds = serviceIds.length ? await resolveCanonicalPublicAssetIds() : [];
    const media = serviceIds.length
      ? await (prisma as any).mediaAsset.findMany({
          where: {
            id: { in: canonicalPublicAssetIds },
            ...getApprovedActiveBaseWhere(),
            visibilityStatus: { in: getVisibilityStatusesForAudience('public') },
            mediaSession: { serviceId: { in: serviceIds } },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, mimeType: true, mediaSession: { select: { serviceId: true } } },
        })
      : [];
    const previewByServiceId = new Map<string, { url: string; type: 'image' | 'video' }>();
    for (const item of media) {
      const serviceId = String(item?.mediaSession?.serviceId || '');
      if (!serviceId || previewByServiceId.has(serviceId)) continue;
      previewByServiceId.set(serviceId, {
        url: `/api/public/media/${item.id}`,
        type: String(item?.mimeType || '').startsWith('video/') ? 'video' : 'image',
      });
    }

    const vendorIds = Array.from(new Set([
      ...serviceRows.map((row: any) => String(row.service.vendorId)),
      ...vendorRows.map((row: any) => String(row.vendor.id)),
    ]));
    const aggregates = await getVendorReviewAggregatesForPublic(vendorIds);
    const serviceItems = serviceRows.map((row: any) => {
      const vendor = row.service.vendor;
      const vendorName = vendor.businessName || vendor.name || 'Service provider';
      const preview = previewByServiceId.get(String(row.service.id)) || null;
      const aggregate = aggregates.get(String(row.service.vendorId));
      return {
        entityType: 'service' as const,
        favoriteId: String(row.id),
        serviceId: String(row.service.id),
        serviceName: String(row.service.name),
        serviceDescription: cleanPublicServiceDescription(row.service.description || '', vendorName),
        price: Number(row.service.price),
        vendorId: String(vendor.id),
        vendorName,
        vendorCategory: vendor.category || null,
        vendorBusinessType: vendor.businessType || null,
        location: [vendor.city, vendor.state].filter(Boolean).join(', ') || null,
        rating: aggregate?.rating ?? null,
        reviewCount: aggregate?.reviewCount ?? null,
        previewMediaUrl: preview?.url || null,
        previewMediaType: preview?.type || null,
        publicListing: { serviceEligible: Boolean(row.service.isPublished && vendor.isPubliclyListed), hasPublicMedia: Boolean(preview) },
        favoritedAt: row.createdAt.toISOString(),
      };
    });
    const vendorItems = vendorRows.map((row: any) => {
      const vendor = row.vendor;
      const aggregate = aggregates.get(String(vendor.id));
      return {
        entityType: 'vendor' as const,
        favoriteId: String(row.id),
        vendorId: String(vendor.id),
        vendorName: String(vendor.businessName || vendor.name || 'Service provider'),
        vendorCategory: vendor.category || null,
        vendorBusinessType: vendor.businessType || null,
        location: [vendor.city, vendor.state].filter(Boolean).join(', ') || null,
        rating: aggregate?.rating ?? null,
        reviewCount: aggregate?.reviewCount ?? null,
        serviceCount: Number(vendor._count?.services || 0),
        isPubliclyListed: Boolean(vendor.isPubliclyListed),
        favoritedAt: row.createdAt.toISOString(),
      };
    });

    const combined = type === 'service'
      ? serviceItems
      : type === 'vendor'
        ? vendorItems
        : [...serviceItems, ...vendorItems]
            .sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt))
            .slice(skip, skip + limit);
    return NextResponse.json({
      success: true,
      favorites: combined,
      items: combined,
      counts: { all: serviceTotal + vendorTotal, services: serviceTotal, vendors: vendorTotal },
      pagination: { page, limit, total, totalPages },
      filter: type,
      search,
    });
  } catch (error: any) {
    console.error('[users/favorites] GET error:', error);
    if (error instanceof AccountStatusError) return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    return NextResponse.json({ error: 'Failed to fetch favorites', details: error?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    const body = await request.json();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (body?.userId && String(body.userId) !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await ensureUserAccountCanAct(userId);

    const entityType = String(body?.entityType || body?.type || 'service').toLowerCase();
    if (entityType === 'vendor') {
      const vendorId = String(body?.vendorId || '').trim();
      if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, isPubliclyListed: true, accountStatus: true },
      });
      if (!vendor || !vendor.isPubliclyListed || isVendorAccountRestricted(vendor.accountStatus)) {
        return NextResponse.json({ error: 'Vendor unavailable' }, { status: 404 });
      }
      const favorite = await (prisma as any).vendorFavorite.upsert({
        where: { userId_vendorId: { userId, vendorId } },
        update: {},
        create: { userId, vendorId },
        select: { id: true, vendorId: true, createdAt: true },
      });
      return NextResponse.json({
        success: true,
        favorite: { entityType: 'vendor', favoriteId: favorite.id, vendorId: favorite.vendorId, favoritedAt: favorite.createdAt.toISOString() },
        message: 'Vendor saved',
      });
    }
    if (entityType !== 'service') return NextResponse.json({ error: 'Unsupported favorite type' }, { status: 422 });

    const serviceId = String(body?.serviceId || body?.service_id || '').trim();
    if (!serviceId) return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, isPublished: true, vendor: { select: { id: true, isPubliclyListed: true, accountStatus: true } } },
    });
    if (!service || !service.isPublished || !service.vendor?.isPubliclyListed || isVendorAccountRestricted(service.vendor.accountStatus)) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 404 });
    }
    const favorite = await prisma.favorite.upsert({
      where: { userId_serviceId: { userId, serviceId } },
      update: {},
      create: { userId, serviceId },
      select: { id: true, serviceId: true, createdAt: true },
    });
    return NextResponse.json({
      success: true,
      favorite: { entityType: 'service', favoriteId: favorite.id, serviceId: favorite.serviceId, favoritedAt: favorite.createdAt.toISOString() },
      message: 'Service saved',
    });
  } catch (error: any) {
    console.error('[users/favorites] POST error:', error);
    if (error instanceof AccountStatusError) return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    return NextResponse.json({ error: 'Failed to add favorite', details: error?.message || 'Unknown error' }, { status: 500 });
  }
}
