// src/app/api/vendors/[vendorId]/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest, getVendorMembership, requireVendorMembership } from "@/lib/membership-auth";
import { resolveOperationalPhase } from "@/lib/vendor-job-operational-phase";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

// Simple in-memory cache (60 seconds TTL per vendor)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const USE_DASHBOARD_CACHE = process.env.NODE_ENV !== "development";
const DASHBOARD_DEBUG_LOG = process.env.NODE_ENV !== "production";

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

function isTransientDbConnectivityError(error: any): boolean {
  const message = String(error?.message || '');
  return (
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT')
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

    // Check cache
    const cacheKey = `dashboard:${vendorId}`;
    const cached = USE_DASHBOARD_CACHE ? cache.get(cacheKey) : null;
    if (USE_DASHBOARD_CACHE && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    // Calculate UTC date ranges for insights (consistent timezone handling)
    const now = new Date();
    const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // Last month start (UTC)
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    // This month start (UTC)
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // Next month start (UTC) for upper bound
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // Fetch vendor profile and related data in parallel
    const [
      vendor,
      statsAgg,
      recentBookings,
      archivedBookings,
      recentReviews,
      confirmedOrCompletedBookings, // For client count (CONFIRMED + COMPLETED only)
      allReviews,
      completedBookings,
      bookingsLastMonth,
      bookingsThisMonth,
      reviewsLastMonth,
      reviewsThisMonth,
      earningsLastMonth,
      earningsThisMonth,
    ] = await withTransientDbRetry(() =>
      Promise.all([
      // Vendor profile
      prisma.vendor.findUnique({
        where: { id: vendorId },
      }),

      // Booking stats aggregation
      prisma.booking.groupBy({
        by: ["vendorId"],
        where: { vendorId },
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Recent bookings (last 5)
      prisma.booking.findMany({
        where: { vendorId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          service: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      // Archived bookings for archived-jobs view
      prisma.booking.findMany({
        where: {
          vendorId,
          status: "ARCHIVED",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),

      // Recent reviews (last 5)
      prisma.review.findMany({
        where: { vendorId },
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
      prisma.booking.findMany({
        where: {
          vendorId,
          status: {
            in: ["CONFIRMED", "COMPLETED"],
          },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),

      // All reviews for rating calculation
      prisma.review.findMany({
        where: { vendorId },
        select: { rating: true },
      }),

      // Completed bookings for earnings
      prisma.booking.findMany({
        where: {
          vendorId,
          status: "COMPLETED",
        },
        select: { amount: true },
      }),

      // Bookings last month (UTC)
      prisma.booking.count({
        where: {
          vendorId,
          createdAt: {
            gte: lastMonthStart,
            lt: thisMonthStart,
          },
        },
      }),
      // Bookings this month (UTC)
      prisma.booking.count({
        where: {
          vendorId,
          createdAt: {
            gte: thisMonthStart,
            lt: nextMonthStart,
          },
        },
      }),
      // Reviews last month (UTC)
      prisma.review.count({
        where: {
          vendorId,
          createdAt: {
            gte: lastMonthStart,
            lt: thisMonthStart,
          },
        },
      }),
      // Reviews this month (UTC)
      prisma.review.count({
        where: {
          vendorId,
          createdAt: {
            gte: thisMonthStart,
            lt: nextMonthStart,
          },
        },
      }),
      // Earnings last month (UTC) - COMPLETED only
      prisma.booking.aggregate({
        where: {
          vendorId,
          status: "COMPLETED",
          createdAt: {
            gte: lastMonthStart,
            lt: thisMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      // Earnings this month (UTC) - COMPLETED only
      prisma.booking.aggregate({
        where: {
          vendorId,
          status: "COMPLETED",
          createdAt: {
            gte: thisMonthStart,
            lt: nextMonthStart,
          },
        },
        _sum: { amount: true },
      }),
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
    const totalClients = confirmedOrCompletedBookings.length;
    
    const ratings = allReviews.map((r: any) => r.rating).filter((r: number) => r > 0);
    const rating =
      ratings.length > 0
        ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length
        : 0;

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
                select: { id: true, moderationStatus: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          })
        )
      : [];
    const mediaSummaryByBookingId = new Map<string, { linkedSessionCount: number; linkedMediaCount: number }>();
    const sessionsForPhaseByBookingId = new Map<string, any[]>();
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

    const recentJobs = recentBookings
      .filter((booking: any) => booking.status !== "ARCHIVED")
      .map((booking: any) => {
      // Explicit mapping for all Booking.status values: PENDING, CONFIRMED, COMPLETED, CANCELED
      const statusMap: Record<string, "completed" | "in progress" | "scheduled" | "canceled"> = {
        COMPLETED: "completed",
        CONFIRMED: "in progress",
        PENDING: "scheduled",
        CANCELED: "canceled",
      };
      const mappedStatus = statusMap[booking.status] || "scheduled";

      const mediaSummary = mediaSummaryByBookingId.get(String(booking.id)) || {
        linkedSessionCount: 0,
        linkedMediaCount: 0,
      };
      const packageState = evaluateVendorJobPackageState(
        sessionsForPhaseByBookingId.get(String(booking.id)) || []
      );
      const operationalPhase = resolveOperationalPhase({
        bookingStatus: booking.status,
        customerMetadata: booking.customerMetadata,
        linkedMediaCount: mediaSummary.linkedMediaCount,
        assignedEmployees: extractAssignedEmployeesFromMetadata(booking.customerMetadata),
        hasCompleteStagedPackage: packageState.hasAllRequiredStages,
        hasAdminApprovedStagedPackage: packageState.hasAllRequiredStagesApproved,
      });

      // Handle Decimal amount
      const amount = booking.amount;
      const amountValue = amount && typeof amount === 'object' && 'toNumber' in amount
        ? (amount as { toNumber: () => number }).toNumber()
        : typeof amount === 'number'
        ? amount
        : parseFloat(String(amount)) || 0;

      return {
        id: booking.id,
        serviceId: booking.serviceId,
        serviceName: booking.service?.name || "",
        serviceType: booking.service?.name || "",
        title: booking.title || booking.service?.name || "Untitled Job",
        client: booking.clientName || booking.user?.name || "Unknown Client",
        amount: amountValue,
        status: mappedStatus,
        operationalPhase,
        assignedEmployees: extractAssignedEmployeesFromMetadata(booking.customerMetadata),
        assignedMembershipIds: extractAssignedMembershipIdsFromMetadata(booking.customerMetadata),
        createdAt: booking.createdAt?.toISOString() || null,
        updatedAt: booking.updatedAt?.toISOString() || booking.createdAt?.toISOString() || null,
        linkedMediaCount: mediaSummary.linkedMediaCount,
        linkedSessionCount: mediaSummary.linkedSessionCount,
        date:
          booking.date?.toISOString() ||
          booking.scheduledFor?.toISOString() ||
          booking.createdAt.toISOString(),
      };
    });

    const archivedJobs = archivedBookings.map((booking: any) => {
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
      return {
      id: booking.id,
      serviceId: booking.serviceId,
      serviceName: booking.service?.name || "",
      serviceType: booking.service?.name || "",
      title: booking.title || booking.service?.name || "Untitled Job",
      client: booking.clientName || booking.user?.name || "Unknown Client",
      amount: booking.amount ? Number(booking.amount) : 0,
      status: "archived",
      operationalPhase: operationalPhaseArchived,
      assignedEmployees: extractAssignedEmployeesFromMetadata(booking.customerMetadata),
      assignedMembershipIds: extractAssignedMembershipIdsFromMetadata(booking.customerMetadata),
      createdAt: booking.createdAt?.toISOString() || null,
      updatedAt: booking.updatedAt?.toISOString() || booking.createdAt?.toISOString() || null,
      date:
        booking.date?.toISOString() ||
        booking.scheduledFor?.toISOString() ||
        booking.updatedAt?.toISOString() ||
        booking.createdAt.toISOString(),
    };
    });

    // Map reviews to VendorReview format
    const recentReviewsMapped = recentReviews.map((review: any) => ({
      id: review.id,
      client: review.clientName || review.user?.name || "Unknown Client",
      rating: review.rating,
      comment: review.comment || "",
      date: review.date?.toISOString() || review.createdAt.toISOString(),
      jobType: review.jobType || "Service",
    }));

    // Calculate insights with Decimal handling
    const bookingsChange = bookingsLastMonth > 0
      ? ((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100
      : bookingsThisMonth > 0 ? 100 : 0;
    
    const reviewsChange = reviewsLastMonth > 0
      ? ((reviewsThisMonth - reviewsLastMonth) / reviewsLastMonth) * 100
      : reviewsThisMonth > 0 ? 100 : 0;
    
    // Handle Decimal earnings
    const earningsLastMonthValue = earningsLastMonth._sum.amount
      ? (earningsLastMonth._sum.amount && typeof earningsLastMonth._sum.amount === 'object' && 'toNumber' in earningsLastMonth._sum.amount
          ? (earningsLastMonth._sum.amount as { toNumber: () => number }).toNumber()
          : typeof earningsLastMonth._sum.amount === 'number'
          ? earningsLastMonth._sum.amount
          : parseFloat(String(earningsLastMonth._sum.amount)) || 0)
      : 0;
    
    const earningsThisMonthValue = earningsThisMonth._sum.amount
      ? (earningsThisMonth._sum.amount && typeof earningsThisMonth._sum.amount === 'object' && 'toNumber' in earningsThisMonth._sum.amount
          ? (earningsThisMonth._sum.amount as { toNumber: () => number }).toNumber()
          : typeof earningsThisMonth._sum.amount === 'number'
          ? earningsThisMonth._sum.amount
          : parseFloat(String(earningsThisMonth._sum.amount)) || 0)
      : 0;
    
    const earningsChange = earningsLastMonthValue > 0
      ? ((earningsThisMonthValue - earningsLastMonthValue) / earningsLastMonthValue) * 100
      : earningsThisMonthValue > 0 ? 100 : 0;

    const insights = [
      {
        id: "bookings-growth",
        title: "Bookings This Month",
        value: bookingsThisMonth.toString(),
        change: `${bookingsChange >= 0 ? "+" : ""}${bookingsChange.toFixed(1)}%`,
        trend: bookingsChange >= 0 ? ("up" as const) : ("down" as const),
      },
      {
        id: "reviews-growth",
        title: "New Reviews",
        value: reviewsThisMonth.toString(),
        change: `${reviewsChange >= 0 ? "+" : ""}${reviewsChange.toFixed(1)}%`,
        trend: reviewsChange >= 0 ? ("up" as const) : ("down" as const),
      },
      {
        id: "earnings-growth",
        title: "Monthly Earnings",
        value: `$${earningsThisMonthValue.toFixed(2)}`, // Currency formatting with 2 decimals
        change: `${earningsChange >= 0 ? "+" : ""}${earningsChange.toFixed(1)}%`,
        trend: earningsChange >= 0 ? ("up" as const) : ("down" as const),
      },
      {
        id: "completion-rate",
        title: "Completion Rate",
        value: totalBookings > 0
          ? `${Math.round((completedBookings.length / totalBookings) * 100)}%`
          : "0%",
        change: "vs last month",
        trend: "up" as const,
      },
    ];

    // Fetch vendor-specific notifications (from AdminNotification filtered by vendorId)
    // Note: Model name in Prisma client is camelCase based on @@map
    const vendorNotifications = await withTransientDbRetry(() =>
      (prisma as any).adminNotification.findMany({
        where: {
          vendorId,
          read: false,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    );

    const notifications = (vendorNotifications as any[]).map((notif: any) => ({
      id: notif.id,
      type: notif.type.toLowerCase().includes("job")
        ? ("job" as const)
        : notif.type.toLowerCase().includes("review")
        ? ("review" as const)
        : notif.type.toLowerCase().includes("payment") || notif.type.toLowerCase().includes("payout")
        ? ("payment" as const)
        : ("reminder" as const),
      title: notif.title,
      message: notif.message,
      time: new Date(notif.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      read: notif.read,
      priority:
        notif.type === "STORAGE_LIMIT_REACHED"
          ? ("high" as const)
          : notif.type === "STORAGE_ALERT"
          ? ("medium" as const)
          : ("low" as const),
    }));

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
        totalEarnings: parseFloat(totalEarnings.toFixed(2)), // Format as number with 2 decimals
        totalClients,
        rating: Math.round(rating * 10) / 10,
      },
      recentJobs,
      archivedJobs,
      recentReviews: recentReviewsMapped,
      insights,
      notifications,
    };

    // Cache the response
    if (USE_DASHBOARD_CACHE) {
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
