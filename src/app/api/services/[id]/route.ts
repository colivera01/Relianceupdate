import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { accountStatusErrorBody, AccountStatusError, isVendorAccountRestricted } from '@/lib/account-status';
import { getApprovedActiveBaseWhere, getVisibilityStatusesForAudience } from '@/lib/media-visibility';
import { getVendorReviewAggregatesForPublic } from '@/lib/public-review-aggregates';
import {
  isCompletedStageProofVideo,
  shouldIncludeAssetForCustomerPublicProof,
} from '@/lib/proof-media-policy';
import {
  cleanPublicServiceDescription,
  cleanPublicServiceName,
  cleanPublicServicePrice,
} from '@/lib/launch-content-cleanup';
import { countableReviewWhere } from '@/lib/metrics-exclusion';
import {
  isTransientDbConnectivityError,
  PUBLIC_DB_UNAVAILABLE_CODE,
  PUBLIC_DB_UNAVAILABLE_MESSAGE,
  withTransientDbRetry,
} from '@/lib/transient-db-errors';
import { resolveVendorAccessForUser } from '@/lib/vendor-context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceIdParam } = await params;
    const serviceId = String(serviceIdParam);

    // DB-first service lookup (real service IDs are string/cuid).
    const dbService = await withTransientDbRetry(() =>
      prisma.service.findUnique({
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
              accountStatus: true,
              insuranceStatus: true,
              bondingStatus: true,
            },
          },
        },
      })
    );

    if (dbService) {
      if (
        !dbService.isPublished ||
        !dbService.vendor?.isPubliclyListed ||
        isVendorAccountRestricted((dbService.vendor as any)?.accountStatus)
      ) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }

      // Public-safe media only: approved + public + active.
      const publicAssets = await withTransientDbRetry<any[]>(() =>
        (prisma as any).mediaAsset.findMany({
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
            id: true,
            mimeType: true,
            blobUrl: true,
            createdAt: true,
            mediaSession: {
              select: {
                vendorJobVideoStage: true,
                sessionType: true,
              },
            },
          },
        })
      );

      const proofSafeAssets = publicAssets.filter((asset: any) =>
        shouldIncludeAssetForCustomerPublicProof(asset?.mediaSession || null)
      );

      const mediaUrls = proofSafeAssets
        .map((asset: any) => String(asset?.blobUrl || '').trim())
        .filter(Boolean);

      const images = proofSafeAssets
        .filter((asset: any) => String(asset?.mimeType || '').startsWith('image/'))
        .map((asset: any) => String(asset.blobUrl));
      const videoAssets = proofSafeAssets.filter((asset: any) =>
        String(asset?.mimeType || '').startsWith('video/')
      );
      const primaryProofVideo = videoAssets.find((asset: any) =>
        isCompletedStageProofVideo(asset?.mediaSession || null)
      );
      const videos = videoAssets.map((asset: any) => String(asset.blobUrl));
      const videoItems = videoAssets.map((asset: any) => ({
        createdAt: asset?.createdAt?.toISOString?.() || null,
        id: String(asset?.id || ''),
        url: String(asset?.blobUrl || ''),
        stageKey: String(asset?.mediaSession?.vendorJobVideoStage || '').trim().toUpperCase() || null,
        stageLabel:
          String(asset?.mediaSession?.vendorJobVideoStage || '').trim().toUpperCase() === 'INTRO'
            ? 'Before Service'
            : String(asset?.mediaSession?.vendorJobVideoStage || '').trim().toUpperCase() === 'IN_PROGRESS'
              ? 'During Service'
              : String(asset?.mediaSession?.vendorJobVideoStage || '').trim().toUpperCase() === 'COMPLETED'
                ? 'Completed Service'
                : 'Service Video',
        isPrimaryProofVideo: Boolean(primaryProofVideo?.id) && String(asset?.id || '') === String(primaryProofVideo.id),
      }));
      const [vendorReviewAggMap, publicReviewCount] = await Promise.all([
        withTransientDbRetry(() => getVendorReviewAggregatesForPublic([dbService.vendor.id])),
        withTransientDbRetry(() =>
          prisma.review.count({
            where: countableReviewWhere({
              vendorId: dbService.vendor.id,
              moderationStatus: 'approved',
              visibilityStatus: 'public',
              OR: [
                {
                  booking: {
                    is: {
                      serviceId: dbService.id,
                    },
                  },
                },
                {
                  mediaSession: {
                    is: {
                      serviceId: dbService.id,
                    },
                  },
                },
              ],
            }),
          })
        ),
      ]);
      const vendorReviewAgg = vendorReviewAggMap.get(dbService.vendor.id);

      const publicVendorName = dbService.vendor.businessName || dbService.vendor.name;
      const publicServiceName = cleanPublicServiceName(dbService.name, publicVendorName);
      const publicServiceDescription = cleanPublicServiceDescription(dbService.description, publicVendorName);
      const publicServicePrice = cleanPublicServicePrice(
        dbService.price,
        dbService.name,
        dbService.description
      );

      return NextResponse.json({
        service: {
          id: dbService.id,
          name: publicServiceName,
          description: publicServiceDescription,
          category: dbService.vendor?.category || 'General',
          price: publicServicePrice,
          duration: 'Varies',
          vendor: {
            id: dbService.vendor.id,
            name: publicVendorName,
            location:
              [dbService.vendor.city, dbService.vendor.state].filter(Boolean).join(', ') || 'Unknown',
            phone: dbService.vendor.phone || null,
            email: dbService.vendor.email || null,
            rating: vendorReviewAgg?.rating ?? null,
            reviewCount: vendorReviewAgg?.reviewCount ?? null,
            isPubliclyListed: Boolean(dbService.vendor.isPubliclyListed),
            insurance: Boolean(String((dbService.vendor as any).insuranceStatus || '').trim()),
            bonded: Boolean(String((dbService.vendor as any).bondingStatus || '').trim()),
          },
          images,
          videos,
          videoItems,
          primaryProofVideoUrl: primaryProofVideo ? String(primaryProofVideo.blobUrl || '') : null,
          hasPrimaryProofVideo: Boolean(primaryProofVideo),
          publicReviewCount,
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
    if (isTransientDbConnectivityError(error)) {
      return NextResponse.json(
        {
          code: PUBLIC_DB_UNAVAILABLE_CODE,
          error: PUBLIC_DB_UNAVAILABLE_MESSAGE,
        },
        { status: 503 }
      );
    }
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
      select: {
        id: true,
        vendorId: true,
        isPublished: true,
        publishedAt: true,
        vendor: { select: { accountStatus: true } },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isVendorAccountRestricted((existing as any).vendor?.accountStatus)) {
      const statusError = new AccountStatusError('vendor', (existing as any).vendor?.accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }
    const vendorAccess = await resolveVendorAccessForUser(userId, {
      preferredVendorId: existing.vendorId,
    });
    const canMutateService =
      vendorAccess.vendorId === existing.vendorId &&
      (vendorAccess.state === 'ACTIVE' || vendorAccess.state === 'PENDING');
    if (!canMutateService) {
      return NextResponse.json(
        { error: 'Forbidden: Vendor ownership required' },
        { status: 403 }
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
      select: { id: true, vendorId: true, vendor: { select: { accountStatus: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isVendorAccountRestricted((existing as any).vendor?.accountStatus)) {
      const statusError = new AccountStatusError('vendor', (existing as any).vendor?.accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }
    const vendorAccess = await resolveVendorAccessForUser(userId, {
      preferredVendorId: existing.vendorId,
    });
    const canMutateService =
      vendorAccess.vendorId === existing.vendorId &&
      (vendorAccess.state === 'ACTIVE' || vendorAccess.state === 'PENDING');
    if (!canMutateService) {
      return NextResponse.json(
        { error: 'Forbidden: Vendor ownership required' },
        { status: 403 }
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
