import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  isVendorAccountRestricted,
} from '@/lib/account-status';
import { mapBookingToContract } from '@/lib/booking-shape';
import { checkVendorSlotAvailability } from '@/lib/availability-slots';
import { deriveCustomerBookingLifecycle } from '@/lib/customer-booking-lifecycle';
import { findUserIdByEmailCaseInsensitive } from '@/lib/resolve-booking-owner-user-id';
import { requireVerifiedEmailForAction } from '@/lib/email-verification-enforcement';
import { generateConsentToken } from '@/lib/consent-flow';
import { sendConsentLinkNotification } from '@/lib/notifications/send-consent-link';

function isTransientDbConnectivityError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');
  return (
    code === 'P1001' ||
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.toLowerCase().includes('prisma connect probe timeout')
  );
}

async function withTransientDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbConnectivityError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    return operation();
  }
}

/** Structured payload stored as JSON string in `Booking.customerMetadata` (snake_case keys). */
function buildCustomerMetadataForCreate(body: {
  user_notes?: unknown;
  client_email?: unknown;
  client_phone?: unknown;
  custom_fields?: unknown;
}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const notes = typeof body.user_notes === 'string' ? body.user_notes.trim() : '';
  if (notes) out.user_notes = notes;
  const email = typeof body.client_email === 'string' ? body.client_email.trim() : '';
  if (email) out.client_email = email;
  const phone = typeof body.client_phone === 'string' ? body.client_phone.trim() : '';
  if (phone) out.client_phone = phone;
  if (body.custom_fields && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields)) {
    const cf = body.custom_fields as Record<string, unknown>;
    const recordingLocation = String(cf.vendor_job_recording_location || '').trim();
    if (
      recordingLocation === 'business' ||
      recordingLocation === 'residence' ||
      recordingLocation === 'customer-business'
    ) {
      out.vendor_job_recording_location = recordingLocation;
    }
    if (cf.vendor_job_customer_controls_visibility === true) {
      out.vendor_job_customer_controls_visibility = true;
    }
    const visibilityOwner = String(cf.vendor_job_visibility_owner || '').trim();
    if (visibilityOwner) {
      out.vendor_job_visibility_owner = visibilityOwner;
    }
    if (Object.keys(cf).length > 0) out.custom_fields = cf;
  }
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

function resolveConsentBaseUrl(request: NextRequest): string {
  const configured = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return String(request.headers.get('origin') || new URL(request.url).origin).trim().replace(/\/+$/, '');
}

