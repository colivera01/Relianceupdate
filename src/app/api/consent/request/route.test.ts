import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { dispatchQueuedConsentNotification } from "@/lib/booking-notification-delivery";

const hoisted = vi.hoisted(() => {
  const bookingFindUnique = vi.fn();
  const bookingUpdate = vi.fn();
  const consentRecordFindMany = vi.fn();
  const consentRecordUpdateMany = vi.fn();
  const consentRecordCreate = vi.fn();
  const consentEventCreate = vi.fn();
  const bookingNotificationUpsert = vi.fn();
  const prisma: any = {
    booking: {
      findUnique: bookingFindUnique,
      update: bookingUpdate,
    },
    consentRecord: {
      findMany: consentRecordFindMany,
      updateMany: consentRecordUpdateMany,
      create: consentRecordCreate,
    },
    consentEvent: {
      create: consentEventCreate,
    },
    bookingNotification: {
      upsert: bookingNotificationUpsert,
    },
  };
  const transaction = vi.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  prisma.$transaction = transaction;
  return {
    prisma,
    bookingFindUnique,
    bookingUpdate,
    consentRecordFindMany,
    consentRecordUpdateMany,
    consentRecordCreate,
    consentEventCreate,
    bookingNotificationUpsert,
    transaction,
  };
});

vi.mock("@/server/db", () => ({ prisma: hoisted.prisma }));
vi.mock("@/lib/auth", () => ({
  getUserIdFromRequest: vi.fn().mockResolvedValue("vendor-user-1"),
}));
vi.mock("@/lib/admin-audit", () => ({
  createAdminAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/env/notification-config", () => ({
  logNotificationEnvWarnings: vi.fn(),
}));
vi.mock("@/lib/booking-notification-delivery", () => ({
  CUSTOMER_CONSENT_NOTIFICATION_KIND: "CUSTOMER_CONSENT_REQUEST",
  dispatchQueuedConsentNotification: vi.fn(),
}));

describe("POST /api/consent/request", () => {
  beforeEach(() => {
    for (const mock of [
      hoisted.bookingFindUnique,
      hoisted.bookingUpdate,
      hoisted.consentRecordFindMany,
      hoisted.consentRecordUpdateMany,
      hoisted.consentRecordCreate,
      hoisted.consentEventCreate,
      hoisted.bookingNotificationUpsert,
      hoisted.transaction,
    ]) {
      mock.mockReset();
    }
    hoisted.transaction.mockImplementation(async (callback: (tx: typeof hoisted.prisma) => unknown) =>
      callback(hoisted.prisma)
    );
    hoisted.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      vendorId: "vendor-1",
      title: "Outlet Installation",
      scheduledFor: new Date("2026-07-26T14:00:00.000Z"),
      clientName: "Customer One",
      customerMetadata: JSON.stringify({
        client_email: "customer@example.com",
        vendor_job_recording_location: "residence",
      }),
      vendor: { businessName: "Vendor Co", name: "Vendor" },
      service: { name: "Outlet Installation" },
      user: { email: "customer@example.com", phone: null, name: "Customer One" },
    });
    hoisted.consentRecordFindMany.mockResolvedValue([{ id: "old-consent" }]);
    hoisted.consentRecordUpdateMany.mockResolvedValue({ count: 1 });
    hoisted.consentRecordCreate.mockImplementation(async ({ data }: any) => ({
      id: "new-consent",
      ...data,
    }));
    hoisted.consentEventCreate.mockResolvedValue({ id: "event-1" });
    hoisted.bookingUpdate.mockResolvedValue({ id: "booking-1" });
    hoisted.bookingNotificationUpsert.mockResolvedValue({ id: "notification-1" });
    vi.mocked(dispatchQueuedConsentNotification).mockReset();
    vi.mocked(dispatchQueuedConsentNotification).mockResolvedValue({
      claimed: true,
      notification: {
        anySuccess: true,
        absoluteFallbackLink: "https://beta.relianceonline.org/consent/new-token",
        channels: [{ channel: "email", attempted: true, success: true }],
      } as any,
      delivery: {
        status: "SENT",
        attemptCount: 2,
        channels: [{ channel: "email", attempted: true, success: true }],
        lastError: null,
        lastAttemptAt: "2026-07-26T12:00:00.000Z",
        sentAt: "2026-07-26T12:00:01.000Z",
      },
    });
  });

  it("supersedes the old token and requeues the tracked notification", async () => {
    const request = new NextRequest("http://localhost/api/consent/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: "booking-1",
        vendorId: "vendor-1",
        mediaSessionId: "session-2",
        consentType: "video_access",
        origin: "http://localhost:3000",
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.transaction).toHaveBeenCalledTimes(1);
    expect(hoisted.consentRecordUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-consent"] } },
      data: { status: "superseded" },
    });
    expect(hoisted.bookingNotificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          consentRecordId: "new-consent",
          status: "QUEUED",
          lastError: null,
        }),
      })
    );
    expect(dispatchQueuedConsentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: "notification-1",
        consentRecordId: "new-consent",
        customerEmail: "customer@example.com",
      })
    );
    expect(json).toMatchObject({
      success: true,
      previousTokenCount: 1,
      delivery: { status: "SENT", attemptCount: 2 },
    });
  });
});
