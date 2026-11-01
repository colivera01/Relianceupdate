import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const assertRoleAssent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/legal/role-assent-service", () => ({
  assertCurrentEmployeeRoleAssent: assertRoleAssent,
}));

import { assertV2EmployeeServiceOrderEntry } from "./employee-v2-service-order-entry";

const tokenAccess = {
  userId: "employee-user",
  vendorId: "vendor-1",
  membershipId: "membership-1",
  bookingId: "booking-1",
} as any;

function db(contractVersion = "recording-assessment-v4-multiscope-safety-v1") {
  return {
    recordingScopeAssessment: {
      findFirst: vi.fn().mockResolvedValue({ contractVersion }),
    },
  };
}

describe("V2 Employee Service Order legal-assent gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEGAL_ROLE_ASSENT_BETA_ENABLED", "false");
    assertRoleAssent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the current Service Order entry for V2", async () => {
    await expect(assertV2EmployeeServiceOrderEntry({
      db: db(),
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess: null,
    })).rejects.toThrow("EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED");
    expect(assertRoleAssent).not.toHaveBeenCalled();
  });

  it("requires current exact Employee legal assent before V2 runtime entry", async () => {
    assertRoleAssent.mockRejectedValue(new Error("EMPLOYEE_ROLE_ASSENT_REQUIRED"));
    await expect(assertV2EmployeeServiceOrderEntry({
      db: db(),
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess,
    })).rejects.toThrow("EMPLOYEE_ROLE_ASSENT_REQUIRED");
    expect(assertRoleAssent).toHaveBeenCalledWith({
      db: expect.any(Object),
      userId: "employee-user",
      membershipId: "membership-1",
      bookingId: "booking-1",
    });
  });

  it("preserves the historical non-V2 entry contract", async () => {
    await expect(assertV2EmployeeServiceOrderEntry({
      db: db("recording-assessment-simplified-v1"),
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess: null,
    })).resolves.toBeUndefined();
    expect(assertRoleAssent).not.toHaveBeenCalled();
  });

  it("requires the secure Service Order entry for compatibility orders while beta legal assent is enabled", async () => {
    vi.stubEnv("LEGAL_ROLE_ASSENT_BETA_ENABLED", "true");

    await expect(assertV2EmployeeServiceOrderEntry({
      db: db("recording-assessment-simplified-v1"),
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess: null,
    })).rejects.toThrow("EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED");
    expect(assertRoleAssent).not.toHaveBeenCalled();
  });

  it("requires current legal assent for compatibility orders entered through the secure link", async () => {
    vi.stubEnv("LEGAL_ROLE_ASSENT_BETA_ENABLED", "true");
    assertRoleAssent.mockRejectedValue(new Error("EMPLOYEE_ROLE_ASSENT_REQUIRED"));

    await expect(assertV2EmployeeServiceOrderEntry({
      db: db("recording-assessment-simplified-v1"),
      bookingId: "booking-1",
      vendorId: "vendor-1",
      tokenAccess,
    })).rejects.toThrow("EMPLOYEE_ROLE_ASSENT_REQUIRED");
    expect(assertRoleAssent).toHaveBeenCalledWith({
      db: expect.any(Object),
      userId: "employee-user",
      membershipId: "membership-1",
      bookingId: "booking-1",
    });
  });
});
