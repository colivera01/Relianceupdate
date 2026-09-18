import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  membershipFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationFindUnique: vi.fn(),
  notificationUpdateMany: vi.fn(),
  notificationUpdate: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  assessmentFindFirst: vi.fn(),
  gate: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findFirst: h.bookingFindFirst },
    vendorMembership: { findMany: h.membershipFindMany },
    bookingNotification: {
      create: h.notificationCreate,
      findUnique: h.notificationFindUnique,
      updateMany: h.notificationUpdateMany,
      update: h.notificationUpdate,
    },
    $transaction: vi.fn(async (callback: any) =>
      callback({
        booking: { findUnique: h.bookingFindUnique, update: h.bookingUpdate },
        recordingScopeAssessment: { findFirst: h.assessmentFindFirst },
      }),
    ),
  },
}));

vi.mock("@/lib/consent/recording-gate", () => ({
  loadRecordingPermissionGate: h.gate,
}));

vi.mock("@/lib/notifications/send-job-assignment", () => ({
  sendJobAssignmentNotification: h.send,
}));

vi.mock("@/lib/employee-capture-token", () => ({
  createEmployeeCaptureToken: vi.fn(() => "capture-token"),
  appendEmployeeCaptureToken: vi.fn((url: string) => `${url}&ct=capture-token`),
}));

import { releaseEmployeeServiceOrderWhenReady } from "./employee-service-order-release";

const metadata = JSON.stringify({
  vendor_job_assigned_membership_ids: ["member-1"],
  vendor_job_assigned_employees: ["Bradley Coopers"],
  vendor_job_assignment_generation: 2,
  vendor_job_recording_location: "residence",
  vendor_job_service_order_released_membership_ids: [],
});

describe("releaseEmployeeServiceOrderWhenReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      status: "PENDING",
      customerMetadata: metadata,
      title: "Controlled residence service",
      clientName: "Controlled Customer",
      scheduledFor: new Date("2026-08-13T15:00:00.000Z"),
      date: null,
      service: { name: "Controlled residence service" },
      vendor: { name: "Electro", businessName: "Electro LLC" },
    });
    h.membershipFindMany.mockResolvedValue([
      {
        id: "member-1",
        user: { name: "Bradley Coopers", email: "employee@example.com", phone: null },
      },
    ]);
    h.gate.mockResolvedValue({
      block: null,
      assessmentId: "assessment-2",
      assessmentGeneration: 2,
      scopeHash: "scope-hash-2",
    });
    h.notificationCreate.mockResolvedValue({ id: "claim-1" });
    h.notificationFindUnique.mockResolvedValue({
      id: "claim-1",
      status: "SENDING",
      lastAttemptAt: new Date(),
    });
    h.notificationUpdateMany.mockResolvedValue({ count: 0 });
    h.notificationUpdate.mockResolvedValue({ id: "claim-1" });
    h.send.mockResolvedValue({ anySuccess: true, channels: [{ channel: "email", success: true }] });
    h.bookingFindUnique.mockResolvedValue({ customerMetadata: metadata });
    h.bookingUpdate.mockResolvedValue({ id: "booking-1" });
    h.assessmentFindFirst.mockResolvedValue({
      id: "assessment-2",
      generation: 2,
      scopeHash: "scope-hash-2",
    });
  });

  it("claims and sends the initial Service Order exactly once when all requirements are ready", async () => {
    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, sentCount: 1, releasedMembershipIds: ["member-1"] });
    expect(h.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "EMPLOYEE_SERVICE_ORDER_INITIAL_V2:2:2:assessment-2:scope-hash-2:member-1",
          idempotencyKey:
            "booking-1:EMPLOYEE_SERVICE_ORDER_INITIAL_V2:2:2:assessment-2:scope-hash-2:member-1",
        }),
      }),
    );
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.bookingUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not send when assignment or permission requirements are not ready", async () => {
    h.gate.mockResolvedValue({
      block: { code: "VERIFIED_PERMISSION_REQUIRED", why: "Permission is pending.", resolution: "Wait for customer." },
    });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: false, sentCount: 0, blocked: { code: "VERIFIED_PERMISSION_REQUIRED" } });
    expect(h.notificationCreate).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("reports a concurrent current-context delivery as in progress rather than already released", async () => {
    h.notificationCreate.mockRejectedValue({ code: "P2002" });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({
      ready: true,
      alreadyReleased: false,
      deliveryInProgress: true,
      sentCount: 0,
    });
    expect(result.results[0]).toMatchObject({
      duplicateInitialDeliveryPrevented: true,
      deliveryInProgress: true,
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it("allows only one notification delivery across concurrent identical Send requests", async () => {
    h.notificationCreate
      .mockResolvedValueOnce({ id: "claim-1" })
      .mockRejectedValueOnce({ code: "P2002" });

    const input = {
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    };
    const [first, second] = await Promise.all([
      releaseEmployeeServiceOrderWhenReady(input),
      releaseEmployeeServiceOrderWhenReady(input),
    ]);

    expect([first.sentCount, second.sentCount].sort()).toEqual([0, 1]);
    expect([first.deliveryInProgress, second.deliveryInProgress]).toContain(true);
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.bookingUpdate).toHaveBeenCalledTimes(1);
  });

  it("restores a missing current release marker from an exact successful delivery claim", async () => {
    h.notificationCreate.mockRejectedValue({ code: "P2002" });
    h.notificationFindUnique.mockResolvedValue({
      id: "claim-1",
      status: "SENT",
      lastAttemptAt: new Date(),
    });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, alreadyReleased: true, sentCount: 0 });
    expect(result.results[0]).toMatchObject({ currentReleaseRestored: true });
    expect(h.send).not.toHaveBeenCalled();
    expect(h.bookingUpdate).toHaveBeenCalledTimes(1);
  });

  it("retries a failed current-context delivery claim instead of treating it as released", async () => {
    h.notificationCreate.mockRejectedValue({ code: "P2002" });
    h.notificationFindUnique.mockResolvedValue({
      id: "claim-1",
      status: "FAILED",
      lastAttemptAt: new Date(),
    });
    h.notificationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, alreadyReleased: false, sentCount: 1 });
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.notificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "claim-1" }, data: expect.objectContaining({ status: "SENT" }) }),
    );
  });

  it("does not repeat an initial delivery already recorded in durable booking metadata", async () => {
    h.bookingFindFirst.mockResolvedValue({
      ...(await h.bookingFindFirst()),
      customerMetadata: JSON.stringify({
        ...JSON.parse(metadata),
        vendor_job_service_order_released_membership_ids: ["member-1"],
        vendor_job_service_order_release_contexts: {
          "member-1": {
            version: 2,
            assignmentGeneration: 2,
            assessmentId: "assessment-2",
            assessmentGeneration: 2,
            scopeHash: "scope-hash-2",
            notificationKind:
              "EMPLOYEE_SERVICE_ORDER_INITIAL_V2:2:2:assessment-2:scope-hash-2:member-1",
            releasedAt: "2026-09-17T20:00:00.000Z",
          },
        },
      }),
    });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, alreadyReleased: true, sentCount: 0 });
    expect(h.notificationCreate).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("ordinary Send establishes a new release when scope replacement invalidated the old context", async () => {
    const replacedMetadata = JSON.stringify({
      ...JSON.parse(metadata),
      vendor_job_service_order_released_membership_ids: ["member-1"],
      vendor_job_service_order_released_at: "2026-09-17T20:00:00.000Z",
      vendor_job_service_order_release_contexts: {
        "member-1": {
          version: 2,
          assignmentGeneration: 2,
          assessmentId: "assessment-1",
          assessmentGeneration: 1,
          scopeHash: "scope-hash-1",
          notificationKind:
            "EMPLOYEE_SERVICE_ORDER_INITIAL_V2:2:1:assessment-1:scope-hash-1:member-1",
          releasedAt: "2026-09-17T20:00:00.000Z",
        },
      },
    });
    h.bookingFindFirst.mockResolvedValue({
      ...(await h.bookingFindFirst()),
      customerMetadata: replacedMetadata,
    });
    h.bookingFindUnique.mockResolvedValue({ customerMetadata: replacedMetadata });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, alreadyReleased: false, sentCount: 1 });
    expect(h.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "EMPLOYEE_SERVICE_ORDER_INITIAL_V2:2:2:assessment-2:scope-hash-2:member-1",
        }),
      }),
    );
    expect(h.send).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(h.bookingUpdate.mock.calls[0][0].data.customerMetadata);
    expect(saved.vendor_job_service_order_release_contexts["member-1"]).toMatchObject({
      version: 2,
      assignmentGeneration: 2,
      assessmentId: "assessment-2",
      assessmentGeneration: 2,
      scopeHash: "scope-hash-2",
    });
  });

  it("reassignment does not reuse another employee's release evidence", async () => {
    const reassignedMetadata = JSON.stringify({
      ...JSON.parse(metadata),
      vendor_job_assigned_membership_ids: ["member-2"],
      vendor_job_assigned_employees: ["New Employee"],
      vendor_job_assignment_generation: 3,
      vendor_job_service_order_released_membership_ids: ["member-1"],
      vendor_job_service_order_release_contexts: {
        "member-1": {
          version: 2,
          assignmentGeneration: 2,
          assessmentId: "assessment-2",
          assessmentGeneration: 2,
          scopeHash: "scope-hash-2",
        },
      },
    });
    h.bookingFindFirst.mockResolvedValue({
      ...(await h.bookingFindFirst()),
      customerMetadata: reassignedMetadata,
    });
    h.bookingFindUnique.mockResolvedValue({ customerMetadata: reassignedMetadata });
    h.membershipFindMany.mockResolvedValue([
      { id: "member-2", user: { name: "New Employee", email: "new@example.com", phone: null } },
    ]);

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ sentCount: 1, releasedMembershipIds: ["member-2"] });
    expect(h.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "EMPLOYEE_SERVICE_ORDER_INITIAL_V2:3:2:assessment-2:scope-hash-2:member-2",
        }),
      }),
    );
  });

  it("fails closed when the assessment changes before release evidence is persisted", async () => {
    h.assessmentFindFirst.mockResolvedValue({
      id: "assessment-3",
      generation: 3,
      scopeHash: "scope-hash-3",
    });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({
      ready: false,
      sentCount: 0,
      blocked: { code: "SERVICE_ORDER_RELEASE_CONTEXT_CHANGED" },
    });
    expect(h.bookingUpdate).not.toHaveBeenCalled();
  });

  it("allows an explicit manager resend without creating another initial-delivery claim", async () => {
    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
      forceResend: true,
    });

    expect(result).toMatchObject({ ready: true, sentCount: 1 });
    expect(h.notificationCreate).not.toHaveBeenCalled();
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("does not describe a failed initial delivery as already released", async () => {
    h.send.mockResolvedValue({
      anySuccess: false,
      channels: [{ channel: "email", success: false, error: "Controlled delivery failure" }],
    });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, alreadyReleased: false, sentCount: 0 });
    expect(h.bookingUpdate).not.toHaveBeenCalled();
    expect(h.notificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
