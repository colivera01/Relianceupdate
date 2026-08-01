import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchQueuedConsentNotification } from "./booking-notification-delivery";
import { sendConsentLinkNotification } from "./notifications/send-consent-link";

const hoisted = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  attemptCreate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    bookingNotification: {
      updateMany: hoisted.updateMany,
      findUnique: hoisted.findUnique,
      update: hoisted.update,
    },
    bookingNotificationAttempt: {
      create: hoisted.attemptCreate,
    },
  },
}));

vi.mock("./notifications/send-consent-link", () => ({
  sendConsentLinkNotification: vi.fn(),
}));

const input = {
  notificationId: "notification-1",
  consentRecordId: "consent-1",
  actorUserId: "vendor-user-1",
  consentPath: "/consent/token-1",
  absoluteBaseUrl: "https://beta.relianceonline.org",
  customerEmail: "customer@example.com",
};

describe("dispatchQueuedConsentNotification", () => {
  beforeEach(() => {
    hoisted.updateMany.mockReset();
    hoisted.findUnique.mockReset();
    hoisted.update.mockReset();
    hoisted.attemptCreate.mockReset();
    vi.mocked(sendConsentLinkNotification).mockReset();
    hoisted.attemptCreate.mockResolvedValue({ id: "attempt-1" });
  });

  it("marks a provider-accepted delivery as sent and stores its channel result", async () => {
    hoisted.updateMany.mockResolvedValue({ count: 1 });
    hoisted.findUnique.mockResolvedValue({ attemptCount: 1 });
    vi.mocked(sendConsentLinkNotification).mockResolvedValue({
      anySuccess: true,
      absoluteFallbackLink: "https://beta.relianceonline.org/consent/token-1",
      channels: [{ channel: "email", attempted: true, success: true }],
    } as any);
    hoisted.update.mockImplementation(async ({ data }: any) => ({
      status: data.status,
      attemptCount: 1,
      channelsJson: data.channelsJson,
      lastError: data.lastError,
      lastAttemptAt: new Date("2026-07-26T12:00:00.000Z"),
      sentAt: new Date("2026-07-26T12:00:01.000Z"),
    }));

    const result = await dispatchQueuedConsentNotification(input);

    expect(result.claimed).toBe(true);
    expect(result.delivery).toMatchObject({
      status: "SENT",
      attemptCount: 1,
      channels: [{ channel: "email", attempted: true, success: true }],
    });
  });

  it("does not send twice when another request already claimed the notification", async () => {
    hoisted.updateMany.mockResolvedValue({ count: 0 });
    hoisted.findUnique.mockResolvedValue({
      status: "SENDING",
      attemptCount: 1,
      channelsJson: null,
      lastError: null,
      lastAttemptAt: new Date("2026-07-26T12:00:00.000Z"),
      sentAt: null,
    });

    const result = await dispatchQueuedConsentNotification(input);

    expect(result).toMatchObject({
      claimed: false,
      notification: null,
      delivery: { status: "SENDING", attemptCount: 1 },
    });
    expect(sendConsentLinkNotification).not.toHaveBeenCalled();
  });

  it("records a failed delivery so the manager can resend it", async () => {
    hoisted.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(sendConsentLinkNotification).mockRejectedValue(new Error("email provider unavailable"));
    hoisted.update.mockResolvedValue({
      status: "FAILED",
      attemptCount: 1,
      channelsJson: null,
      lastError: "email provider unavailable",
      lastAttemptAt: new Date("2026-07-26T12:00:00.000Z"),
      sentAt: null,
    });

    const result = await dispatchQueuedConsentNotification(input);

    expect(result.delivery).toMatchObject({
      status: "FAILED",
      lastError: "email provider unavailable",
    });
  });
});
