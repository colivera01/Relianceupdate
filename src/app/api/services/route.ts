import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { accountStatusErrorBody, AccountStatusError, isVendorAccountRestricted } from '@/lib/account-status';
import {
  authorizationErrorResponse,
  requireActorVendorMembership,
  requireActorVendorManager,
  requireRequestActor,
  resolveRequestActor,
} from '@/lib/request-actor';

function parsePositiveNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function mapServiceRow(service: any) {
  const lifecycleStatus = service.isPublished
    ? 'active'
    : service.publishedAt
      ? 'archived'
      : 'pending_approval';
  return {
    id: service.id,
    name: service.name,
    description: service.description || '',
    price: Number(service.price),
    vendor_id: service.vendorId,
    vendorId: service.vendorId,
    isPublished: Boolean(service.isPublished),
    publishedAt: service.publishedAt ? new Date(service.publishedAt).toISOString() : null,
    lifecycleStatus,
    created_at: service.createdAt ? new Date(service.createdAt).toISOString() : null,
    updated_at: service.updatedAt ? new Date(service.updatedAt).toISOString() : null,
    vendor: service.vendor
      ? {
          id: service.vendor.id,
          name: service.vendor.businessName || service.vendor.name,
          businessName: service.vendor.businessName || null,
          category: service.vendor.category || null,
          businessType: service.vendor.businessType || null,
          location:
            [service.vendor.city, service.vendor.state].filter(Boolean).join(', ') || null,
          isPubliclyListed: Boolean(service.vendor.isPubliclyListed),
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const category = String(searchParams.get('category') || '').trim();
    const vendorId = String(searchParams.get('vendorId') || '').trim();
    const priceMin = parsePositiveNumber(searchParams.get('priceMin'));
    const priceMax = parsePositiveNumber(searchParams.get('priceMax'));
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = String(searchParams.get('sortBy') || 'created_at').trim().toLowerCase();
    const sortOrder = String(searchParams.get('sortOrder') || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
    let canViewVendorPrivate = false;
    if (vendorId) {
      try {
        const actor = await resolveRequestActor(request);
        if (actor) {
          requireActorVendorMembership(actor, vendorId);
          canViewVendorPrivate = true;
        }
      } catch {
        canViewVendorPrivate = false;
      }
    }

    const where: any = {
      ...(vendorId ? { vendorId } : {}),
      ...(!canViewVendorPrivate
        ? {
            isPublished: true,
            vendor: {
              isPubliclyListed: true,
              accountStatus: 'active',
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
      ...(priceMin != null || priceMax != null
        ? {
            price: {
              ...(priceMin != null ? { gte: priceMin } : {}),
              ...(priceMax != null ? { lte: priceMax } : {}),
            },
          }
        : {}),
      ...(category
        ? {
            OR: [
              { vendor: { category } },
              { vendor: { businessType: category } },
            ],
          }
        : {}),
    };

    const orderBy: any =
      sortBy === 'price'
        ? { price: sortOrder }
        : sortBy === 'name'
        ? { name: sortOrder }
        : { createdAt: sortOrder };

    const [total, rows] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              businessName: true,
              businessType: true,
              category: true,
              city: true,
              state: true,
              isPubliclyListed: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      services: rows.map(mapServiceRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search: search || null,
        category: category || null,
        priceMin,
        priceMax,
        vendorId: vendorId || null,
      },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim();
    const priceValue = Number(body?.price);
    const vendorId = String(body?.vendor_id ?? body?.vendorId ?? '').trim();

    if (!name || !description || !vendorId || !Number.isFinite(priceValue) || priceValue < 0) {
      return NextResponse.json(
        { error: 'Name, description, non-negative price, and vendor ID are required' },
        { status: 400 }
      );
    }
    const actor = await requireRequestActor(request);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, accountStatus: true },
    });
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }
    if (isVendorAccountRestricted((vendor as any).accountStatus)) {
      const statusError = new AccountStatusError('vendor', (vendor as any).accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }

    requireActorVendorManager(actor, vendorId);

    const created = await prisma.service.create({
      data: {
        vendorId,
        name,
        description,
        price: priceValue,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            businessName: true,
            businessType: true,
            category: true,
            city: true,
            state: true,
            isPubliclyListed: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      service: mapServiceRow(created),
      message: 'Service created successfully',
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error('Error creating service:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}

