import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  consentFindUnique: vi.fn(),
  consentUpdate: vi.fn(),
  eventCreate: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    consentRecord: {
      findUnique: hoisted.consentFindUnique,
      update: hoisted.consentUpdate,
    },
    consentEvent: { create: hoisted.eventCreate },
  },
}));

vi.mock("@/lib/booking-notification-delivery", () => ({
  dispatchQueuedConsentNotification: hoisted.dispatch,
}));

import { deliverVerifiedPermissionRequest } from "./delivery-service";

const baseInput = {
  request: new Request("https://beta.relianceonline.org/api/consent/request"),
  notificationId: "notification-1",
  consentRecordId: "consent-1",
  actorUserId: "manager-1",
  actionPath: "/consent/current-token",
  recipient: {
    name: "Reliance Demo Customer",
    email: "customer@example.com",
    phone: "+14075550199",
  },
  booking: {
    title: "Outlet Installation",
    date: new Date("2026-08-26T14:00:00.000Z"),
    vendor: { businessName: "Electro LLC" },
    service: { name: "Outlet Installation" },
  },
};

describe("canonical permission delivery scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.dispatch.mockResolvedValue({
      delivery: { status: "SENT", channels: [] },
    });
    hoisted.consentUpdate.mockResolvedValue({});
    hoisted.eventCreate.mockResolvedValue({});
  });

  it.each([
    [true, "recording-permission-v3-video-audio"],
    [false, "recording-permission-v3-video-only"],
  ])(
    "uses the current consent generation audio scope for initial, resend, and corrected-recipient delivery (%s)",
    async (audioEnabled, version) => {
      hoisted.consentFindUnique.mockResolvedValue({
        audioEnabled,
        contentVersion: { version },
      });

      await deliverVerifiedPermissionRequest(baseInput);

      expect(hoisted.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ audioEnabled, contentVersion: version }),
      );
    },
  );

  it("does not derive replacement notification copy from stale booking metadata", async () => {
    hoisted.consentFindUnique.mockResolvedValue({
      audioEnabled: true,
      contentVersion: { version: "recording-permission-v3-video-audio" },
    });

    await deliverVerifiedPermissionRequest({
      ...baseInput,
      booking: {
        ...baseInput.booking,
        customerMetadata: JSON.stringify({ audioEnabled: false }),
      },
    });

    expect(hoisted.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        audioEnabled: true,
        contentVersion: "recording-permission-v3-video-audio",
      }),
    );
  });
});
