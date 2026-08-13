import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireVendorManager, requireVendorMembership } from "@/lib/membership-auth";
import {
  getRelianceOps,
  operationalPhaseForBookingStatusUpdate,
  resolveOperationalPhase,
  setOperationalPhaseOnMetadataJson,
} from "@/lib/vendor-job-operational-phase";
import { evaluateVendorJobPackageState } from "@/lib/vendor-job-package-state";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { countableMediaAssetWhere } from "@/lib/metrics-exclusion";
import { authorizationErrorResponse } from "@/lib/request-actor";
import { sendJobAssignmentNotification } from "@/lib/notifications/send-job-assignment";
import { sendVideoReadyNotification } from "@/lib/notifications/send-video-ready";
import { appendEmployeeCaptureToken, createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import {
  isUnclaimedBookingUserEmail,
  issueCustomerBookingClaimToken,
} from "@/lib/customer-booking-claim";
import {
  normalizeRecordingLocationChoice,
  parseRecordingComplianceMetadata,
} from "@/lib/job-assignment";
import {
  loadRecordingPermissionGate,
  type RecordingPermissionGate,
} from "@/lib/consent/recording-gate";
import { createVerifiedPermissionRequest } from "@/lib/consent/request-service";
import { deliverVerifiedPermissionRequest } from "@/lib/consent/delivery-service";
import {
  createRecordingScopeAssessment,
  deriveRecordingScopeAssessment,
  parseRecordingScopeAssessmentInput,
} from "@/lib/recording/scope-assessment";
import {
  CUSTOMER_RECORDING_NOTICE_KIND,
  dispatchQueuedRecordingNotice,
} from "@/lib/recording/recording-notice";

interface RouteParams {
  params: Promise<{ vendorId: string; jobId: string }>;
}

type JobAction =
  | "ARCHIVE_JOB"
  | "MOVE_CONTENT_TO_ARCHIVE"
  | "UNARCHIVE_JOB"
  | "UPDATE_JOB"
  | "ASSIGN_JOB"
  | "UPDATE_RECORDING_COMPLIANCE"
  | "RELEASE_EMPLOYEE_SERVICE_ORDER"
  | "RESEND_COMPLETED_WORK_ORDER"
  | "UPDATE_STATUS"
  | "APPROVE_JOB_COMPLETION";

type ResolvedAssignmentMember = {
  id: string;
  displayName: string;
  user: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function apiResponse(
  success: boolean,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return { success, code, message, ...(details ? { details } : {}) };
}

function normalizeBookingStatus(status: string | null | undefined): string {
  return String(status || "").trim().toUpperCase();
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

function stringifyCustomerMetadata(metadata: Record<string, unknown>) {
  return JSON.stringify(metadata);
}

function mergeRecordingComplianceMetadata(
  value: string | null | undefined,
  input: Record<string, unknown>,
  locationVerification?: Record<string, unknown>,
) {
  const metadata = parseCustomerMetadata(value);
  // Customer permission is derived from immutable server evidence. A manager
  // may configure location details here, but cannot assert a customer decision.
  delete metadata.vendor_job_consent_token;
  if (input.locationVerified !== undefined) {
    const verified = input.locationVerified === true;
    metadata.vendor_job_location_verified = verified;
    if (verified) {
      metadata.vendor_job_location_verified_at =
        String(input.locationVerifiedAt || "").trim() || new Date().toISOString();
    }
  }
  if (locationVerification && typeof locationVerification === "object") {
    metadata.vendor_job_location_verification = {
      ...locationVerification,
      recordedAt: new Date().toISOString(),
    };
  }
  return metadata;
}

function releaseFailureForCompliance(
  value: string | null | undefined,
  gate: RecordingPermissionGate
) {
  if (gate.block) {
    return {
      code: gate.block.code,
      message: `${gate.block.why} ${gate.block.resolution}`,
      blocked: gate.block,
    };
  }
  if (gate.location === "customer-business") {
    const metadata = parseCustomerMetadata(value);
    const latitude = Number(metadata.vendor_job_customer_business_latitude);
    const longitude = Number(metadata.vendor_job_customer_business_longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return {
        code: "CUSTOMER_BUSINESS_ADDRESS_REQUIRED",
        message: "The customer must provide and verify the business address before the employee service order can be sent.",
      };
    }
  }

  return null;
}

function toSafeRecordingCompliance(
  value: string | null | undefined,
  gate: RecordingPermissionGate
) {
  const compliance = parseRecordingComplianceMetadata(value);
  return {
    location: gate.location,
    consentAccepted: gate.verifiedAllowed,
    permissionRequired: gate.permissionRequired,
    permissionStatus: gate.permissionState,
    recordingUnlocked: gate.recordingUnlocked,
    assessmentId: gate.assessmentId,
    riskLevel: gate.riskLevel,
    certificationActive: gate.certificationActive,
    scopeSummary: gate.scopeSummary,
    canonicalBlock: gate.block,
    locationVerified: compliance.locationVerified,
    locationVerifiedAt: compliance.locationVerifiedAt,
    serviceOrderReleasedAt: compliance.serviceOrderReleasedAt,
    releasedMembershipIds: compliance.releasedMembershipIds,
    addressSnapshot: compliance.addressSnapshot,
  };
}

function displayNameForMembershipUser(
  user: { name: string | null; email: string | null } | null | undefined
) {
  if (!user) return "Team member";
  const name = String(user.name || "").trim();
  const email = String(user.email || "").trim();
  return name || email || "Team member";
}

function resolveJobLinkBaseUrl(request: Request): string {
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (appBaseUrl) return appBaseUrl;
  const origin = String(request.headers.get("origin") || "").trim().replace(/\/+$/, "");
  if (origin) return origin;
  try {
    return new URL(request.url).origin.replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

function toCustomerCompletedWorkUrl(
  request: Request,
  bookingId: string,
  claimToken?: string
): string {
  const params = new URLSearchParams({ videoReady: "1" });
  if (claimToken) {
    params.set("claimToken", claimToken);
  }
  return `${resolveJobLinkBaseUrl(request)}/my-bookings/${encodeURIComponent(
    bookingId
  )}?${params.toString()}`;
}

function usableCustomerEmail(value: unknown): string {
  const email = String(value || "").trim();
  return email && !email.toLowerCase().endsWith("@reliance.local") ? email : "";
}

async function resolveJobAssignmentForVendor(
  vendorId: string,
  assignedMembershipIds: unknown,
  assignedEmployees: unknown
): Promise<
  | { ok: true; membershipIds: string[]; displayNames: string[]; members: ResolvedAssignmentMember[] }
  | { ok: false; response: NextResponse }
> {
  const normalizedIds = Array.isArray(assignedMembershipIds)
    ? Array.from(
        new Set(assignedMembershipIds.map((id) => String(id || "").trim()).filter(Boolean))
      )
    : [];
  const normalizedNames = Array.isArray(assignedEmployees)
    ? assignedEmployees.map((n) => String(n || "").trim()).filter(Boolean)
    : [];

  if (normalizedIds.length > 0) {
    const rows = await prisma.vendorMembership.findMany({
      where: {
        vendorId,
        id: { in: normalizedIds },
        status: { in: ["ACTIVE", "active", "PENDING", "pending"] },
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    if (rows.length !== normalizedIds.length) {
      return {
        ok: false,
        response: NextResponse.json(
          apiResponse(
            false,
            "INVALID_MEMBERSHIP",
            "One or more selected team members are not eligible for this vendor."
          ),
          { status: 422 }
        ),
      };
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const displayNames = normalizedIds.map((id) => displayNameForMembershipUser(byId.get(id)?.user));
    const members = normalizedIds
      .map((id, index) => {
        const row = byId.get(id);
        if (!row) return null;
        return {
          id,
          displayName: displayNames[index] || displayNameForMembershipUser(row.user),
          user: row.user || null,
        };
      })
      .filter(Boolean) as ResolvedAssignmentMember[];
    return { ok: true, membershipIds: normalizedIds, displayNames, members };
  }

  if (normalizedNames.length === 0) {
    return { ok: true, membershipIds: [], displayNames: [], members: [] };
  }

  const activeMembers = await prisma.vendorMembership.findMany({
    where: { vendorId, status: { in: ["ACTIVE", "active", "PENDING", "pending"] } },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });

  const membershipIdsOut: string[] = [];
  const displayNamesOut: string[] = [];
  const membersOut: ResolvedAssignmentMember[] = [];

  for (const requestedName of normalizedNames) {
    const lower = requestedName.toLowerCase();
    const match = activeMembers.find((m) => {
      const n = String(m.user?.name || "").trim().toLowerCase();
      const e = String(m.user?.email || "").trim().toLowerCase();
      return n === lower || e === lower;
    });
    if (!match) {
      return {
        ok: false,
        response: NextResponse.json(
          apiResponse(false, "UNKNOWN_EMPLOYEE", `No active team member matches "${requestedName}".`, {
            requestedName,
          }),
          { status: 422 }
        ),
      };
    }
    if (!membershipIdsOut.includes(match.id)) {
      membershipIdsOut.push(match.id);
      const displayName = displayNameForMembershipUser(match.user);
      displayNamesOut.push(displayName);
      membersOut.push({ id: match.id, displayName, user: match.user || null });
    }
  }

  return { ok: true, membershipIds: membershipIdsOut, displayNames: displayNamesOut, members: membersOut };
}

function normalizeUiStatusToBookingStatus(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "archived") return "ARCHIVED";
  if (normalized === "completed") return "COMPLETED";
  if (normalized === "cancelled" || normalized === "canceled") return "CANCELED";
  if (normalized === "pending" || normalized === "scheduled") return "PENDING";
  if (normalized === "in progress" || normalized === "in-progress" || normalized === "in_progress") return "CONFIRMED";
  if (normalized === "confirmed") return "CONFIRMED";
  return null;
}

async function getLinkedMediaSummary(vendorId: string, bookingId: string) {
  const sessions = await (prisma as any).mediaSession.findMany({
    where: {
      vendorId,
      bookingId,
    },
    select: { id: true },
  });
  const sessionIds = sessions.map((s: any) => s.id);
  const linkedAssetCount = sessionIds.length
    ? await (prisma as any).mediaAsset.count({
        where: countableMediaAssetWhere({
          mediaSessionId: { in: sessionIds },
        }),
      })
    : 0;
  return {
    linkedSessionCount: sessionIds.length,
    linkedAssetCount,
    linkedSessionIds: sessionIds,
  };
}

async function getVendorJobPackageState(vendorId: string, bookingId: string) {
  const sessions = await (prisma as any).mediaSession.findMany({
    where: {
      vendorId,
      bookingId,
    },
    select: {
      id: true,
      sessionType: true,
      vendorJobVideoStage: true,
      mediaAssets: {
        where: { deletedAt: null },
        select: { id: true, moderationStatus: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return evaluateVendorJobPackageState(sessions);
}

export async function PATCH(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    const member = await requireVendorManager(request, vendorId);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase() as JobAction;

    const booking = await prisma.booking.findFirst({
      where: {
        id: jobId,
        vendorId,
      },
      select: {
        id: true,
        vendorId: true,
        status: true,
        customerMetadata: true,
        title: true,
        clientName: true,
        scheduledFor: true,
        date: true,
        service: { select: { id: true, name: true } },
        vendor: {
          select: {
            name: true,
            businessName: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
            geocodedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    if (action === "ARCHIVE_JOB") {
      if (normalizeBookingStatus(booking.status) === "ARCHIVED") {
        return NextResponse.json({
          success: true,
          action,
          job: { id: booking.id, status: "ARCHIVED" },
          message: "Job is already archived.",
        });
      }
      const statusUpper = normalizeBookingStatus(booking.status);
      if (statusUpper !== "COMPLETED") {
        return NextResponse.json(
          apiResponse(
            false,
            "ARCHIVE_REQUIRES_COMPLETED_JOB",
            "Archive is allowed only for completed jobs with completed admin approval.",
            { status: statusUpper || "UNKNOWN" }
          ),
          { status: 409 }
        );
      }
      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      if (packageState.hasStagedPackage && !packageState.hasAllRequiredStagesApproved) {
        return NextResponse.json(
          apiResponse(
            false,
            "ARCHIVE_REQUIRES_ADMIN_APPROVED_PACKAGE",
            "Archive is allowed only after all required staged videos are admin-approved.",
            {
              hasAllRequiredStages: packageState.hasAllRequiredStages,
              hasAllRequiredStagesApproved: packageState.hasAllRequiredStagesApproved,
            }
          ),
          { status: 409 }
        );
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "ARCHIVED" },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job archived successfully",
      });
    }

    if (action === "UNARCHIVE_JOB") {
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "PENDING" },
        select: { id: true, status: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job restored to active jobs",
      });
    }

    if (action === "UPDATE_JOB") {
      const title = body?.title !== undefined ? String(body.title || "").trim() : undefined;
      const clientName =
        body?.clientName !== undefined ? String(body.clientName || "").trim() : undefined;
      const serviceId =
        body?.serviceId !== undefined && body?.serviceId !== null
          ? String(body.serviceId || "").trim()
          : undefined;

      const data: any = {};
      if (title !== undefined) data.title = title || null;
      if (clientName !== undefined) data.clientName = clientName || null;
      if (serviceId !== undefined) {
        if (serviceId) {
          const service = await prisma.service.findFirst({
            where: { id: serviceId, vendorId },
            select: { id: true },
          });
          if (!service) {
            return NextResponse.json(
              apiResponse(false, "SERVICE_NOT_FOUND", "Selected service does not belong to this vendor."),
              { status: 404 }
            );
          }
          data.serviceId = service.id;
        }
      }

      const assessmentSource =
        body?.recordingAssessment && typeof body.recordingAssessment === "object"
          ? body.recordingAssessment
          : null;
      const parsedAssessment = assessmentSource
        ? parseRecordingScopeAssessmentInput(assessmentSource)
        : null;
      if (assessmentSource && !parsedAssessment) {
        return NextResponse.json(
          apiResponse(
            false,
            "RECORDING_ASSESSMENT_INCOMPLETE",
            "Complete the location, subject, framing, and authority fields before saving the recording scope.",
          ),
          { status: 422 },
        );
      }
      const nextAssessment = parsedAssessment
        ? deriveRecordingScopeAssessment(parsedAssessment)
        : null;
      const currentCompliance = parseRecordingComplianceMetadata(booking.customerMetadata);
      if (
        nextAssessment &&
        currentCompliance.location &&
        nextAssessment.recordingLocation !== currentCompliance.location
      ) {
        return NextResponse.json(
          apiResponse(
            false,
            "RECORDING_LOCATION_SNAPSHOT_IMMUTABLE",
            "The service location cannot be changed after its verified snapshot is saved. Create a corrected work record so permission and location evidence remain truthful.",
            {
              currentLocation: currentCompliance.location,
              requestedLocation: nextAssessment.recordingLocation,
              responsibleParticipant: "VENDOR_MANAGER",
            },
          ),
          { status: 409 },
        );
      }
      const currentAssessment = nextAssessment
        ? await (prisma as any).recordingScopeAssessment.findFirst({
            where: { bookingId: booking.id, vendorId, isCurrent: true },
            orderBy: [{ generation: "desc" }, { completedAt: "desc" }],
          })
        : null;
      const materialScopeChange = Boolean(
        nextAssessment && currentAssessment?.scopeHash !== nextAssessment.scopeHash,
      );

      if (nextAssessment && materialScopeChange) {
        const now = new Date();
        const metadata = parseCustomerMetadata(booking.customerMetadata);
        metadata.vendor_job_recording_location = nextAssessment.recordingLocation;
        metadata.recording_property_scope = nextAssessment.propertyScope;
        metadata.recording_people_scope = nextAssessment.peopleScope;
        metadata.recording_frame_control = nextAssessment.frameControl;
        metadata.recording_authority_holder_type = nextAssessment.authorityHolderType;
        metadata.recording_minor_may_appear = nextAssessment.minorMayAppear;
        metadata.recording_protected_non_participant_may_appear =
          nextAssessment.protectedNonParticipantMayAppear;
        metadata.recording_sensitive_information_may_appear =
          nextAssessment.sensitiveInformationMayAppear;
        metadata.recording_identifiers_may_appear = nextAssessment.identifiersMayAppear;
        metadata.recording_residence_interior = nextAssessment.residenceInterior;
        metadata.recording_business_interior = nextAssessment.businessInterior;
        metadata.service_can_continue_without_recording =
          nextAssessment.serviceCanContinueWithoutRecording;
        metadata.essential_private_recording = nextAssessment.essentialPrivateRecording;
        delete metadata.vendor_job_service_order_released_membership_ids;
        delete metadata.vendor_job_service_order_released_at;
        delete metadata.vendor_job_consent_accepted;
        delete metadata.vendor_job_consent_verified;
        delete metadata.vendor_job_consent_decided_at;
        metadata.vendor_job_consent_status = nextAssessment.permissionRequired
          ? "pending"
          : "not_required";

        const scopeChange = await prisma.$transaction(async (tx) => {
          if (currentAssessment) {
            await (tx as any).recordingScopeAssessment.update({
              where: { id: currentAssessment.id },
              data: { isCurrent: false, status: "SUPERSEDED", supersededAt: now },
            });
          }
          await (tx as any).employeeRecordingCertification.updateMany({
            where: { bookingId: booking.id, status: "ACTIVE", invalidatedAt: null },
            data: {
              status: "INVALIDATED",
              invalidatedAt: now,
              invalidationReason: "RECORDING_SCOPE_CHANGED",
            },
          });
          const priorPermissions = await (tx as any).consentRecord.findMany({
            where: { bookingId: booking.id, isCurrent: true },
            select: { id: true },
          });
          const priorPermissionIds = priorPermissions.map((item: any) => item.id);
          if (priorPermissionIds.length) {
            await (tx as any).consentRequestLink.updateMany({
              where: { consentRecordId: { in: priorPermissionIds }, revokedAt: null },
              data: { revokedAt: now, revocationReason: "recording_scope_changed" },
            });
            await (tx as any).consentRecord.updateMany({
              where: { id: { in: priorPermissionIds } },
              data: {
                isCurrent: false,
                status: "superseded",
                lifecycleStatus: "SUPERSEDED",
                supersededAt: now,
              },
            });
            await (tx as any).bookingNotification.updateMany({
              where: { consentRecordId: { in: priorPermissionIds }, deadLetteredAt: null },
              data: {
                status: "DEAD_LETTERED",
                deadLetteredAt: now,
                nextAttemptAt: null,
                lastError: "superseded_by_recording_scope_change",
              },
            });
            await Promise.all(
              priorPermissionIds.map((consentRecordId: string) =>
                (tx as any).consentEvent.create({
                  data: {
                    consentRecordId,
                    eventType: "scope_superseded",
                    metadata: JSON.stringify({
                      previousAssessmentId: currentAssessment?.id || null,
                      previousScopeHash: currentAssessment?.scopeHash || null,
                      nextScopeHash: nextAssessment.scopeHash,
                    }),
                  },
                }),
              ),
            );
          }
          const createdAssessment = await createRecordingScopeAssessment({
            tx,
            bookingId: booking.id,
            vendorId,
            completedByUserId: member.userId,
            assessment: nextAssessment,
            generation: Number(currentAssessment?.generation || 0) + 1,
          });
          const updated = await tx.booking.update({
            where: { id: booking.id },
            data: { ...data, customerMetadata: stringifyCustomerMetadata(metadata) },
            select: {
              id: true,
              status: true,
              title: true,
              clientName: true,
              serviceId: true,
              updatedAt: true,
            },
          });
          const notice = !nextAssessment.permissionRequired
            ? await (tx as any).bookingNotification.create({
                data: {
                  bookingId: booking.id,
                  consentRecordId: null,
                  kind: `${CUSTOMER_RECORDING_NOTICE_KIND}:${createdAssessment.generation}`,
                  status: "QUEUED",
                  idempotencyKey: `recording-notice:${booking.id}:${createdAssessment.generation}`,
                },
              })
            : null;
          return { updated, createdAssessment, notice };
        });

        let workflowState: Record<string, unknown> = {
          recordingLocked: true,
          assessmentId: scopeChange.createdAssessment.id,
          scopeHash: scopeChange.createdAssessment.scopeHash,
        };
        if (nextAssessment.permissionRequired) {
          try {
            const mediaSession = await prisma.mediaSession.create({
              data: {
                vendorId,
                bookingId: booking.id,
                serviceId: serviceId || booking.service?.id || null,
                userId: booking.user?.id || undefined,
                sessionType: "CONSENT_REQUEST",
                status: "CREATED",
                title: "Customer recording permission request",
                description: "Replacement request after recording scope changed",
              },
            });
            const createdPermission = await createVerifiedPermissionRequest({
              bookingId: booking.id,
              actorUserId: member.userId,
              mediaSessionId: mediaSession.id,
              reason: "create",
            });
            const delivery =
              createdPermission.actionPath && createdPermission.notificationId
                ? await deliverVerifiedPermissionRequest({
                    request,
                    notificationId: createdPermission.notificationId,
                    consentRecordId: createdPermission.consentRecordId,
                    actorUserId: member.userId,
                    actionPath: createdPermission.actionPath,
                    recipient: createdPermission.recipient,
                    booking: createdPermission.booking,
                  })
                : null;
            workflowState = {
              ...workflowState,
              permissionState: createdPermission.state,
              deliveryStatus: delivery?.status || null,
            };
          } catch (permissionError) {
            console.error("[vendor job update] replacement permission request failed", permissionError);
            workflowState = {
              ...workflowState,
              permissionState: "needs_attention",
            };
          }
        } else if (scopeChange.notice) {
          const notice = await dispatchQueuedRecordingNotice({
            notificationId: scopeChange.notice.id,
            bookingId: booking.id,
            actorUserId: member.userId,
            customerName: booking.user?.name || booking.clientName,
            customerEmail: booking.user?.email,
            customerPhone: booking.user?.phone,
            vendorName: booking.vendor?.businessName || booking.vendor?.name,
            serviceName: booking.service?.name || booking.title,
            scopeHash: scopeChange.createdAssessment.scopeHash,
          });
          workflowState = {
            ...workflowState,
            noticeStatus: notice.delivery?.status || "FAILED",
          };
        }
        await recordLifecycleAudit({
          actionType: "recording_scope_changed",
          entityType: "booking",
          entityId: booking.id,
          actorUserId: member.userId,
          newValue: {
            assessmentId: scopeChange.createdAssessment.id,
            scopeHash: scopeChange.createdAssessment.scopeHash,
            riskLevel: nextAssessment.riskLevel,
            permissionRequired: nextAssessment.permissionRequired,
          },
          metadata: {
            vendorId,
            previousAssessmentId: currentAssessment?.id || null,
            previousScopeHash: currentAssessment?.scopeHash || null,
          },
        });
        return NextResponse.json({
          success: true,
          action,
          job: scopeChange.updated,
          recordingWorkflow: workflowState,
          message:
            "Work details and recording scope updated. Previous permission and employee certification were replaced, and recording is locked until the current gates are complete.",
        });
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data,
        select: { id: true, status: true, title: true, clientName: true, serviceId: true, updatedAt: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job details updated successfully",
      });
    }

    if (action === "ASSIGN_JOB") {
      const resolved = await resolveJobAssignmentForVendor(
        vendorId,
        body?.assignedMembershipIds,
        body?.assignedEmployees
      );
      if (!resolved.ok) {
        return resolved.response;
      }
      const { membershipIds, displayNames } = resolved;
      const existing = await prisma.booking.findUnique({
        where: { id: booking.id },
        select: { customerMetadata: true, status: true },
      });
      const metadata = parseCustomerMetadata(existing?.customerMetadata || null);
      const previouslyAssignedIds = Array.isArray(metadata.vendor_job_assigned_membership_ids)
        ? metadata.vendor_job_assigned_membership_ids
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];
      const assignmentChanged =
        [...previouslyAssignedIds].sort().join("|") !== [...membershipIds].sort().join("|");
      if (assignmentChanged) {
        metadata.vendor_job_assignment_generation =
          Number(metadata.vendor_job_assignment_generation || 1) + 1;
      }
      metadata.vendor_job_assigned_membership_ids = membershipIds;
      metadata.vendor_job_assigned_employees = displayNames;
      if (membershipIds[0]) {
        metadata.vendor_job_primary_membership_id = membershipIds[0];
        metadata.vendor_job_primary_employee = displayNames[0] || null;
      } else {
        delete metadata.vendor_job_primary_membership_id;
        delete metadata.vendor_job_primary_employee;
      }
      const releasedMembershipIds = Array.isArray(metadata.vendor_job_service_order_released_membership_ids)
        ? metadata.vendor_job_service_order_released_membership_ids
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];
      if (releasedMembershipIds.length > 0) {
        const retainedReleasedIds = releasedMembershipIds.filter((id) => membershipIds.includes(id));
        if (retainedReleasedIds.length > 0) {
          metadata.vendor_job_service_order_released_membership_ids = retainedReleasedIds;
        } else {
          delete metadata.vendor_job_service_order_released_membership_ids;
          delete metadata.vendor_job_service_order_released_at;
        }
      }
      const bookingUpper = normalizeBookingStatus(existing?.status);
      if (bookingUpper === "PENDING" && displayNames.length > 0) {
        const ops = getRelianceOps(metadata);
        metadata.reliance_ops = { ...ops, operational_phase: "ASSIGNED" };
      }
      if (bookingUpper === "PENDING" && displayNames.length === 0) {
        const ops = getRelianceOps(metadata);
        metadata.reliance_ops = { ...ops, operational_phase: "PENDING" };
      }
      const updated = await prisma.$transaction(async (tx) => {
        if (assignmentChanged && tx.employeeRecordingCertification?.updateMany) {
          await tx.employeeRecordingCertification.updateMany({
            where: { bookingId: booking.id, status: "ACTIVE", invalidatedAt: null },
            data: {
              status: "INVALIDATED",
              invalidatedAt: new Date(),
              invalidationReason: "EMPLOYEE_ASSIGNMENT_CHANGED",
            },
          });
        }
        return tx.booking.update({
          where: { id: booking.id },
          data: { customerMetadata: JSON.stringify(metadata) },
          select: { id: true, status: true, customerMetadata: true, updatedAt: true },
        });
      });
      await recordLifecycleAudit({
        actionType: "job_assigned",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: member.userId,
        newValue: {
          assignedMembershipIds: membershipIds,
          assignedEmployees: displayNames,
          primaryMembershipId: membershipIds[0] || null,
          primaryEmployeeName: displayNames[0] || null,
        },
        metadata: { vendorId },
      });

      const newlyAssignedIds = new Set(
        membershipIds.filter((id) => !previouslyAssignedIds.includes(id))
      );

      return NextResponse.json({
        success: true,
        action,
        job: {
          id: updated.id,
          status: updated.status,
          assignedMembershipIds: membershipIds,
          assignedEmployees: displayNames,
          primaryMembershipId: membershipIds[0] || null,
          primaryEmployeeName: displayNames[0] || null,
          updatedAt: updated.updatedAt,
        },
        notifications: {
          newlyAssignedCount: newlyAssignedIds.size,
          sentCount: 0,
          deferred: true,
          results: [],
        },
        message:
          "Job assignment saved. Complete the required location or customer-consent check to send the employee service order.",
      });
    }

    if (action === "UPDATE_RECORDING_COMPLIANCE") {
      const input =
        body?.recordingCompliance && typeof body.recordingCompliance === "object"
          ? (body.recordingCompliance as Record<string, unknown>)
          : (body as Record<string, unknown>);
      const locationVerification =
        body?.locationVerification && typeof body.locationVerification === "object"
          ? (body.locationVerification as Record<string, unknown>)
          : undefined;
      const existing = await prisma.booking.findUnique({
        where: { id: booking.id },
        select: { customerMetadata: true },
      });
      const requestedLocation = normalizeRecordingLocationChoice(input.location);
      const currentCompliance = parseRecordingComplianceMetadata(
        existing?.customerMetadata || booking.customerMetadata,
      );
      if (requestedLocation && requestedLocation !== currentCompliance.location) {
        return NextResponse.json(
          apiResponse(
            false,
            "RECORDING_LOCATION_SNAPSHOT_IMMUTABLE",
            "The service location cannot be replaced after the work record snapshot is saved. Create a corrected work record with the required location source.",
            {
              currentLocation: currentCompliance.location,
              requestedLocation,
              responsibleParticipant: "VENDOR_MANAGER",
            },
          ),
          { status: 409 },
        );
      }
      const metadata = mergeRecordingComplianceMetadata(
        existing?.customerMetadata || booking.customerMetadata,
        input,
        locationVerification,
      );
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { customerMetadata: stringifyCustomerMetadata(metadata) },
        select: { id: true, status: true, customerMetadata: true, updatedAt: true },
      });
      const permissionGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId,
        customerMetadata: updated.customerMetadata,
        surface: "admin_evidence",
        capability: "observe",
        actorKind: "VENDOR_MANAGER",
      });

      await recordLifecycleAudit({
        actionType: "recording_compliance_updated",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: member.userId,
        newValue: toSafeRecordingCompliance(updated.customerMetadata, permissionGate),
        metadata: { vendorId },
      });

      return NextResponse.json({
        success: true,
        action,
        job: {
          id: updated.id,
          status: updated.status,
          recordingCompliance: toSafeRecordingCompliance(updated.customerMetadata, permissionGate),
          updatedAt: updated.updatedAt,
        },
        message: "Recording compliance saved.",
      });
    }

    if (action === "RELEASE_EMPLOYEE_SERVICE_ORDER") {
      const forceResend = Boolean(body?.forceResend);
      const existing = await prisma.booking.findUnique({
        where: { id: booking.id },
        select: { customerMetadata: true, status: true },
      });
      const metadata = existing?.customerMetadata || booking.customerMetadata || null;

      const assignmentMetadata = parseCustomerMetadata(metadata);
      const assignedMembershipIds = Array.isArray(assignmentMetadata.vendor_job_assigned_membership_ids)
        ? assignmentMetadata.vendor_job_assigned_membership_ids
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];
      if (assignedMembershipIds.length === 0) {
        return NextResponse.json(
          apiResponse(
            false,
            "EMPLOYEE_ASSIGNMENT_REQUIRED",
            "Assign at least one employee before sending a service order."
          ),
          { status: 409 }
        );
      }

      const permissionGate = await loadRecordingPermissionGate({
        bookingId: booking.id,
        vendorId,
        customerMetadata: metadata,
        surface: "vendor_release",
        capability: "release",
        actorKind: "VENDOR_MANAGER",
      });
      const complianceFailure = releaseFailureForCompliance(metadata, permissionGate);
      if (complianceFailure) {
        return NextResponse.json(
          apiResponse(false, complianceFailure.code, complianceFailure.message, {
            recordingCompliance: toSafeRecordingCompliance(metadata, permissionGate),
            blocked: complianceFailure.blocked || null,
          }),
          { status: 409 }
        );
      }

      const resolved = await resolveJobAssignmentForVendor(
        vendorId,
        assignedMembershipIds,
        assignmentMetadata.vendor_job_assigned_employees
      );
      if (!resolved.ok) return resolved.response;

      const compliance = parseRecordingComplianceMetadata(metadata);
      const unreleasedMembers = forceResend
        ? resolved.members
        : resolved.members.filter(
            (assignmentMember) => !compliance.releasedMembershipIds.includes(assignmentMember.id)
          );
      if (unreleasedMembers.length === 0) {
        return NextResponse.json({
          success: true,
          action,
          notifications: { sentCount: 0, alreadyReleased: true, results: [] },
          recordingCompliance: toSafeRecordingCompliance(metadata, permissionGate),
          message: "Employee service order was already sent for this assignment.",
        });
      }

      const baseUrl = resolveJobLinkBaseUrl(request);
      const vendorName = String(booking.vendor?.businessName || booking.vendor?.name || "Reliance Vendor");
      const jobTitle = String(booking.title || booking.service?.name || "Assigned job");
      const customerName = String(booking.clientName || booking.user?.name || "").trim() || null;
      const notificationResults = [];
      const successfulMembershipIds: string[] = [];

      for (const assignmentMember of unreleasedMembers) {
        try {
          const employeeJobLink = appendEmployeeCaptureToken(
            `${baseUrl}/employee/jobs?jobId=${encodeURIComponent(booking.id)}`,
            createEmployeeCaptureToken({
              vendorId,
              bookingId: booking.id,
              membershipId: assignmentMember.id,
            })
          );
          const notification = await sendJobAssignmentNotification({
            bookingId: booking.id,
            actorUserId: member.userId,
            employeeName: assignmentMember.displayName,
            employeeEmail: assignmentMember.user?.email || null,
            employeePhone: assignmentMember.user?.phone || null,
            employeeJobLink,
            vendorName,
            jobTitle,
            customerName,
            scheduledFor: booking.scheduledFor || booking.date || null,
            serviceTimeZone:
              typeof assignmentMetadata.service_time_zone === "string"
                ? assignmentMetadata.service_time_zone
                : null,
          });
          if (notification.anySuccess) successfulMembershipIds.push(assignmentMember.id);
          notificationResults.push({
            membershipId: assignmentMember.id,
            employeeName: assignmentMember.displayName,
            anySuccess: notification.anySuccess,
            phoneNumberUsed: notification.phoneNumberUsed,
            channels: notification.channels,
          });
        } catch (error) {
          notificationResults.push({
            membershipId: assignmentMember.id,
            employeeName: assignmentMember.displayName,
            anySuccess: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            channels: [],
          });
        }
      }

      if (successfulMembershipIds.length === 0) {
        return NextResponse.json(
          apiResponse(
            false,
            "SERVICE_ORDER_NOTIFICATION_FAILED",
            "The employee service order was ready, but the notification could not be delivered.",
            { notifications: notificationResults }
          ),
          { status: 502 }
        );
      }

      const updatedMetadata = parseCustomerMetadata(metadata);
      const releasedIds = Array.from(
        new Set([...compliance.releasedMembershipIds, ...successfulMembershipIds])
      );
      updatedMetadata.vendor_job_service_order_released_membership_ids = releasedIds;
      updatedMetadata.vendor_job_service_order_released_at = new Date().toISOString();
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { customerMetadata: stringifyCustomerMetadata(updatedMetadata) },
        select: { id: true, status: true, customerMetadata: true, updatedAt: true },
      });

      await recordLifecycleAudit({
        actionType: "employee_service_order_released",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: member.userId,
        newValue: {
          releasedMembershipIds: releasedIds,
          notificationResults,
          forceResend,
        },
        metadata: { vendorId },
      });

      return NextResponse.json({
        success: true,
        action,
        job: {
          id: updated.id,
          status: updated.status,
          recordingCompliance: toSafeRecordingCompliance(updated.customerMetadata, permissionGate),
          updatedAt: updated.updatedAt,
        },
        notifications: {
          sentCount: successfulMembershipIds.length,
          forceResend,
          results: notificationResults,
        },
        message: forceResend ? "Employee service order link resent." : "Employee service order sent.",
      });
    }

    if (action === "RESEND_COMPLETED_WORK_ORDER") {
      const statusUpper = normalizeBookingStatus(booking.status);
      if (statusUpper !== "COMPLETED") {
        return NextResponse.json(
          apiResponse(
            false,
            "COMPLETED_WORK_ORDER_REQUIRED",
            "Only completed work orders can be resent to the customer.",
            { status: statusUpper || "UNKNOWN" }
          ),
          { status: 409 }
        );
      }

      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      if (!packageState.hasAllRequiredStagesApproved) {
        return NextResponse.json(
          apiResponse(
            false,
            "CUSTOMER_VISIBLE_PACKAGE_NOT_READY",
            "The completed work order cannot be resent until Reliance approves the three-stage video package.",
            {
              hasAllRequiredStages: packageState.hasAllRequiredStages,
              hasAllRequiredStagesApproved: packageState.hasAllRequiredStagesApproved,
            }
          ),
          { status: 409 }
        );
      }

      const metadata = parseCustomerMetadata(booking.customerMetadata);
      const customerEmail =
        usableCustomerEmail(metadata.client_email) ||
        usableCustomerEmail(metadata.claim_contact_email) ||
        usableCustomerEmail(booking.user?.email);
      const customerPhone = String(metadata.client_phone || booking.user?.phone || "").trim();
      if (!customerEmail && !customerPhone) {
        return NextResponse.json(
          apiResponse(
            false,
            "CUSTOMER_CONTACT_REQUIRED",
            "This work order does not have a customer email or phone number to resend to."
          ),
          { status: 409 }
        );
      }

      let claimToken = "";
      if (
        customerEmail &&
        isUnclaimedBookingUserEmail(booking.user?.email)
      ) {
        const issuedClaim = issueCustomerBookingClaimToken(metadata);
        claimToken = issuedClaim.rawToken;
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            customerMetadata: stringifyCustomerMetadata(
              issuedClaim.metadata
            ),
          },
        });
      }

      const result = await sendVideoReadyNotification({
        actorUserId: member.userId,
        bookingId: booking.id,
        customerEmail,
        customerPhone,
        customerName: String(booking.clientName || booking.user?.name || "").trim() || null,
        serviceName: booking.service?.name || null,
        bookingTitle: booking.title || null,
        vendorName: booking.vendor?.businessName || booking.vendor?.name || null,
        completedAt: booking.date || null,
        serviceTimeZone:
          typeof metadata.service_time_zone === "string"
            ? metadata.service_time_zone
            : null,
        videoUrl: toCustomerCompletedWorkUrl(
          request,
          booking.id,
          claimToken
        ),
      });

      await recordLifecycleAudit({
        actionType: "completed_work_order_resent",
        entityType: "booking",
        entityId: booking.id,
        actorUserId: member.userId,
        newValue: {
          ok: result.ok,
          channels: result.channels,
          videoUrl: result.videoUrl,
        },
        metadata: { vendorId },
      });

      return NextResponse.json({
        success: result.ok,
        action,
        notifications: result,
        message: result.ok
          ? "Completed work order resent to the customer."
          : result.errorMessage || "Reliance could not resend the completed work order.",
      }, { status: result.ok ? 200 : 502 });
    }

    if (action === "UPDATE_STATUS") {
      const requestedStatus = normalizeUiStatusToBookingStatus(body?.status);
      if (!requestedStatus) {
        return NextResponse.json(
          apiResponse(false, "INVALID_STATUS", "Unsupported status transition request."),
          { status: 422 }
        );
      }
      const requestedUpper = normalizeBookingStatus(requestedStatus);
      const assignedFromMeta = (() => {
        const m = parseCustomerMetadata(booking.customerMetadata || null);
        const raw = m.vendor_job_assigned_employees;
        if (!Array.isArray(raw)) return [] as string[];
        return raw.map((item) => String(item || "").trim()).filter(Boolean);
      })();

      const { linkedAssetCount } = await getLinkedMediaSummary(vendorId, booking.id);
      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      const currentPhase = resolveOperationalPhase({
        bookingStatus: booking.status,
        customerMetadata: booking.customerMetadata,
        linkedMediaCount: linkedAssetCount,
        assignedEmployees: assignedFromMeta,
        hasCompleteStagedPackage: packageState.hasAllRequiredStages,
        hasAdminApprovedStagedPackage: packageState.hasAllRequiredStagesApproved,
      });

      if (requestedUpper === "COMPLETED") {
        return NextResponse.json(
          apiResponse(
            false,
            "MANAGER_APPROVAL_REQUIRED",
            "Direct status update to completed is blocked. Use manager approval for jobs in AWAITING_REVIEW.",
            { operationalPhase: currentPhase, hasAllRequiredStages: packageState.hasAllRequiredStages }
          ),
          { status: 409 }
        );
      }

      const nextOpsPhase = operationalPhaseForBookingStatusUpdate(requestedUpper, assignedFromMeta);
      const metadataUpdate =
        nextOpsPhase != null
          ? setOperationalPhaseOnMetadataJson(booking.customerMetadata, nextOpsPhase)
          : booking.customerMetadata;

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: requestedStatus,
          ...(metadataUpdate !== undefined && metadataUpdate !== booking.customerMetadata
            ? { customerMetadata: metadataUpdate }
            : {}),
        },
        select: { id: true, status: true, customerMetadata: true, updatedAt: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job status updated successfully",
      });
    }

    if (action === "APPROVE_JOB_COMPLETION") {
      const currentStatus = normalizeBookingStatus(booking.status);
      if (currentStatus !== "AWAITING_REVIEW") {
        return NextResponse.json(
          apiResponse(
            false,
            "INVALID_APPROVAL_STATUS",
            "Only jobs awaiting review can be approved for completion.",
            { status: currentStatus || "UNKNOWN" }
          ),
          { status: 409 }
        );
      }
      const packageState = await getVendorJobPackageState(vendorId, booking.id);
      if (!packageState.hasAllRequiredStages) {
        return NextResponse.json(
          apiResponse(
            false,
            "COMPLETION_REQUIRES_COMPLETE_VIDEO_PACKAGE",
            "Approve completion only after Starting Condition, Work in Progress, and Final Result videos are uploaded."
          ),
          { status: 409 }
        );
      }
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "COMPLETED", date: new Date() },
        select: { id: true, status: true, date: true, updatedAt: true },
      });
      return NextResponse.json({
        success: true,
        action,
        job: updated,
        message: "Job completion approved.",
      });
    }

    if (action === "MOVE_CONTENT_TO_ARCHIVE") {
      const sessions = await (prisma as any).mediaSession.findMany({
        where: {
          vendorId,
          bookingId: booking.id,
        },
        select: { id: true },
      });
      const sessionIds = sessions.map((s: any) => s.id);

      if (sessionIds.length === 0) {
        return NextResponse.json({
          success: true,
          action,
          message: "No linked content found for this job",
          sessionCount: 0,
          archivedAssetCount: 0,
        });
      }

      await (prisma as any).mediaSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: "ARCHIVED" },
      });

      const archivedAssetsResult = await (prisma as any).mediaAsset.updateMany({
        where: {
          mediaSessionId: { in: sessionIds },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        action,
        message: "Job content moved to archive successfully",
        sessionCount: sessionIds.length,
        archivedAssetCount: archivedAssetsResult?.count || 0,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 422 });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] PATCH error:", error);
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse as NextResponse;
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to process job action", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorManager(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: {
        id: jobId,
        vendorId,
      },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus === "COMPLETED") {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_COMPLETED",
          "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed.",
          { status: normalizedStatus }
        ),
        { status: 403 }
      );
    }

    // UI "in progress" maps to Prisma CONFIRMED (legacy check used IN_PROGRESS which never matched).
    const allowedVendorDeleteStatuses = new Set(["PENDING", "CONFIRMED", "AWAITING_REVIEW"]);
    if (!allowedVendorDeleteStatuses.has(normalizedStatus)) {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
          `Job status ${normalizedStatus || "UNKNOWN"} is not eligible for vendor deletion.`,
          { status: normalizedStatus || "UNKNOWN" }
        ),
        { status: 409 }
      );
    }

    const { linkedSessionCount, linkedAssetCount, linkedSessionIds } = await getLinkedMediaSummary(
      vendorId,
      booking.id
    );

    try {
      await prisma.$transaction(async (tx) => {
        if (linkedSessionIds.length > 0) {
          await (tx as any).mediaSession.updateMany({
            where: { id: { in: linkedSessionIds } },
            data: {
              status: "ARCHIVED",
              endedAt: new Date(),
            },
          });

          await (tx as any).mediaAsset.updateMany({
            where: {
              mediaSessionId: { in: linkedSessionIds },
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
            },
          });

          // Detach sessions from booking before deleting booking to avoid FK/NoAction conflicts.
          await (tx as any).mediaSession.updateMany({
            where: { id: { in: linkedSessionIds } },
            data: { bookingId: null },
          });
        }

        await tx.booking.delete({
          where: { id: booking.id },
        });
      });
    } catch (transactionError: any) {
      return NextResponse.json(
        apiResponse(
          false,
          "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
          "Job deletion was blocked because linked dependencies could not be handled safely. No records were deleted.",
          {
            status: normalizedStatus,
            reason: transactionError?.message || "Unknown dependency handling failure",
          }
        ),
        { status: 409 }
      );
    }

    return NextResponse.json({
      ...apiResponse(
        true,
        linkedSessionCount > 0
          ? "JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED"
          : "JOB_DELETE_SUCCESS_NO_LINKED_CONTENT",
        linkedSessionCount > 0
          ? "Job permanently deleted. Linked media sessions and assets were archived safely to prevent orphaned records."
          : "Job permanently deleted. No linked media content was found.",
        {
          linkedSessionCount,
          linkedAssetCount,
          mediaHandled: linkedSessionCount > 0 ? "archived" : "none",
        }
      ),
      hardDeleted: true,
    });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] DELETE error:", error);
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse as NextResponse;
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json(
        apiResponse(false, "JOB_DELETE_BLOCKED_FORBIDDEN", String(error.message)),
        { status: 403 }
      );
    }
    return NextResponse.json(
      apiResponse(
        false,
        "JOB_DELETE_FAILED_INTERNAL",
        "Failed to permanently delete job.",
        { reason: error.message }
      ),
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteParams): Promise<NextResponse> {
  try {
    const { vendorId, jobId } = await context.params;
    await requireVendorMembership(request, vendorId);

    const booking = await prisma.booking.findFirst({
      where: { id: jobId, vendorId },
      select: { id: true, status: true },
    });

    if (!booking) {
      return NextResponse.json(
        apiResponse(false, "JOB_NOT_FOUND", "Job not found for this vendor."),
        { status: 404 }
      );
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    const { linkedSessionCount, linkedAssetCount } = await getLinkedMediaSummary(vendorId, booking.id);

    const canVendorDelete =
      normalizedStatus === "PENDING" ||
      normalizedStatus === "CONFIRMED" ||
      normalizedStatus === "AWAITING_REVIEW";

    return NextResponse.json({
      jobId: booking.id,
      status: normalizedStatus,
      canVendorDelete,
      linkedSessionCount,
      linkedAssetCount,
      message:
        normalizedStatus === "COMPLETED"
          ? "Completed jobs cannot be deleted by vendors. Please contact an admin if further action is needed."
          : canVendorDelete
          ? linkedSessionCount > 0
            ? "This job has linked media. Deleting this job will also archive related media/session records so nothing is orphaned."
            : "This job can be deleted safely. No linked media content found."
          : `Job status ${normalizedStatus || "UNKNOWN"} is not eligible for vendor deletion.`,
      code:
        normalizedStatus === "COMPLETED"
          ? "JOB_DELETE_BLOCKED_COMPLETED"
          : canVendorDelete
          ? linkedSessionCount > 0
            ? "JOB_DELETE_SUCCESS_WITH_LINKED_CONTENT_ARCHIVED"
            : "JOB_DELETE_SUCCESS_NO_LINKED_CONTENT"
          : "JOB_DELETE_BLOCKED_UNSAFE_DEPENDENCY",
    });
  } catch (error: any) {
    console.error("[vendors/jobs/actions] GET error:", error);
    if (error.message === "Unauthorized" || String(error.message).includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to inspect job delete dependencies", details: error.message },
      { status: 500 }
    );
  }
}
