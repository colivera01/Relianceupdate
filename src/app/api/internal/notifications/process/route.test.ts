import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const hoisted = vi.hoisted(() => {
  const findMany = vi.fn();
  const findConsentRecord = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();
  const rotate = vi.fn();
  const deliver = vi.fn();
  const deliverEmployeeDecline = vi.fn();
  const enqueueReminders = vi.fn();
  const dispatchServiceRequest = vi.fn();
  return {
    findMany,
    findConsentRecord,
    update,
    updateMany,
    rotate,
    deliver,
    deliverEmployeeDecline,
    enqueueReminders,
    dispatchServiceRequest,
  };
});

vi.mock("@/server/db", () => ({
  prisma: {
    bookingNotification: { findMany: hoisted.findMany, update: hoisted.update, updateMany: hoisted.updateMany },
    consentRecord: { findFirst: hoisted.findConsentRecord },
  },
}));
vi.mock("@/lib/consent/request-service", () => ({ rotateVerifiedPermissionLink: hoisted.rotate }));
vi.mock("@/lib/consent/delivery-service", () => ({ deliverVerifiedPermissionRequest: hoisted.deliver }));
vi.mock("@/lib/notifications/send-employee-participation-declined", () => ({
  EMPLOYEE_PARTICIPATION_DECLINED_NOTIFICATION_KIND: "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED:",
  isEmployeeParticipationDeclinedNotificationKind: (kind: string) =>
    String(kind || "").startsWith("EMPLOYEE_RECORDING_PARTICIPATION_DECLINED:"),
  dispatchEmployeeParticipationDeclinedNotification: hoisted.deliverEmployeeDecline,
}));
vi.mock("@/lib/notifications/service-request", () => ({
  SERVICE_REQUEST_NOTIFICATION_PREFIX: "SERVICE_REQUEST_",
  enqueueServiceRequestAppointmentReminders: hoisted.enqueueReminders,
  dispatchServiceRequestNotification: hoisted.dispatchServiceRequest,
}));

function workerRequest(secret = "worker-secret") {
  return new Request("http://localhost/api/internal/notifications/process", {
    method: "POST",
    headers: { "x-internal-notification-secret": secret },
  });
}

