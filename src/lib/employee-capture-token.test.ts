import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendEmployeeCaptureToken,
  createEmployeeCaptureToken,
  readEmployeeCaptureToken,
  resolveEmployeeCaptureAccess,
  verifyEmployeeCaptureToken,
} from "@/lib/employee-capture-token";
import { assertV2EmployeeServiceOrderEntry } from "@/lib/recording/employee-v2-service-order-entry";

const db = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  bookingFindFirst: vi.fn(),
  assessmentFindFirst: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    vendorMembership: { findUnique: db.membershipFindUnique },
    booking: { findFirst: db.bookingFindFirst },
    recordingScopeAssessment: { findFirst: db.assessmentFindFirst },
  },
}));

describe("employee capture token", () => {
  beforeEach(() => {
    process.env.EMPLOYEE_CAPTURE_TOKEN_SECRET = "unit-test-secret";
    db.membershipFindUnique.mockReset();
    db.bookingFindFirst.mockReset();
    db.assessmentFindFirst.mockReset();
    db.assessmentFindFirst.mockResolvedValue(null);
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

  it("creates a contextual Service Order token for the exact assignment and assessment", () => {
    const token = createEmployeeCaptureToken({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
      context: {
        assignmentGeneration: 3,
        assessmentId: "assessment-v2",
        assessmentGeneration: 4,
        scopeHash: "a".repeat(64),
      },
    });

    expect(verifyEmployeeCaptureToken(token)).toMatchObject({
      version: 2,
      assignmentGeneration: 3,
      assessmentId: "assessment-v2",
      assessmentGeneration: 4,
      scopeHash: "a".repeat(64),
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

  it("accepts a V2 link only for the exact current released recording context", async () => {
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
        vendor_job_assignment_generation: 3,
        vendor_job_service_order_released_membership_ids: ["membership-1"],
        vendor_job_service_order_release_contexts: {
          "membership-1": {
            version: 2,
            assignmentGeneration: 3,
            assessmentId: "assessment-v2",
            assessmentGeneration: 4,
            scopeHash: "a".repeat(64),
          },
        },
      }),
    });
    db.assessmentFindFirst.mockResolvedValue({
      id: "assessment-v2",
      generation: 4,
      scopeHash: "a".repeat(64),
      contractVersion: "recording-assessment-v4-multiscope-safety-v1",
    });
    const token = createEmployeeCaptureToken({
      vendorId: "vendor-1",
      bookingId: "booking-1",
      membershipId: "membership-1",
      context: {
        assignmentGeneration: 3,
        assessmentId: "assessment-v2",
        assessmentGeneration: 4,
        scopeHash: "a".repeat(64),
      },
    });

    await expect(resolveEmployeeCaptureAccess(
      new Request(`http://localhost/employee/jobs?ct=${encodeURIComponent(token)}`),
    )).resolves.toMatchObject({ membershipId: "membership-1", token: { version: 2 } });
  });

  it.each([
    ["legacy token", null],
    ["stale scope", "b".repeat(64)],
  ])("rejects a V2 %s after the exact release context changes", async (_label, tokenScope) => {
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
        vendor_job_assignment_generation: 3,
        vendor_job_service_order_released_membership_ids: ["membership-1"],
        vendor_job_service_order_release_contexts: {
          "membership-1": {
            version: 2,
            assignmentGeneration: 3,
            assessmentId: "assessment-v2",
            assessmentGeneration: 4,
            scopeHash: "a".repeat(64),
          },
        },
      }),
    });
    db.assessmentFindFirst.mockResolvedValue({
      id: "assessment-v2",
      generation: 4,
      scopeHash: "a".repeat(64),
      contractVersion: "recording-assessment-v4-multiscope-safety-v1",
    });
    const token = tokenScope
      ? createEmployeeCaptureToken({
          vendorId: "vendor-1",
          bookingId: "booking-1",
          membershipId: "membership-1",
          context: {
            assignmentGeneration: 3,
            assessmentId: "assessment-v2",
            assessmentGeneration: 4,
            scopeHash: tokenScope,
          },
        })
      : createEmployeeCaptureToken({
          vendorId: "vendor-1",
          bookingId: "booking-1",
          membershipId: "membership-1",
        });

    await expect(resolveEmployeeCaptureAccess(
      new Request(`http://localhost/employee/jobs?ct=${encodeURIComponent(token)}`),
    )).resolves.toBeNull();
  });

  it("requires a verified Service Order entry for V2 Employee runtime actions", async () => {
    const runtimeDb = {
      recordingScopeAssessment: {
        findFirst: vi.fn().mockResolvedValue({
          contractVersion: "recording-assessment-v4-multiscope-safety-v1",
        }),
      },
    };
    await expect(assertV2EmployeeServiceOrderEntry({
      db: runtimeDb,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess: null,
    })).rejects.toThrow("EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED");
    await expect(assertV2EmployeeServiceOrderEntry({
      db: runtimeDb,
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess: { membershipId: "membership-1" } as any,
    })).resolves.toBeUndefined();
  });
});
