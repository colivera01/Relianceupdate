import { NextRequest, NextResponse } from 'next/server';
import { customerLoadError } from '@/lib/customer-load-error';
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
import { resolveBookingSchedule } from '@/lib/booking-schedule';
import { toBookingNotificationState } from '@/lib/booking-notification-delivery';
import { createVerifiedPermissionRequest } from '@/lib/consent/request-service';
import { deliverVerifiedPermissionRequest } from '@/lib/consent/delivery-service';
import {
  createRecordingScopeAssessment,
  deriveRecordingScopeAssessment,
  parseRecordingScopeAssessmentInput,
  recordingPermissionRequired,
} from '@/lib/recording/scope-assessment';
import {
  CUSTOMER_RECORDING_NOTICE_KIND,
  dispatchQueuedRecordingNotice,
} from '@/lib/recording/recording-notice';
import { geocodeAddress, geocodeFailureMessage, hasCompleteAddress } from '@/lib/geocoding';
import type { GeocodeEvidence, GeocodeFailureStatus } from '@/lib/geocoding';
import { buildRecordingLocationSnapshot } from '@/lib/recording-location-snapshot';
import type { RecordingLocationType } from '@/lib/recording-location-snapshot';
import { loadCustomerServiceRecords } from '@/lib/customer-service-records-server';

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
  client_name?: unknown;
  client_email?: unknown;
  client_phone?: unknown;
  service_time_zone?: unknown;
  custom_fields?: unknown;
}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const notes = typeof body.user_notes === 'string' ? body.user_notes.trim() : '';
  if (notes) out.user_notes = notes;
  const name = typeof body.client_name === 'string' ? body.client_name.trim() : '';
  if (name) out.client_name = name;
  const email = typeof body.client_email === 'string' ? body.client_email.trim() : '';
  if (email) out.client_email = email;
  const phone = typeof body.client_phone === 'string' ? body.client_phone.trim() : '';
  if (phone) out.client_phone = phone;
  const timeZone = typeof body.service_time_zone === 'string' ? body.service_time_zone.trim() : '';
  if (timeZone) out.service_time_zone = timeZone;
  if (body.custom_fields && typeof body.custom_fields === 'object' && !Array.isArray(body.custom_fields)) {
    const cf = { ...(body.custom_fields as Record<string, unknown>) };
    for (const removedField of [
      'propertyScope',
      'peopleScope',
      'frameControl',
      'minorMayAppear',
      'protectedNonParticipantMayAppear',
      'sensitiveInformationMayAppear',
      'identifiersMayAppear',
      'recording_property_scope',
      'recording_people_scope',
      'recording_frame_control',
      'recording_minor_may_appear',
      'recording_protected_non_participant_may_appear',
      'recording_sensitive_information_may_appear',
      'recording_identifiers_may_appear',
    ]) {
      delete cf[removedField];
    }
    const recordingLocation = String(
      cf.vendor_job_recording_location || cf.recordingLocation || ''
    ).trim();
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

function normalizeCreationRequestKey(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized.slice(0, 255);
}

function normalizeServiceVideoCustomerEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function finiteCoordinate(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function customerResidenceFromCustomFields(customFields: Record<string, unknown>) {
  return {
    address: String(customFields.vendor_job_customer_residence_address || '').trim() || null,
    city: String(customFields.vendor_job_customer_residence_city || '').trim() || null,
    state: String(customFields.vendor_job_customer_residence_state || '').trim() || null,
    zipCode: String(customFields.vendor_job_customer_residence_zip_code || '').trim() || null,
    latitude: finiteCoordinate(customFields.vendor_job_customer_residence_latitude),
    longitude: finiteCoordinate(customFields.vendor_job_customer_residence_longitude),
    geocodedAt: null as Date | null,
    geocodingEvidence: null as GeocodeEvidence | null,
  };
}

type WorkRecordLocationInput = ReturnType<typeof customerResidenceFromCustomFields>;

function customerBusinessFromCustomFields(
  customFields: Record<string, unknown>
): WorkRecordLocationInput {
  return {
    address: String(customFields.vendor_job_customer_business_address || '').trim() || null,
    city: String(customFields.vendor_job_customer_business_city || '').trim() || null,
    state: String(customFields.vendor_job_customer_business_state || '').trim() || null,
    zipCode: String(customFields.vendor_job_customer_business_zip_code || '').trim() || null,
    latitude: finiteCoordinate(customFields.vendor_job_customer_business_latitude),
    longitude: finiteCoordinate(customFields.vendor_job_customer_business_longitude),
    geocodedAt: null as Date | null,
    geocodingEvidence: null as GeocodeEvidence | null,
  };
}

function hasAnyLocationInput(location: WorkRecordLocationInput): boolean {
  return Boolean(
    location.address ||
      location.city ||
      location.state ||
      location.zipCode ||
      location.latitude != null ||
      location.longitude != null
  );
}

function hasValidLocationCoordinates(location: WorkRecordLocationInput): boolean {
  const latitude = finiteCoordinate(location.latitude);
  const longitude = finiteCoordinate(location.longitude);
  return Boolean(
    latitude != null &&
      longitude != null &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !(latitude === 0 && longitude === 0) &&
      location.geocodedAt instanceof Date &&
      Number.isFinite(location.geocodedAt.getTime())
  );
}

type WorkRecordLocationVerification =
  | { ok: true; location: WorkRecordLocationInput }
  | { ok: false; reason: GeocodeFailureStatus };

async function verifyWorkRecordLocation(
  location: WorkRecordLocationInput
): Promise<WorkRecordLocationVerification> {
  if (!hasCompleteAddress(location)) return { ok: false, reason: 'incomplete_address' };
  if (hasValidLocationCoordinates(location) && location.geocodingEvidence) {
    return { ok: true, location };
  }
  const result = await geocodeAddress(location);
  if (result.status !== 'success') return { ok: false, reason: result.status };
  return {
    ok: true,
    location: {
      ...location,
      latitude: result.latitude,
      longitude: result.longitude,
      geocodedAt: result.geocodedAt,
      geocodingEvidence: result.evidence || null,
    },
  };
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
    const customerRecordsView = searchParams.get('view') === 'customer_service_records';
    const summaryOnly = searchParams.get('summaryOnly') === '1';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 10;
    const skip = (safePage - 1) * safeLimit;

    const authUserId = await getUserIdFromRequest(request);
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required' },
        { status: 401 }
      );
    }
    await ensureUserAccountCanAct(authUserId);

    if (customerRecordsView) {
      if (requestedUserId && String(requestedUserId) !== authUserId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const result = await withTransientDbRetry(() => loadCustomerServiceRecords({
        db: prisma,
        customerUserId: authUserId,
        requestedTab: searchParams.get('tab'),
        search: searchParams.get('q'),
        page,
        limit,
        bookingId: searchParams.get('bookingId'),
        businessId: searchParams.get('businessId'),
      }));
      return NextResponse.json({
        bookings: result.records,
        counts: result.counts,
        selectedTab: result.selectedTab,
        businesses: result.businesses,
        selectedBusinessId: result.selectedBusinessId,
        pagination: result.pagination,
      });
    }

    let userId: string | null = authUserId;
    if (vendorId) {
      const membership = await prisma.vendorMembership.findFirst({
        where: {
          vendorId: String(vendorId),
          userId: authUserId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      userId = requestedUserId ? String(requestedUserId) : null;
    } else if (requestedUserId && String(requestedUserId) !== authUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: any = {
      ...(userId ? { userId: String(userId) } : {}),
      ...(vendorId ? { vendorId: String(vendorId) } : {}),
      ...(status ? { status: String(status).toUpperCase() } : {}),
    };

    if (summaryOnly) {
      if (!vendorId && userId) {
        const records = await withTransientDbRetry(() => loadCustomerServiceRecords({
          db: prisma,
          customerUserId: String(userId),
          limit: 1,
        }));
        const total =
          records.counts.upcoming +
          records.counts.completed +
          records.counts.cancelled +
          records.counts.archived +
          records.counts.unclassified;
        return NextResponse.json({
          summary: {
            total,
            activeTotal: records.counts.upcoming,
            needsAttentionTotal: records.counts.needs_attention,
          },
        });
      }
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
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return customerLoadError(error, 'BOOKINGS_API_ERROR', 'Unable to load your Service Records.', isTransientDbConnectivityError(error) ? 503 : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUserId = await getUserIdFromRequest(request);
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required for booking creation' },
        { status: 401 }
      );
    }
    await ensureUserAccountCanAct(authUserId);
    const verificationGate = await requireVerifiedEmailForAction({
      userId: authUserId,
      action: 'create_booking',
    });
    if (verificationGate) {
      return verificationGate;
    }
    const body = await request.json();
    const {
      service_id,
      vendor_id,
      booking_date,
      booking_time,
      scheduled_for,
      service_time_zone,
      user_notes,
      custom_fields,
      title,
      client_name,
      client_email,
      client_phone,
      amount,
      user_id,
      userId: bodyUserIdCamel,
      idempotency_key,
    } = body as Record<string, unknown>;
    const creationRequestKey = normalizeCreationRequestKey(
      idempotency_key || request.headers.get('idempotency-key')
    );

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
      select: {
        id: true,
        accountStatus: true,
        businessName: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        geocodedAt: true,
      },
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
        where: {
          vendorId,
          userId: String(authUserId),
          status: 'ACTIVE',
          role: 'MANAGER',
        },
        select: { id: true },
      });
      isVendorStaffForThisVendor = Boolean(staffMembership);
    }

    if (creationRequestKey) {
      const existingBooking = await (prisma as any).booking.findFirst({
        where: { creationRequestKey },
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
          vendor: {
            select: {
              id: true,
              name: true,
              businessName: true,
              phone: true,
              email: true,
              city: true,
              state: true,
            },
          },
        },
      });
      if (existingBooking) {
        if (String(existingBooking.vendorId) !== vendorId) {
          return NextResponse.json(
            {
              success: false,
              code: 'IDEMPOTENCY_KEY_REUSED',
              error: 'This creation request key was already used for another work record.',
            },
            { status: 409 }
          );
        }
        const [deliveryRecord, consentRecord] = await Promise.all([
          (prisma as any).bookingNotification.findFirst({
            where: {
              bookingId: existingBooking.id,
              kind: { startsWith: 'CUSTOMER_PERMISSION_REQUEST' },
            },
            orderBy: { createdAt: 'desc' },
          }),
          (prisma as any).consentRecord.findFirst({
            where: { bookingId: existingBooking.id },
            orderBy: { requestedAt: 'desc' },
          }),
        ]);
        const delivery = toBookingNotificationState(deliveryRecord);
        return NextResponse.json({
          success: true,
          idempotentReplay: true,
          booking: mapBookingToContract(existingBooking as any),
          automaticConsent: consentRecord
            ? {
                id: consentRecord.id,
                status: String(consentRecord.lifecycleStatus || consentRecord.status || 'pending').toLowerCase(),
                delivery,
                deliveryConfirmed: delivery?.status === 'SENT' || delivery?.status === 'PARTIAL',
                recordingLocked: !(
                  consentRecord.verifiedDecision === true &&
                  String(consentRecord.lifecycleStatus || '').toUpperCase() === 'ALLOWED'
                ),
              }
            : null,
          message: 'This work record was already created. The existing record was returned.',
        });
      }
    }

    let bookingUserId: string | null = null;
    let linkedToExistingCustomerAccount = false;
    let placeholderCustomerName: string | null = null;

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
        placeholderCustomerName = placeholderNameRaw;
      }
    } else {
      const fromBody =
        (user_id != null && String(user_id).trim() ? String(user_id).trim() : null) ||
        (bodyUserIdCamel != null && String(bodyUserIdCamel).trim()
          ? String(bodyUserIdCamel).trim()
          : null);
      if (fromBody && fromBody !== authUserId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      bookingUserId = authUserId;
    }

    if (!bookingUserId && !placeholderCustomerName) {
      return NextResponse.json(
        { error: 'Unauthorized: user context is required for booking creation' },
        { status: 401 }
      );
    }
    // Vendor staff are acting on behalf of the vendor here. A customer's
    // inactive account must not prevent the vendor from creating their work record.
    if (!isVendorStaffForThisVendor && bookingUserId) {
      await ensureUserAccountCanAct(bookingUserId);
    }

    const scheduledFor = resolveBookingSchedule({
      scheduledFor: scheduled_for,
      bookingDate: booking_date,
      bookingTime: booking_time,
    });

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
      client_name,
      client_email,
      client_phone,
      service_time_zone,
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
    const recordingLocation = String(
      customerMetadataPayload?.vendor_job_recording_location || ''
    ).trim().toLowerCase();
    const customFieldsRecord =
      custom_fields && typeof custom_fields === 'object' && !Array.isArray(custom_fields)
        ? (custom_fields as Record<string, unknown>)
        : {};
    const assessmentInput = isVendorStaffForThisVendor
      ? parseRecordingScopeAssessmentInput(customFieldsRecord)
      : null;
    if (isVendorStaffForThisVendor && !assessmentInput) {
      return NextResponse.json(
        {
          error:
            'Complete the Service Video recording scope before creating this work record.',
          code: 'RECORDING_ASSESSMENT_REQUIRED',
          responsibleParticipant: 'VENDOR_MANAGER',
          resolution: 'Choose who, if anyone, must be intentionally identifiable and confirm the audio scope.',
        },
        { status: 422 }
      );
    }
    if (
      isVendorStaffForThisVendor &&
      assessmentInput &&
      !normalizeServiceVideoCustomerEmail(clientEmailCombined)
    ) {
      return NextResponse.json(
        {
          error:
            'Customer email is required for a Service Video work record so the customer can securely claim and view Private proof.',
          code: 'CUSTOMER_EMAIL_REQUIRED_FOR_SERVICE_VIDEO',
          responsibleParticipant: 'VENDOR_MANAGER',
          resolution: 'Enter the customer email that should receive and claim the completed Private Service Video.',
        },
        { status: 400 }
      );
    }
    if (
      isVendorStaffForThisVendor &&
      assessmentInput &&
      assessmentInput.recordingLocation !== recordingLocation
    ) {
      return NextResponse.json(
        {
          error: 'The selected service location does not match the recording assessment.',
          code: 'RECORDING_LOCATION_ASSESSMENT_MISMATCH',
          responsibleParticipant: 'VENDOR_MANAGER',
          resolution: 'Choose one location type and complete the assessment for that same location.',
        },
        { status: 422 }
      );
    }
    const requiresCustomerConsent =
      isVendorStaffForThisVendor &&
      Boolean(assessmentInput && recordingPermissionRequired(assessmentInput));
    const customerProfileLocation =
      recordingLocation === 'residence' && bookingUserId
        ? await prisma.user.findUnique({
            where: { id: bookingUserId },
            select: {
              address: true,
              city: true,
              state: true,
              zipCode: true,
              latitude: true,
              longitude: true,
              geocodedAt: true,
            },
          })
        : null;
    const suppliedResidence = customerResidenceFromCustomFields(customFieldsRecord);
    const suppliedCustomerBusiness = customerBusinessFromCustomFields(customFieldsRecord);
    let resolvedRecordingLocation: WorkRecordLocationInput | null = null;
    let resolvedRecordingLocationSource:
      | 'customer_profile'
      | 'customer_supplied'
      | 'vendor_profile'
      | null = null;

    if (recordingLocation === 'business') {
      const verification = await verifyWorkRecordLocation({
        ...vendor,
        geocodingEvidence: null,
      });
      resolvedRecordingLocation = verification.ok ? verification.location : null;
      resolvedRecordingLocationSource = 'vendor_profile';
      if (!resolvedRecordingLocation) {
        return NextResponse.json(
          {
            error: geocodeFailureMessage(verification.ok ? 'error' : verification.reason),
            code: 'VENDOR_BUSINESS_ADDRESS_REQUIRED',
            responsibleParticipant: 'VENDOR_MANAGER',
            resolution: 'Complete and verify the vendor business address before creating this work record.',
          },
          { status: 422 }
        );
      }
    } else if (recordingLocation === 'residence') {
      const hasSuppliedResidence = hasAnyLocationInput(suppliedResidence);
      const residenceSource = hasSuppliedResidence
        ? suppliedResidence
        : customerProfileLocation
          ? ({ ...customerProfileLocation, geocodingEvidence: null } as WorkRecordLocationInput)
          : null;
      const verification = residenceSource
        ? await verifyWorkRecordLocation(residenceSource)
        : ({ ok: false, reason: 'incomplete_address' } as const);
      resolvedRecordingLocation = verification.ok ? verification.location : null;
      resolvedRecordingLocationSource = hasSuppliedResidence
        ? 'customer_supplied'
        : 'customer_profile';
      if (!resolvedRecordingLocation) {
        return NextResponse.json(
          {
            error: geocodeFailureMessage(verification.ok ? 'error' : verification.reason),
            code: hasSuppliedResidence
              ? 'CUSTOMER_RESIDENCE_ADDRESS_UNVERIFIED'
              : 'CUSTOMER_RESIDENCE_ADDRESS_REQUIRED',
            responsibleParticipant: 'VENDOR_MANAGER',
            resolution: 'Enter and verify the exact customer residence for this work record.',
          },
          { status: 422 }
        );
      }
    } else if (recordingLocation === 'customer-business') {
      const verification = await verifyWorkRecordLocation(suppliedCustomerBusiness);
      resolvedRecordingLocation = verification.ok ? verification.location : null;
      resolvedRecordingLocationSource = 'customer_supplied';
      if (!resolvedRecordingLocation) {
        return NextResponse.json(
          {
            error: geocodeFailureMessage(verification.ok ? 'error' : verification.reason),
            code: hasAnyLocationInput(suppliedCustomerBusiness)
              ? 'CUSTOMER_BUSINESS_ADDRESS_UNVERIFIED'
              : 'CUSTOMER_BUSINESS_ADDRESS_REQUIRED',
            responsibleParticipant: 'VENDOR_MANAGER',
            resolution: 'Enter and verify the exact customer business address for this work record.',
          },
          { status: 422 }
        );
      }
    }
    let recordingAssessment: ReturnType<typeof deriveRecordingScopeAssessment> | null = null;
    if (recordingLocation) {
      const nextMeta = customerMetadataPayload || {};
      const locationSnapshot = buildRecordingLocationSnapshot(
        recordingLocation as RecordingLocationType,
        resolvedRecordingLocationSource!,
        resolvedRecordingLocation
      );
      nextMeta.vendor_job_recording_location_snapshot = locationSnapshot;
      if (assessmentInput) {
        recordingAssessment = deriveRecordingScopeAssessment(assessmentInput, {
          locationSnapshotEvidenceHash: String(locationSnapshot.snapshot_evidence_hash || ''),
          generation: 1,
          completedByUserId: authUserId,
          completedAt: new Date(),
        });
      }
      nextMeta.vendor_job_permission_workflow_version = 'SIMPLIFIED_V1';
      if (requiresCustomerConsent) {
        nextMeta.vendor_job_consent_accepted = false;
        nextMeta.vendor_job_consent_status = 'not_sent';
        nextMeta.vendor_job_consent_notification_status = 'NOT_SENT';
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

    let transactionalCreate: any;
    try {
      transactionalCreate = await prisma.$transaction(async (tx) => {
      let resolvedBookingUserId = bookingUserId;
      if (!resolvedBookingUserId && placeholderCustomerName) {
        const placeholderEmail = `unclaimed+${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}@reliance.local`;
        const placeholderUser = await tx.user.create({
          data: {
            name: `${placeholderCustomerName} (Unclaimed Booking)`,
            email: placeholderEmail,
          },
          select: { id: true },
        });
        resolvedBookingUserId = placeholderUser.id;
      }
      if (!resolvedBookingUserId) {
        throw new Error('Booking customer could not be resolved');
      }

      const createdBooking = await tx.booking.create({
        data: {
          vendorId,
          serviceId,
          userId: resolvedBookingUserId,
          title: title ? String(title) : null,
          clientName: client_name ? String(client_name) : null,
          status: 'PENDING',
          scheduledFor,
          date: scheduledFor,
          amount: resolvedAmount,
          creationRequestKey,
          ...(customerMetadata != null ? { customerMetadata } : {}),
        },
      });

      const createdAssessment = recordingAssessment
        ? await createRecordingScopeAssessment({
          tx,
          bookingId: createdBooking.id,
          vendorId,
          completedByUserId: authUserId,
          assessment: recordingAssessment,
        })
        : null;

      if (!requiresCustomerConsent) {
        const noticeNotification =
          isVendorStaffForThisVendor &&
          createdAssessment &&
          recordingAssessment?.noticeRequired
            ? await tx.bookingNotification.create({
                data: {
                  bookingId: createdBooking.id,
                  consentRecordId: null,
                  kind: `${CUSTOMER_RECORDING_NOTICE_KIND}:${createdAssessment.generation}`,
                  status: 'QUEUED',
                  idempotencyKey: `recording-notice:${createdBooking.id}:${createdAssessment.generation}`,
                },
              })
            : null;
        return {
          booking: createdBooking,
          bookingUserId: resolvedBookingUserId,
          consentMediaSessionId: null,
          noticeNotificationId: noticeNotification?.id || null,
          assessmentScopeHash: createdAssessment?.scopeHash || null,
          assessmentAudioEnabled: createdAssessment?.audioAllowed === true,
          assessmentParticipantPlan: recordingAssessment?.intentionalParticipantPlan || null,
        };
      }

      const mediaSession = await tx.mediaSession.create({
        data: {
          vendorId,
          bookingId: createdBooking.id,
          serviceId,
          userId: resolvedBookingUserId,
          sessionType: 'CONSENT_REQUEST',
          status: 'CREATED',
          title: 'Customer consent request',
          description: `Consent request before ${recordingLocation} recording`,
        },
      });
      return {
        booking: createdBooking,
        bookingUserId: resolvedBookingUserId,
        consentMediaSessionId: mediaSession.id,
        noticeNotificationId: null,
        assessmentScopeHash: createdAssessment?.scopeHash || null,
        assessmentAudioEnabled: createdAssessment?.audioAllowed === true,
        assessmentParticipantPlan: recordingAssessment?.intentionalParticipantPlan || null,
      };
      });
    } catch (transactionError: any) {
      if (creationRequestKey && String(transactionError?.code || '') === 'P2002') {
        const existingBooking = await (prisma as any).booking.findFirst({
          where: { creationRequestKey },
          include: {
            service: true,
            vendor: true,
          },
        });
        if (existingBooking && String(existingBooking.vendorId) === vendorId) {
          return NextResponse.json({
            success: true,
            idempotentReplay: true,
            booking: mapBookingToContract(existingBooking),
            automaticConsent: null,
            message: 'This work record was already created. The existing record was returned.',
          });
        }
      }
      throw transactionError;
    }

    const booking = transactionalCreate.booking;
    let automaticConsent: Record<string, unknown> | null = null;
    let recordingNotice: Record<string, unknown> | null = null;

    if (transactionalCreate.consentMediaSessionId) {
      try {
        const createdPermission = await createVerifiedPermissionRequest({
          bookingId: booking.id,
          actorUserId: String(authUserId || transactionalCreate.bookingUserId),
          mediaSessionId: transactionalCreate.consentMediaSessionId,
          reason: 'create',
        });
        let delivery: any = null;
        if (createdPermission.actionPath && createdPermission.notificationId) {
          delivery = await deliverVerifiedPermissionRequest({
            request,
            notificationId: createdPermission.notificationId,
            consentRecordId: createdPermission.consentRecordId,
            actorUserId: String(authUserId || transactionalCreate.bookingUserId),
            actionPath: createdPermission.actionPath,
            recipient: createdPermission.recipient,
            booking: createdPermission.booking,
          });
        }
        automaticConsent = {
          id: createdPermission.consentRecordId,
          status:
            createdPermission.state === 'pending' && delivery
              ? delivery.status === 'SENT' || delivery.status === 'PARTIAL'
                ? 'delivered'
                : 'delivery_failed'
              : createdPermission.state,
          recipient: {
            name: createdPermission.recipient.name,
            email: createdPermission.recipient.emailMasked,
            phone: createdPermission.recipient.phoneMasked,
          },
          delivery: delivery
            ? {
                status: delivery.status,
                channels: delivery.channels,
                lastError: delivery.lastError,
              }
            : null,
          recordingLocked: true,
        };
      } catch (permissionError) {
        console.error('[bookings] automatic permission request failed after booking creation', permissionError);
        automaticConsent = {
          status: 'delivery_failed',
          recordingLocked: true,
          error: 'The work record was created, but the recording permission request needs attention.',
        };
      }
    } else if (transactionalCreate.noticeNotificationId) {
      const noticeResult = await dispatchQueuedRecordingNotice({
        notificationId: transactionalCreate.noticeNotificationId,
        bookingId: booking.id,
        actorUserId: String(authUserId || transactionalCreate.bookingUserId),
        customerName: typeof client_name === 'string' ? client_name : null,
        customerEmail: clientEmailCombined,
        customerPhone: clientPhoneCombined,
        vendorName: vendor.businessName || vendor.name,
        serviceName:
          (await prisma.service.findUnique({ where: { id: serviceId }, select: { name: true } }))?.name ||
          (typeof title === 'string' ? title : null),
        scopeHash: transactionalCreate.assessmentScopeHash,
        audioEnabled: transactionalCreate.assessmentAudioEnabled,
        intentionalParticipantPlan: transactionalCreate.assessmentParticipantPlan,
      });
      recordingNotice = {
        status: noticeResult.delivery?.status || 'FAILED',
        delivery: noticeResult.delivery,
        responseRequired: false,
        recordingPermissionCreated: false,
      };
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
      recordingNotice,
      message: automaticConsent
        ? automaticConsent.deliveryConfirmed
          ? 'Booking created and customer consent request sent'
          : 'Booking created, but customer consent delivery needs attention'
        : recordingNotice
          ? recordingNotice.status === 'SENT' || recordingNotice.status === 'PARTIAL'
            ? 'Work record created and customer recording notice sent'
            : 'Work record created, but the informational recording notice needs attention'
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
