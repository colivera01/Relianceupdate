import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./[jobId]/actions/route";
import { requireVendorManager } from "@/lib/membership-auth";
import { createVerifiedPermissionRequest } from "@/lib/consent/request-service";
import { deliverVerifiedPermissionRequest } from "@/lib/consent/delivery-service";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";
import { deriveRecordingScopeAssessment } from "@/lib/recording/scope-assessment";

const hoisted = vi.hoisted(() => {
  const bookingFindFirst = vi.fn();
  const bookingUpdate = vi.fn();
  const assessmentFindFirst = vi.fn();
  const assessmentUpdate = vi.fn();
  const assessmentCreate = vi.fn();
  const authorityCreateMany = vi.fn();
  const certificationUpdateMany = vi.fn();
  const consentFindMany = vi.fn();
  const consentUpdateMany = vi.fn();
  const linkUpdateMany = vi.fn();
  const notificationUpdateMany = vi.fn();
  const notificationCreate = vi.fn();
  const consentEventCreate = vi.fn();
  const mediaSessionCreate = vi.fn();
  const mediaSessionFindMany = vi.fn();
  const mediaAssetCount = vi.fn();
  const consentFindFirst = vi.fn();
  const certificationFindFirst = vi.fn();
  const serviceFindFirst = vi.fn();
  const tx = {
    booking: { update: bookingUpdate },
    recordingScopeAssessment: { update: assessmentUpdate, create: assessmentCreate },
    recordingAuthorityRequirement: { createMany: authorityCreateMany },
    employeeRecordingCertification: { updateMany: certificationUpdateMany },
    consentRecord: { findMany: consentFindMany, updateMany: consentUpdateMany },
    consentRequestLink: { updateMany: linkUpdateMany },
    bookingNotification: { updateMany: notificationUpdateMany, create: notificationCreate },
    consentEvent: { create: consentEventCreate },
  };
  const prisma = {
    booking: { findFirst: bookingFindFirst, update: bookingUpdate },
    service: { findFirst: serviceFindFirst },
    consentRecord: { findFirst: consentFindFirst },
    employeeRecordingCertification: { findFirst: certificationFindFirst },
    recordingScopeAssessment: { findFirst: assessmentFindFirst },
    mediaSession: { create: mediaSessionCreate, findMany: mediaSessionFindMany },
    mediaAsset: { count: mediaAssetCount },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return {
    prisma,
    bookingFindFirst,
    bookingUpdate,
    assessmentFindFirst,
    assessmentUpdate,
    assessmentCreate,
    authorityCreateMany,
    certificationUpdateMany,
    consentFindMany,
    consentUpdateMany,
    linkUpdateMany,
    notificationUpdateMany,
    consentEventCreate,
    mediaSessionCreate,
    mediaSessionFindMany,
    mediaAssetCount,
    consentFindFirst,
    certificationFindFirst,
    serviceFindFirst,
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/membership-auth", () => ({
  requireVendorMembership: vi.fn(),
  requireVendorManager: vi.fn(),
}));
vi.mock("@/lib/consent/request-service", () => ({
  createVerifiedPermissionRequest: vi.fn(),
}));
vi.mock("@/lib/consent/delivery-service", () => ({
  deliverVerifiedPermissionRequest: vi.fn(),
}));
vi.mock("@/lib/recording/recording-notice", () => ({
  CUSTOMER_RECORDING_NOTICE_KIND: "CUSTOMER_RECORDING_NOTICE",
  dispatchQueuedRecordingNotice: vi.fn(),
}));
vi.mock("@/lib/lifecycle-audit", () => ({ recordLifecycleAudit: vi.fn() }));
vi.mock("@/lib/notifications/send-job-assignment", () => ({
  sendJobAssignmentNotification: vi.fn(),
}));
vi.mock("@/lib/notifications/send-video-ready", () => ({
  sendVideoReadyNotification: vi.fn(),
}));

describe("material recording scope change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireVendorManager).mockResolvedValue({ userId: "manager-1" } as any);
    vi.mocked(recordLifecycleAudit).mockResolvedValue(undefined);
    hoisted.mediaSessionFindMany.mockResolvedValue([]);
    hoisted.mediaAssetCount.mockResolvedValue(0);
    hoisted.consentFindFirst.mockResolvedValue({ id: "permission-1", lifecycleStatus: "ACCEPTED", status: "accepted" });
    hoisted.certificationFindFirst.mockResolvedValue({ id: "certification-1" });
    hoisted.serviceFindFirst.mockResolvedValue({ id: "service-2" });
    hoisted.bookingFindFirst.mockResolvedValue({
      id: "job-1",
      vendorId: "vendor-1",
      status: "CONFIRMED",
      title: "Outlet installation",
      clientName: "Alex Customer",
      customerMetadata: JSON.stringify({
        vendor_job_recording_location: "business",
        vendor_job_service_order_released_at: "2026-08-04T10:00:00.000Z",
        vendor_job_service_order_released_membership_ids: ["membership-1"],
        vendor_job_consent_accepted: true,
        vendor_job_consent_verified: true,
      }),
      scheduledFor: new Date("2026-08-05T14:00:00.000Z"),
      date: new Date("2026-08-05T14:00:00.000Z"),
      service: { id: "service-1", name: "Outlet installation" },
      vendor: { name: "Electro", businessName: "Electro LLC" },
      user: {
        id: "customer-1",
        name: "Alex Customer",
        email: "alex@example.com",
        phone: "+14075550123",
      },
    });
    hoisted.assessmentFindFirst.mockResolvedValue({
      id: "assessment-1",
      generation: 1,
      scopeHash: "old-scope-hash",
    });
    hoisted.consentFindMany.mockResolvedValue([{ id: "permission-1" }]);
    hoisted.assessmentCreate.mockResolvedValue({
      id: "assessment-2",
      generation: 2,
      scopeHash: "new-scope-hash",
    });
    hoisted.bookingUpdate.mockResolvedValue({
      id: "job-1",
      status: "CONFIRMED",
      title: "Outlet installation",
      clientName: "Alex Customer",
      serviceId: "service-1",
      updatedAt: new Date(),
    });
    hoisted.mediaSessionCreate.mockResolvedValue({ id: "permission-session-2" });
    vi.mocked(createVerifiedPermissionRequest).mockResolvedValue({
      consentRecordId: "permission-2",
      requestLinkId: "link-2",
      actionSecret: "ephemeral-secret",
      actionPath: "/consent/ephemeral-secret",
      notificationId: "notification-2",
      state: "pending",
      recipient: {
        name: "Alex Customer",
        email: "alex@example.com",
        phone: "+14075550123",
        emailHash: "email-hash",
        phoneHash: "phone-hash",
        emailMasked: "a***@example.com",
        phoneMasked: "***0123",
      } as any,
      booking: { vendor: {}, service: {} },
      generation: 2,
    });
    vi.mocked(deliverVerifiedPermissionRequest).mockResolvedValue({ status: "SENT" } as any);
  });

  it("supersedes stale evidence, relocks recording, and requests permission for the new scope", async () => {
    const request = new Request(
      "http://localhost/api/vendors/vendor-1/jobs/job-1/actions",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_JOB",
          recordingAssessment: {
            recordingLocation: "business",
            propertyScope: "customer_owned",
            peopleScope: "customer",
            frameControl: "controlled",
            authorityHolderType: "customer",
            minorMayAppear: false,
            protectedNonParticipantMayAppear: false,
            sensitiveInformationMayAppear: false,
            identifiersMayAppear: false,
            residenceInterior: false,
            businessInterior: false,
            serviceCanContinueWithoutRecording: true,
            essentialPrivateRecording: false,
          },
        }),
      },
    );
    const response = await PATCH(request, {
      params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recordingWorkflow).toMatchObject({
      recordingLocked: true,
      assessmentId: "assessment-2",
      permissionState: "pending",
      deliveryStatus: "SENT",
    });
    expect(hoisted.assessmentUpdate).toHaveBeenCalledWith({
      where: { id: "assessment-1" },
      data: expect.objectContaining({ isCurrent: false, status: "SUPERSEDED" }),
    });
    expect(hoisted.certificationUpdateMany).toHaveBeenCalledWith({
      where: { bookingId: "job-1", status: "ACTIVE", invalidatedAt: null },
      data: expect.objectContaining({
        status: "INVALIDATED",
        invalidationReason: "RECORDING_SCOPE_CHANGED",
      }),
    });
    expect(hoisted.linkUpdateMany).toHaveBeenCalled();
    expect(hoisted.consentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["permission-1"] } },
      data: expect.objectContaining({ isCurrent: false, lifecycleStatus: "SUPERSEDED" }),
    });
    expect(hoisted.assessmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ generation: 2, isCurrent: true, locationType: "business" }),
    });
    const savedMetadata = JSON.parse(hoisted.bookingUpdate.mock.calls[0][0].data.customerMetadata);
    expect(savedMetadata.vendor_job_service_order_released_at).toBeUndefined();
    expect(savedMetadata.vendor_job_service_order_released_membership_ids).toBeUndefined();
    expect(savedMetadata.vendor_job_consent_accepted).toBeUndefined();
    expect(createVerifiedPermissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "job-1", mediaSessionId: "permission-session-2" }),
    );
    expect(recordLifecycleAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "recording_scope_changed", entityId: "job-1" }),
    );
  });

  it("rejects attempts to rewrite the immutable saved location snapshot", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/jobs/job-1/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_JOB",
          recordingAssessment: {
            recordingLocation: "residence",
            propertyScope: "customer_owned",
            peopleScope: "none",
            frameControl: "controlled",
            authorityHolderType: "customer",
            minorMayAppear: false,
            protectedNonParticipantMayAppear: false,
            sensitiveInformationMayAppear: false,
            identifiersMayAppear: false,
            residenceInterior: true,
            businessInterior: false,
            serviceCanContinueWithoutRecording: true,
            essentialPrivateRecording: false,
          },
        }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "RECORDING_LOCATION_SNAPSHOT_IMMUTABLE",
    });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("supersedes permission when the service changes even if the scope hash is unchanged", async () => {
    const assessmentInput = {
      recordingLocation: "business" as const,
      propertyScope: "customer_owned" as const,
      peopleScope: "customer" as const,
      frameControl: "controlled" as const,
      authorityHolderType: "customer" as const,
      minorMayAppear: false,
      protectedNonParticipantMayAppear: false,
      sensitiveInformationMayAppear: false,
      identifiersMayAppear: false,
      residenceInterior: false,
      businessInterior: false,
      serviceCanContinueWithoutRecording: true,
      essentialPrivateRecording: false,
      audioRequested: false,
    };
    const unchangedScope = deriveRecordingScopeAssessment(assessmentInput);
    hoisted.assessmentFindFirst.mockResolvedValue({
      id: "assessment-1",
      generation: 1,
      scopeHash: unchangedScope.scopeHash,
    });

    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/jobs/job-1/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_JOB",
          serviceId: "service-2",
          title: "Panel replacement",
          recordingAssessment: assessmentInput,
        }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }) },
    );

    expect(response.status).toBe(200);
    expect(hoisted.consentUpdateMany).toHaveBeenCalled();
    expect(hoisted.certificationUpdateMany).toHaveBeenCalled();
    expect(recordLifecycleAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          materialChangeReasons: expect.arrayContaining(["service_work_type"]),
        }),
      }),
    );
  });

  it("requires the audited recipient-correction workflow after permission begins", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/jobs/job-1/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_JOB",
          clientName: "Different Customer",
          recordingAssessment: {
            recordingLocation: "business",
            propertyScope: "customer_owned",
            peopleScope: "customer",
            frameControl: "controlled",
            authorityHolderType: "customer",
            minorMayAppear: false,
            protectedNonParticipantMayAppear: false,
            sensitiveInformationMayAppear: false,
            identifiersMayAppear: false,
            residenceInterior: false,
            businessInterior: false,
            serviceCanContinueWithoutRecording: true,
            essentialPrivateRecording: false,
          },
        }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "CUSTOMER_RECIPIENT_CORRECTION_REQUIRED",
    });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("does not edit work-record evidence after capture begins", async () => {
    hoisted.mediaSessionFindMany.mockResolvedValue([{ id: "session-1" }]);
    hoisted.mediaAssetCount.mockResolvedValue(1);

    const response = await PATCH(
      new Request("http://localhost/api/vendors/vendor-1/jobs/job-1/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_JOB", title: "Changed after capture" }),
      }),
      { params: Promise.resolve({ vendorId: "vendor-1", jobId: "job-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "WORK_RECORD_EDIT_LOCKED_AFTER_CAPTURE",
    });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });
});
