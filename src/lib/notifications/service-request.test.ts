import { describe, expect, it, vi } from "vitest";

import {
  buildServiceRequestNotificationCopy,
  enqueueServiceRequestAppointmentReminders,
  enqueueServiceRequestCustomerEvent,
  enqueueServiceRequestVendorEvent,
} from "./service-request";

vi.mock("@/server/db", () => ({ prisma: {} }));

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    userId: "customer-1",
    title: "Outlet Installation",
    clientName: "Casey Customer",
    vendorId: "vendor-1",
    scheduledFor: new Date("2026-11-05T15:00:00.000Z"),
    createdAt: new Date("2026-11-01T13:00:00.000Z"),
    customerMetadata: null,
    user: { id: "customer-1", name: "Casey Customer", email: "customer@example.com", phone: "+14075550101" },
    vendor: { id: "vendor-1", name: "Electro LLC", businessName: "Electro LLC", email: "vendor@example.com", phone: "+14075550102", notifications_job: true },
    service: { name: "Outlet Installation" },
    ...overrides,
  };
}

describe("service request notifications", () => {
  it("clearly tells the customer a new request is not yet confirmed", () => {
    const copy = buildServiceRequestNotificationCopy({
      event: "NEW_REQUEST_CUSTOMER",
      vendorName: "Electro LLC",
      customerName: "Casey Customer",
      serviceName: "Outlet Installation",
      scheduledFor: "2026-11-05T15:00:00.000Z",
      targetUrl: "https://beta.relianceonline.org/my-bookings/booking-1",
    });
    expect(copy.subject).toContain("Service request sent");
    expect(copy.body).toContain("not a confirmed appointment");
  });

  it("creates a durable manager notice using only real relation IDs", async () => {
    const notificationUpsert = vi.fn().mockResolvedValue({ id: "notification-1", status: "QUEUED" });
    const managerUpsert = vi.fn().mockResolvedValue({ id: "manager-notification-1" });
    const db = {
      booking: { findUnique: vi.fn().mockResolvedValue(booking()) },
      vendorMembership: { findMany: vi.fn().mockResolvedValue([{ id: "membership-1", user: { id: "manager-user-1", name: "Manager", email: "manager@example.com", phone: "+14075550103" } }]) },
      bookingNotification: { upsert: notificationUpsert },
      vendorManagerNotification: { upsert: managerUpsert },
    };

    await enqueueServiceRequestVendorEvent({
      db,
      bookingId: "booking-1",
      event: "NEW_REQUEST_VENDOR",
      actorUserId: "customer-1",
      baseUrl: "https://beta.relianceonline.org",
      dedupeKey: "created",
    });

    expect(notificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { bookingId_kind: expect.objectContaining({ bookingId: "booking-1" }) },
    }));
    expect(managerUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        vendorId: "vendor-1",
        bookingId: "booking-1",
        recipientMembershipId: "membership-1",
        sourceBookingNotificationId: "notification-1",
      }),
    }));
  });

  it("uses the validated request phone for customer delivery before the account fallback", async () => {
    const notificationUpsert = vi.fn().mockResolvedValue({ id: "notification-1", status: "QUEUED" });
    const db = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(booking({
          customerMetadata: JSON.stringify({ client_phone: "(407) 555-0199" }),
        })),
      },
      bookingNotification: { upsert: notificationUpsert },
    };

    await enqueueServiceRequestCustomerEvent({
      db,
      bookingId: "booking-1",
      event: "NEW_REQUEST_CUSTOMER",
      actorUserId: "customer-1",
      baseUrl: "https://beta.relianceonline.org",
      dedupeKey: "created",
    });

    const envelope = JSON.parse(notificationUpsert.mock.calls[0][0].create.channelsJson);
    expect(envelope.payload.recipient.phone).toBe("+14075550199");
  });

  it("idempotently keys customer and vendor 24-hour reminders", async () => {
    const scheduledFor = new Date("2026-11-05T15:00:00.000Z");
    const current = booking({
      scheduledFor,
      customerMetadata: JSON.stringify({
        service_request: {
          state: "SCHEDULED",
          schedule_mode: "CUSTOMER_REQUESTED",
          requested_at: "2026-11-01T13:00:00.000Z",
          requested_scheduled_for: scheduledFor.toISOString(),
          history: [{ state: "SCHEDULED", at: "2026-11-01T14:00:00.000Z" }],
        },
      }),
    });
    const notificationUpsert = vi.fn()
      .mockResolvedValueOnce({ id: "customer-reminder", status: "QUEUED" })
      .mockResolvedValueOnce({ id: "vendor-reminder", status: "QUEUED" });
    const db = {
      booking: {
        findMany: vi.fn().mockResolvedValue([{ id: "booking-1", createdAt: current.createdAt, scheduledFor, customerMetadata: current.customerMetadata }]),
        findUnique: vi.fn().mockResolvedValue(current),
      },
      vendorMembership: { findMany: vi.fn().mockResolvedValue([]) },
      bookingNotification: { upsert: notificationUpsert },
      vendorManagerNotification: { upsert: vi.fn() },
    };

    const queued = await enqueueServiceRequestAppointmentReminders({
      db,
      now: new Date("2026-11-04T16:00:00.000Z"),
      baseUrl: "https://beta.relianceonline.org",
    });

    expect(queued).toHaveLength(2);
    const kinds = notificationUpsert.mock.calls.map(([call]) => call.create.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      expect.stringContaining("SERVICE_REQUEST_REMINDER_CUSTOMER_V1:24h"),
      expect.stringContaining("SERVICE_REQUEST_REMINDER_VENDOR_V1:24h"),
    ]));
  });
});
