import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { requireVendorManager } from "@/lib/membership-auth";
import { resolveRecordingPermissionGate } from "@/lib/consent/recording-gate";

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
      select: { id: true, vendorId: true, userId: true, customerMetadata: true },
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

    const [latest, assessment] = await Promise.all([
      (prisma as any).consentRecord.findFirst({
        where: { bookingId, isCurrent: true },
        orderBy: [{ generation: "desc" }, { requestedAt: "desc" }],
        select: {
          id: true,
          status: true,
          lifecycleStatus: true,
          verifiedDecision: true,
          isCurrent: true,
          scopeJson: true,
          scopeHash: true,
          recipientMismatch: true,
          recipientEmailMasked: true,
          recipientPhoneMasked: true,
          acceptedAt: true,
          declinedAt: true,
          requestedAt: true,
          expiresAt: true,
          decisionEvidence: {
            select: {
              id: true,
              claimedRole: true,
              authorityScope: true,
              verificationMethod: true,
              verifiedContactHash: true,
              scopeHash: true,
              metadata: true,
            },
          },
        },
      }),
      (prisma as any).recordingScopeAssessment.findFirst({
        where: {
          bookingId,
          vendorId: booking.vendorId,
          isCurrent: true,
          status: "COMPLETE",
        },
        orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
        select: {
          id: true,
          generation: true,
          authorityHolderType: true,
          locationType: true,
          permissionRequired: true,
          scopeHash: true,
        },
      }),
    ]);

    const permissionGate = resolveRecordingPermissionGate({
      customerMetadata: booking.customerMetadata,
      consentRecord: latest,
      assessment,
    });
    return NextResponse.json({
      success: true,
      status: permissionGate.permissionState,
      acceptedAt: latest?.acceptedAt || null,
      declinedAt: latest?.declinedAt || null,
      latestConsentId: latest?.id || null,
      verifiedDecision: permissionGate.verifiedAllowed,
      permissionRequired: permissionGate.permissionRequired,
      recordingUnlocked: permissionGate.recordingUnlocked,
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
