import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  markCustomerBookingClaimed,
  parseCustomerBookingClaimMetadata,
  validateCustomerBookingClaim,
} from "@/lib/customer-booking-claim";

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

    const [booking, account] = await Promise.all([
      prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          userId: true,
          customerMetadata: true,
          user: { select: { email: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      }),
    ]);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Service record not found" },
        { status: 404 }
      );
    }
    if (!account?.email) {
      return NextResponse.json(
        { success: false, error: "Your customer account has no verified email context." },
        { status: 409 }
      );
    }
    if (String(booking.userId) === String(userId)) {
      return NextResponse.json({
        success: true,
        claimed: false,
        alreadyConnected: true,
        bookingId,
      });
    }

    const metadata = parseCustomerBookingClaimMetadata(
      booking.customerMetadata
    );
    const validation = validateCustomerBookingClaim({
      metadata,
      bookingUserEmail: booking.user?.email,
      accountEmail: account.email,
      claimToken,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          code: validation.code,
        },
        {
          status:
            validation.code === "BOOKING_ALREADY_CLAIMED" ? 409 : 403,
        }
      );
    }

    const updated = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        userId: booking.userId,
      },
      data: {
        userId,
        customerMetadata: JSON.stringify(
          markCustomerBookingClaimed(metadata, userId)
        ),
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "This service record changed while it was being connected. Refresh and try again.",
          code: "BOOKING_CLAIM_CONFLICT",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      claimed: true,
      alreadyConnected: false,
      bookingId,
    });
  } catch (error) {
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
