import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const hoisted = vi.hoisted(() => {
  const findMany = vi.fn();
  const findConsentRecord = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();
  const rotate = vi.fn();
  const deliver = vi.fn();
  return { findMany, findConsentRecord, update, updateMany, rotate, deliver };
});

vi.mock("@/server/db", () => ({
  prisma: {
    bookingNotification: { findMany: hoisted.findMany, update: hoisted.update, updateMany: hoisted.updateMany },
    consentRecord: { findFirst: hoisted.findConsentRecord },
  },
}));
vi.mock("@/lib/consent/request-service", () => ({ rotateVerifiedPermissionLink: hoisted.rotate }));
vi.mock("@/lib/consent/delivery-service", () => ({ deliverVerifiedPermissionRequest: hoisted.deliver }));

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
    hoisted.findConsentRecord.mockResolvedValue({ id: "permission-1", generation: 7 });
    hoisted.rotate.mockResolvedValue({
      consentRecordId: "permission-1",
      notificationId: "notification-new",
      actionPath: "/consent/server-only-new-secret",
      recipient: {},
      booking: {},
    });
    hoisted.deliver.mockResolvedValue({ status: "SENT" });
  });

  afterEach(() => delete process.env.INTERNAL_NOTIFICATION_WORKER_SECRET);

  it("requires independent worker authentication", async () => {
    const response = await POST(workerRequest("wrong-secret"));
    expect(response.status).toBe(401);
    expect(hoisted.findMany).not.toHaveBeenCalled();
  });

  it("rotates the action link before retrying delivery", async () => {
    hoisted.findMany.mockResolvedValue([{
      id: "notification-old",
      consentRecordId: "permission-1",
      attemptCount: 1,
      maxAttempts: 4,
    }]);
    const response = await POST(workerRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(hoisted.rotate).toHaveBeenCalledWith({ consentRecordId: "permission-1", actorUserId: "permission-notification-worker" });
    expect(hoisted.deliver).toHaveBeenCalledWith(expect.objectContaining({ actionPath: "/consent/server-only-new-secret" }));
  });

  it("dead-letters based on delivery attempts, not link generation", async () => {
    hoisted.findMany.mockResolvedValue([{
      id: "notification-old",
      consentRecordId: "permission-1",
      attemptCount: 4,
      maxAttempts: 4,
    }]);
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
    hoisted.findMany.mockResolvedValue([{
      id: "notification-old",
      consentRecordId: "permission-1",
      attemptCount: 1,
      maxAttempts: 4,
    }]);
    hoisted.findConsentRecord.mockResolvedValue(null);

    const response = await POST(workerRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(hoisted.rotate).not.toHaveBeenCalled();
    expect(hoisted.deliver).not.toHaveBeenCalled();
  });
});
