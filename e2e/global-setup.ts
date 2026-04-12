import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';

const CUSTOMER_ID = 'e2e-smoke-customer';
const CUSTOMER_EMAIL = 'e2e-smoke-customer@reliance.test';
const VENDOR_EMAIL = 'e2e-smoke-vendor@reliance.test';
const SERVICE_NAME = 'E2E Smoke Service';
/** Stable title so we can reset the chain on each globalSetup run. */
const REVIEW_SMOKE_BOOKING_TITLE = 'E2E Review Smoke';
/** Public short MP4 playable in Chromium for review capture UI (soft prompt after play). */
const REVIEW_SMOKE_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

async function deleteReviewSmokeChain(prisma: PrismaClient, bookingId: string) {
  await prisma.review.deleteMany({ where: { bookingId } });
  await prisma.reviewWindow.deleteMany({ where: { bookingId } });
  await prisma.mediaAsset.deleteMany({
    where: { mediaSession: { bookingId } },
  });
  await prisma.mediaSession.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
}

/**
 * Ensures Prisma user id matches dev login (`src/lib/dev-registered-users.ts`)
 * and a published service under a publicly listed vendor for Discover + booking.
 */
export default async function globalSetup() {
  const root = path.join(__dirname, '..');
  loadEnv({ path: path.join(root, '.env.local') });
  loadEnv({ path: path.join(root, '.env') });

  const fixturePath = path.join(__dirname, 'smoke-fixture.json');

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'E2E global-setup: DATABASE_URL is required (set in .env / .env.local) so Prisma can upsert the smoke user and listing.'
    );
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.upsert({
      where: { id: CUSTOMER_ID },
      create: {
        id: CUSTOMER_ID,
        email: CUSTOMER_EMAIL,
        name: 'E2E Smoke',
        demo: true,
      },
      update: {
        email: CUSTOMER_EMAIL,
        name: 'E2E Smoke',
      },
    });

    let vendor = await prisma.vendor.findFirst({ where: { email: VENDOR_EMAIL } });
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          name: 'E2E Smoke Vendor',
          businessName: 'E2E Smoke Vendor',
          email: VENDOR_EMAIL,
          phone: '555-0199',
          demo: true,
          isPubliclyListed: true,
        },
      });
    } else {
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: { isPubliclyListed: true },
      });
    }

    let service = await prisma.service.findFirst({
      where: { vendorId: vendor.id, name: SERVICE_NAME },
    });
    if (!service) {
      service = await prisma.service.create({
        data: {
          vendorId: vendor.id,
          name: SERVICE_NAME,
          description: 'Minimal listing for browser smoke (pass 1).',
          price: 49.99,
          demo: true,
          isPublished: true,
        },
      });
    } else {
      service = await prisma.service.update({
        where: { id: service.id },
        data: { isPublished: true },
      });
    }

    const existingReviewBookings = await prisma.booking.findMany({
      where: { userId: CUSTOMER_ID, title: REVIEW_SMOKE_BOOKING_TITLE },
      select: { id: true },
    });
    for (const row of existingReviewBookings) {
      await deleteReviewSmokeChain(prisma, row.id);
    }

    const completedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);

    let bookingId: string;
    let reviewVendorId: string;
    let reviewMediaSessionId: string;

    try {
      const out = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            userId: CUSTOMER_ID,
            serviceId: service.id,
            vendorId: vendor.id,
            title: REVIEW_SMOKE_BOOKING_TITLE,
            status: 'COMPLETED',
            scheduledFor: completedAt,
            date: completedAt,
            amount: 49.99,
            demo: true,
          },
        });

        const mediaSession = await tx.mediaSession.create({
          data: {
            vendorId: vendor.id,
            userId: CUSTOMER_ID,
            bookingId: booking.id,
            serviceId: service.id,
            sessionType: 'SERVICE_RECORD',
            status: 'COMPLETED',
            title: 'E2E review smoke capture',
          },
        });

        await tx.mediaAsset.create({
          data: {
            vendorId: vendor.id,
            mediaSessionId: mediaSession.id,
            bytes: BigInt(2048),
            mimeType: 'video/mp4',
            blobKey: `e2e-smoke/${booking.id}/review-smoke.mp4`,
            blobUrl: REVIEW_SMOKE_VIDEO_URL,
            moderationStatus: 'approved',
            visibilityStatus: 'customer_only',
            archiveStatus: 'active',
          },
        });

        await tx.consentRecord.create({
          data: {
            token: `e2e-review-smoke-${booking.id}-${Date.now()}`,
            bookingId: booking.id,
            vendorId: vendor.id,
            mediaSessionId: mediaSession.id,
            consentType: 'video_access',
            status: 'accepted',
            acceptedAt: new Date(),
          },
        });

        return {
          bookingId: booking.id,
          vendorId: vendor.id,
          mediaSessionId: mediaSession.id,
        };
      });
      bookingId = out.bookingId;
      reviewVendorId = out.vendorId;
      reviewMediaSessionId = out.mediaSessionId;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
        throw new Error(
          'E2E global-setup (review smoke): a required table is missing (e.g. dbo.consent_records or review/media tables). Apply Prisma migrations to this DATABASE_URL before npm run test:e2e:smoke:review.'
        );
      }
      throw e;
    }

    const payload = {
      serviceId: service.id,
      serviceNameSearch: 'E2E Smoke',
      customerEmail: CUSTOMER_EMAIL,
      reviewBookingId: bookingId,
      reviewVendorId,
      reviewMediaSessionId,
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  } finally {
    await prisma.$disconnect();
  }
}
