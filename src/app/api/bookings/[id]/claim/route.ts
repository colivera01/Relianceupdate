import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  claimCustomerBooking,
  CustomerBookingClaimError,
} from "@/lib/customer-booking-claim-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: bookingId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const claimToken = String(body?.claimToken || "").trim();

    const result = await claimCustomerBooking({
      prisma,
      bookingId,
      customerUserId: userId,
      claimToken,
    });

    return NextResponse.json({
      success: true,
      claimed: result.claimed,
      grantRebound: result.grantRebound,
      alreadyConnected: result.alreadyConnected,
      bookingId,
    });
  } catch (error) {
    if (error instanceof CustomerBookingClaimError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[bookings/:id/claim] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to connect this service record right now.",
      },
      { status: 500 }
    );
  }
}
