// src/app/api/vendors/[vendorId]/dashboard/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

// Simple in-memory cache (60 seconds TTL per vendor)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const USE_DASHBOARD_CACHE = process.env.NODE_ENV !== "development";

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
  try {
    const { vendorId } = await context.params;
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
        orderBy: { createdAt: "desc" },
        take: 5,
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
        include: {
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
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
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
        title: booking.title || booking.service?.name || "Untitled Job",
        client: booking.clientName || booking.user?.name || "Unknown Client",
        amount: amountValue,
        status: mappedStatus,
        date:
          booking.date?.toISOString() ||
          booking.scheduledFor?.toISOString() ||
          booking.createdAt.toISOString(),
      };
    });

    const archivedJobs = archivedBookings.map((booking: any) => ({
      id: booking.id,
      serviceId: booking.serviceId,
      serviceName: booking.service?.name || "",
      title: booking.title || booking.service?.name || "Untitled Job",
      client: booking.clientName || booking.user?.name || "Unknown Client",
      amount: booking.amount ? Number(booking.amount) : 0,
      status: "archived",
      date:
        booking.date?.toISOString() ||
        booking.scheduledFor?.toISOString() ||
        booking.updatedAt?.toISOString() ||
        booking.createdAt.toISOString(),
    }));

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

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[vendors/dashboard] GET error:", error);
    if (isTransientDbConnectivityError(error)) {
      console.error("[vendors/dashboard] transient DB connectivity issue (Azure SQL/network)");
      return NextResponse.json(
        {
          error: "Failed to fetch dashboard",
          details: "Transient database connectivity issue. Please retry shortly.",
        },
        { status: 503 }
      );
    }
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch dashboard", details: error.message },
      { status: 500 }
    );
  }
}
