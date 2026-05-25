import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';

const CUSTOMER_ID = 'e2e-smoke-customer';
const CUSTOMER_EMAIL = 'e2e-smoke-customer@reliance.test';
const CUSTOMER_PREF_OFF_ID = 'e2e-location-pref-off-customer';
const CUSTOMER_PREF_OFF_EMAIL = 'e2e-location-pref-off@reliance.test';
const CUSTOMER_MISSING_COORDS_ID = 'e2e-location-missing-coords-customer';
const CUSTOMER_MISSING_COORDS_EMAIL = 'e2e-location-missing-coords@reliance.test';
const VENDOR_EMAIL = 'e2e-smoke-vendor@reliance.test';
const SERVICE_NAME = 'E2E Smoke Service';
const E2E_VENDOR_COORDINATES = {
  address: '350 5th Ave',
  city: 'New York',
  state: 'NY',
  zipCode: '10118',
  latitude: 40.7484,
  longitude: -73.9857,
};
const E2E_DISTANCE_ORIGIN = {
  latitude: 40.73061,
  longitude: -73.935242,
};
const EXTRA_COORDINATE_VENDOR_FIXTURES = [
  {
    email: 'e2e-midtown-vendor@reliance.test',
    vendorName: 'E2E Midtown Vendor',
    serviceName: 'E2E Nearby Midtown Service',
    description: 'Deterministic Midtown listing for nearby browse coverage.',
    coordinates: {
      address: '11 W 53rd St',
      city: 'New York',
      state: 'NY',
      zipCode: '10019',
      latitude: 40.7614,
      longitude: -73.9776,
    },
  },
  {
    email: 'e2e-brooklyn-vendor@reliance.test',
    vendorName: 'E2E Brooklyn Vendor',
    serviceName: 'E2E Nearby Brooklyn Service',
    description: 'Deterministic Brooklyn listing for nearby browse coverage.',
    coordinates: {
      address: '990 Washington Ave',
      city: 'Brooklyn',
      state: 'NY',
      zipCode: '11225',
      latitude: 40.6694,
      longitude: -73.9624,
    },
  },
] as const;
/** Stable title so we can reset the chain on each globalSetup run. */
const REVIEW_SMOKE_BOOKING_TITLE = 'E2E Review Smoke';
/** Public short MP4 playable in Chromium for review capture UI (soft prompt after play). */
const REVIEW_SMOKE_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const PUBLIC_SERVICE_REVIEW_COMMENT =
  'Verified public storefront review for the E2E smoke service.';

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
        address: '47-01 Queens Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11104',
        latitude: E2E_DISTANCE_ORIGIN.latitude,
        longitude: E2E_DISTANCE_ORIGIN.longitude,
        geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
        locationPreferenceEnabled: true,
        demo: true,
      },
      update: {
        email: CUSTOMER_EMAIL,
        name: 'E2E Smoke',
        address: '47-01 Queens Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11104',
        latitude: E2E_DISTANCE_ORIGIN.latitude,
        longitude: E2E_DISTANCE_ORIGIN.longitude,
        geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
        locationPreferenceEnabled: true,
      },
    });

    await prisma.user.upsert({
      where: { id: CUSTOMER_PREF_OFF_ID },
      create: {
        id: CUSTOMER_PREF_OFF_ID,
        email: CUSTOMER_PREF_OFF_EMAIL,
        name: 'E2E Location Preference Off',
        address: '47-01 Queens Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11104',
        latitude: E2E_DISTANCE_ORIGIN.latitude,
        longitude: E2E_DISTANCE_ORIGIN.longitude,
        geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
        locationPreferenceEnabled: false,
        demo: true,
      },
      update: {
        email: CUSTOMER_PREF_OFF_EMAIL,
        name: 'E2E Location Preference Off',
        address: '47-01 Queens Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11104',
        latitude: E2E_DISTANCE_ORIGIN.latitude,
        longitude: E2E_DISTANCE_ORIGIN.longitude,
        geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
        locationPreferenceEnabled: false,
      },
    });

    await prisma.user.upsert({
      where: { id: CUSTOMER_MISSING_COORDS_ID },
      create: {
        id: CUSTOMER_MISSING_COORDS_ID,
        email: CUSTOMER_MISSING_COORDS_EMAIL,
        name: 'E2E Missing Coordinates',
        address: '47-01 Queens Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11104',
        latitude: null,
        longitude: null,
        geocodedAt: null,
        locationPreferenceEnabled: true,
        demo: true,
      },
      update: {
        email: CUSTOMER_MISSING_COORDS_EMAIL,
        name: 'E2E Missing Coordinates',
        address: '47-01 Queens Blvd',
        city: 'Queens',
        state: 'NY',
        zipCode: '11104',
        latitude: null,
        longitude: null,
        geocodedAt: null,
        locationPreferenceEnabled: true,
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
          address: E2E_VENDOR_COORDINATES.address,
          city: E2E_VENDOR_COORDINATES.city,
          state: E2E_VENDOR_COORDINATES.state,
          zipCode: E2E_VENDOR_COORDINATES.zipCode,
          latitude: E2E_VENDOR_COORDINATES.latitude,
          longitude: E2E_VENDOR_COORDINATES.longitude,
          geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
          demo: true,
          isPubliclyListed: true,
        },
      });
    } else {
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: {
          ...E2E_VENDOR_COORDINATES,
          geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
          isPubliclyListed: true,
        },
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

    const extraCoordinateServices: Array<{ serviceId: string; vendorId: string; serviceName: string }> = [];
    for (const fixture of EXTRA_COORDINATE_VENDOR_FIXTURES) {
      let extraVendor = await prisma.vendor.findFirst({ where: { email: fixture.email } });
      if (!extraVendor) {
        extraVendor = await prisma.vendor.create({
          data: {
            name: fixture.vendorName,
            businessName: fixture.vendorName,
            email: fixture.email,
            phone: '555-0188',
            address: fixture.coordinates.address,
            city: fixture.coordinates.city,
            state: fixture.coordinates.state,
            zipCode: fixture.coordinates.zipCode,
            latitude: fixture.coordinates.latitude,
            longitude: fixture.coordinates.longitude,
            geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
            demo: true,
            isPubliclyListed: true,
          },
        });
      } else {
        extraVendor = await prisma.vendor.update({
          where: { id: extraVendor.id },
          data: {
            address: fixture.coordinates.address,
            city: fixture.coordinates.city,
            state: fixture.coordinates.state,
            zipCode: fixture.coordinates.zipCode,
            latitude: fixture.coordinates.latitude,
            longitude: fixture.coordinates.longitude,
            geocodedAt: new Date('2026-01-01T00:00:00.000Z'),
            isPubliclyListed: true,
          },
        });
      }

      let extraService = await prisma.service.findFirst({
        where: { vendorId: extraVendor.id, name: fixture.serviceName },
      });
      if (!extraService) {
        extraService = await prisma.service.create({
          data: {
            vendorId: extraVendor.id,
            name: fixture.serviceName,
            description: fixture.description,
            price: 75,
            demo: true,
            isPublished: true,
          },
        });
      } else {
        extraService = await prisma.service.update({
          where: { id: extraService.id },
          data: {
            description: fixture.description,
            isPublished: true,
          },
        });
      }

      extraCoordinateServices.push({
        serviceId: extraService.id,
        vendorId: extraVendor.id,
        serviceName: extraService.name,
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
    let publicReviewId: string;

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

        const review = await tx.review.create({
          data: {
            userId: CUSTOMER_ID,
            vendorId: vendor.id,
            bookingId: booking.id,
            mediaSessionId: mediaSession.id,
            clientName: 'E2E Smoke',
            jobType: SERVICE_NAME,
            rating: 5,
            comment: PUBLIC_SERVICE_REVIEW_COMMENT,
            source: 'customer',
            submittedVia: 'e2e_public_storefront_fixture',
            moderationStatus: 'approved',
            visibilityStatus: 'public',
            date: completedAt,
            demo: true,
          },
        });

        return {
          bookingId: booking.id,
          vendorId: vendor.id,
          mediaSessionId: mediaSession.id,
          publicReviewId: review.id,
        };
      });
      bookingId = out.bookingId;
      reviewVendorId = out.vendorId;
      reviewMediaSessionId = out.mediaSessionId;
      publicReviewId = out.publicReviewId;
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
      vendorEmail: VENDOR_EMAIL,
      reviewBookingId: bookingId,
      reviewVendorId,
      reviewMediaSessionId,
      publicReviewId,
      publicReviewComment: PUBLIC_SERVICE_REVIEW_COMMENT,
      distanceOrigin: E2E_DISTANCE_ORIGIN,
      vendorCoordinates: E2E_VENDOR_COORDINATES,
      extraCoordinateServices,
      locationEdgeCustomers: {
        preferenceOffCustomerId: CUSTOMER_PREF_OFF_ID,
        missingCoordinatesCustomerId: CUSTOMER_MISSING_COORDS_ID,
      },
    };
    fs.writeFileSync(fixturePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  } finally {
    await prisma.$disconnect();
  }
}
