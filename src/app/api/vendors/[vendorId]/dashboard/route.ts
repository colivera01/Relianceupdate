// src/app/api/vendors/[vendorId]/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest, getVendorMembership, requireVendorMembership } from "@/lib/membership-auth";
import { resolveOperationalPhase } from "@/lib/vendor-job-operational-phase";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { getEmployeeRatingsForVendor, getVendorRatingStats } from "@/lib/review-attribution-aggregates";
import { calculateStorageUsage } from "@/lib/storage-helpers";
import {
  buildCompleteMediaModerationPackages,
  countPendingMediaModerationPackages,
  REQUIRED_MEDIA_MODERATION_STAGE_KEYS,
} from "@/lib/admin-media-moderation-packages";
import { getCurrentVendorTrustScoreSnapshot, toVendorTrustScore } from "@/lib/trust-score-read";
import {
  resolveOperationalClientKey,
  resolveOperationalClientLabel,
} from "@/lib/operational-client";
import {
  countableMediaAssetWhere,
  countableReviewWhere,
  vendorOperationalBookingWhere,
} from "@/lib/metrics-exclusion";
import { parseRecordingComplianceMetadata } from "@/lib/job-assignment";
import { toBookingNotificationState } from "@/lib/booking-notification-delivery";
import { loadRecordingPermissionGate } from "@/lib/consent/recording-gate";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

// Simple in-memory cache (60 seconds TTL per vendor)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const USE_DASHBOARD_CACHE =
  process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";
const DASHBOARD_DEBUG_LOG = process.env.NODE_ENV !== "production";
const APPROVED_STATUS = "APPROVED";
const PUBLIC_VISIBILITY_STATUS = "PUBLIC";

function approvedCustomerReviewWhereForVendor(
  vendorId: string,
  extra: Record<string, unknown> = {}
) {
  return countableReviewWhere({
    vendorId,
    source: "customer",
    moderationStatus: "approved",
    bookingId: { not: null },
    ...extra,
  });
}

function errorResponse(
  code: string,
  error: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      code,
      error,
      ...extra,
    },
    { status }
  );
}

function parseCustomerMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function extractAssignedEmployeesFromMetadata(value: string | null | undefined): string[] {
  const metadata = parseCustomerMetadata(value);
  const raw = metadata.vendor_job_assigned_employees;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || "").trim()).filter(Boolean);
}

function extractAssignedMembershipIdsFromMetadata(value: string | null | undefined): string[] {
  const metadata = parseCustomerMetadata(value);
  const raw = metadata.vendor_job_assigned_membership_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || "").trim()).filter(Boolean);
}

function extractUploadedVideoStagesFromMetadata(value: string | null | undefined): string[] {
  const metadata = parseCustomerMetadata(value);
  const raw = metadata.vendor_job_stage_progress;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .filter(([, stageValue]) => Boolean(stageValue))
    .map(([stageKey]) => String(stageKey || "").trim().toUpperCase())
    .filter((stageKey) => ["INTRO", "IN_PROGRESS", "COMPLETED"].includes(stageKey));
}

function resolveJobSourceFromMetadata(value: string | null | undefined): "customer_booking" | "vendor_created_job" {
  const metadata = parseCustomerMetadata(value);
  const claimStatus = String(metadata.claim_status || "").trim().toUpperCase();
  const linkedFlag = metadata.customer_account_linked;
  const hasLinkedFlag = typeof linkedFlag === "boolean";
  if (claimStatus || hasLinkedFlag) {
    return "vendor_created_job";
  }
  return "customer_booking";
}

function usableCustomerEmail(value: unknown): string {
  const email = String(value || "").trim();
  return email.toLowerCase().endsWith("@reliance.local") ? "" : email;
}

function resolveCustomerContactForBooking(booking: any): { email: string; phone: string } {
  const metadata = parseCustomerMetadata(booking?.customerMetadata);
  return {
    email:
      usableCustomerEmail(metadata.client_email) ||
      usableCustomerEmail(metadata.claim_contact_email) ||
      usableCustomerEmail(booking?.user?.email),
    phone: String(metadata.client_phone || "").trim() || String(booking?.user?.phone || "").trim(),
  };
}

function formatAssignedEmployeesForHistory(
  assignedEmployees: string[],
  assignedMembershipIds: string[],
  formerMembershipIds: Set<string>
): string[] {
  if (!assignedEmployees.length) return [];
  return assignedEmployees.map((name, index) => {
    const membershipId = String(assignedMembershipIds[index] || "").trim();
    if (membershipId && formerMembershipIds.has(membershipId)) {
      return `${name} (Former team member)`;
    }
    return name;
  });
}

function isTransientDbConnectivityError(error: any): boolean {
  const message = String(error?.message || '');
  return (
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT')
  );
}

