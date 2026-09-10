import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVendorManager: vi.fn(),
  membershipFindUnique: vi.fn(),
  createToken: vi.fn(),
  appendToken: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@/lib/membership-auth", () => ({ requireVendorManager: mocks.requireVendorManager }));
vi.mock("@/server/db", () => ({
  prisma: { vendorMembership: { findUnique: mocks.membershipFindUnique } },
}));
vi.mock("@/lib/employee-public-media-consent-token", () => ({
  createEmployeePublicMediaConsentToken: mocks.createToken,
  appendEmployeePublicMediaConsentToken: mocks.appendToken,
}));
vi.mock("@/lib/notifications/send-employee-public-media-consent-link", () => ({
  sendEmployeePublicMediaConsentLinkNotification: mocks.sendNotification,
}));

import { POST } from "./route";

const context = {
  params: Promise.resolve({ vendorId: "vendor-1", membershipId: "membership-1" }),
};

describe("Vendor Employee participation-link route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireVendorManager.mockResolvedValue({ userId: "manager-1" });
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-1",
      vendorId: "vendor-1",
      userId: "employee-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: { name: "Employee", email: "employee@example.com", phone: null },
      vendor: { name: "Vendor", businessName: "Vendor LLC" },
    });
    mocks.createToken.mockReturnValue("signed-participation-token");
    mocks.appendToken.mockReturnValue("https://beta.example/employee/public-media-consent?pct=redacted");
    mocks.sendNotification.mockResolvedValue({
      anySuccess: true,
      channels: [{ channel: "email", attempted: true, success: true }],
    });
  });

  it("sends a short-lived link without returning the bearer token to the Manager", async () => {
    const response = await POST(new Request("https://beta.example/api/vendors/vendor-1/memberships/membership-1/public-media-consent-link", {
      method: "POST",
      body: JSON.stringify({ decision: "ALLOW" }),
    }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("token");
    expect(body).not.toHaveProperty("participationLink");
    expect(mocks.createToken).toHaveBeenCalledWith({
      vendorId: "vendor-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });
    expect(mocks.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "manager-1",
      membershipId: "membership-1",
      employeeEmail: "employee@example.com",
    }));
  });

  it.each(["PENDING", "REMOVED", "REVOKED"])("does not issue a link for %s membership", async (status) => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-1",
      vendorId: "vendor-1",
      userId: "employee-1",
      role: "EMPLOYEE",
      status,
      user: { name: "Employee", email: "employee@example.com", phone: null },
      vendor: { name: "Vendor", businessName: "Vendor LLC" },
    });
    const response = await POST(new Request("https://beta.example/api/vendors/vendor-1/memberships/membership-1/public-media-consent-link", {
      method: "POST",
    }), context);

    expect(response.status).toBe(422);
    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
