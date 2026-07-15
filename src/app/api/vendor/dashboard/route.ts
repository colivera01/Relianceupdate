// src/app/api/vendor/dashboard/route.ts

import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

import { getVendorIdFromRequest } from "@/lib/auth";
import { resolveOperationalClientKey, resolveOperationalClientLabel } from "@/lib/operational-client";
import {
  countableReviewWhere,
  vendorOperationalBookingWhere,
} from "@/lib/metrics-exclusion";

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


export async function GET(request: Request) {

  try {

    // 1) Get vendor ID (currently hard-coded in auth.ts)

    const vendorId = await getVendorIdFromRequest(request);

    console.log("[vendor/dashboard] vendorId from auth:", vendorId);



    if (!vendorId) {

      return NextResponse.json(

        { error: "Unauthorized: no vendor ID" },

        { status: 401 }

      );

    }



    // 2) Fetch vendor profile and related data in parallel

    console.log("[vendor/dashboard] Fetching vendor and related data from DB...");

    const [vendor, statsAgg, recentBookings, recentReviews, allBookings, allReviews, completedBookings] = await Promise.all([

      prisma.vendor.findUnique({

        where: { id: vendorId },

      }),

      prisma.booking.groupBy({

        by: ['vendorId'],

        where: vendorOperationalBookingWhere({ vendorId }),

        _count: { _all: true },

        _sum: { amount: true },

      }),

      prisma.booking.findMany({

        where: vendorOperationalBookingWhere({ vendorId }),

        include: {

          user: true,

          service: true,

        },

        orderBy: { createdAt: 'desc' },

        take: 5,

      }),

      prisma.review.findMany({

        where: approvedCustomerReviewWhereForVendor(vendorId),

        include: {

          user: true,

        },

        orderBy: { createdAt: 'desc' },

        take: 5,

      }),

      prisma.booking.findMany({

        where: vendorOperationalBookingWhere({ vendorId }),

        select: {
          userId: true,
          clientName: true,
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },

      }),

      prisma.review.findMany({

        where: approvedCustomerReviewWhereForVendor(vendorId),

        select: { rating: true },

      }),

      // Calculate earnings only from COMPLETED bookings
      prisma.booking.findMany({

        where: vendorOperationalBookingWhere({ 

          vendorId,

          status: 'COMPLETED'

        }),

        select: { amount: true },

      }),

    ]);

    console.log("[vendor/dashboard] Vendor found:", vendor ? "YES" : "NO");



    if (!vendor) {

      return NextResponse.json(

        { error: "Vendor not found" },

        { status: 404 }

      );

    }



    // 3) Calculate stats

    const statsData = statsAgg[0];

    const totalBookings = statsData?._count._all ?? 0;

    // Calculate earnings only from COMPLETED bookings
    const totalEarnings = completedBookings.reduce(
      (sum, b) => sum + Number(b.amount ?? 0),
      0
    );

    const totalClients = new Set(
      allBookings
        .map((booking) =>
          resolveOperationalClientKey({
            userId: booking.userId,
            clientName: booking.clientName,
            userName: booking.user?.name,
            email: booking.user?.email,
            phone: booking.user?.phone,
          })
        )
        .filter(Boolean)
    ).size;

    const ratings = allReviews.map((r) => r.rating).filter((r) => r > 0);

    const rating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;



    // 4) Map bookings to VendorJob format

    const recentJobs = recentBookings.map((booking) => {

      // Map Prisma status to expected format

      const statusMap: Record<string, 'completed' | 'in progress' | 'scheduled' | 'rejected'> = {

        COMPLETED: 'completed',

        CONFIRMED: 'in progress',

        PENDING: 'scheduled',

        CANCELED: 'scheduled', // Treat canceled as scheduled for display
        REJECTED: 'rejected',

      };

      const mappedStatus = statusMap[booking.status] || 'scheduled';



      return {

        id: booking.id,

        title: booking.title || booking.service?.name || 'Untitled Job',

        client: resolveOperationalClientLabel({
          clientName: booking.clientName,
          userName: booking.user?.name,
        }),

        amount: booking.amount ?? 0,

        status: mappedStatus,

        date: booking.date?.toISOString() || booking.scheduledFor?.toISOString() || booking.createdAt.toISOString(),

      };

    });



    // 5) Map reviews to VendorReview format

    const recentReviewsMapped = recentReviews.map((review) => ({

      id: review.id,

      client: resolveOperationalClientLabel({
        clientName: review.clientName,
        userName: review.user?.name,
      }),

      rating: review.rating,

      comment: review.comment || '',

      date: review.date?.toISOString() || review.createdAt.toISOString(),

      jobType: review.jobType || 'Service',

    }));



    // 6) Build response

    console.log("[vendor/dashboard] Building response...");

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

        totalEarnings,

        totalClients,

        rating: Math.round(rating * 10) / 10, // Round to 1 decimal place

      },

      recentJobs,

      recentReviews: recentReviewsMapped,

      insights: [],

      notifications: [],

    };

    console.log("[vendor/dashboard] Response built successfully");

    return NextResponse.json(response);

  } catch (err) {

    console.error("Vendor dashboard error:", err);

    console.error("Error details:", err instanceof Error ? err.message : String(err));

    console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");

    return NextResponse.json(

      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },

      { status: 500 }

    );

  }

}
