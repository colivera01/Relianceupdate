import { describe, expect, it } from "vitest";
import {
  getEmployeeRuntimeErrorResponse,
  isPausedEmployeeDatabaseError,
} from "@/lib/employee-runtime-errors";

describe("employee runtime errors", () => {
  it("detects the paused Azure free-tier database message", () => {
    const error = new Error(
      "ERROR 42119: This database has reached the monthly free amount allowance for the month of May 2026 and is paused for the remainder of the month."
    );

    expect(isPausedEmployeeDatabaseError(error)).toBe(true);
  });

  it("returns a temporary unavailable response for paused database failures", () => {
    const response = getEmployeeRuntimeErrorResponse(
      "jobs",
      new Error("This database has reached the monthly free amount allowance and is paused for the remainder of the month.")
    );

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("EMPLOYEE_RUNTIME_TEMPORARILY_UNAVAILABLE");
    expect(response.body.error).toContain("temporarily unavailable");
  });

  it("keeps non-database errors as normal route failures", () => {
    const response = getEmployeeRuntimeErrorResponse(
      "pair",
      new Error("Unexpected null membership")
    );

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Failed to pair employee device");
    expect(response.body.details).toBe("Unexpected null membership");
  });
});
