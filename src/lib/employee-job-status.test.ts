import { describe, expect, it } from "vitest";
import { normalizeEmployeeJobStatusLabel, shouldShowEmployeeStartButton } from "@/lib/employee-job-status";

describe("employee job status helpers", () => {
  it("maps confirmed jobs to the in-progress label used by the employee UI", () => {
    expect(normalizeEmployeeJobStatusLabel("CONFIRMED")).toBe("In Progress");
    expect(normalizeEmployeeJobStatusLabel("IN_PROGRESS")).toBe("In Progress");
  });

  it("only shows the start button for pending jobs", () => {
    expect(shouldShowEmployeeStartButton("PENDING")).toBe(true);
    expect(shouldShowEmployeeStartButton("CONFIRMED")).toBe(false);
    expect(shouldShowEmployeeStartButton("IN_PROGRESS")).toBe(false);
    expect(shouldShowEmployeeStartButton("AWAITING_REVIEW")).toBe(false);
    expect(shouldShowEmployeeStartButton("COMPLETED")).toBe(false);
  });
});