function normalizeKey(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function hasRejectedStagedMedia(packageState: ReturnType<typeof evaluateVendorJobPackageState>): boolean {
  return Object.values(packageState.stages || {}).some(
    (stage) => normalizeKey(stage?.latestModerationStatus) === "REJECTED"
  );
}

async function withTransientDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbConnectivityError(error)) {
      throw error;
    }
    // Minimal retry for intermittent Azure SQL network hiccups.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return operation();
  }
}

/**
 * GET /api/vendors/[vendorId]/dashboard
 * Get complete dashboard data for a vendor (vendor-scoped)
 * Cached for 60 seconds per vendor
 */
export async function GET(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const { vendorId } = await context.params;
    const resolvedUserId = await getUserIdFromRequest(request);
    const headerUserId = request.headers.get("x-user-id");
    const headerVendorId = request.headers.get("x-vendor-id");

    if (DASHBOARD_DEBUG_LOG) {
      console.info("[vendors/dashboard] request:start", {
        requestId,
        vendorId,
        resolvedUserId,
        headerUserId,
        headerVendorId,
        hasAuthorization: Boolean(request.headers.get("authorization")),
      });
    }

    if (!resolvedUserId) {
      if (DASHBOARD_DEBUG_LOG) {
        console.warn("[vendors/dashboard] auth:missing-user", {
          requestId,
          vendorId,
          headerUserId,
        });
      }
      return errorResponse("UNAUTHORIZED_NO_USER", "Unauthorized", 401, {
        vendorId,
      });
    }

    const membership = await withTransientDbRetry(() => getVendorMembership(vendorId, resolvedUserId));
    if (DASHBOARD_DEBUG_LOG) {
      console.info("[vendors/dashboard] auth:membership-check", {
        requestId,
        vendorId,
        userId: resolvedUserId,
        membershipFound: Boolean(membership),
        membershipStatus: membership?.status || null,
        membershipRole: membership?.role || null,
      });
    }
    if (!membership || membership.status !== "ACTIVE") {
      const fallbackMembership = await withTransientDbRetry(() =>
        (prisma as any).vendorMembership.findFirst({
          where: {
            userId: resolvedUserId,
            status: "ACTIVE",
          },
          select: {
            vendorId: true,
            role: true,
            status: true,
          },
          orderBy: { approvedAt: "desc" },
        })
      ) as { vendorId?: string | null } | null;
      if (DASHBOARD_DEBUG_LOG) {
        console.warn("[vendors/dashboard] auth:forbidden-membership", {
          requestId,
          vendorId,
          userId: resolvedUserId,
          fallbackVendorId: fallbackMembership?.vendorId || null,
        });
      }
      return errorResponse("FORBIDDEN_ACTIVE_MEMBERSHIP_REQUIRED", "Forbidden: Active membership required", 403, {
        vendorId,
        userId: resolvedUserId,
        ...(fallbackMembership?.vendorId
          ? { suggestedVendorId: fallbackMembership.vendorId }
          : {}),
      });
    }

    // Preserve legacy helper validation path for behavioral consistency.
    await withTransientDbRetry(() => requireVendorMembership(request, vendorId));

    const { searchParams } = new URL(request.url);
    const jobsOnly = searchParams.get("jobsOnly") === "1";
    // Manage Jobs is an operational surface. Its list must reflect mutations
    // immediately, so jobs-only responses must never come from the dashboard TTL.
    const useResponseCache = USE_DASHBOARD_CACHE && !jobsOnly;

    // Check cache
    const cacheKey = `dashboard:${vendorId}:${jobsOnly ? "jobsOnly" : "full"}`;
    const cached = useResponseCache ? cache.get(cacheKey) : null;
    if (useResponseCache && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    // Fetch vendor profile and related data in parallel
    const [
      vendor,
      statsAgg,
      recentBookings,
      archivedBookings,
      recentReviews,
      confirmedOrCompletedBookings, // For client count (CONFIRMED + COMPLETED only)
      completedBookings,
      proofModerationGroups,
      totalProofAssets,
      archivedProofs,
      packageMediaAssets,
      currentTrustScoreSnapshot,
    ] = await withTransientDbRetry(() =>
      Promise.all([
      // Vendor profile
      prisma.vendor.findUnique({
        where: { id: vendorId },
      }),

      // Booking stats aggregation (vendor-facing operational truth)
      prisma.booking.groupBy({
        by: ["vendorId"],
        where: vendorOperationalBookingWhere({ vendorId }),
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Recent bookings (vendor portal — include test-client jobs; stats stay countable)
      prisma.booking.findMany({
        where: vendorOperationalBookingWhere({ vendorId }),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          service: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      // Archived bookings for archived-jobs view
      prisma.booking.findMany({
        where: vendorOperationalBookingWhere({
          vendorId,
          status: "ARCHIVED",
        }),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              isPublished: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),

      // Recent reviews (last 5)
      jobsOnly
        ? Promise.resolve([])
        : prisma.review.findMany({
        where: approvedCustomerReviewWhereForVendor(vendorId),
        select: {
          id: true,
          clientName: true,
          rating: true,
          comment: true,
          date: true,
          jobType: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Confirmed or Completed bookings for client count (exclude CANCELED and PENDING)
      jobsOnly
        ? Promise.resolve([])
        : prisma.booking.findMany({
        where: vendorOperationalBookingWhere({
          vendorId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
        }),
        select: {
          userId: true,
          clientName: true,
          customerMetadata: true,
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),

      // Completed bookings for earnings
      jobsOnly
        ? Promise.resolve([])
        : prisma.booking.findMany({
        where: vendorOperationalBookingWhere({
          vendorId,
          status: "COMPLETED",
        }),
        select: { amount: true },
      }),

      jobsOnly
        ? Promise.resolve([])
        : (prisma as any).mediaAsset.groupBy({
        by: ["moderationStatus"],
        where: countableMediaAssetWhere({
          vendorId,
        }),
        _count: { id: true },
      }),
      jobsOnly
        ? Promise.resolve(0)
        : (prisma as any).mediaAsset.count({
        where: countableMediaAssetWhere({
          vendorId,
        }),
      }),
      jobsOnly
        ? Promise.resolve(0)
        : (prisma as any).mediaAsset.count({
        where: {
          vendorId,
          OR: [{ deletedAt: { not: null } }, { archiveStatus: { in: ["ARCHIVED", "archived"] } }],
        },
      }),
      jobsOnly
        ? Promise.resolve([])
        : typeof (prisma as any).mediaAsset?.findMany === "function"
        ? (prisma as any).mediaAsset.findMany({
            where: {
              ...countableMediaAssetWhere({ vendorId }),
              mediaSession: {
                bookingId: { not: null },
                sessionType: "JOB_SERVICE_VIDEO",
                vendorJobVideoStage: {
                  in: [...REQUIRED_MEDIA_MODERATION_STAGE_KEYS],
                },
              },
            },
            select: {
              id: true,
              vendorId: true,
              moderationStatus: true,
              visibilityStatus: true,
              uploadedByMembershipId: true,
              createdAt: true,
              mediaSession: {
                select: {
                  bookingId: true,
                  vendorJobVideoStage: true,
                  booking: {
                    select: {
                      id: true,
                      title: true,
                      status: true,
                      clientName: true,
                      vendor: { select: { businessName: true, name: true } },
                      service: { select: { name: true } },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      jobsOnly
        ? Promise.resolve(null)
        : getCurrentVendorTrustScoreSnapshot(prisma as any, vendorId),
      ])
    );

    if (!vendor) {
      if (DASHBOARD_DEBUG_LOG) {
        console.warn("[vendors/dashboard] data:vendor-not-found", {
          requestId,
          vendorId,
          userId: resolvedUserId,
        });
      }
      return errorResponse("VENDOR_NOT_FOUND", "Vendor not found", 404, { vendorId });
    }

    // Calculate stats
    const statsData = statsAgg[0];
    const totalBookings = statsData?._count._all ?? 0;
    
    // Total Earnings: Sum of COMPLETED bookings only (Decimal handling)
    const totalEarnings = completedBookings.reduce(
      (sum: number, b: any) => {
        const amount = b.amount;
        if (!amount) return sum;
        // Handle Decimal type from Prisma (Decimal has toNumber method)
        const value = amount && typeof amount === 'object' && 'toNumber' in amount
          ? (amount as { toNumber: () => number }).toNumber()
          : typeof amount === 'number'
          ? amount
          : parseFloat(String(amount)) || 0;
        return sum + value;
      },
      0
    );
    
    // Total Clients: Unique clients from CONFIRMED + COMPLETED bookings only (exclude CANCELED)
    const totalClients = new Set(
      confirmedOrCompletedBookings
        .map((booking: any) => {
          const contact = resolveCustomerContactForBooking(booking);
          return resolveOperationalClientKey({
            userId: booking.userId,
            clientName: booking.clientName,
            userName: booking.user?.name,
            email: contact.email,
            phone: contact.phone,
          });
        })
        .filter(Boolean)
    ).size;
    let vendorRatingStats = { averageRating: 0, reviewCount: 0, ratingSum: 0 };
    try {
      vendorRatingStats = await getVendorRatingStats(vendorId);
    } catch (ratingError: any) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[vendors/dashboard] rating aggregation fallback", {
          vendorId,
          error: ratingError?.message || String(ratingError),
        });
      }
    }

    // Map bookings to VendorJob format with explicit status mapping
    const bookingIds = recentBookings.map((booking: any) => String(booking.id));
    const sessionsByBooking = bookingIds.length
      ? await withTransientDbRetry(() =>
          (prisma as any).mediaSession.findMany({
            where: {
              vendorId,
              bookingId: { in: bookingIds },
            },
            select: {
              id: true,
              bookingId: true,
              vendorJobVideoStage: true,
              sessionType: true,
              _count: { select: { mediaAssets: true } },
              mediaAssets: {
                where: { deletedAt: null },
                select: { id: true, moderationStatus: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          })
        )
      : [];
    const latestConsentRecords = bookingIds.length
      ? await withTransientDbRetry(() =>
          (prisma as any).consentRecord.findMany({
            where: { bookingId: { in: bookingIds }, isCurrent: true },
            select: {
              id: true,
              bookingId: true,
              status: true,
              lifecycleStatus: true,
              verifiedDecision: true,
              isCurrent: true,
              scopeJson: true,
              recipientEmailMasked: true,
              recipientPhoneMasked: true,
              recipientMismatch: true,
              acceptedAt: true,
              declinedAt: true,
              requestedAt: true,
              expiresAt: true,
              decisionEvidence: { select: { id: true } },
            },
            orderBy: [{ bookingId: "asc" }, { requestedAt: "desc" }],
          })
        )
      : [];
    const consentNotifications = bookingIds.length
      ? await withTransientDbRetry(() =>
          (prisma as any).bookingNotification.findMany({
            where: {
              bookingId: { in: bookingIds },
              kind: { startsWith: 'CUSTOMER_PERMISSION_REQUEST' },
            },
            orderBy: { createdAt: 'desc' },
          })
        )
      : [];
    const mediaSummaryByBookingId = new Map<string, { linkedSessionCount: number; linkedMediaCount: number }>();
    const sessionsForPhaseByBookingId = new Map<string, any[]>();
    const latestConsentByBookingId = new Map<string, any>();
    const consentNotificationByBookingId = new Map<string, any>();
    for (const session of sessionsByBooking as any[]) {
      const key = String(session.bookingId || "");
      if (!key) continue;
      const current = mediaSummaryByBookingId.get(key) || { linkedSessionCount: 0, linkedMediaCount: 0 };
      mediaSummaryByBookingId.set(key, {
        linkedSessionCount: current.linkedSessionCount + 1,
        linkedMediaCount: current.linkedMediaCount + Number(session?._count?.mediaAssets || 0),
      });
      const existingSessions = sessionsForPhaseByBookingId.get(key) || [];
      existingSessions.push(session);
      sessionsForPhaseByBookingId.set(key, existingSessions);
    }
    for (const consentRecord of latestConsentRecords as any[]) {
      const key = String(consentRecord?.bookingId || "");
      if (!key || latestConsentByBookingId.has(key)) continue;
      latestConsentByBookingId.set(key, consentRecord);
    }
    for (const notification of consentNotifications as any[]) {
      const key = String(notification?.bookingId || "");
      if (key && !consentNotificationByBookingId.has(key)) {
        consentNotificationByBookingId.set(key, notification);
      }
    }

    const recentJobs = await Promise.all(recentBookings
      .filter((booking: any) => {
        if (booking.status === "ARCHIVED") return false;
        if (!booking.serviceId || !booking.service) return true;
        return Boolean(booking.service.isPublished);
      })
      .map(async (booking: any) => {
      // Explicit mapping for all Booking.status values: PENDING, CONFIRMED, COMPLETED, CANCELED
      const statusMap: Record<
        string,
        "completed" | "in progress" | "scheduled" | "canceled" | "awaiting_review" | "archived" | "rejected"
      > = {
        COMPLETED: "completed",
        IN_PROGRESS: "in progress",
        CONFIRMED: "in progress",
        PENDING: "scheduled",
        CANCELED: "canceled",
        AWAITING_REVIEW: "awaiting_review",
        ARCHIVED: "archived",
        REJECTED: "rejected",
      };
      const mappedStatus = statusMap[booking.status] || "scheduled";

      const mediaSummary = mediaSummaryByBookingId.get(String(booking.id)) || {
        linkedSessionCount: 0,
        linkedMediaCount: 0,
      };
      const latestConsentRecord = latestConsentByBookingId.get(String(booking.id)) || null;
      const consentNotification =
        consentNotificationByBookingId.get(String(booking.id)) || null;
      const packageState = evaluateVendorJobPackageState(
        sessionsForPhaseByBookingId.get(String(booking.id)) || []
      );
      const rejectedStagedMedia = hasRejectedStagedMedia(packageState);
      const operationalPhase = rejectedStagedMedia
        ? "REJECTED"
        : resolveOperationalPhase({
            bookingStatus: booking.status,
            customerMetadata: booking.customerMetadata,
            linkedMediaCount: mediaSummary.linkedMediaCount,
            assignedEmployees: extractAssignedEmployeesFromMetadata(booking.customerMetadata),
            hasCompleteStagedPackage: packageState.hasAllRequiredStages,
            hasAdminApprovedStagedPackage: packageState.hasAllRequiredStagesApproved,
          });
      const effectiveStatus = rejectedStagedMedia ? "rejected" : mappedStatus;

      // Handle Decimal amount
      const amount = booking.amount;
      const amountValue = amount && typeof amount === 'object' && 'toNumber' in amount
        ? (amount as { toNumber: () => number }).toNumber()
        : typeof amount === 'number'
        ? amount
        : parseFloat(String(amount)) || 0;

      const assignedEmployeesRaw = extractAssignedEmployeesFromMetadata(booking.customerMetadata);
      const assignedMembershipIds = extractAssignedMembershipIdsFromMetadata(booking.customerMetadata);
      const uploadedVideoStages = extractUploadedVideoStagesFromMetadata(booking.customerMetadata);
      const customerContact = resolveCustomerContactForBooking(booking);
      const legacyCompliance = parseRecordingComplianceMetadata(booking.customerMetadata);
      const permissionGate = await loadRecordingPermissionGate({
        bookingId: String(booking.id),
        vendorId,
        customerMetadata: booking.customerMetadata,
        consentRecord: latestConsentRecord,
        membershipId: assignedMembershipIds[0] || undefined,
        surface: "admin_evidence",
        capability: "observe",
        actorKind: "VENDOR_MANAGER",
      });
      const clientLabel = resolveOperationalClientLabel({
        clientName: booking.clientName,
        userName: booking.user?.name,
      });
      return {
        id: booking.id,
        serviceId: booking.serviceId,
        serviceName: booking.service?.name || "",
        serviceType: booking.service?.name || "",
        title: booking.title || booking.service?.name || "Untitled Job",
        client: clientLabel,
        customerEmail: customerContact.email,
        customerPhone: customerContact.phone,
        amount: amountValue,
        status: effectiveStatus,
        operationalPhase,
        assignedEmployees: assignedEmployeesRaw,
        assignedMembershipIds,
        uploadedVideoStages,
        recordingCompliance: {
          location: permissionGate.location,
          consentAccepted: permissionGate.verifiedAllowed,
          permissionRequired: permissionGate.permissionRequired,
          permissionStatus: permissionGate.permissionState,
          recordingUnlocked: permissionGate.recordingUnlocked,
          locationVerified: legacyCompliance.locationVerified,
          locationVerifiedAt: legacyCompliance.locationVerifiedAt,
          locationAttemptStatus: permissionGate.locationAttemptStatus,
          locationAttemptResultCode: permissionGate.locationAttemptResultCode,
          locationExceptionStatus: permissionGate.locationExceptionStatus,
          assessmentId: permissionGate.assessmentId,
          riskLevel: permissionGate.riskLevel,
          scopeSummary: permissionGate.scopeSummary,
          canonicalBlock: permissionGate.block,
          serviceOrderReleasedAt: legacyCompliance.serviceOrderReleasedAt,
          releasedMembershipIds: legacyCompliance.releasedMembershipIds,
        },
        rejectionReason: booking.rejectionReason || null,
        rejectedAt: booking.rejectedAt?.toISOString?.() || null,
        consentStatus: permissionGate.permissionState,
        latestConsentId: latestConsentRecord?.id || null,
        permissionRecordingUnlocked: permissionGate.recordingUnlocked,
        consentRecipient: latestConsentRecord
          ? {
              email: latestConsentRecord.recipientEmailMasked || null,
              phone: latestConsentRecord.recipientPhoneMasked || null,
            }
          : null,
        consentAcceptedAt: latestConsentRecord?.acceptedAt?.toISOString?.() || null,
        consentDeclinedAt: latestConsentRecord?.declinedAt?.toISOString?.() || null,
        consentNotification: toBookingNotificationState(consentNotification),
        source: resolveJobSourceFromMetadata(booking.customerMetadata),
        createdAt: booking.createdAt?.toISOString() || null,
        updatedAt: booking.updatedAt?.toISOString() || booking.createdAt?.toISOString() || null,
        linkedMediaCount: mediaSummary.linkedMediaCount,
        linkedSessionCount: mediaSummary.linkedSessionCount,
        date:
          booking.date?.toISOString() ||
          booking.scheduledFor?.toISOString() ||
          booking.createdAt.toISOString(),
      };
    }));

    const archivedJobs = archivedBookings
      .filter((booking: any) => {
        if (!booking.serviceId || !booking.service) return true;
        return Boolean(booking.service.isPublished);
      })
      .map((booking: any) => {
      const archMedia = mediaSummaryByBookingId.get(String(booking.id)) || {
        linkedSessionCount: 0,
        linkedMediaCount: 0,
      };
      const operationalPhaseArchived = resolveOperationalPhase({
        bookingStatus: booking.status,
        customerMetadata: booking.customerMetadata,
        linkedMediaCount: archMedia.linkedMediaCount,
        assignedEmployees: extractAssignedEmployeesFromMetadata(booking.customerMetadata),
      });
      const assignedEmployeesRaw = extractAssignedEmployeesFromMetadata(booking.customerMetadata);
      const assignedMembershipIds = extractAssignedMembershipIdsFromMetadata(booking.customerMetadata);
      const uploadedVideoStages = extractUploadedVideoStagesFromMetadata(booking.customerMetadata);
      const customerContact = resolveCustomerContactForBooking(booking);
      const clientLabel = resolveOperationalClientLabel({
        clientName: booking.clientName,
        userName: booking.user?.name,
      });
      return {
      id: booking.id,
      serviceId: booking.serviceId,
      serviceName: booking.service?.name || "",
      serviceType: booking.service?.name || "",
      title: booking.title || booking.service?.name || "Untitled Job",
      client: clientLabel,
      customerEmail: customerContact.email,
      customerPhone: customerContact.phone,
      amount: booking.amount ? Number(booking.amount) : 0,
      status: "archived",
      operationalPhase: operationalPhaseArchived,
      assignedEmployees: assignedEmployeesRaw,
      assignedMembershipIds,
      uploadedVideoStages,
      createdAt: booking.createdAt?.toISOString() || null,
      updatedAt: booking.updatedAt?.toISOString() || booking.createdAt?.toISOString() || null,
      date:
        booking.date?.toISOString() ||
        booking.scheduledFor?.toISOString() ||
        booking.updatedAt?.toISOString() ||
        booking.createdAt.toISOString(),
    };
    });

    const historyJobs = [...recentJobs, ...archivedJobs];
    const historyMembershipIds = Array.from(
      new Set(
        historyJobs
          .flatMap((job: any) =>
            Array.isArray(job?.assignedMembershipIds)
              ? job.assignedMembershipIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
              : []
          )
          .filter(Boolean)
      )
    );
    const formerMembershipIds = new Set<string>();
    if (historyMembershipIds.length > 0) {
      const membershipRows = await prisma.vendorMembership.findMany({
        where: {
          vendorId,
          id: { in: historyMembershipIds },
        },
        select: { id: true, status: true },
      });
      for (const row of membershipRows) {
        if (String(row.status || "").trim().toUpperCase() !== "ACTIVE") {
          formerMembershipIds.add(String(row.id));
        }
      }
    }
    for (const job of historyJobs) {
      const status = String(job?.status || "").trim().toLowerCase();
      if (status !== "completed" && status !== "archived") continue;
      job.assignedEmployees = formatAssignedEmployeesForHistory(
        Array.isArray(job.assignedEmployees) ? job.assignedEmployees : [],
        Array.isArray(job.assignedMembershipIds) ? job.assignedMembershipIds : [],
        formerMembershipIds
      );
    }

    const lifecycleCounts = recentJobs.reduce(
      (counts, job: any) => {
        const normalized = String(job?.status || "").trim().toLowerCase();
        const phase = normalizeKey(job?.operationalPhase);
        if (phase === "REJECTED" || normalized === "rejected") counts.rejected += 1;
        else if (phase === "COMPLETED" || normalized === "completed") counts.completed += 1;
        else if (phase === "IN_PROGRESS" || normalized === "in progress") counts.inProgress += 1;
        else if (
          phase === "AWAITING_VENDOR_REVIEW" ||
          phase === "AWAITING_ADMIN_REVIEW" ||
          normalized === "awaiting_review"
        ) counts.awaitingReview += 1;
        else if (normalized === "canceled") counts.canceled += 1;
        else counts.scheduled += 1;
        return counts;
      },
      {
        scheduled: 0,
        inProgress: 0,
        awaitingReview: 0,
        completed: 0,
        canceled: 0,
        rejected: 0,
        archived: archivedJobs.length,
      }
    );
    const completionEligibleBookingCount =
      lifecycleCounts.scheduled +
      lifecycleCounts.inProgress +
      lifecycleCounts.awaitingReview +
      lifecycleCounts.completed;

    if (jobsOnly) {
      const response = {
        recentJobs,
        archivedJobs,
        lifecycleCounts,
      };

      if (useResponseCache) {
        cache.set(cacheKey, {
          data: response,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }

      return NextResponse.json({ success: true, ...response });
    }

    // Map reviews to VendorReview format
    const recentReviewsMapped = recentReviews.map((review: any) => ({
      id: review.id,
      client: resolveOperationalClientLabel({
        clientName: review.clientName,
        userName: review.user?.name,
      }),
      rating: review.rating,
      comment: review.comment || "",
      date: review.date?.toISOString() || review.createdAt.toISOString(),
      jobType: review.jobType || "Service",
    }));

    let employeeRatingRows: Array<{
      membershipId: string;
      averageRating: number;
      reviewCount: number;
      ratingSum: number;
    }> = [];
    try {
      employeeRatingRows = await getEmployeeRatingsForVendor(vendorId);
    } catch (employeeRatingError: any) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[vendors/dashboard] employee rating aggregation fallback", {
          vendorId,
          error: employeeRatingError?.message || String(employeeRatingError),
        });
      }
      employeeRatingRows = [];
    }
    const employeeMembershipIds = employeeRatingRows.map((row) => row.membershipId);
    const membershipRows = employeeMembershipIds.length
      ? await prisma.vendorMembership.findMany({
          where: {
            vendorId,
            id: { in: employeeMembershipIds },
          },
          select: {
            id: true,
            status: true,
            user: { select: { name: true, email: true } },
          },
        })
      : [];
    const membershipById = new Map(membershipRows.map((row) => [String(row.id), row]));

    // Aggregate per-membership job completion counts + last completed job
    // timestamp from the same booking history we already loaded above. This
    // lets the dashboard show jobsCompleted / lastJobAt for every employee
    // even when they don't have any reviews yet.
    const jobStatsByMembershipId = new Map<
      string,
      { jobsCompleted: number; lastJobAt: string | null }
    >();
    const completedHistoryJobs = historyJobs.filter((job: any) => {
      const status = String(job?.status || "").trim().toLowerCase();
      return status === "completed" || status === "archived";
    });
    for (const job of completedHistoryJobs) {
      const ids = Array.isArray(job?.assignedMembershipIds)
        ? job.assignedMembershipIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
        : [];
      const candidate =
        (typeof job?.updatedAt === "string" && job.updatedAt) ||
        (typeof job?.date === "string" && job.date) ||
        (typeof job?.createdAt === "string" && job.createdAt) ||
        null;
      for (const id of ids) {
        const existing = jobStatsByMembershipId.get(id) || {
          jobsCompleted: 0,
          lastJobAt: null,
        };
        existing.jobsCompleted += 1;
        if (candidate) {
          if (!existing.lastJobAt || candidate > existing.lastJobAt) {
            existing.lastJobAt = candidate;
          }
        }
        jobStatsByMembershipId.set(id, existing);
      }
    }

    // Make sure every membership that has completed jobs is hydrated with
    // its display name, even when it never received a review.
    const reviewMembershipIds = new Set(employeeMembershipIds.map((id) => String(id)));
    const jobOnlyMembershipIds = Array.from(jobStatsByMembershipId.keys()).filter(
      (id) => !reviewMembershipIds.has(id)
    );
    if (jobOnlyMembershipIds.length > 0) {
      const extra = await prisma.vendorMembership.findMany({
        where: {
          vendorId,
          id: { in: jobOnlyMembershipIds },
        },
        select: {
          id: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
      });
      for (const row of extra) {
        membershipById.set(String(row.id), row);
      }
    }

    const buildEmployeeEntry = (membershipId: string, ratingRow?: {
      averageRating: number;
      reviewCount: number;
    }) => {
      const membership = membershipById.get(String(membershipId));
      const baseName =
        String(membership?.user?.name || "").trim() ||
        String(membership?.user?.email || "").trim() ||
        "Former team member";
      const isFormer = membership
        ? String(membership.status || "").trim().toUpperCase() !== "ACTIVE"
        : true;
      const jobStats = jobStatsByMembershipId.get(String(membershipId)) || {
        jobsCompleted: 0,
        lastJobAt: null,
      };
      return {
        membershipId,
        displayName: isFormer ? `${baseName} (Former team member)` : baseName,
        averageRating: ratingRow?.averageRating ?? 0,
        reviewCount: ratingRow?.reviewCount ?? 0,
        jobsCompleted: jobStats.jobsCompleted,
        lastJobAt: jobStats.lastJobAt,
        active: !isFormer,
      };
    };

    const employeePerformance = [
      ...employeeRatingRows.map((row) =>
        buildEmployeeEntry(String(row.membershipId), {
          averageRating: row.averageRating,
          reviewCount: row.reviewCount,
        })
      ),
      ...jobOnlyMembershipIds.map((id) => buildEmployeeEntry(id)),
    ];

    let pendingModerationProofs = 0;
    let approvedProofAssets = 0;
    for (const row of proofModerationGroups as any[]) {
      const key = normalizeKey(row?.moderationStatus);
      const count = Number(row?._count?.id || 0);
      if (!key || key === "PENDING_REVIEW") {
        pendingModerationProofs += count;
      } else if (key === APPROVED_STATUS) {
        approvedProofAssets += count;
      }
    }
    const moderationPackages = buildCompleteMediaModerationPackages(
      (packageMediaAssets as any[]).map((asset) => ({
        id: asset.id,
        title: asset.mediaSession?.booking?.title || asset.mediaSession?.booking?.service?.name || null,
        vendorId: asset.vendorId,
        vendorName:
          asset.mediaSession?.booking?.vendor?.businessName ||
          asset.mediaSession?.booking?.vendor?.name ||
          null,
        bookingId: asset.mediaSession?.bookingId || null,
        jobTitle: asset.mediaSession?.booking?.title || asset.mediaSession?.booking?.service?.name || null,
        bookingStatus: asset.mediaSession?.booking?.status || null,
        clientName: asset.mediaSession?.booking?.clientName || null,
        serviceName: asset.mediaSession?.booking?.service?.name || null,
        uploadedByMembershipId: asset.uploadedByMembershipId || null,
        vendorJobVideoStageKey: asset.mediaSession?.vendorJobVideoStage || null,
        moderationStatus: asset.moderationStatus || null,
        visibilityStatus: asset.visibilityStatus || null,
        createdAt: asset.createdAt || null,
      }))
    );
    const pendingModerationServiceOrders = countPendingMediaModerationPackages(moderationPackages);
    const approvedServiceOrders = moderationPackages.filter(
      (pack) =>
        pack.packageReadiness === "APPROVED" &&
        !["REJECTED", "CANCELED", "ARCHIVED"].includes(normalizeKey(pack.bookingStatus))
    ).length;
    const publicServiceOrders = moderationPackages.filter(
      (pack) =>
        pack.packageReadiness === "APPROVED" &&
        !["REJECTED", "CANCELED", "ARCHIVED"].includes(normalizeKey(pack.bookingStatus)) &&
        pack.visibilityStatuses.some((status) => normalizeKey(status) === PUBLIC_VISIBILITY_STATUS)
    ).length;
    const trustScore = toVendorTrustScore(currentTrustScoreSnapshot as any);

    let storageUsedBytes = "0";
    let storageLimitBytes = "0";
    let storagePercentUsed = 0;
    try {
      const usage = await withTransientDbRetry(() => calculateStorageUsage(vendorId));
      storageUsedBytes = String(usage.usedBytes);
      storageLimitBytes = String(usage.limitBytes);
      storagePercentUsed = Number(usage.percentUsed || 0);
    } catch (storageError: any) {
      if (DASHBOARD_DEBUG_LOG) {
        console.warn("[vendors/dashboard] storage summary fallback", {
          vendorId,
          error: storageError?.message || String(storageError),
        });
      }
    }

    // Build response
    const response = {
      profile: {
        id: vendor.id,
        firstName: vendor.firstName ?? "",
        lastName: vendor.lastName ?? "",
        name: vendor.name ?? "",
        businessName: vendor.businessName ?? "",
        businessType: vendor.businessType ?? "",
        category: vendor.category ?? "",
        foundedYear: vendor.foundedYear ?? "",
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        city: vendor.city ?? "",
        state: vendor.state ?? "",
        serviceTypes: vendor.serviceTypes ?? "",
        specializations: vendor.specializations ?? "",
        serviceAreas: vendor.serviceAreas ?? "",
      },
      stats: {
        totalBookings,
        completionEligibleBookingCount,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)), // Format as number with 2 decimals
        totalClients,
        rating: vendorRatingStats.averageRating,
        ratingCount: vendorRatingStats.reviewCount,
      },
      recentJobs,
      archivedJobs,
      lifecycleCounts,
      recentReviews: recentReviewsMapped,
      employeePerformance,
      insights: [],
      notifications: [],
      pendingModerationProofs,
      approvedProofs: approvedServiceOrders,
      pendingModerationServiceOrderCount: pendingModerationServiceOrders,
      approvedServiceOrderCount: approvedServiceOrders,
      publicServiceOrderCount: publicServiceOrders,
      approvedProofAssets,
      archivedProofs: Number(archivedProofs || 0),
      totalProofAssets: Number(totalProofAssets || 0),
      trustScore: trustScore.totalScorePct,
      trustScoreSummary: trustScore,
      storageUsedBytes,
      storageLimitBytes,
      storagePercentUsed,
    };

    // Cache the response
    if (useResponseCache) {
      cache.set(cacheKey, {
        data: response,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      // Clean up expired cache entries (simple cleanup)
      if (cache.size > 100) {
        const now = Date.now();
        const keysToDelete: string[] = [];
        cache.forEach((value, key) => {
          if (value.expiresAt <= now) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => cache.delete(key));
      }
    }

    return NextResponse.json({ success: true, ...response });
  } catch (error: any) {
    console.error("[vendors/dashboard] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      console.error("[vendors/dashboard] transient DB connectivity issue (Azure SQL/network)");
      return errorResponse(
        "DASHBOARD_DB_CONNECTIVITY",
        "Failed to fetch dashboard",
        503,
        { details: "Transient database connectivity issue. Please retry shortly." }
      );
    }
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return errorResponse("DASHBOARD_FORBIDDEN", error.message, 403);
    }
    return errorResponse(
      "DASHBOARD_INTERNAL_ERROR",
      "Failed to fetch dashboard",
      500,
      { details: error.message }
    );
  }
}
