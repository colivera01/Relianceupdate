import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorMembership } from "@/lib/membership-auth";
import { mapMediaSessionCreateFailure } from "@/lib/media-session-create-errors";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { normalizeVendorJobVideoStage } from "@/lib/vendor-job-video-stages";
import {
  parseRecordingLocationProof,
  recordJobRecordingLocationAttempt,
  verifyJobRecordingLocation,
} from "@/lib/job-recording-location";
import { loadRecordingPermissionGate, recordingGateErrorBody } from "@/lib/consent/recording-gate";
import { persistAllowedRecordingGateDecision } from "@/lib/service-video-evidence";

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

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

function getAssignedMembershipIdsFromMetadata(metadata: string | null | undefined): string[] {
  const parsed = parseCustomerMetadata(metadata);
  const raw = parsed.vendor_job_assigned_membership_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id || "").trim()).filter(Boolean);
}

type VendorBusinessLocation = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: Date | null;
};

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
      vendorJobVideoStage,
      replaceExisting,
    } = body;
    const tokenAccess = await resolveEmployeeCaptureAccess(request, {
      vendorId,
      bookingId: bookingId ? String(bookingId) : null,
    });
    const membership = tokenAccess || (await requireVendorMembership(request, vendorId));
    const userId = membership.userId;

    // Keep booking linkage optional and backward-compatible with UI-local job IDs.
    // If bookingId is provided but not found for this vendor, ignore it instead of failing FK constraints.
    let validBookingId: string | null = null;
    let validBookingMetadata: string | null = null;
    let validBookingVendorLocation: VendorBusinessLocation | null = null;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: {
          id: String(bookingId),
          vendorId,
        },
        select: {
          id: true,
          customerMetadata: true,
          vendor: {
            select: {
              address: true,
              city: true,
              state: true,
              zipCode: true,
              latitude: true,
              longitude: true,
              geocodedAt: true,
            },
          },
        },
      });
      validBookingId = booking?.id ?? null;
      validBookingMetadata = booking?.customerMetadata ?? null;
      validBookingVendorLocation = booking?.vendor ?? null;
    }

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, code: "INVALID_SESSION_STATUS", message: "Invalid status value for media session." },
        { status: 422 }
      );
    }

    const resolvedSessionType = String(sessionType || "SERVICE_RECORD").trim() || "SERVICE_RECORD";
    const normalizedStage = normalizeVendorJobVideoStage(vendorJobVideoStage);
    const wantsStagedJobVideo =
      normalizedStage != null ||
      resolvedSessionType.toUpperCase() === "JOB_SERVICE_VIDEO";
    let stagedPermissionGate: Awaited<ReturnType<typeof loadRecordingPermissionGate>> | null = null;
    let stagedMembershipId: string | null = null;
    let stagedActorKind: string | null = null;

    if (wantsStagedJobVideo) {
      if (!normalizedStage) {
        return NextResponse.json(
          {
            success: false,
            code: "VENDOR_JOB_VIDEO_STAGE_REQUIRED",
            message: "Video stage is required (Starting Condition, Work in Progress, or Final Result).",
          },
          { status: 422 }
        );
      }
      if (!validBookingId) {
        return NextResponse.json(
          {
            success: false,
            code: "VENDOR_JOB_VIDEO_BOOKING_REQUIRED",
            message:
              "A valid job/booking is required for staged service videos. Ensure bookingId matches a booking that belongs to this vendor.",
          },
          { status: 422 }
        );
      }
      const assignedMembershipIds = getAssignedMembershipIdsFromMetadata(validBookingMetadata);
      if (tokenAccess && !assignedMembershipIds.includes(tokenAccess.membershipId)) {
        return NextResponse.json(
          {
            success: false,
            code: "JOB_CAPTURE_TOKEN_FORBIDDEN",
            message: "This capture link is not authorized for this assigned job.",
          },
          { status: 403 }
        );
      }

      const membershipId = tokenAccess?.membershipId || membership.membershipId;
      const actorKind = tokenAccess
        ? "EMPLOYEE_LINK"
        : String((membership as any).role || "VENDOR_MEMBER");
      let permissionGate = await loadRecordingPermissionGate({
        bookingId: validBookingId,
        vendorId,
        customerMetadata: validBookingMetadata,
        membershipId,
        surface: "media_session",
        capability: "record",
        actorKind,
        recordingStage: normalizedStage,
      });
      if (permissionGate.blockCode === "LOCATION_VERIFICATION_REQUIRED") {
        const canonicalLocation = permissionGate.location!;
        const proof = parseRecordingLocationProof(body);
        const verification = await verifyJobRecordingLocation({
          vendorId,
          metadata: validBookingMetadata,
          vendorLocation: validBookingVendorLocation,
          proof,
          location: canonicalLocation,
        });
        if (permissionGate.assessmentId) {
          await recordJobRecordingLocationAttempt({
            bookingId: validBookingId,
            vendorId,
            membershipId,
            assessmentId: permissionGate.assessmentId,
            actorUserId: userId || null,
            proof,
            result: verification,
          });
        }
        if (!verification.ok) {
          return NextResponse.json(
            {
              success: false,
              code: verification.code,
              message: verification.message,
              why: verification.message,
              responsibleParticipant: "EMPLOYEE",
              resolution: "Allow precise location at the saved service address and try again, or ask the manager to request an admin-reviewed exception.",
              serviceMayContinue: true,
              details: verification.details,
            },
            { status: verification.status }
          );
        }
        permissionGate = await loadRecordingPermissionGate({
          bookingId: validBookingId,
          vendorId,
          customerMetadata: validBookingMetadata,
          membershipId,
          surface: "media_session",
          capability: "record",
          actorKind,
          recordingStage: normalizedStage,
        });
      }
      if (permissionGate.blockCode) {
        return NextResponse.json(
          { success: false, ...recordingGateErrorBody(permissionGate) },
          { status: 409 },
        );
      }
      stagedPermissionGate = permissionGate;
      stagedMembershipId = membershipId;
      stagedActorKind = actorKind;

      const conflicting = await (prisma as any).mediaSession.findFirst({
        where: {
          vendorId,
          bookingId: validBookingId,
          vendorJobVideoStage: normalizedStage,
          status: { notIn: ["FAILED", "CANCELLED", "ARCHIVED"] },
        },
        select: { id: true },
      });

      if (conflicting?.id) {
        const allowReplace = Boolean(replaceExisting);
        if (!allowReplace) {
          if (process.env.NODE_ENV !== "production") {
            console.info("[media/sessions][POST] conflict:reusing_existing", {
              reason: "same_booking_same_stage_active_session_exists",
              vendorId,
              bookingId: validBookingId,
              stage: normalizedStage,
              existingSessionId: String(conflicting.id),
            });
          }
          const existingSession = await (prisma as any).mediaSession.findUnique({
            where: { id: String(conflicting.id) },
          });
          return NextResponse.json({
            session: existingSession,
            reused: true,
            reason: "JOB_VIDEO_STAGE_OCCUPIED_REUSED",
            existingSessionId: String(conflicting.id),
          });
        }
      }
    }

    const createSessionData = {
      vendorId,
      userId: userId || null,
      employeeId: employeeId || null,
      bookingId: validBookingId,
      serviceId: serviceId || null,
      deviceId: deviceId || null,
      deviceType: deviceType || null,
      sessionType: normalizedStage ? "JOB_SERVICE_VIDEO" : resolvedSessionType,
      vendorJobVideoStage: normalizedStage,
      status: status || "CREATED",
      title: title || null,
      description: description || null,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      capturedByMembershipId: stagedMembershipId,
    };

    const useEvidenceTransaction =
      Boolean(wantsStagedJobVideo && normalizedStage && validBookingId && stagedPermissionGate && stagedMembershipId);

    if (process.env.NODE_ENV !== "production") {
      console.info("[media/sessions][POST] trace:before_create", {
        vendorId,
        userId: userId || null,
        membershipUserId: userId || null,
        bookingIdRaw: bookingId ?? null,
        validBookingId,
        vendorJobVideoStage: normalizedStage,
        sessionTypeFromBody: sessionType ?? null,
        resolvedSessionType: createSessionData.sessionType,
        wantsStagedJobVideo,
        replaceExisting: Boolean(replaceExisting),
        createPath: useEvidenceTransaction ? "transaction_with_gate_evidence" : "direct_create",
        titleLength: createSessionData.title ? String(createSessionData.title).length : 0,
        descriptionLength: createSessionData.description ? String(createSessionData.description).length : 0,
        status: createSessionData.status,
      });
    }

    let session: any;
    try {
      if (useEvidenceTransaction) {
        session = await prisma.$transaction(async (tx: any) => {
          const gateEvidence = await persistAllowedRecordingGateDecision({
            bookingId: validBookingId!,
            vendorId,
            membershipId: stagedMembershipId!,
            actorKind: stagedActorKind || "VENDOR_MEMBER",
            surface: "media_session",
            gate: stagedPermissionGate!,
            tx,
          });
          return tx.mediaSession.create({
            data: { ...createSessionData, recordingGateDecisionId: gateEvidence.id },
          });
        });
      } else {
        session = await (prisma as any).mediaSession.create({
          data: createSessionData,
        });
      }
    } catch (createError: unknown) {
      const mapped = mapMediaSessionCreateFailure(createError);
      if (process.env.NODE_ENV !== "production") {
        console.error("[media/sessions][POST] trace:create_threw", {
          httpStatus: mapped.status,
          code: mapped.body.code,
          message: mapped.body.message,
          prismaMessage: String((createError as any)?.message ?? createError),
          prismaCode: (createError as any)?.code ?? null,
          prismaName: (createError as any)?.name ?? null,
        });
      }
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    return NextResponse.json({ session });
  } catch (error: any) {
    console.error("[media/sessions] POST error:", error);
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { success: false, code: "UNAUTHORIZED", message: error.message },
        { status: 403 }
      );
    }
    const mapped = mapMediaSessionCreateFailure(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
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
