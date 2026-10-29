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
import {
  bookingIntervalsOverlap,
  checkVendorSlotAvailability,
  DEFAULT_BOOKING_TIMEZONE,
  parseSavedBusinessHours,
  resolveServiceDurationMinutes,
} from '@/lib/availability-slots';
import { deriveCustomerBookingLifecycle } from '@/lib/customer-booking-lifecycle';
import { findUserIdByEmailCaseInsensitive } from '@/lib/resolve-booking-owner-user-id';
import { requireVerifiedEmailForAction } from '@/lib/email-verification-enforcement';
import { isValidServiceTimeZone, resolveBookingSchedule } from '@/lib/booking-schedule';
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
import { EMPLOYEE_RECORDING_PARTICIPATION_CONTRACT_VERSION } from '@/lib/employee-recording-participation';
import {
  initializeServiceRequestMetadata,
  readServiceRequestLifecycle,
} from '@/lib/service-request-lifecycle';
import {
  dispatchServiceRequestNotifications,
  enqueueNewServiceRequestNotifications,
} from '@/lib/notifications/service-request';

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

type CustomerScheduleMode = 'CUSTOMER_SELECTS_TIME' | 'VENDOR_TO_PROPOSE';

function normalizeCustomerScheduleMode(value: unknown): CustomerScheduleMode | null {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'CUSTOMER_SELECTS_TIME' || normalized === 'VENDOR_TO_PROPOSE'
    ? normalized
    : null;
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function serviceAddressFromCustomFields(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return String((value as Record<string, unknown>).service_address || '').trim();
}

function parseCustomerMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function serviceRequestListFields(booking: any) {
  const metadata = parseCustomerMetadata(booking.customerMetadata);
  const customFields =
    metadata.custom_fields && typeof metadata.custom_fields === 'object' && !Array.isArray(metadata.custom_fields)
      ? (metadata.custom_fields as Record<string, unknown>)
      : {};
  const explicitSource = String(metadata.booking_source || metadata.source || '').trim().toLowerCase();
  const vendorCreated =
    explicitSource === 'vendor_created_job' ||
    Boolean(String(metadata.claim_status || '').trim()) ||
    typeof metadata.customer_account_linked === 'boolean';
  const lifecycle = vendorCreated
    ? null
    : readServiceRequestLifecycle(metadata, {
        requestedAt: booking.createdAt,
        scheduledFor: booking.scheduledFor,
      });
  const storedMode = String(metadata.service_request_schedule_mode || '').trim().toUpperCase();
  return {
    requestLifecycle: lifecycle,
    scheduleMode: lifecycle
      ? storedMode || (lifecycle.schedule_mode === 'VENDOR_TO_PROPOSE' ? 'VENDOR_TO_PROPOSE' : 'CUSTOMER_SELECTS_TIME')
      : null,
    // Counteroffers move Booking.scheduledFor so that the proposed slot is
    // actually reserved. Keep exposing the customer's original requested
    // appointment separately for the vendor's decision context.
    requestedFor:
      lifecycle?.requested_scheduled_for ||
      booking.scheduledFor?.toISOString?.() ||
      null,
    // This value is written from the server-authoritative availability
    // schedule during customer creation. Consumers must not infer it from the
    // browser running the vendor UI.
    serviceTimeZone:
      String(metadata.service_time_zone || '').trim() ||
      DEFAULT_BOOKING_TIMEZONE,
    serviceAddress:
      String(
        metadata.service_address ||
          customFields.service_address ||
          customFields.vendor_job_customer_residence_address ||
          customFields.vendor_job_customer_business_address ||
          '',
      ).trim() || null,
    requestNotes: String(metadata.user_notes || '').trim() || null,
    customerEmail: String(metadata.client_email || '').trim() || null,
    customerPhone: String(metadata.client_phone || '').trim() || null,
  };
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
      if (vendorId) {
        return {
          ...base,
          ...serviceRequestListFields(booking),
        };
      }
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
      schedule_mode,
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
        isPubliclyListed: true,
        businessName: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        geocodedAt: true,
        businessHoursJson: true,
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

    const staffMembership = await prisma.vendorMembership.findFirst({
      where: {
        vendorId,
        userId: String(authUserId),
        status: 'ACTIVE',
        role: 'MANAGER',
      },
      select: { id: true },
    });
    const isVendorStaffForThisVendor = Boolean(staffMembership);

    // Resolve service for required Booking.serviceId FK.
    let serviceId: string | null = null;
    let selectedService: {
      id: string;
      name: string;
      description: string | null;
      price: number;
      isPublished: boolean;
    } | null = null;
    if (service_id) {
      const existingService = await prisma.service.findFirst({
        where: { id: String(service_id), vendorId },
        select: { id: true, name: true, description: true, price: true, isPublished: true },
      });
      serviceId = existingService?.id || null;
      selectedService = existingService || null;
    }
    if (!serviceId && isVendorStaffForThisVendor) {
      const firstVendorService = await prisma.service.findFirst({
        where: { vendorId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, description: true, price: true, isPublished: true },
      });
      serviceId = firstVendorService?.id || null;
      selectedService = firstVendorService || null;
    }
    if (!serviceId && isVendorStaffForThisVendor) {
      const createdService = await prisma.service.create({
        data: {
          vendorId,
          name: 'General Service Job',
          description: 'Auto-created default service for vendor jobs',
          price: 0,
        },
      });
      serviceId = createdService.id;
      selectedService = {
        id: createdService.id,
        name: createdService.name,
        description: createdService.description,
        price: createdService.price,
        isPublished: createdService.isPublished,
      };
    }

    const clientEmailCombined =
      (typeof client_email === 'string' && client_email.trim()) ||
      (typeof body.clientEmail === 'string' && String(body.clientEmail).trim()) ||
      '';
    const clientPhoneCombined =
      (typeof client_phone === 'string' && client_phone.trim()) ||
      (typeof body.clientPhone === 'string' && String(body.clientPhone).trim()) ||
      '';

    const requestedScheduleMode = normalizeCustomerScheduleMode(schedule_mode);
    const vendorSchedule = parseSavedBusinessHours((vendor as any).businessHoursJson);
    const vendorHasPublishedHours = Boolean(vendorSchedule);
    const authoritativeServiceTimeZone = vendorSchedule?.timezone || DEFAULT_BOOKING_TIMEZONE;
    const requiredCustomerScheduleMode: CustomerScheduleMode = vendorHasPublishedHours
      ? 'CUSTOMER_SELECTS_TIME'
      : 'VENDOR_TO_PROPOSE';
    const serviceAddress = serviceAddressFromCustomFields(custom_fields);
    let authenticatedCustomer: { name: string | null; email: string | null; phone: string | null } | null = null;

    if (!isVendorStaffForThisVendor) {
      if (vendor.isPubliclyListed === false) {
        return NextResponse.json(
          { error: 'This provider is not currently accepting public service requests.', code: 'VENDOR_NOT_PUBLIC' },
          { status: 404 },
        );
      }
      if (
        !service_id ||
        !selectedService ||
        String(selectedService.id) !== String(service_id) ||
        selectedService.isPublished === false
      ) {
        return NextResponse.json(
          { error: 'A published service is required for a customer service request.', code: 'PUBLISHED_SERVICE_REQUIRED' },
          { status: 400 },
        );
      }
      if (!creationRequestKey) {
        return NextResponse.json(
          { error: 'A unique request key is required. Refresh and try again.', code: 'IDEMPOTENCY_KEY_REQUIRED' },
          { status: 400 },
        );
      }
      if (requestedScheduleMode !== requiredCustomerScheduleMode) {
        return NextResponse.json(
          {
            error: vendorHasPublishedHours
              ? 'Choose a time from the provider’s published availability.'
              : 'This provider must propose the service time after reviewing your request.',
            code: 'SCHEDULE_MODE_MISMATCH',
            requiredScheduleMode: requiredCustomerScheduleMode,
          },
          { status: 409 },
        );
      }
      if (requiredCustomerScheduleMode === 'CUSTOMER_SELECTS_TIME' && (!booking_date || !booking_time)) {
        return NextResponse.json(
          { error: 'Select an available date and time.', code: 'SCHEDULE_REQUIRED' },
          { status: 400 },
        );
      }
      if (
        requiredCustomerScheduleMode === 'VENDOR_TO_PROPOSE' &&
        (booking_date || booking_time || scheduled_for)
      ) {
        return NextResponse.json(
          { error: 'The provider will propose the service time after reviewing this request.', code: 'SCHEDULE_NOT_YET_AVAILABLE' },
          { status: 400 },
        );
      }

      const normalizedName = String(client_name || '').trim();
      const normalizedEmail = normalizeEmail(client_email);
      const normalizedPhone = String(client_phone || '').trim();
      if (normalizedName.length < 2) {
        return NextResponse.json({ error: 'Full name is required.', code: 'CLIENT_NAME_REQUIRED' }, { status: 400 });
      }
      if (!validEmail(normalizedEmail)) {
        return NextResponse.json({ error: 'A valid email is required.', code: 'CLIENT_EMAIL_REQUIRED' }, { status: 400 });
      }
      if (!validPhone(normalizedPhone)) {
        return NextResponse.json({ error: 'A valid phone number is required.', code: 'CLIENT_PHONE_REQUIRED' }, { status: 400 });
      }
      if (serviceAddress.length < 5) {
        return NextResponse.json({ error: 'Service address is required.', code: 'SERVICE_ADDRESS_REQUIRED' }, { status: 400 });
      }

      authenticatedCustomer = await prisma.user.findUnique({
        where: { id: authUserId },
        select: { name: true, email: true, phone: true },
      });
      const accountEmail = normalizeEmail(authenticatedCustomer?.email);
      if (!accountEmail || normalizedEmail !== accountEmail) {
        return NextResponse.json(
          {
            error: 'Use the verified email connected to your Reliance customer account.',
            code: 'CUSTOMER_EMAIL_MISMATCH',
          },
          { status: 400 },
        );
      }
    }

    if (!serviceId || !selectedService) {
      return NextResponse.json(
        { error: 'A service is required to create this work record.', code: 'SERVICE_REQUIRED' },
        { status: 400 },
      );
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
        if (!isVendorStaffForThisVendor && String(existingBooking.userId) !== String(authUserId)) {
          return NextResponse.json(
            { success: false, code: 'IDEMPOTENCY_KEY_REUSED', error: 'This request key belongs to another customer.' },
            { status: 409 },
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

    let scheduledFor: Date | null = null;
    if (isVendorStaffForThisVendor) {
      const hasAbsoluteSchedule = Boolean(String(scheduled_for || '').trim());
      const hasBookingDate = Boolean(String(booking_date || '').trim());
      const hasBookingTime = Boolean(String(booking_time || '').trim());
      if (!hasAbsoluteSchedule && !hasBookingDate && !hasBookingTime) {
        return NextResponse.json(
          {
            error: 'Scheduled service date and time is required for a vendor-created work record.',
            code: 'SCHEDULE_REQUIRED',
          },
          { status: 400 },
        );
      }
      const vendorServiceTimeZone =
        String(service_time_zone || '').trim() || DEFAULT_BOOKING_TIMEZONE;
      if (
        (!hasAbsoluteSchedule && (!hasBookingDate || !hasBookingTime)) ||
        !isValidServiceTimeZone(vendorServiceTimeZone)
      ) {
        return NextResponse.json(
          {
            error: 'Enter a valid scheduled service date, time, and service time zone.',
            code: 'INVALID_SCHEDULE',
          },
          { status: 400 },
        );
      }
      scheduledFor = resolveBookingSchedule({
        scheduledFor: scheduled_for,
        bookingDate: booking_date,
        bookingTime: booking_time,
        timeZone: vendorServiceTimeZone,
      });
      if (!scheduledFor) {
        return NextResponse.json(
          {
            error: 'The scheduled service date and time could not be resolved.',
            code: 'INVALID_SCHEDULE',
          },
          { status: 400 },
        );
      }
    } else if (requiredCustomerScheduleMode === 'CUSTOMER_SELECTS_TIME') {
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
      scheduledFor = slotCheck.scheduled_for
        ? new Date(slotCheck.scheduled_for)
        : resolveBookingSchedule({
            bookingDate: booking_date,
            bookingTime: booking_time,
            timeZone: slotCheck.timezone || service_time_zone,
          });
      if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
        return NextResponse.json(
          { error: 'The selected date and time could not be scheduled.', code: 'INVALID_SCHEDULE' },
          { status: 400 },
        );
      }
    }

    let customerMetadataPayload = buildCustomerMetadataForCreate({
      user_notes,
      client_name,
      client_email,
      client_phone,
      service_time_zone: isVendorStaffForThisVendor ? service_time_zone : authoritativeServiceTimeZone,
      custom_fields,
    });
    if (!isVendorStaffForThisVendor) {
      const nextMeta = customerMetadataPayload || {};
      const submittedAt = new Date();
      nextMeta.booking_source = 'customer_booking';
      nextMeta.service_request_schedule_mode = requiredCustomerScheduleMode;
      nextMeta.service_request_status = 'REQUESTED';
      nextMeta.service_request_submitted_at = submittedAt.toISOString();
      nextMeta.service_time_zone = authoritativeServiceTimeZone;
      nextMeta.customer_contact_policy = {
        version: 1,
        email_source: 'VERIFIED_ACCOUNT',
        email_override_allowed: false,
        name_source: 'CUSTOMER_REQUEST',
        phone_source: 'CUSTOMER_REQUEST',
        submitted_by_user_id: authUserId,
      };
      nextMeta.service_address = serviceAddress;
      customerMetadataPayload = initializeServiceRequestMetadata({
        metadataValue: nextMeta,
        requestedAt: submittedAt,
        scheduledFor,
        actorUserId: authUserId,
        scheduleMode:
          requiredCustomerScheduleMode === 'VENDOR_TO_PROPOSE'
            ? 'VENDOR_TO_PROPOSE'
            : 'CUSTOMER_REQUESTED',
      }).metadata;
    }
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
            'Customer email is required for a Service Video work record so the customer can securely claim and view the Private Service Record.',
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
      nextMeta.vendor_job_employee_recording_participation_contract_version =
        EMPLOYEE_RECORDING_PARTICIPATION_CONTRACT_VERSION;
      if (requiresCustomerConsent) {
        nextMeta.vendor_job_consent_accepted = false;
        nextMeta.vendor_job_consent_status = 'not_sent';
        nextMeta.vendor_job_consent_notification_status = 'NOT_SENT';
      }
      customerMetadataPayload = nextMeta;
    }
    const customerMetadata =
      customerMetadataPayload !== undefined ? JSON.stringify(customerMetadataPayload) : undefined;

    // Customer-submitted amounts are display data only. The persisted price must
    // always come from the vendor's current Service Offered record. Vendor-created
    // work records retain their explicit amount override for backward compatibility.
    let resolvedAmount = 0;
    if (isVendorStaffForThisVendor && amount !== undefined && amount !== null && String(amount).trim() !== '') {
      const submitted = Number(amount);
      if (Number.isFinite(submitted) && submitted >= 0) resolvedAmount = submitted;
    } else {
      const authoritativePrice = Number(selectedService?.price);
      if (Number.isFinite(authoritativePrice) && authoritativePrice >= 0) {
        resolvedAmount = authoritativePrice;
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

      if (!isVendorStaffForThisVendor && scheduledFor) {
        const requestedDuration = resolveServiceDurationMinutes(selectedService?.description);
        const nearby = await tx.booking.findMany({
          where: {
            vendorId,
            status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as any },
            scheduledFor: {
              gte: new Date(scheduledFor.getTime() - 8 * 60 * 60 * 1000),
              lt: new Date(scheduledFor.getTime() + requestedDuration * 60 * 1000),
            },
          },
          select: {
            scheduledFor: true,
            service: { select: { description: true } },
          },
        });
        const collision = nearby.some((existing: any) =>
          existing.scheduledFor
            ? bookingIntervalsOverlap(
                scheduledFor!,
                requestedDuration,
                existing.scheduledFor,
                resolveServiceDurationMinutes(existing.service?.description),
              )
            : false,
        );
        if (collision) throw new Error('SLOT_CONFLICT_AFTER_LOCK');
      }

      const createdBooking = await tx.booking.create({
        data: {
          vendorId,
          serviceId,
          userId: resolvedBookingUserId,
          title: isVendorStaffForThisVendor
            ? (title ? String(title) : null)
            : (selectedService?.name || null),
          clientName: client_name ? String(client_name).trim() : null,
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

      const serviceRequestNotifications = !isVendorStaffForThisVendor
        ? await enqueueNewServiceRequestNotifications({
            db: tx,
            bookingId: createdBooking.id,
            actorUserId: authUserId,
            baseUrl: resolveConsentBaseUrl(request),
          })
        : [];

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
          serviceRequestNotifications: serviceRequestNotifications.map((row: any) => ({ id: row.id })),
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
        serviceRequestNotifications: serviceRequestNotifications.map((row: any) => ({ id: row.id })),
      };
      }, { isolationLevel: 'Serializable' as any });
    } catch (transactionError: any) {
      const transactionErrorCode = String(transactionError?.code || '').toUpperCase();
      if (
        String(transactionError?.message || '') === 'SLOT_CONFLICT_AFTER_LOCK' ||
        (!isVendorStaffForThisVendor && scheduledFor && transactionErrorCode === 'P2034')
      ) {
        return NextResponse.json(
          { error: 'Selected slot is no longer available', code: 'SLOT_UNAVAILABLE' },
          { status: 409 },
        );
      }
      if (creationRequestKey && String(transactionError?.code || '') === 'P2002') {
        const existingBooking = await (prisma as any).booking.findFirst({
          where: { creationRequestKey },
          include: {
            service: true,
            vendor: true,
          },
        });
        if (
          existingBooking &&
          String(existingBooking.vendorId) === vendorId &&
          (isVendorStaffForThisVendor || String(existingBooking.userId) === String(authUserId))
        ) {
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

    if (transactionalCreate.serviceRequestNotifications?.length) {
      try {
        await dispatchServiceRequestNotifications(
          transactionalCreate.serviceRequestNotifications,
          authUserId,
          prisma,
        );
      } catch (notificationError) {
        // The durable queue was committed with the request. Immediate delivery is
        // best effort and may be retried without rolling back the service request.
        console.error('[bookings] service request notification dispatch failed', notificationError);
      }
    }

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
