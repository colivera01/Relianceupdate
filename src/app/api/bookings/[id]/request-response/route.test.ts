import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { getUserIdFromRequest } from "@/lib/auth";
import { ensureUserAccountCanAct } from "@/lib/account-status";
import { recordLifecycleAudit } from "@/lib/lifecycle-audit";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const bookingFindMany = vi.fn();
  const bookingUpdate = vi.fn();
  const transaction = vi.fn(async (callback: any) => callback({
    booking: {
      findUnique: bookingFindUnique,
      findMany: bookingFindMany,
      update: bookingUpdate,
    },
  }));
  return {
    bookingFindUnique,
    bookingFindMany,
    bookingUpdate,
    transaction,
    enqueueServiceRequestVendorEvent: vi.fn(),
    dispatchServiceRequestNotifications: vi.fn(),
  };
});

vi.mock("@/server/db", () => ({
  prisma: { $transaction: hoisted.transaction },
}));

vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/account-status", () => {
  class AccountStatusError extends Error {
    statusCode = 403;
  }
  return {
    AccountStatusError,
    accountStatusErrorBody: vi.fn((error: Error) => ({ success: false, error: error.message })),
    ensureUserAccountCanAct: vi.fn(),
  };
});

vi.mock("@/lib/lifecycle-audit", () => ({
  recordLifecycleAudit: vi.fn(),
}));

vi.mock("@/lib/notifications/service-request", () => ({
  enqueueServiceRequestVendorEvent: hoisted.enqueueServiceRequestVendorEvent,
  dispatchServiceRequestNotifications: hoisted.dispatchServiceRequestNotifications,
}));

const createdAt = new Date("2026-10-29T12:00:00.000Z");
const requestedFor = new Date("2099-11-05T14:00:00.000Z");
const proposedFor = new Date("2099-11-06T15:00:00.000Z");

function counterofferMetadata(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    service_request: {
      version: 1,
      state: "COUNTEROFFERED",
      schedule_mode: "CUSTOMER_REQUESTED",
      requested_at: createdAt.toISOString(),
      requested_scheduled_for: requestedFor.toISOString(),
      responded_at: "2026-10-29T12:05:00.000Z",
      responded_by_user_id: "manager-1",
      responded_by_membership_id: "manager-membership-1",
      response_reason: "A later time is available.",
      proposed_scheduled_for: proposedFor.toISOString(),
      counteroffer_generation: 1,
      customer_responded_at: null,
      customer_response_reason: null,
      history: [],
    },
    ...extra,
  });
}

function currentBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    userId: "customer-1",
    vendorId: "vendor-1",
    status: "PENDING",
    scheduledFor: proposedFor,
    createdAt,
    customerMetadata: counterofferMetadata(),
    service: { description: "Estimated duration: 60 minutes." },
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new Request("https://beta.relianceonline.org/api/bookings/booking-1/request-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("customer service request response route", () => {
  beforeEach(() => {
    vi.mocked(getUserIdFromRequest).mockReset();
    vi.mocked(getUserIdFromRequest).mockResolvedValue("customer-1");
    vi.mocked(ensureUserAccountCanAct).mockReset();
    vi.mocked(ensureUserAccountCanAct).mockResolvedValue(undefined);
    vi.mocked(recordLifecycleAudit).mockReset();
    vi.mocked(recordLifecycleAudit).mockResolvedValue(undefined);
    hoisted.bookingFindUnique.mockReset();
    hoisted.bookingFindUnique.mockResolvedValue(currentBooking());
    hoisted.bookingFindMany.mockReset();
    hoisted.bookingFindMany.mockResolvedValue([]);
    hoisted.bookingUpdate.mockReset();
    hoisted.bookingUpdate.mockImplementation(async (args: any) => ({
      id: "booking-1",
      status: args.data.status,
      scheduledFor: args.data.scheduledFor || proposedFor,
      customerMetadata: args.data.customerMetadata,
    }));
    hoisted.transaction.mockClear();
    hoisted.enqueueServiceRequestVendorEvent.mockReset();
    hoisted.enqueueServiceRequestVendorEvent.mockResolvedValue([{ id: "notice-1", status: "QUEUED" }]);
    hoisted.dispatchServiceRequestNotifications.mockReset();
    hoisted.dispatchServiceRequestNotifications.mockResolvedValue([{ id: "notice-1", status: "SENT" }]);
  });

  it("requires an authenticated customer before loading the request", async () => {
    vi.mocked(getUserIdFromRequest).mockResolvedValue(null);

    const response = await POST(
      request({ action: "ACCEPT_COUNTEROFFER", requestId: "auth-1" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ code: "UNAUTHORIZED" });
    expect(hoisted.transaction).not.toHaveBeenCalled();
  });

  it("forbids a signed-in customer from answering another customer's request", async () => {
    hoisted.bookingFindUnique.mockResolvedValue(currentBooking({ userId: "another-customer" }));

    const response = await POST(
      request({ action: "ACCEPT_COUNTEROFFER", requestId: "owner-1" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: "SERVICE_REQUEST_FORBIDDEN" });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });

  it("accepts an available counteroffer and notifies the vendor", async () => {
    const response = await POST(
      request({ action: "ACCEPT_COUNTEROFFER", requestId: "accept-1" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      code: "COUNTEROFFER_ACCEPTED",
      details: {
        booking: { id: "booking-1", status: "CONFIRMED", scheduledFor: proposedFor.toISOString() },
        requestLifecycle: { state: "SCHEDULED" },
        idempotent: false,
      },
    });
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "CONFIRMED",
        scheduledFor: proposedFor,
        date: proposedFor,
        customerMetadata: expect.stringContaining('"service_request_customer_request_ids":["ACCEPT_COUNTEROFFER:accept-1"]'),
      }),
    }));
    expect(hoisted.enqueueServiceRequestVendorEvent).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: "booking-1",
      event: "COUNTER_ACCEPTED_VENDOR",
    }));
    expect(hoisted.dispatchServiceRequestNotifications).toHaveBeenCalledTimes(1);
    expect(recordLifecycleAudit).toHaveBeenCalledWith(expect.objectContaining({
      actionType: "customer_counteroffer_accepted",
      entityId: "booking-1",
    }));
  });

  it("rejects a counteroffer that conflicts before customer acceptance", async () => {
    hoisted.bookingFindMany.mockResolvedValue([
      {
        scheduledFor: new Date(proposedFor.getTime() + 30 * 60 * 1000),
        service: { description: "Estimated duration: 60 minutes." },
      },
    ]);

    const response = await POST(
      request({ action: "ACCEPT_COUNTEROFFER", requestId: "conflict-1" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "COUNTEROFFER_SCHEDULE_UNAVAILABLE" });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
    expect(hoisted.enqueueServiceRequestVendorEvent).not.toHaveBeenCalled();
  });

  it("declines a counteroffer, cancels the request, and notifies the vendor", async () => {
    const response = await POST(
      request({
        action: "DECLINE_COUNTEROFFER",
        reason: "I need a different date.",
        requestId: "decline-1",
      }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      code: "COUNTEROFFER_DECLINED",
      details: {
        booking: { status: "CANCELED" },
        requestLifecycle: { state: "CUSTOMER_DECLINED" },
      },
    });
    expect(hoisted.bookingUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "CANCELED",
        rejectionReason: "I need a different date.",
      }),
    }));
    expect(hoisted.enqueueServiceRequestVendorEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: "COUNTER_DECLINED_VENDOR",
      reason: "I need a different date.",
    }));
  });

  it("replays an action-bound requestId without a second mutation or notification", async () => {
    const metadata = counterofferMetadata({
      service_request_customer_request_ids: ["ACCEPT_COUNTEROFFER:retry-safe-1"],
    });
    const parsed = JSON.parse(metadata);
    parsed.service_request.state = "SCHEDULED";
    hoisted.bookingFindUnique.mockResolvedValue(currentBooking({
      status: "CONFIRMED",
      customerMetadata: JSON.stringify(parsed),
    }));

    const response = await POST(
      request({ action: "ACCEPT_COUNTEROFFER", requestId: "retry-safe-1" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ code: "COUNTEROFFER_ACCEPTED", details: { idempotent: true } });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
    expect(hoisted.enqueueServiceRequestVendorEvent).not.toHaveBeenCalled();
    expect(hoisted.dispatchServiceRequestNotifications).not.toHaveBeenCalled();
    expect(recordLifecycleAudit).not.toHaveBeenCalled();
  });

  it("does not treat the same requestId used for another action as an idempotent replay", async () => {
    hoisted.bookingFindUnique.mockResolvedValue(currentBooking({
      customerMetadata: counterofferMetadata({
        service_request_customer_request_ids: ["ACCEPT_COUNTEROFFER:shared-id"],
      }),
    }));

    const response = await POST(
      request({ action: "DECLINE_COUNTEROFFER", reason: "Not available then.", requestId: "shared-id" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ code: "COUNTEROFFER_DECLINED", details: { idempotent: false } });
    expect(hoisted.bookingUpdate).toHaveBeenCalledTimes(1);
    expect(hoisted.enqueueServiceRequestVendorEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale counteroffer lifecycle before mutation", async () => {
    const metadata = counterofferMetadata();
    const parsed = JSON.parse(metadata);
    parsed.service_request.state = "SCHEDULED";
    hoisted.bookingFindUnique.mockResolvedValue(currentBooking({
      status: "CONFIRMED",
      customerMetadata: JSON.stringify(parsed),
    }));

    const response = await POST(
      request({ action: "DECLINE_COUNTEROFFER", reason: "Too late.", requestId: "stale-1" }),
      { params: Promise.resolve({ id: "booking-1" }) },
    );

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "COUNTEROFFER_STATE_CHANGED" });
    expect(hoisted.bookingUpdate).not.toHaveBeenCalled();
  });
});
