import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  bookingFindFirst: vi.fn(),
  membershipFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationUpdate: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  gate: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findFirst: h.bookingFindFirst },
    vendorMembership: { findMany: h.membershipFindMany },
    bookingNotification: { create: h.notificationCreate, update: h.notificationUpdate },
    $transaction: vi.fn(async (callback: any) =>
      callback({ booking: { findUnique: h.bookingFindUnique, update: h.bookingUpdate } }),
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
    h.gate.mockResolvedValue({ block: null });
    h.notificationCreate.mockResolvedValue({ id: "claim-1" });
    h.notificationUpdate.mockResolvedValue({ id: "claim-1" });
    h.send.mockResolvedValue({ anySuccess: true, channels: [{ channel: "email", success: true }] });
    h.bookingFindUnique.mockResolvedValue({ customerMetadata: metadata });
    h.bookingUpdate.mockResolvedValue({ id: "booking-1" });
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
          kind: "EMPLOYEE_SERVICE_ORDER_INITIAL:2:member-1",
          idempotencyKey: "booking-1:2:member-1:initial-service-order",
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

  it("treats the unique delivery claim as authoritative across concurrent ready events", async () => {
    h.notificationCreate.mockRejectedValue({ code: "P2002" });

    const result = await releaseEmployeeServiceOrderWhenReady({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "manager-1",
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(result).toMatchObject({ ready: true, alreadyReleased: true, sentCount: 0 });
    expect(result.results[0]).toMatchObject({ duplicateInitialDeliveryPrevented: true });
    expect(h.send).not.toHaveBeenCalled();
  });

  it("does not repeat an initial delivery already recorded in durable booking metadata", async () => {
    h.bookingFindFirst.mockResolvedValue({
      ...(await h.bookingFindFirst()),
      customerMetadata: JSON.stringify({
        ...JSON.parse(metadata),
        vendor_job_service_order_released_membership_ids: ["member-1"],
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
