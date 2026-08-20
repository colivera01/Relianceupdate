import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    booking: { findUnique: h.bookingFindUnique },
    vendorMembership: { findMany: h.membershipFindMany },
  },
}));
vi.mock("@/lib/employee-service-order-release", () => ({
  releaseEmployeeServiceOrderWhenReady: h.release,
}));
vi.mock("@/lib/env/notification-config", () => ({
  readNotificationEnv: vi.fn(() => ({ emailEnabled: false, smsEnabled: false })),
}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/sms/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/notifications/notification-audit", () => ({ logNotificationAttempt: vi.fn() }));

import {
  buildConsentDecisionEmailContent,
  sendConsentDecisionNotifications,
} from "./send-consent-decision";

describe("accepted permission Service Order release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      userId: "customer-1",
      vendorId: "vendor-1",
      title: "Controlled Service",
      clientName: "Controlled Customer",
      scheduledFor: null,
      date: null,
      customerMetadata: JSON.stringify({ vendor_job_assigned_membership_ids: ["employee-1"] }),
      service: { name: "Controlled Service" },
      user: { id: "customer-1", name: "Customer", email: null, phone: null },
      vendor: { name: "Electro", businessName: "Electro LLC", email: null, phone: null },
    });
    h.membershipFindMany.mockResolvedValue([]);
    h.release.mockResolvedValue({
      ready: true,
      alreadyReleased: false,
      sentCount: 1,
      releasedMembershipIds: ["employee-1"],
      results: [{ membershipId: "employee-1", anySuccess: true }],
    });
  });

  it("re-evaluates automatic employee delivery when permission is accepted after assignment", async () => {
    const result = await sendConsentDecisionNotifications({
      request: new Request("https://beta.relianceonline.org/api/consent/token/decision"),
      bookingId: "booking-1",
      accepted: true,
      actorUserId: "customer-1",
    });

    expect(h.release).toHaveBeenCalledWith({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      actorUserId: "customer-1",
      baseUrl: "https://beta.relianceonline.org",
    });
    expect(result.releasedMembershipIds).toEqual(["employee-1"]);
  });

  it("never releases recording access after a decline", async () => {
    const result = await sendConsentDecisionNotifications({
      request: new Request("https://beta.relianceonline.org/api/consent/token/decision"),
      bookingId: "booking-1",
      accepted: false,
      actorUserId: "customer-1",
    });

    expect(h.release).not.toHaveBeenCalled();
    expect(result.releasedMembershipIds).toEqual([]);
  });

  it("distinguishes Reliance work-record cancellation from the underlying service", () => {
    const content = buildConsentDecisionEmailContent({
      accepted: false,
      declineCanceled: true,
      vendorName: "Electro LLC",
      jobTitle: "Outlet Installation",
      recipientName: "Vendor manager",
    });

    expect(content.subject).toContain("Reliance work record canceled");
    expect(content.message).toContain("underlying service arrangement was not canceled");
    expect(content.nextStep).toContain("vendor may decide independently");
    expect(content.text).not.toContain("Customer canceled service");
  });
});
