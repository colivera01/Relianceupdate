import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
  isVendorAccountRestricted,
} from "@/lib/account-status";
import { getEmployeeRuntimeErrorResponse } from "@/lib/employee-runtime-errors";
import { parseAssignmentMetadata, parseRecordingComplianceMetadata } from "@/lib/job-assignment";
import { resolveEmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { resolveBookingCustomer } from "@/lib/booking-customer";
import { loadRecordingPermissionGate } from "@/lib/consent/recording-gate";
import {
  EMPLOYEE_DECISION_PURPOSES,
  loadEmployeeDecisionContext,
} from "@/lib/employee-decision-verification";
import {
  buildEmployeeV2ServiceOrderView,
} from "@/lib/recording/employee-v2-service-order";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "@/lib/recording/assessment-v2";

type StageKey = "INTRO" | "IN_PROGRESS" | "COMPLETED";

function hasEmployeeServiceOrderCredential(request: Request): boolean {
  if (request.headers.get("x-employee-capture-token")?.trim()) return true;
  if ((request.headers.get("authorization") || "").toLowerCase().startsWith("employee-capture ")) {
    return true;
  }
  try {
    const url = new URL(request.url);
    return Boolean(url.searchParams.get("captureToken")?.trim() || url.searchParams.get("ct")?.trim());
  } catch {
    return false;
  }
}

function emptyStageProgress() {
  return {
    INTRO: false,
    IN_PROGRESS: false,
    COMPLETED: false,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const userId = await getUserIdFromRequest(request);
    const serviceOrderTokenPresented = hasEmployeeServiceOrderCredential(request);
    const tokenAccess = await resolveEmployeeCaptureAccess(request);
    if (serviceOrderTokenPresented && !tokenAccess) {
      return NextResponse.json(
        {
          success: false,
          code: "EMPLOYEE_SERVICE_ORDER_LINK_INVALID",
          error: "This Service Order link is expired or no longer current. Ask the Vendor Manager for the current link.",
        },
        { status: 401 },
      );
    }
    if (!userId && !tokenAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (userId && !tokenAccess) {
      await ensureUserAccountCanAct(userId);
    }

    const memberships = tokenAccess
      ? await prisma.vendorMembership.findMany({
          where: { id: tokenAccess.membershipId },
          select: { id: true, vendorId: true, vendor: { select: { name: true, businessName: true, accountStatus: true } } },
        })
      : await prisma.vendorMembership.findMany({
          where: { userId: userId!, status: "ACTIVE", role: "EMPLOYEE" },
          select: { id: true, vendorId: true, vendor: { select: { name: true, businessName: true, accountStatus: true } } },
        });
    const activeVendorMemberships = memberships.filter((m) => !isVendorAccountRestricted((m.vendor as any)?.accountStatus));
    if (activeVendorMemberships.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "EMPLOYEE_MEMBERSHIP_REQUIRED",
          error: "An active employee membership is required to open assigned jobs.",
        },
        { status: 403 },
      );
    }

    const byVendor = new Map<string, string[]>();
    for (const m of activeVendorMemberships) {
      byVendor.set(m.vendorId, [...(byVendor.get(m.vendorId) || []), m.id]);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId: { in: Array.from(byVendor.keys()) },
        ...(tokenAccess ? { id: tokenAccess.bookingId } : {}),
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "AWAITING_REVIEW", "REJECTED", "COMPLETED"] },
      },
      include: {
        service: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        vendor: { select: { id: true, name: true, businessName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const assignedBookings = bookings.filter((booking) => {
      const assigned = parseAssignmentMetadata(booking.customerMetadata);
      const allowedMembershipIds = byVendor.get(booking.vendorId) || [];
      return assigned.assignedMembershipIds.some((id) => allowedMembershipIds.includes(id));
    });
    // Assigned work remains visible even while recording is blocked. The
    // canonical gate below explains who must act and how the block is resolved.
    const bookingIds = assignedBookings.map((b) => b.id);

    const sessions = bookingIds.length
      ? await (prisma as any).mediaSession.findMany({
          where: { bookingId: { in: bookingIds } },
          select: {
            id: true,
            bookingId: true,
            vendorJobVideoStage: true,
            mediaAssets: {
              where: { deletedAt: null, archiveStatus: "active" },
              select: { id: true },
              take: 1,
            },
          },
        })
      : [];

    const stageByBooking = new Map<string, Record<StageKey, boolean>>();
    for (const booking of assignedBookings) {
      stageByBooking.set(booking.id, emptyStageProgress());
    }
    for (const row of sessions) {
      const bookingId = String(row.bookingId || "");
      const stage = String(row.vendorJobVideoStage || "").trim().toUpperCase() as StageKey;
      if (!bookingId || !stageByBooking.has(bookingId)) continue;
      if (!["INTRO", "IN_PROGRESS", "COMPLETED"].includes(stage)) continue;
      if (!Array.isArray(row.mediaAssets) || row.mediaAssets.length === 0) continue;
      stageByBooking.set(bookingId, {
        ...stageByBooking.get(bookingId)!,
        [stage]: true,
      });
    }

    const jobs = await Promise.all(assignedBookings.map(async (booking) => {
      const stageProgress = stageByBooking.get(booking.id) || emptyStageProgress();
      const recordingCompliance = parseRecordingComplianceMetadata(booking.customerMetadata);
      const allowedMembershipIds = byVendor.get(booking.vendorId) || [];
      const assigned = parseAssignmentMetadata(booking.customerMetadata);
      const membershipId = assigned.assignedMembershipIds.find((id) => allowedMembershipIds.includes(id)) || null;
      const permissionGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId: booking.vendorId,
        customerMetadata: booking.customerMetadata,
        membershipId,
        surface: "employee_jobs",
        capability: "record",
        actorKind: "EMPLOYEE",
      });
      const isV2 =
        permissionGate.assessmentContractVersion ===
        RECORDING_ASSESSMENT_V2_CONTRACT_VERSION;
      // V2 is accountless-Service-Order only. It must not appear in the
      // signed-in legacy employee work list.
      if (isV2 && !tokenAccess) return null;
      let v2ServiceOrder = null;
      if (isV2 && tokenAccess && membershipId && permissionGate.employeeParticipation) {
        const assessment = await prisma.recordingScopeAssessment.findUnique({
          where: { id: permissionGate.assessmentId! },
        });
        const decisionContext = await loadEmployeeDecisionContext({
          db: prisma as any,
          purpose: EMPLOYEE_DECISION_PURPOSES.RECORDING,
          userId: tokenAccess.userId,
          membershipId,
          bookingId: booking.id,
        });
        v2ServiceOrder = buildEmployeeV2ServiceOrderView({
          assessment,
          decisionContext,
          participation: permissionGate.employeeParticipation,
          membershipId,
          serviceLocation: recordingCompliance.addressSnapshot?.formattedAddress || null,
          serviceOrderCurrent: decisionContext.serviceOrderCurrent === true,
          blockCode: permissionGate.blockCode,
        });
      }
      const stageRecordingAccess = Object.fromEntries(
        await Promise.all(
          (["INTRO", "IN_PROGRESS", "COMPLETED"] as StageKey[]).map(async (stage) => {
            const stageGate = permissionGate.correctionRequestedStages.length
              ? await loadRecordingPermissionGate({
                  bookingId: booking.id,
                  vendorId: booking.vendorId,
                  customerMetadata: booking.customerMetadata,
                  membershipId,
                  surface: "employee_jobs",
                  capability: "record",
                  actorKind: "EMPLOYEE",
                  recordingStage: stage,
                })
              : permissionGate;
            return [
              stage,
              {
                recordingUnlocked: stageGate.recordingUnlocked,
                canonicalBlock: stageGate.block,
              },
            ];
          }),
        ),
      ) as Record<StageKey, { recordingUnlocked: boolean; canonicalBlock: typeof permissionGate.block }>;
      const normalizedStatus = String(booking.status || "").trim().toUpperCase();
      const correctionRequested = permissionGate.correctionRequestedStages.length > 0;
      const canMarkComplete =
        stageProgress.INTRO &&
        stageProgress.IN_PROGRESS &&
        stageProgress.COMPLETED &&
        (normalizedStatus === "PENDING" ||
          normalizedStatus === "CONFIRMED" ||
          normalizedStatus === "IN_PROGRESS" ||
          (normalizedStatus === "REJECTED" && correctionRequested));
      const customer = resolveBookingCustomer(booking);
      return {
        id: booking.id,
        membershipId,
        vendorId: booking.vendorId,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || "Vendor",
        title: booking.title || booking.service?.name || "Assigned Job",
        status: booking.status,
        service: booking.service || null,
        customer: isV2 ? { ...customer, email: null } : customer,
        bookingDate: booking.scheduledFor || booking.date || null,
        rejectionReason: (booking as any).rejectionReason || null,
        rejectedAt: (booking as any).rejectedAt || null,
        recordingCompliance: {
          location: permissionGate.location,
          locationVerified: recordingCompliance.locationVerified,
          locationVerifiedAt: recordingCompliance.locationVerifiedAt,
          serviceOrderReleasedAt: recordingCompliance.serviceOrderReleasedAt,
          releasedMembershipIds: recordingCompliance.releasedMembershipIds,
          permissionRequired: permissionGate.permissionRequired,
          permissionStatus: permissionGate.permissionState,
          recordingUnlocked: permissionGate.recordingUnlocked,
          audioAllowed: permissionGate.audioAllowed,
          recipientNeedsCorrection: permissionGate.recipientNeedsCorrection,
          assessmentId: permissionGate.assessmentId,
          riskLevel: permissionGate.riskLevel,
          certificationActive: permissionGate.certificationActive,
          scopeSummary: permissionGate.scopeSummary,
          serviceLocation: recordingCompliance.addressSnapshot?.formattedAddress || null,
          serviceLocationType: recordingCompliance.addressSnapshot?.type || permissionGate.location,
          canonicalBlock: permissionGate.block,
          correctionRequestedStages: permissionGate.correctionRequestedStages,
          stageRecordingAccess,
          employeeParticipation: permissionGate.employeeParticipation || null,
          v2ServiceOrder,
        },
        stageProgress,
        canMarkComplete,
      };
    }));

    return NextResponse.json({
      jobs: jobs.filter(Boolean),
      membership: activeVendorMemberships[0],
      placeholderData: false,
    });
  } catch (error: any) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    const runtimeError = getEmployeeRuntimeErrorResponse("jobs", error);
    return NextResponse.json(runtimeError.body, { status: runtimeError.status });
  }
}
