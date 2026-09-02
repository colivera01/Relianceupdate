import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { mapBookingToContract } from "@/lib/booking-shape";
import {
  claimCustomerBooking,
  CustomerBookingClaimError,
} from "@/lib/customer-booking-claim-service";

/**
 * POST /api/bookings/claim
 * Allows a signed-in customer to claim a vendor-created booking created before account linkage.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: user context is required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const bookingId = String(body?.bookingId || "").trim();
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "bookingId is required" },
        { status: 400 }
      );
    }

    const result = await claimCustomerBooking({
      prisma,
      bookingId,
      customerUserId: userId,
      claimToken: String(body?.claimToken || "").trim(),
    });
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
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
          service: {
            select: { id: true, name: true, description: true, price: true },
          },
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
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: mapBookingToContract(booking as any),
      claimed: result.claimed,
      grantRebound: result.grantRebound,
      alreadyConnected: result.alreadyConnected,
      message: result.alreadyConnected
        ? "Booking already belongs to this account."
        : "Booking claimed successfully. You can now access agreements and approved service videos.",
    });
  } catch (error: any) {
    if (error instanceof CustomerBookingClaimError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[bookings/claim] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to claim booking",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

