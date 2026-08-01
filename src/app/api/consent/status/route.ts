import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { requireVendorManager } from "@/lib/membership-auth";

function mapConsentStatus(record: any): string {
  if (!record) return "not_requested";
  const lifecycle = String(record.lifecycleStatus || "").trim().toLowerCase();
  if (lifecycle) return lifecycle;
  const raw = String(record.status || "").trim().toUpperCase();
  if (raw === "ACCEPTED") return "accepted";
  if (raw === "DECLINED") return "declined";
  if (raw === "EXPIRED") return "expired";
  if (raw === "REQUESTED" || raw === "PENDING") {
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) return "expired";
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
    if (!isBookingOwner) {
      try {
        await requireVendorManager(request, String(booking.vendorId || ""));
      } catch {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const latest = await (prisma as any).consentRecord.findFirst({
      where: { bookingId },
      orderBy: { requestedAt: "desc" },
      select: {
        id: true,
        status: true,
        lifecycleStatus: true,
        verifiedDecision: true,
        recipientEmailMasked: true,
        recipientPhoneMasked: true,
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
      latestConsentId: latest?.id || null,
      verifiedDecision: latest?.verifiedDecision === true,
      recordingUnlocked:
        latest?.verifiedDecision === true &&
        String(latest?.lifecycleStatus || "").toUpperCase() === "ALLOWED",
      recipient: latest
        ? { email: latest.recipientEmailMasked || null, phone: latest.recipientPhoneMasked || null }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch consent status", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
