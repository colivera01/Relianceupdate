import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

const ALLOWED_STATUSES = new Set([
  "CREATED",
  "RECORDING",
  "UPLOADING",
  "COMPLETED",
  "APPROVED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
]);

/**
 * POST /api/vendors/[vendorId]/media/sessions
 * Create a media session scoped to vendor and current user context.
 */
export async function POST(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    const { userId } = await requireVendorMembership(request, vendorId);

    const body = await request.json().catch(() => ({}));
    const {
      bookingId,
      serviceId,
      employeeId,
      deviceId,
      deviceType,
      sessionType,
      title,
      description,
      status,
      startedAt,
    } = body;

    // Keep booking linkage optional and backward-compatible with UI-local job IDs.
    // If bookingId is provided but not found for this vendor, ignore it instead of failing FK constraints.
    let validBookingId: string | null = null;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: {
          id: String(bookingId),
          vendorId,
        },
        select: { id: true },
      });
      validBookingId = booking?.id ?? null;
    }

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 422 });
    }

    const session = await (prisma as any).mediaSession.create({
      data: {
        vendorId,
        userId: userId || null,
        employeeId: employeeId || null,
        bookingId: validBookingId,
        serviceId: serviceId || null,
        deviceId: deviceId || null,
        deviceType: deviceType || null,
        sessionType: sessionType || "SERVICE_RECORD",
        status: status || "CREATED",
        title: title || null,
        description: description || null,
        startedAt: startedAt ? new Date(startedAt) : undefined,
      },
    });

    return NextResponse.json({ session });
  } catch (error: any) {
    console.error("[media/sessions] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create media session", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vendors/[vendorId]/media/sessions
 * List media sessions with optional filters.
 */
export async function GET(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { vendorId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const sessionType = searchParams.get("sessionType");
    const deviceId = searchParams.get("deviceId");
    const bookingId = searchParams.get("bookingId");

    const where: any = { vendorId };
    if (status) where.status = status;
    if (sessionType) where.sessionType = sessionType;
    if (deviceId) where.deviceId = deviceId;
    if (bookingId) where.bookingId = bookingId;

    const sessions = await (prisma as any).mediaSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { mediaAssets: true },
        },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s: any) => ({
        ...s,
        mediaAssetCount: s._count?.mediaAssets ?? 0,
      })),
    });
  } catch (error: any) {
    console.error("[media/sessions] GET error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to list media sessions", details: error.message },
      { status: 500 }
    );
  }
}

