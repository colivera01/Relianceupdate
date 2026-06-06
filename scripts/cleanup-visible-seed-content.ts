import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

const SERVICE_ID = 'cmnvdeh1n0002sop8otabf4su';
const PRIMARY_VENDOR_ID = 'cmnvdegk60000sop8sj18nud2';
const MIDTOWN_VENDOR_ID = 'cmpggaky40000soc0il005lwi';
const BROOKLYN_VENDOR_ID = 'cmpggam0w0003soc0z4ezfhth';
const MIDTOWN_SERVICE_ID = 'cmpggali10002soc0gytj7vok';
const BROOKLYN_SERVICE_ID = 'cmpggamkj0005soc0sts7krkw';
const PUBLIC_REVIEW_ID = 'cmpm55wl70009sovk322fca9k';
const REVIEW_BOOKING_ID = 'cmpm55vyk0001sovk2bp25eg7';
const SPARKLE_VENDOR_ID = 'cmipm4d6v0000sosgqvb8tp63';
const FRESH_TRUST_LOOP_BOOKING_ID = 'cmpoqbz9u000gsog8fodmtud2';

const RENAMES = {
  primaryVendor: {
    name: 'Metro Home Care Pros',
    businessName: 'Metro Home Care Pros',
  },
  primaryService: {
    name: 'Metro Apartment Deep Clean',
    description:
      'Detailed apartment and move-out cleaning with approved service video updates.',
  },
  midtownVendor: {
    name: 'Midtown Home Detailers',
    businessName: 'Midtown Home Detailers',
  },
  midtownService: {
    name: 'Midtown Apartment Refresh',
    description:
      'Detailed apartment cleaning for Midtown homes and short-term rentals.',
  },
  brooklynVendor: {
    name: 'Brooklyn Home Care Studio',
    businessName: 'Brooklyn Home Care Studio',
  },
  brooklynService: {
    name: 'Brooklyn Move-In Cleaning',
    description:
      'Move-in cleaning and room-by-room refresh for Brooklyn apartments.',
  },
  customerName: 'Jordan Rivera',
  reviewComment:
    'The team was punctual, thorough, and the finished walkthrough video made the whole service feel transparent.',
  reviewBookingTitle: 'Apartment Deep Clean Follow-Up',
  reviewSessionTitle: 'Completed service walkthrough',
  sparkleServiceName: 'Sparkle Home Cleaning Visit',
  sparkleServiceDescription:
    'Residential cleaning visit with approved service videos and customer feedback.',
  freshBookingTitle: 'Completed Home Cleaning Walkthrough',
  archivedSparkleBookingTitle: 'Archived Home Service Visit',
  freshReviewComment:
    'Great communication from start to finish, and the completed walkthrough made it easy to confirm the work.',
} as const;

function replaceE2eProofTitle(title: string | null | undefined): string | null {
  if (!title) return title ?? null;
  return title
    .replace(/^E2E INTRO proof /i, 'Before service video ')
    .replace(/^E2E IN_PROGRESS proof /i, 'During service video ')
    .replace(/^E2E COMPLETED proof /i, 'Completed service video ')
    .replace(/^E2E review smoke capture$/i, RENAMES.reviewSessionTitle);
}

function normalizeSignedInVisibleTitle(title: string | null | undefined): string | null {
  if (!title) return title ?? null;
  let next = replaceE2eProofTitle(title) ?? title;
  next = next
    .replace(/^COMPLETED recount validation video\b.*$/i, 'Completed service walkthrough')
    .replace(/^Fresh countable trust-loop\b.*$/i, 'Completed service walkthrough')
    .replace(/^IN_PROGRESS walkthrough video\b.*$/i, 'During service walkthrough')
    .replace(/^INTRO walkthrough video\b.*$/i, 'Before service walkthrough')
    .replace(/^E2E consent gated media$/i, 'Customer consent walkthrough')
    .replace(/^Consent retest media$/i, 'Service consent walkthrough')
    .replace(/^Acceptance live test no service$/i, 'Walkthrough without service link')
    .replace(/^Admin Review Test$/i, 'Completed service walkthrough')
    .replace(/^The test$/i, 'Service walkthrough')
    .replace(/^The Test\s*$/i, 'Service walkthrough')
    .replace(
      /^(Before service video|During service video|Completed service video)\s+\d+$/i,
      '$1'
    )
    .replace(/\btrust-loop\b/gi, 'service')
    .replace(/\brecount validation\b/gi, 'walkthrough')
    .trim();
  if (/^Test\s*$/i.test(next)) {
    next = 'Service walkthrough';
  }
  return next === title ? null : next;
}