// TODO: Import your database models
// import { BookingModel } from '@/lib/models/Booking';
// import { ServiceModel } from '@/lib/models/Service';
// import { VendorModel } from '@/lib/models/Vendor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const vendorId = searchParams.get('vendorId');
    const status = searchParams.get('status');
    const summaryOnly = searchParams.get('summaryOnly') === '1';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 10;
    const skip = (safePage - 1) * safeLimit;

    const authUserId = await getUserIdFromRequest(request);
    const userId = authUserId || (requestedUserId ? String(requestedUserId) : null);
    if (!userId && !vendorId) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required' },
        { status: 401 }
      );
    }
    if (userId) {
      await ensureUserAccountCanAct(userId);
    }

    const where: any = {
      ...(userId ? { userId: String(userId) } : {}),
      ...(vendorId ? { vendorId: String(vendorId) } : {}),
      ...(status ? { status: String(status).toUpperCase() } : {}),
    };

    if (summaryOnly) {
      const [total, activeTotal] = await withTransientDbRetry(() =>
        Promise.all([
          prisma.booking.count({ where }),
          prisma.booking.count({
            where: {
              ...where,
              status: {
                notIn: ['COMPLETED', 'CANCELED', 'CANCELLED'],
              },
            },
          }),
        ])
      );

      return NextResponse.json({
        summary: {
          total,
          activeTotal,
        },
      });
    }

    const [total, records] = await withTransientDbRetry(() =>
      Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: safeLimit,
          select: {
            id: true,
            serviceId: true,
            vendorId: true,
            userId: true,
            title: true,
            clientName: true,
            amount: true,
            status: true,
            scheduledFor: true,
            date: true,
            createdAt: true,
            updatedAt: true,
            customerMetadata: true,
            service: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
            vendor: {
              select: {
                id: true,
                name: true,
                businessName: true,
                phone: true,
              },
            },
            ...(userId
              ? {
                  reviews: {
                    where: { userId: String(userId) },
                    select: { createdAt: true },
                    orderBy: { createdAt: 'desc' as const },
                    take: 1,
                  },
                  mediaSessions: {
                    where: { sessionType: 'JOB_SERVICE_VIDEO' },
                    select: {
                      vendorJobVideoStage: true,
                      mediaAssets: {
                        select: {
                          mimeType: true,
                          moderationStatus: true,
                          visibilityStatus: true,
                          archiveStatus: true,
                        },
                      },
                    },
                  },
                  reviewWindows: {
                    select: { status: true },
                  },
                }
              : {}),
          },
        }),
      ])
    );

    const bookings = records.map((booking) => {
      const base = mapBookingToContract(booking as any);
      if (!userId) return base;
      const lifecycle = deriveCustomerBookingLifecycle({
        bookingStatus: booking.status,
        mediaSessions: (booking as any).mediaSessions || [],
        hasSubmittedReview: Array.isArray((booking as any).reviews) && (booking as any).reviews.length > 0,
        reviewWindows: (booking as any).reviewWindows || [],
      });
      const latestReview = Array.isArray((booking as any).reviews) ? (booking as any).reviews[0] : null;
      return {
        ...base,
        customer_lifecycle: {
          ...lifecycle,
          review_submitted_at: latestReview?.createdAt?.toISOString?.() || null,
        },
      };
    });

    return NextResponse.json({
      bookings,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    const err = error as any;
    console.error("[BOOKINGS_API_ERROR]", err);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    if (isTransientDbConnectivityError(err)) {
      return NextResponse.json(
        {
          success: false,
          code: "DB_UNAVAILABLE",
          message: "The database is temporarily unavailable. Please try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: err?.message || "Unknown error",
        stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUserId = await getUserIdFromRequest(request);
    if (authUserId) {
      await ensureUserAccountCanAct(authUserId);
      const verificationGate = await requireVerifiedEmailForAction({
        userId: authUserId,
        action: 'create_booking',
      });
      if (verificationGate) {
        return verificationGate;
      }
    }
    const body = await request.json();
    const {
      service_id,
      vendor_id,
      booking_date,
      booking_time,
      user_notes,
      custom_fields,
      title,
      client_name,
      client_email,
      client_phone,
      amount,
      user_id,
      userId: bodyUserIdCamel,
    } = body as Record<string, unknown>;

    // Validate minimum required fields for vendor job creation flow
    if (!vendor_id) {
      return NextResponse.json(
        { error: 'vendor_id is required' },
        { status: 400 }
      );
    }

    const vendorId = String(vendor_id);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, accountStatus: true, businessName: true, name: true },
    });
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }
    if (isVendorAccountRestricted((vendor as any).accountStatus)) {
      const statusError = new AccountStatusError("vendor", (vendor as any).accountStatus);
      return NextResponse.json(accountStatusErrorBody(statusError), { status: statusError.statusCode });
    }

    // Resolve service for required Booking.serviceId FK.
    let serviceId: string | null = null;
    if (service_id) {
      const existingService = await prisma.service.findFirst({
        where: { id: String(service_id), vendorId },
        select: { id: true },
      });
      serviceId = existingService?.id || null;
    }
    if (!serviceId) {
      const firstVendorService = await prisma.service.findFirst({
        where: { vendorId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      serviceId = firstVendorService?.id || null;
    }
    if (!serviceId) {
      const createdService = await prisma.service.create({
        data: {
          vendorId,
          name: 'General Service Job',
          description: 'Auto-created default service for vendor jobs',
          price: 0,
        },
      });
      serviceId = createdService.id;
    }

    const clientEmailCombined =
      (typeof client_email === 'string' && client_email.trim()) ||
      (typeof body.clientEmail === 'string' && String(body.clientEmail).trim()) ||
      '';
    const clientPhoneCombined =
      (typeof client_phone === 'string' && client_phone.trim()) ||
      (typeof body.clientPhone === 'string' && String(body.clientPhone).trim()) ||
      '';

    let isVendorStaffForThisVendor = false;
    if (authUserId) {
      const staffMembership = await prisma.vendorMembership.findFirst({
        where: { vendorId, userId: String(authUserId), status: 'ACTIVE' },
        select: { id: true },
      });
      isVendorStaffForThisVendor = Boolean(staffMembership);
    }

    let bookingUserId: string | null = null;
    let linkedToExistingCustomerAccount = false;

    if (isVendorStaffForThisVendor) {
      if (!clientEmailCombined && !clientPhoneCombined) {
        return NextResponse.json(
          {
            error:
              'Customer phone or email is required for vendor-created jobs so Reliance can send completed service updates.',
            code: 'CLIENT_CONTACT_REQUIRED',
          },
          { status: 400 }
        );
      }
      const customerId = clientEmailCombined
        ? await findUserIdByEmailCaseInsensitive(prisma, clientEmailCombined)
        : null;
      if (customerId) {
        bookingUserId = customerId;
        linkedToExistingCustomerAccount = true;
      } else {
        const placeholderNameRaw =
          (typeof client_name === 'string' && client_name.trim()) ||
          (typeof title === 'string' && title.trim()) ||
          'Customer';
        const placeholderEmail = `unclaimed+${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}@reliance.local`;
        const placeholderUser = await prisma.user.create({
          data: {
            name: `${placeholderNameRaw} (Unclaimed Booking)`,
            email: placeholderEmail,
          },
          select: { id: true },
        });
        bookingUserId = placeholderUser.id;
      }
    } else {
      const fromBody =
        (user_id != null && String(user_id).trim() ? String(user_id).trim() : null) ||
        (bodyUserIdCamel != null && String(bodyUserIdCamel).trim()
          ? String(bodyUserIdCamel).trim()
          : null);
      bookingUserId = authUserId || fromBody;
    }

    if (!bookingUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required for booking creation' },
        { status: 401 }
      );
    }
    await ensureUserAccountCanAct(bookingUserId);

    const combinedDateTime =
      booking_date && booking_time
        ? new Date(`${booking_date}T${booking_time}`)
        : new Date();
    const scheduledFor = Number.isNaN(combinedDateTime.getTime()) ? new Date() : combinedDateTime;

    if (booking_date && booking_time) {
      const slotCheck = await checkVendorSlotAvailability({
        vendorId,
        serviceId,
        booking_date: String(booking_date),
        booking_time: String(booking_time),
      });
      if (!slotCheck.available) {
        return NextResponse.json(
          {
            error: slotCheck.reason || 'Selected slot is unavailable',
            code: 'SLOT_UNAVAILABLE',
          },
          { status: 409 }
        );
      }
    }

    let customerMetadataPayload = buildCustomerMetadataForCreate({
      user_notes,
      client_email,
      client_phone,
      custom_fields,
    });
    if (isVendorStaffForThisVendor) {
      const nextMeta = customerMetadataPayload || {};
      nextMeta.customer_account_linked = linkedToExistingCustomerAccount;
      if (linkedToExistingCustomerAccount && bookingUserId) {
        nextMeta.linked_customer_user_id = bookingUserId;
      }
      const claimStatus = nextMeta.claim_status
        ? String(nextMeta.claim_status).trim().toUpperCase()
        : '';
      if (!claimStatus) {
        nextMeta.claim_status = linkedToExistingCustomerAccount ? 'CLAIMED' : 'UNCLAIMED';
      }
      if (!nextMeta.claim_contact_email && clientEmailCombined) {
        nextMeta.claim_contact_email = clientEmailCombined;
      }
      if (!nextMeta.claim_created_at) {
        nextMeta.claim_created_at = new Date().toISOString();
      }
      customerMetadataPayload = nextMeta;
    }
    const customerMetadata =
      customerMetadataPayload !== undefined ? JSON.stringify(customerMetadataPayload) : undefined;

    let resolvedAmount = 0;
    if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
      const n = Number(amount);
      if (Number.isFinite(n) && n >= 0) resolvedAmount = n;
    } else {
      const priceRow = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { price: true },
      });
      if (priceRow?.price != null) {
        const n = Number(priceRow.price);
        if (Number.isFinite(n) && n >= 0) resolvedAmount = n;
      }
    }

    const booking = await prisma.booking.create({
      data: {
        vendorId,
        serviceId,
        userId: bookingUserId,
        title: title ? String(title) : null,
        clientName: client_name ? String(client_name) : null,
        status: 'PENDING',
        scheduledFor,
        date: scheduledFor,
        amount: resolvedAmount,
        ...(customerMetadata != null ? { customerMetadata } : {}),
      },
    });

    const recordingLocation = String(
      customerMetadataPayload?.vendor_job_recording_location || ''
    ).trim().toLowerCase();
    const requiresCustomerConsent =
      isVendorStaffForThisVendor &&
      (recordingLocation === 'residence' || recordingLocation === 'customer-business');
    let automaticConsent: Record<string, unknown> | null = null;

    if (requiresCustomerConsent) {
      try {
        const token = generateConsentToken();
        const requestedAt = new Date();
        const expiresAt = new Date(requestedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        const mediaSession = await (prisma as any).mediaSession.create({
          data: {
            vendorId,
            bookingId: booking.id,
            serviceId,
            userId: bookingUserId,
            sessionType: 'CONSENT_REQUEST',
            status: 'CREATED',
            title: 'Customer consent request',
            description: `Consent request before ${recordingLocation} recording`,
          },
        });
        const consentRecord = await (prisma as any).consentRecord.create({
          data: {
            token,
            bookingId: booking.id,
            vendorId,
            mediaSessionId: mediaSession.id,
            consentType: 'video_access',
            status: 'requested',
            requestedAt,
            expiresAt,
          },
        });
        await (prisma as any).consentEvent.create({
          data: { consentRecordId: consentRecord.id, eventType: 'sent', metadata: null },
        });

        const consentMetadata = {
          ...(customerMetadataPayload || {}),
          vendor_job_consent_token: token,
          vendor_job_consent_accepted: false,
          vendor_job_consent_status: 'requested',
        };
        await prisma.booking.update({
          where: { id: booking.id },
          data: { customerMetadata: JSON.stringify(consentMetadata) },
        });

        let notification: Awaited<ReturnType<typeof sendConsentLinkNotification>> | null = null;
        let notificationError: string | null = null;
        try {
          notification = await sendConsentLinkNotification({
            consentRecordId: consentRecord.id,
            actorUserId: String(authUserId || bookingUserId),
            token,
            consentPath: `/consent/${encodeURIComponent(token)}`,
            absoluteBaseUrl: resolveConsentBaseUrl(request),
            customerEmail: clientEmailCombined || undefined,
            customerPhone: clientPhoneCombined || undefined,
            customerName: client_name ? String(client_name) : undefined,
            vendorName: String(vendor.businessName || vendor.name || '').trim() || undefined,
            serviceName: title ? String(title) : undefined,
            bookingTitle: title ? String(title) : undefined,
            serviceDate: scheduledFor.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            consentTypeLabel: 'video access',
          });
          await (prisma as any).consentEvent.create({
            data: {
              consentRecordId: consentRecord.id,
              eventType: 'notification_dispatch',
              metadata: JSON.stringify({
                anySuccess: notification.anySuccess,
                channels: notification.channels,
                absoluteFallbackLink: notification.absoluteFallbackLink,
              }),
            },
          });
        } catch (notificationFailure) {
          notificationError =
            notificationFailure instanceof Error
              ? notificationFailure.message
              : String(notificationFailure);
          await (prisma as any).consentEvent.create({
            data: {
              consentRecordId: consentRecord.id,
              eventType: 'notification_dispatch_failed',
              metadata: JSON.stringify({ error: notificationError }),
            },
          });
        }

        automaticConsent = {
          status: 'requested',
          token,
          consentUrl: `/consent/${encodeURIComponent(token)}`,
          consentAbsoluteUrl: notification?.absoluteFallbackLink || null,
          notification,
          notificationError,
          deliveryConfirmed: notification?.anySuccess === true,
          manualLinkRequired: notification?.anySuccess !== true,
        };
      } catch (consentFailure) {
        console.error('[bookings] automatic customer consent setup failed', consentFailure);
        automaticConsent = {
          status: 'setup_failed',
          deliveryConfirmed: false,
          manualLinkRequired: true,
          error: consentFailure instanceof Error ? consentFailure.message : String(consentFailure),
        };
      }
    }

    const hydrated = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        id: true,
        userId: true,
        vendorId: true,
        serviceId: true,
        title: true,
        clientName: true,
        amount: true,
        status: true,
        scheduledFor: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        customerMetadata: true,
        service: { select: { id: true, name: true, description: true, price: true } },
        vendor: { select: { id: true, name: true, businessName: true, phone: true, email: true, city: true, state: true } },
      },
    });

    const contract = mapBookingToContract((hydrated || booking) as any);

    return NextResponse.json({
      success: true,
      booking: contract,
      automaticConsent,
      message: automaticConsent
        ? automaticConsent.deliveryConfirmed
          ? 'Booking created and customer consent request sent'
          : 'Booking created, but customer consent delivery needs attention'
        : 'Booking created successfully',
      /** @deprecated Prefer `booking.customer_metadata` — kept for older clients. */
      meta: {
        user_notes: (contract.customer_metadata as { user_notes?: string } | null)?.user_notes ?? null,
        custom_fields: (contract.customer_metadata as { custom_fields?: unknown } | null)?.custom_fields ?? null,
        client_email: (contract.customer_metadata as { client_email?: string } | null)?.client_email ?? null,
        client_phone: (contract.customer_metadata as { client_phone?: string } | null)?.client_phone ?? null,
      },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
} 