describe("permission notification worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_NOTIFICATION_WORKER_SECRET = "worker-secret";
    hoisted.update.mockResolvedValue({});
    hoisted.updateMany.mockResolvedValue({ count: 1 });
    hoisted.findMany.mockResolvedValue([]);
    hoisted.enqueueReminders.mockResolvedValue([]);
    hoisted.dispatchServiceRequest.mockResolvedValue({ status: "SENT" });
    hoisted.findConsentRecord.mockResolvedValue({ id: "permission-1", generation: 7 });
    hoisted.rotate.mockResolvedValue({
      consentRecordId: "permission-1",
      notificationId: "notification-new",
      actionPath: "/consent/server-only-new-secret",
      recipient: {},
      booking: {},
    });
    hoisted.deliver.mockResolvedValue({ status: "SENT" });
    hoisted.deliverEmployeeDecline.mockResolvedValue({ claimed: true, status: "SENT" });
  });

  afterEach(() => delete process.env.INTERNAL_NOTIFICATION_WORKER_SECRET);

  it("requires independent worker authentication", async () => {
    const response = await POST(workerRequest("wrong-secret"));
    expect(response.status).toBe(401);
    expect(hoisted.findMany).not.toHaveBeenCalled();
  });

  it("rotates the action link before retrying delivery", async () => {
    hoisted.findMany.mockResolvedValueOnce([{
      id: "notification-old",
      consentRecordId: "permission-1",
      attemptCount: 1,
      maxAttempts: 4,
    }]).mockResolvedValueOnce([]);
    const response = await POST(workerRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(hoisted.rotate).toHaveBeenCalledWith({ consentRecordId: "permission-1", actorUserId: "permission-notification-worker" });
    expect(hoisted.deliver).toHaveBeenCalledWith(expect.objectContaining({ actionPath: "/consent/server-only-new-secret" }));
  });

  it("dead-letters based on delivery attempts, not link generation", async () => {
    hoisted.findMany.mockResolvedValueOnce([{
      id: "notification-old",
      consentRecordId: "permission-1",
      attemptCount: 4,
      maxAttempts: 4,
    }]).mockResolvedValueOnce([]);
    const response = await POST(workerRequest());
    const json = await response.json();

    expect(json.results).toEqual([{ notificationId: "notification-old", status: "dead_lettered" }]);
    expect(hoisted.rotate).not.toHaveBeenCalled();
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: "notification-old" },
      data: { deadLetteredAt: expect.any(Date), lastError: "permission_delivery_retry_limit_reached" },
    });
  });

  it("skips notifications whose permission request is no longer retryable", async () => {
    hoisted.findMany.mockResolvedValueOnce([{
      id: "notification-old",
      consentRecordId: "permission-1",
      attemptCount: 1,
      maxAttempts: 4,
    }]).mockResolvedValueOnce([]);
    hoisted.findConsentRecord.mockResolvedValue(null);

    const response = await POST(workerRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(hoisted.rotate).not.toHaveBeenCalled();
    expect(hoisted.deliver).not.toHaveBeenCalled();
  });

  it("retries the existing idempotent Employee participation DECLINE delivery", async () => {
    hoisted.findMany.mockResolvedValueOnce([{
      id: "notification-decline",
      kind: "EMPLOYEE_RECORDING_PARTICIPATION_DECLINED:membership-1:1",
      consentRecordId: null,
      attemptCount: 1,
      maxAttempts: 4,
    }]).mockResolvedValueOnce([]);

    const response = await POST(workerRequest());
    const json = await response.json();

    expect(json.results).toEqual([{ notificationId: "notification-decline", status: "SENT" }]);
    expect(hoisted.deliverEmployeeDecline).toHaveBeenCalledWith({
      notificationId: "notification-decline",
      actorUserId: "employee-participation-notification-worker",
    });
    expect(hoisted.rotate).not.toHaveBeenCalled();
  });

  it("enqueues 24-hour reminders and retries queued service-request delivery", async () => {
    hoisted.enqueueReminders.mockResolvedValue([{ id: "reminder-customer" }, { id: "reminder-vendor" }]);
    hoisted.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "service-notification-1",
        kind: "SERVICE_REQUEST_ACCEPTED_CUSTOMER_V1:accepted_customer:customer-1",
        attemptCount: 0,
        maxAttempts: 4,
      }]);

    const response = await POST(workerRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders).toEqual({ queued: 2, error: null });
    expect(hoisted.enqueueReminders).toHaveBeenCalledWith(expect.objectContaining({
      db: expect.any(Object),
      now: expect.any(Date),
      baseUrl: "http://localhost",
    }));
    expect(hoisted.dispatchServiceRequest).toHaveBeenCalledWith({
      notificationId: "service-notification-1",
      actorUserId: "service-request-notification-worker",
      db: expect.any(Object),
    });
    expect(json.results).toContainEqual(expect.objectContaining({
      notificationId: "service-notification-1",
      status: "SENT",
    }));
  });

  it("dead-letters service-request deliveries at their retry limit", async () => {
    hoisted.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "service-notification-1",
        kind: "SERVICE_REQUEST_DECLINED_CUSTOMER_V1:declined_customer:customer-1",
        attemptCount: 4,
        maxAttempts: 4,
      }]);

    const response = await POST(workerRequest());
    const json = await response.json();

    expect(json.results).toContainEqual(expect.objectContaining({
      notificationId: "service-notification-1",
      status: "dead_lettered",
    }));
    expect(hoisted.dispatchServiceRequest).not.toHaveBeenCalled();
    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: "service-notification-1" },
      data: {
        deadLetteredAt: expect.any(Date),
        leaseExpiresAt: null,
        lastError: "service_request_delivery_retry_limit_reached",
      },
    });
  });
});
