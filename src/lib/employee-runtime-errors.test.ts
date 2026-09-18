import { describe, expect, it } from "vitest";
import {
  getEmployeeDecisionErrorResponse,
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
    expect(response.body.error).toBe("Failed to prepare employee phone");
    expect(response.body).not.toHaveProperty("details");
  });

  it("maps stale V2 decision context to a safe reload response", () => {
    const response = getEmployeeDecisionErrorResponse(
      new Error("EMPLOYEE_RECORDING_PARTICIPATION_CONTEXT_STALE"),
    );
    expect(response).toMatchObject({
      status: 409,
      body: {
        code: "EMPLOYEE_SERVICE_ORDER_CONTEXT_CHANGED",
        staleContext: true,
      },
    });
    expect(response.body.error).not.toContain("PARTICIPATION_CONTEXT_STALE");
  });
});
