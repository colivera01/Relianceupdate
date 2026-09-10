import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmployeeCaptureToken } from "@/lib/employee-capture-token";
import {
  appendEmployeePublicMediaConsentToken,
  createEmployeePublicMediaConsentToken,
  resolveEmployeePublicMediaConsentAccess,
  verifyEmployeePublicMediaConsentToken,
} from "@/lib/employee-public-media-consent-token";

const db = vi.hoisted(() => ({ membershipFindUnique: vi.fn() }));

vi.mock("@/server/db", () => ({
  prisma: { vendorMembership: { findUnique: db.membershipFindUnique } },
}));

describe("Employee Public Media Consent access token", () => {
  beforeEach(() => {
    process.env.EMPLOYEE_CAPTURE_TOKEN_SECRET = "unit-test-secret";
    db.membershipFindUnique.mockReset();
  });

  it("creates a short-lived membership-bound token distinct from a Service Order token", () => {
    const participation = createEmployeePublicMediaConsentToken({
      vendorId: "vendor-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });
    const capture = createEmployeeCaptureToken({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
    });

    expect(verifyEmployeePublicMediaConsentToken(participation)).toMatchObject({
      purpose: "employee-public-media-consent",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });
    expect(verifyEmployeePublicMediaConsentToken(capture)).toBeNull();
    expect(appendEmployeePublicMediaConsentToken("/employee/public-media-consent", participation))
      .toContain("/employee/public-media-consent?pct=");
  });

  it.each(["PENDING", "REMOVED", "REVOKED"])(
    "rejects a %s Employee membership",
    async (status) => {
      db.membershipFindUnique.mockResolvedValue({
        id: "membership-1",
        vendorId: "vendor-1",
        userId: "employee-1",
        role: "EMPLOYEE",
        status,
        user: { name: "Employee", accountStatus: "ACTIVE" },
        vendor: { name: "Vendor", businessName: "Vendor LLC", accountStatus: "ACTIVE" },
      });
      const token = createEmployeePublicMediaConsentToken({
        vendorId: "vendor-1",
        membershipId: "membership-1",
        userId: "employee-1",
      });

      await expect(resolveEmployeePublicMediaConsentAccess(new Request(
        `http://localhost/employee/public-media-consent?pct=${encodeURIComponent(token)}`,
      ))).resolves.toBeNull();
    },
  );

  it("resolves only the exact active Employee, Vendor, and membership identity", async () => {
    db.membershipFindUnique.mockResolvedValue({
      id: "membership-1",
      vendorId: "vendor-1",
      userId: "employee-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: { name: "Bradley Coopers", accountStatus: "ACTIVE" },
      vendor: { name: "Electro", businessName: "Electro LLC", accountStatus: "ACTIVE" },
    });
    const token = createEmployeePublicMediaConsentToken({
      vendorId: "vendor-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });

    await expect(resolveEmployeePublicMediaConsentAccess(new Request(
      "http://localhost/employee/public-media-consent",
      { headers: { "x-employee-public-media-consent-token": token } },
    ))).resolves.toMatchObject({
      vendorId: "vendor-1",
      membershipId: "membership-1",
      userId: "employee-1",
      employeeName: "Bradley Coopers",
      vendorName: "Electro LLC",
    });
  });
});
