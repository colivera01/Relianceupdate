import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from '@/lib/account-status';
import { generateDownloadUrl } from '@/lib/azure-blob-storage';
import { getVisibilityStatusesForAudience } from '@/lib/media-visibility';
import { loadAuthorizedPrivateProof, recordPrivateProofAccessBestEffort } from '@/lib/service-video-evidence';

type RouteContext = {
  params: Promise<{ id: string; assetId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await ensureUserAccountCanAct(userId);

    const { id: bookingId, assetId } = await context.params;
    if (!bookingId || !assetId) {
      return NextResponse.json({ success: false, error: 'bookingId and assetId are required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    if (String(booking.userId) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden: booking does not belong to this user' }, { status: 403 });
    }

    const privateProof = await loadAuthorizedPrivateProof({ bookingId, customerUserId: userId });
    if (!privateProof || !privateProof.assetIds.includes(assetId)) {
      return NextResponse.json(
        { success: false, error: 'Private Service Video approval evidence is incomplete' },
        { status: 403 }
      );
    }

    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        blobKey: true,
        blobUrl: true,
        mimeType: true,
        moderationStatus: true,
        visibilityStatus: true,
        archiveStatus: true,
        mediaSession: {
          select: {
            bookingId: true,
          },
        },
      },
    });
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Media asset not found' }, { status: 404 });
    }

    const allowedVisibility = getVisibilityStatusesForAudience('customer').map((v) => String(v).toLowerCase());
    const moderationOk = String(asset.moderationStatus || '').toLowerCase() === 'approved';
    const visibilityOk = allowedVisibility.includes(String(asset.visibilityStatus || '').toLowerCase());
    const archiveOk = String(asset.archiveStatus || '').toLowerCase() === 'active';
    const bookingMatch = String(asset?.mediaSession?.bookingId || '') === bookingId;
    if (!bookingMatch || !moderationOk || !visibilityOk || !archiveOk) {
      return NextResponse.json({ success: false, error: 'Asset is not available for customer playback' }, { status: 403 });
    }

    let secureUrl = '';
    try {
      secureUrl = await generateDownloadUrl(String(asset.blobKey || ''), 60);
    } catch {
      secureUrl = String(asset.blobUrl || '').trim();
    }
    if (!secureUrl) {
      return NextResponse.json({ success: false, error: 'Playable URL is unavailable for this media asset' }, { status: 500 });
    }

    await recordPrivateProofAccessBestEffort({
      accessGrantId: privateProof.grant.id,
      packageId: privateProof.package.id,
      bookingId,
      mediaAssetId: assetId,
      actorUserId: userId,
      eventType: 'DOWNLOAD',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.redirect(secureUrl, { status: 302, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error: any) {
    console.error('[bookings/:id/media/:assetId/download] GET error:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to resolve customer media download', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