async function main() {
  loadEnv({ path: '.env.local' });
  loadEnv({ path: '.env' });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to clean visible seed content.');
  }

  const prisma = new PrismaClient();
  try {
    await prisma.vendor.update({
      where: { id: PRIMARY_VENDOR_ID },
      data: RENAMES.primaryVendor,
    });
    await prisma.vendor.update({
      where: { id: MIDTOWN_VENDOR_ID },
      data: RENAMES.midtownVendor,
    });
    await prisma.vendor.update({
      where: { id: BROOKLYN_VENDOR_ID },
      data: RENAMES.brooklynVendor,
    });

    await prisma.service.update({
      where: { id: SERVICE_ID },
      data: RENAMES.primaryService,
    });
    await prisma.service.update({
      where: { id: MIDTOWN_SERVICE_ID },
      data: RENAMES.midtownService,
    });
    await prisma.service.update({
      where: { id: BROOKLYN_SERVICE_ID },
      data: RENAMES.brooklynService,
    });

    await prisma.user.update({
      where: { id: 'e2e-smoke-customer' },
      data: { name: RENAMES.customerName },
    });
    await prisma.user.update({
      where: { id: 'e2e-location-pref-off-customer' },
      data: { name: 'Saved Address Customer' },
    });
    await prisma.user.update({
      where: { id: 'e2e-location-missing-coords-customer' },
      data: { name: 'Customer Without Coordinates' },
    });

    const bookingTitleUpdate = await prisma.booking.updateMany({
      where: { title: 'E2E Smoke Service' },
      data: { title: RENAMES.primaryService.name },
    });

    const templateBookingUpdate = await prisma.booking.updateMany({
      where: { title: 'Template Service Booking' },
      data: {
        title: 'Office Maintenance Walkthrough',
        clientName: 'Alex Morgan',
      },
    });

    const testCustomerUpdate = await prisma.booking.updateMany({
      where: { clientName: 'Test Customer' },
      data: { clientName: 'Alex Morgan' },
    });

    const dairyJobUpdate = await prisma.booking.updateMany({
      where: { title: 'General Service Job - Dairy' },
      data: {
        title: 'Kitchen Deep Clean',
        clientName: 'Morgan Lee',
      },
    });

    const cubanRobberyJobUpdate = await prisma.booking.updateMany({
      where: { title: 'General Service Job - The Cuban Robbery' },
      data: { title: 'Apartment Safety Check' },
    });

    const brakePadJobUpdate = await prisma.booking.updateMany({
      where: { title: 'General Service Job - Brake Pad' },
      data: { title: 'Brake Pad Replacement' },
    });

    const sparkleGenericServicesUpdate = await prisma.service.updateMany({
      where: {
        vendorId: SPARKLE_VENDOR_ID,
        OR: [
          { name: 'General Service Job' },
          { description: 'Auto-created default service for vendor jobs' },
        ],
      },
      data: {
        name: RENAMES.sparkleServiceName,
        description: RENAMES.sparkleServiceDescription,
      },
    });

    const freshTrustLoopBookingUpdate = await prisma.booking.updateMany({
      where: {
        id: FRESH_TRUST_LOOP_BOOKING_ID,
        OR: [
          { title: { contains: 'COMPLETED recount validation' } },
          { title: { contains: 'Fresh countable trust-loop' } },
          { title: { contains: 'Fresh recount validation' } },
          { title: { contains: 'General Service Job' } },
        ],
      },
      data: {
        title: RENAMES.freshBookingTitle,
        clientName: RENAMES.customerName,
      },
    });

    const sparkleGenericBookingTitlesUpdate = await prisma.booking.updateMany({
      where: {
        vendorId: SPARKLE_VENDOR_ID,
        id: { not: FRESH_TRUST_LOOP_BOOKING_ID },
        title: { contains: 'General Service Job' },
      },
      data: {
        title: RENAMES.archivedSparkleBookingTitle,
      },
    });

    const exampleEmailBookings = await prisma.booking.findMany({
      where: { customerMetadata: { contains: 'customer@example.com' } },
      select: { id: true, customerMetadata: true, clientName: true },
      take: 50,
    });

    let exampleEmailMetadataUpdates = 0;
    for (const booking of exampleEmailBookings) {
      try {
        const meta = booking.customerMetadata
          ? (JSON.parse(booking.customerMetadata) as Record<string, unknown>)
          : {};
        const clientName = String(booking.clientName || '').trim();
        const replacementEmail =
          clientName === 'Alex Morgan'
            ? 'alex.morgan@gmail.com'
            : clientName
              ? `${clientName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`
              : 'customer.contact@gmail.com';
        let changed = false;
        if (meta.client_email === 'customer@example.com') {
          meta.client_email = replacementEmail;
          changed = true;
        }
        if (meta.claim_contact_email === 'customer@example.com') {
          meta.claim_contact_email = replacementEmail;
          changed = true;
        }
        if (!changed) continue;
        await prisma.booking.update({
          where: { id: booking.id },
          data: { customerMetadata: JSON.stringify(meta) },
        });
        exampleEmailMetadataUpdates += 1;
      } catch {
        // Skip malformed metadata rows.
      }
    }

    const trustLoopClientUpdate = await prisma.booking.updateMany({
      where: { clientName: { contains: 'E2E Trust Loop Client' } },
      data: { clientName: 'Jordan Rivera' },
    });

    const smokeClientUpdate = await prisma.booking.updateMany({
      where: { clientName: 'E2E Smoke Client' },
      data: { clientName: 'Jordan Rivera' },
    });

    await prisma.booking.updateMany({
      where: { title: 'E2E Review Smoke' },
      data: { title: RENAMES.reviewBookingTitle },
    });

    if (REVIEW_BOOKING_ID) {
      await prisma.booking.update({
        where: { id: REVIEW_BOOKING_ID },
        data: {
          title: RENAMES.reviewBookingTitle,
          clientName: RENAMES.customerName,
        },
      }).catch(() => undefined);
    }

    const reviewUpdate = await prisma.review.updateMany({
      where: {
        OR: [
          { jobType: 'E2E Smoke Service' },
          { comment: { contains: 'E2E smoke service' } },
          { clientName: 'E2E Smoke' },
        ],
      },
      data: {
        jobType: RENAMES.primaryService.name,
        clientName: RENAMES.customerName,
        comment: RENAMES.reviewComment,
      },
    });

    if (PUBLIC_REVIEW_ID) {
      await prisma.review.update({
        where: { id: PUBLIC_REVIEW_ID },
        data: {
          jobType: RENAMES.primaryService.name,
          clientName: RENAMES.customerName,
          comment: RENAMES.reviewComment,
        },
      }).catch(() => undefined);
    }

    const trustLoopReviewUpdate = await prisma.review.updateMany({
      where: {
        OR: [
          { comment: { contains: 'E2E trust loop review' } },
          { comment: { contains: 'Fresh countable trust-loop' } },
          { comment: { contains: 'recount validation' } },
          { bookingId: FRESH_TRUST_LOOP_BOOKING_ID },
        ],
      },
      data: {
        comment: RENAMES.freshReviewComment,
      },
    });

    const staleApprovalMemberships = await prisma.vendorMembership.findMany({
      where: {
        status: 'PENDING',
        role: 'MANAGER',
      },
      include: {
        vendor: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    const staleApprovalMembershipIds = staleApprovalMemberships
      .filter((membership: any) => {
        const businessName = String(membership.vendor?.businessName || membership.vendor?.name || '').toLowerCase();
        const email = String(membership.vendor?.email || membership.user?.email || '').toLowerCase();
        const userName = String(membership.user?.name || '').toLowerCase();
        const combined = `${businessName} ${email} ${userName}`;
        return (
          /@example\.com$/i.test(email) ||
          combined.includes('test barber co') ||
          combined.includes('fallback categorydefaults') ||
          combined.includes('template verify barber')
        );
      })
      .map((membership: any) => String(membership.id));

    const staleApprovalQueueUpdate = staleApprovalMembershipIds.length
      ? await prisma.vendorMembership.updateMany({
          where: { id: { in: staleApprovalMembershipIds } },
          data: {
            status: 'DENIED',
            deniedAt: new Date(),
          },
        })
      : { count: 0 };

    const sessions = await prisma.mediaSession.findMany({
      where: {
        OR: [
          { title: { contains: 'E2E' } },
          { title: { contains: 'Test' } },
          { title: { contains: 'test' } },
          { title: { contains: 'retest' } },
          { title: { contains: 'Before service video ' } },
          { title: { contains: 'During service video ' } },
          { title: { contains: 'Completed service video ' } },
          { title: { contains: 'COMPLETED recount validation' } },
          { title: { contains: 'Fresh countable trust-loop' } },
          { title: { contains: 'Fresh recount validation' } },
          { title: { contains: 'recount validation' } },
          { title: { contains: 'IN_PROGRESS walkthrough video' } },
          { title: { contains: 'INTRO walkthrough video' } },
          { serviceId: { in: [SERVICE_ID, MIDTOWN_SERVICE_ID, BROOKLYN_SERVICE_ID] } },
          { bookingId: FRESH_TRUST_LOOP_BOOKING_ID },
        ],
      },
      select: { id: true, title: true },
      take: 500,
    });

    let mediaSessionUpdates = 0;
    for (const session of sessions) {
      const nextTitle = normalizeSignedInVisibleTitle(session.title);
      if (!nextTitle || nextTitle === session.title) continue;
      await prisma.mediaSession.update({
        where: { id: session.id },
        data: { title: nextTitle },
      });
      mediaSessionUpdates += 1;
    }

    console.log(
      JSON.stringify(
        {
          vendorsUpdated: 3,
          servicesUpdated: 3,
          usersUpdated: 3,
          bookingsTitleUpdated: bookingTitleUpdate.count,
          bookingsTemplateUpdated: templateBookingUpdate.count,
          bookingsTestCustomerUpdated: testCustomerUpdate.count,
          bookingsDairyJobUpdated: dairyJobUpdate.count,
          bookingsCubanRobberyJobUpdated: cubanRobberyJobUpdate.count,
          bookingsBrakePadJobUpdated: brakePadJobUpdate.count,
          sparkleGenericServicesUpdated: sparkleGenericServicesUpdate.count,
          freshTrustLoopBookingUpdated: freshTrustLoopBookingUpdate.count,
          sparkleGenericBookingTitlesUpdated: sparkleGenericBookingTitlesUpdate.count,
          bookingsExampleEmailMetadataUpdated: exampleEmailMetadataUpdates,
          bookingsTrustLoopClientUpdated: trustLoopClientUpdate.count,
          bookingsSmokeClientUpdated: smokeClientUpdate.count,
          reviewsUpdated: reviewUpdate.count,
          trustLoopReviewsUpdated: trustLoopReviewUpdate.count,
          staleApprovalQueueRowsArchived: staleApprovalQueueUpdate.count,
          mediaSessionsUpdated: mediaSessionUpdates,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
