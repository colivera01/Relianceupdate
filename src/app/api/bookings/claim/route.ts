import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { mapBookingToContract } from "@/lib/booking-shape";

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

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

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

    const [claimUser, booking] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      }),
      prisma.booking.findUnique({
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
      }),
    ]);

    if (!claimUser) {
      return NextResponse.json(
        { success: false, error: "Claim user not found" },
        { status: 404 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    if (String(booking.userId) === String(userId)) {
      return NextResponse.json({
        success: true,
        booking: mapBookingToContract(booking as any),
        message: "Booking already belongs to this account.",
      });
    }

    const metadata = parseCustomerMetadata(booking.customerMetadata);
    const contactEmail = normalizeEmail(
      String(metadata.client_email || metadata.claim_contact_email || "")
    );
    const userEmail = normalizeEmail(claimUser.email);

    if (!contactEmail) {
      return NextResponse.json(
        {
          success: false,
          code: "BOOKING_NOT_CLAIMABLE",
          error: "This booking cannot be claimed because no customer contact email was stored.",
        },
        { status: 409 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          code: "CLAIM_USER_EMAIL_REQUIRED",
          error: "Add an email to your account before claiming this booking.",
        },
        { status: 409 }
      );
    }

    if (contactEmail !== userEmail) {
      return NextResponse.json(
        {
          success: false,
          code: "CLAIM_EMAIL_MISMATCH",
          error: "This booking was created for a different customer email.",
        },
        { status: 403 }
      );
    }

    const updatedMetadata: Record<string, unknown> = {
      ...metadata,
      claim_status: "CLAIMED",
      claimed_at: new Date().toISOString(),
      claimed_user_id: userId,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const claimedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          userId,
          customerMetadata: JSON.stringify(updatedMetadata),
        },
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
      await (tx as any).privateProofAccessGrant.updateMany({
        where: { bookingId: booking.id, customerUserId: booking.userId, status: "ACTIVE" },
        data: { customerUserId: userId },
      });
      return claimedBooking;
    });

    return NextResponse.json({
      success: true,
      booking: mapBookingToContract(updated as any),
      message: "Booking claimed successfully. You can now access agreements and approved service videos.",
    });
  } catch (error: any) {
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

