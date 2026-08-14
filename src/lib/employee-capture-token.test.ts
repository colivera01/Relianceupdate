import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendEmployeeCaptureToken,
  createEmployeeCaptureToken,
  readEmployeeCaptureToken,
  resolveEmployeeCaptureAccess,
  verifyEmployeeCaptureToken,
} from "@/lib/employee-capture-token";

const db = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  bookingFindFirst: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: { findUnique: db.membershipFindUnique },
    booking: { findFirst: db.bookingFindFirst },
  },
}));

describe("employee capture token", () => {
  beforeEach(() => {
    process.env.EMPLOYEE_CAPTURE_TOKEN_SECRET = "unit-test-secret";
    db.membershipFindUnique.mockReset();
    db.bookingFindFirst.mockReset();
  });

  it("creates and verifies a scoped employee capture token", () => {
    const token = createEmployeeCaptureToken({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
    });

    expect(verifyEmployeeCaptureToken(token)).toMatchObject({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
      version: 1,
    });
  });

  it("reads capture tokens from headers and query params", () => {
    const headerRequest = new Request("http://localhost/employee/jobs", {
      headers: { "x-employee-capture-token": "token-from-header" },
    });
    const queryRequest = new Request("http://localhost/employee/jobs?ct=token-from-query");

    expect(readEmployeeCaptureToken(headerRequest)).toBe("token-from-header");
    expect(readEmployeeCaptureToken(queryRequest)).toBe("token-from-query");
  });

  it("appends the token to existing employee job links", () => {
    expect(appendEmployeeCaptureToken("/employee/jobs?jobId=job-1", "token-1")).toBe(
      "/employee/jobs?jobId=job-1&ct=token-1"
    );
  });

  it("rejects an otherwise valid stale employee link after the Service Order is canceled", async () => {
    db.membershipFindUnique.mockResolvedValue({
      id: "membership-1",
      vendorId: "vendor-1",
      userId: "employee-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: { name: "Employee", accountStatus: "ACTIVE" },
      vendor: { accountStatus: "ACTIVE" },
    });
    db.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      status: "CANCELED",
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
      }),
    });
    const token = createEmployeeCaptureToken({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
    });

    await expect(
      resolveEmployeeCaptureAccess(
        new Request(`http://localhost/employee/jobs?ct=${encodeURIComponent(token)}`),
        { vendorId: "vendor-1", bookingId: "booking-1" },
      ),
    ).resolves.toBeNull();
  });

  it("preserves signed employee-link access for an active assigned Service Order", async () => {
    db.membershipFindUnique.mockResolvedValue({
      id: "membership-1",
      vendorId: "vendor-1",
      userId: "employee-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
      user: { name: "Employee", accountStatus: "ACTIVE" },
      vendor: { accountStatus: "ACTIVE" },
    });
    db.bookingFindFirst.mockResolvedValue({
      id: "booking-1",
      status: "PENDING",
      customerMetadata: JSON.stringify({
        vendor_job_assigned_membership_ids: ["membership-1"],
      }),
    });
    const token = createEmployeeCaptureToken({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
    });

    await expect(
      resolveEmployeeCaptureAccess(
        new Request(`http://localhost/employee/jobs?ct=${encodeURIComponent(token)}`),
        { vendorId: "vendor-1", bookingId: "booking-1" },
      ),
    ).resolves.toMatchObject({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
      userId: "employee-1",
    });
  });
});
