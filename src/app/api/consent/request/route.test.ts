import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const hoisted = vi.hoisted(() => ({
  authorize: vi.fn(),
  createRequest: vi.fn(),
  dispatch: vi.fn(),
  consentRecordUpdate: vi.fn(),
  consentEventCreate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    consentRecord: { update: hoisted.consentRecordUpdate },
    consentEvent: { create: hoisted.consentEventCreate },
  },
}));
vi.mock("@/lib/consent/authorization", () => ({
  requirePermissionManagerForBooking: hoisted.authorize,
  permissionAuthorizationStatus: (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unauthorized")) return 401;
    if (message.includes("Forbidden")) return 403;
    if (message.includes("not found")) return 404;
    return 500;
  },
}));
vi.mock("@/lib/consent/request-service", () => ({
  createVerifiedPermissionRequest: hoisted.createRequest,
}));
vi.mock("@/lib/booking-notification-delivery", () => ({
  dispatchQueuedConsentNotification: hoisted.dispatch,
}));
vi.mock("@/lib/env/notification-config", () => ({ logNotificationEnvWarnings: vi.fn() }));

function request() {
  return new NextRequest("http://localhost/api/consent/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId: "booking-1", mediaSessionId: "session-1" }),
  });
}

describe("POST /api/consent/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authorize.mockResolvedValue({ manager: { userId: "manager-user-1" } });
    hoisted.createRequest.mockResolvedValue({
      consentRecordId: "permission-1",
      actionSecret: "raw-secret-that-must-not-leave-the-server",
      actionPath: "/consent/raw-secret-that-must-not-leave-the-server",
      notificationId: "notification-1",
      state: "pending",
      generation: 1,
      audioEnabled: false,
      contentVersion: "recording-permission-v3-video-only",
      recipient: {
        name: "Customer One",
        email: "customer@example.com",
        phone: null,
        emailMasked: "c***@example.com",
        phoneMasked: null,
      },
      booking: {
        id: "booking-1",
        title: "Outlet Installation",
        scheduledFor: new Date("2026-07-31T14:00:00.000Z"),
        vendor: { name: "Vendor", businessName: "Vendor Co" },
        service: { name: "Outlet Installation" },
      },
    });
    hoisted.dispatch.mockResolvedValue({
      delivery: {
        status: "SENT",
        attemptCount: 1,
        channels: [{ channel: "email", attempted: true, success: true }],
        lastError: null,
        lastAttemptAt: "2026-07-31T13:00:00.000Z",
        sentAt: "2026-07-31T13:00:01.000Z",
      },
    });
    hoisted.consentRecordUpdate.mockResolvedValue({ id: "permission-1" });
    hoisted.consentEventCreate.mockResolvedValue({ id: "event-1" });
  });

  it("allows the vendor manager to create and deliver a permission request", async () => {
    const response = await POST(request());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.authorize).toHaveBeenCalledWith(expect.any(Request), "booking-1");
    expect(hoisted.createRequest).toHaveBeenCalledWith({
      bookingId: "booking-1",
      actorUserId: "manager-user-1",
      mediaSessionId: "session-1",
      reason: "create",
    });
    expect(json.permission).toMatchObject({
      id: "permission-1",
      state: "delivered",
      recipient: { email: "c***@example.com", phone: null },
      audioEnabled: false,
      initialAudience: "private",
    });
    expect(hoisted.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        audioEnabled: false,
        contentVersion: "recording-permission-v3-video-only",
      }),
    );
    expect(JSON.stringify(json)).not.toContain("raw-secret-that-must-not-leave-the-server");
  });

  it("denies an employee or outsider before a request is created", async () => {
    hoisted.authorize.mockRejectedValue(new Error("Forbidden: Manager access required"));
    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(hoisted.createRequest).not.toHaveBeenCalled();
    expect(hoisted.dispatch).not.toHaveBeenCalled();
  });

  it("keeps recording locked and reports failed delivery without exposing the action secret", async () => {
    hoisted.dispatch.mockResolvedValue({
      delivery: {
        status: "FAILED",
        attemptCount: 1,
        channels: [{ channel: "email", attempted: true, success: false, errorCode: "SEND_FAILED" }],
        lastError: "Delivery failed",
        lastAttemptAt: "2026-07-31T13:00:00.000Z",
        sentAt: null,
      },
    });
    const response = await POST(request());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.permission.state).toBe("delivery_failed");
    expect(hoisted.consentRecordUpdate).toHaveBeenCalledWith({
      where: { id: "permission-1" },
      data: { lifecycleStatus: "DELIVERY_FAILED" },
    });
    expect(JSON.stringify(json)).not.toContain("raw-secret-that-must-not-leave-the-server");
  });
});
