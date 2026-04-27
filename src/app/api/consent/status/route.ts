import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";

function mapConsentStatus(record: any): "pending" | "accepted" | "declined" | "expired" | "not_requested" {
  if (!record) return "not_requested";
  const now = new Date();
  const raw = String(record.status || "").trim().toUpperCase();
  if (raw === "ACCEPTED") return "accepted";
  if (raw === "DECLINED") return "declined";
  if (raw === "EXPIRED") return "expired";
  if (raw === "REQUESTED" || raw === "PENDING") {
    if (record.expiresAt && new Date(record.expiresAt) < now) return "expired";
    return "pending";
  }
  return "not_requested";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const bookingId = String(request.nextUrl.searchParams.get("bookingId") || "").trim();
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "bookingId is required" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, vendorId: true, userId: true },
    });
    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    const isBookingOwner = String(booking.userId || "") === String(userId);
    const hasActiveVendorMembership = await prisma.vendorMembership.findFirst({
      where: {
        vendorId: String(booking.vendorId || ""),
        userId: String(userId),
        status: { in: ["ACTIVE", "active"] },
      },
      select: { id: true },
    });
    if (!isBookingOwner && !hasActiveVendorMembership) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const latest = await (prisma as any).consentRecord.findFirst({
      where: { bookingId },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        token: true,
        status: true,
        acceptedAt: true,
        declinedAt: true,
        requestedAt: true,
        expiresAt: true,
      },
    });

    const status = mapConsentStatus(latest);
    return NextResponse.json({
      success: true,
      status,
      acceptedAt: latest?.acceptedAt || null,
      declinedAt: latest?.declinedAt || null,
      latestConsentToken: latest?.token || null,
      latestConsentId: latest?.id || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch consent status", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
