import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPermissionContact } from "@/lib/consent/recipient";

const hoisted = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  requireAdmin: vi.fn(),
  decide: vi.fn(),
  sendReady: vi.fn(),
  sendRejected: vi.fn(),
  sendVendor: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { booking: { findUnique: hoisted.bookingFindUnique, update: hoisted.bookingUpdate } },
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: hoisted.requireAdmin }));
vi.mock("@/lib/service-video-admin-audit", async () => {
  const actual = await vi.importActual<any>("@/lib/service-video-admin-audit");
  return { ...actual, decideCoreServiceVideoAdminAudit: hoisted.decide };
});
vi.mock("@/lib/service-video-admin-audit-notifications", () => ({
  sendCorePrivateProofReadyNotification: hoisted.sendReady,
  sendCorePrivateProofRejectedNotification: hoisted.sendRejected,
  sendCoreAdminAuditVendorResultNotification: hoisted.sendVendor,
}));
vi.mock("@/lib/media-lifecycle", () => ({ ensureRetentionSchedulesForBooking: vi.fn() }));
vi.mock("@/lib/trust-score-outcome-foundation", () => ({
  TRUST_OUTCOME_TYPES: { VIDEO_PACKAGE_APPROVED: "approved", VIDEO_PACKAGE_REJECTED: "rejected" },
  tryRecordFinalizedOperationalOutcome: vi.fn(),
}));
vi.mock("@/lib/trust-score-calculator", () => ({ tryRecalculateVendorTrustScore: vi.fn() }));

function booking() {
  return {
    id: "b1",
    vendorId: "v1",
    userId: "customer-1",
    title: "Outlet Installation",
    clientName: "Alex",
    date: new Date("2026-08-24T12:00:00Z"),
    customerMetadata: JSON.stringify({ claim_contact_email: "alex@example.com" }),
    user: { email: "alex@example.com", name: "Alex", phone: null },
    vendor: { businessName: "A Heating", name: "Vendor A" },
    service: { name: "Outlet Installation" },
  };
}

describe("core Admin Service Video audit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.requireAdmin.mockResolvedValue({ userId: "admin-1" });
    hoisted.bookingFindUnique.mockResolvedValue(booking());
    hoisted.sendReady.mockResolvedValue({ status: "SENT" });
    hoisted.sendRejected.mockResolvedValue({ status: "SENT" });
    hoisted.sendVendor.mockResolvedValue({ status: "SENT" });
  });

  it("records PASS and sends the customer notice only after durable proof release", async () => {
    hoisted.decide.mockResolvedValue({
      decision: { id: "audit-1", decidedAt: new Date() },
      package: { id: "package-1", version: 1 },
      customerNotificationId: "notification-1",
      vendorNotificationId: "vendor-notification-1",
      alreadyDecided: false,
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PASS",
        publicDisplayEligibility: "PUBLIC_DISPLAY_ELIGIBLE",
      }),
    }), { params: Promise.resolve({ bookingId: "b1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ decision: "PASS", customerProofReleased: true });
    expect(hoisted.decide).toHaveBeenCalledWith(expect.objectContaining({ decision: "PASS" }));
    expect(hoisted.sendReady).toHaveBeenCalledOnce();
    expect(hoisted.sendVendor).toHaveBeenCalledWith(expect.objectContaining({
      decision: "PASS",
      vendorId: "v1",
      notificationId: "vendor-notification-1",
    }));
    expect(hoisted.sendRejected).not.toHaveBeenCalled();
  });

  it("sends Private Proof to the corrected current recipient, not historical claim metadata", async () => {
    const current = "current@example.com";
    hoisted.bookingFindUnique.mockResolvedValue({
      ...booking(),
      customerMetadata: JSON.stringify({
        client_email: current,
        claim_contact_email: "historical@example.com",
      }),
      user: { email: "unclaimed+b1@reliance.local", name: "Alex", phone: null },
      consentRecords: [
        { recipientEmailHash: hashPermissionContact(current) },
      ],
    });
    hoisted.decide.mockResolvedValue({
      decision: { id: "audit-1", decidedAt: new Date() },
      package: { id: "package-1", version: 1 },
      customerNotificationId: "notification-1",
      vendorNotificationId: "vendor-notification-1",
      alreadyDecided: false,
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PASS",
          publicDisplayEligibility: "PUBLIC_DISPLAY_ELIGIBLE",
        }),
      }),
      { params: Promise.resolve({ bookingId: "b1" }) },
    );
    expect(response.status).toBe(200);
    expect(hoisted.sendReady).toHaveBeenCalledWith(
      expect.objectContaining({ customerEmail: current }),
    );
  });

  it("requires a category and reason for terminal REJECT", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", reason: "Not verifiable" }),
    }), { params: Promise.resolve({ bookingId: "b1" }) });
    expect(response.status).toBe(422);
    expect(hoisted.decide).not.toHaveBeenCalled();
  });

  it("requires a Public-display eligibility outcome for PASS", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "PASS" }),
    }), { params: Promise.resolve({ bookingId: "b1" }) });
    expect(response.status).toBe(422);
    expect(hoisted.decide).not.toHaveBeenCalled();
  });

  it("rejects a free-text or unknown category at the API boundary", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", rejectionCategory: "OTHER", reason: "Not accepted" }),
    }), { params: Promise.resolve({ bookingId: "b1" }) });
    expect(response.status).toBe(422);
    expect(hoisted.decide).not.toHaveBeenCalled();
  });

  it("records terminal REJECT without creating customer proof", async () => {
    hoisted.decide.mockResolvedValue({
      decision: { id: "audit-2", decidedAt: new Date() },
      package: { id: "package-1", version: 1 },
      customerNotificationId: "notification-2",
      vendorNotificationId: "vendor-notification-2",
      alreadyDecided: false,
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", rejectionCategory: "UNVERIFIABLE", reason: "Video cannot be verified" }),
    }), { params: Promise.resolve({ bookingId: "b1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ decision: "REJECT", customerProofReleased: false });
    expect(hoisted.sendRejected).toHaveBeenCalledOnce();
    expect(hoisted.sendVendor).toHaveBeenCalledWith(expect.objectContaining({
      decision: "REJECT",
      rejectionCategory: "UNVERIFIABLE",
      reason: "Video cannot be verified",
    }));
    expect(hoisted.sendReady).not.toHaveBeenCalled();
  });

  it("fails closed before a non-Admin actor can decide a package", async () => {
    hoisted.requireAdmin.mockRejectedValue(new Error("Forbidden: Admin access required"));
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("https://beta.relianceonline.org/api/admin/media/packages/b1/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "PASS" }),
    }), { params: Promise.resolve({ bookingId: "b1" }) });

    expect(response.status).toBe(403);
    expect(hoisted.decide).not.toHaveBeenCalled();
    expect(hoisted.bookingFindUnique).not.toHaveBeenCalled();
  });
});
