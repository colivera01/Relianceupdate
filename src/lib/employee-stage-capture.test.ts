import { describe, expect, it } from "vitest";

import {
  getCompletedEmployeeCaptureCount,
  getEmployeeCaptureActionLabel,
  getEmployeeCaptureDeviceLabel,
  getEmployeeCaptureStageHeading,
  getEmployeeCaptureSupportCopy,
  getEmployeeStageStep,
  getNextEmployeeCaptureStage,
} from "@/lib/employee-stage-capture";

describe("employee-stage-capture", () => {
  it("picks the next incomplete stage in order", () => {
    expect(
      getNextEmployeeCaptureStage({
        INTRO: false,
        IN_PROGRESS: false,
        COMPLETED: false,
      })
    ).toBe("INTRO");

    expect(
      getNextEmployeeCaptureStage({
        INTRO: true,
        IN_PROGRESS: false,
        COMPLETED: false,
      })
    ).toBe("IN_PROGRESS");

    expect(
      getNextEmployeeCaptureStage({
        INTRO: true,
        IN_PROGRESS: true,
        COMPLETED: false,
      })
    ).toBe("COMPLETED");
  });

  it("falls back to completed when all stages are already done", () => {
    expect(
      getNextEmployeeCaptureStage({
        INTRO: true,
        IN_PROGRESS: true,
        COMPLETED: true,
      })
    ).toBe("COMPLETED");
  });

  it("returns helpful stage labels and action copy", () => {
    expect(getEmployeeStageStep("INTRO")).toBe(1);
    expect(getEmployeeStageStep("IN_PROGRESS")).toBe(2);
    expect(getEmployeeStageStep("COMPLETED")).toBe(3);
    expect(getEmployeeCaptureStageHeading("INTRO")).toBe("Capture the before view");
    expect(getEmployeeCaptureActionLabel("INTRO", false)).toBe("Record Before");
    expect(getEmployeeCaptureActionLabel("COMPLETED", true)).toBe("Retake Completed");
  });

  it("counts completed stages correctly", () => {
    expect(
      getCompletedEmployeeCaptureCount({
        INTRO: true,
        IN_PROGRESS: false,
        COMPLETED: true,
      })
    ).toBe(2);
  });

  it("describes capture source for current and future devices", () => {
    expect(
      getEmployeeCaptureDeviceLabel({
        deviceType: "PHONE",
      })
    ).toBe("This phone");
    expect(
      getEmployeeCaptureDeviceLabel({
        deviceType: "HEADSET",
      })
    ).toBe("Headset capture");
    expect(
      getEmployeeCaptureSupportCopy({
        deviceType: "HEADSET",
      })
    ).toContain("hands-free");
    expect(
      getEmployeeCaptureSupportCopy({
        deviceType: "PHONE",
      })
    ).toContain("phone camera");
  });
});
