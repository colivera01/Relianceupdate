import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendEmployeeCaptureToken,
  createEmployeeCaptureToken,
  readEmployeeCaptureToken,
  verifyEmployeeCaptureToken,
} from "@/lib/employee-capture-token";

vi.mock("@/server/db", () => ({
  prisma: {},
}));

describe("employee capture token", () => {
  beforeEach(() => {
    process.env.EMPLOYEE_CAPTURE_TOKEN_SECRET = "unit-test-secret";
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
});
