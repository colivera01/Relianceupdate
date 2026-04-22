import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from '@/lib/media-visibility';
import { getVendorReviewAggregatesForPublic } from '@/lib/public-review-aggregates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceIdParam } = await params;
    const serviceId = String(serviceIdParam);

    // DB-first service lookup (real service IDs are string/cuid).
    const dbService = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            businessName: true,
            category: true,
            city: true,
            state: true,
            phone: true,
            email: true,
            isPubliclyListed: true,
          },
        },
      },
    });

    if (dbService) {
      if (!dbService.isPublished || !dbService.vendor?.isPubliclyListed) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }

      // Public-safe media only: approved + public + active.
      const publicAssets = await (prisma as any).mediaAsset.findMany({
        where: {
          ...getApprovedActiveBaseWhere(),
          visibilityStatus: {
            in: getVisibilityStatusesForAudience('public'),
          },
          mediaSession: {
            serviceId: dbService.id,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          mimeType: true,
          blobUrl: true,
        },
      });

      const mediaUrls = publicAssets
        .map((asset: any) => String(asset?.blobUrl || '').trim())
        .filter(Boolean);

      const images = publicAssets
        .filter((asset: any) => String(asset?.mimeType || '').startsWith('image/'))
        .map((asset: any) => String(asset.blobUrl));
      const videos = publicAssets
        .filter((asset: any) => String(asset?.mimeType || '').startsWith('video/'))
        .map((asset: any) => String(asset.blobUrl));
      const vendorReviewAgg = (await getVendorReviewAggregatesForPublic([dbService.vendor.id])).get(dbService.vendor.id);

      return NextResponse.json({
        service: {
          id: dbService.id,
          name: dbService.name,
          description: dbService.description || '',
          category: dbService.vendor?.category || 'General',
          price: dbService.price,
          duration: 'Varies',
          vendor: {
            id: dbService.vendor.id,
            name: dbService.vendor.businessName || dbService.vendor.name,
            location:
              [dbService.vendor.city, dbService.vendor.state].filter(Boolean).join(', ') || 'Unknown',
            phone: dbService.vendor.phone || null,
            email: dbService.vendor.email || null,
            rating: vendorReviewAgg?.rating ?? null,
            reviewCount: vendorReviewAgg?.reviewCount ?? null,
          },
          images,
          videos,
          mediaCount: mediaUrls.length,
          status: 'active',
        },
      });
    }
    return NextResponse.json(
      { error: 'Service not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serviceId = String(id);
    const body = await request.json();
    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, vendorId: true, isPublished: true, publishedAt: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    const nextName = body?.name !== undefined ? String(body.name || '').trim() : undefined;
    const nextDescription = body?.description !== undefined ? String(body.description || '').trim() : undefined;
    const nextPrice = body?.price !== undefined ? Number(body.price) : undefined;

    if (nextName !== undefined && !nextName) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }
    if (nextDescription !== undefined && !nextDescription) {
      return NextResponse.json({ error: 'Service description is required' }, { status: 400 });
    }
    if (nextPrice !== undefined && (!Number.isFinite(nextPrice) || nextPrice < 0)) {
      return NextResponse.json({ error: 'Service price must be a non-negative number' }, { status: 400 });
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        ...(nextPrice !== undefined ? { price: nextPrice } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      service: {
        id: updatedService.id,
        vendor_id: updatedService.vendorId,
        vendorId: updatedService.vendorId,
        name: updatedService.name,
        description: updatedService.description || '',
        price: Number(updatedService.price),
        isPublished: Boolean(updatedService.isPublished),
        publishedAt: updatedService.publishedAt ? new Date(updatedService.publishedAt).toISOString() : null,
        created_at: updatedService.createdAt ? new Date(updatedService.createdAt).toISOString() : null,
        updated_at: updatedService.updatedAt ? new Date(updatedService.updatedAt).toISOString() : null,
      },
      message: 'Service updated successfully',
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serviceId = String(id);
    const existing = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
} 