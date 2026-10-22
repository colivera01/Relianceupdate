import { describe, expect, it } from "vitest";

import {
  buildEmployeeServiceOrderSteps,
  employeeStageLockCopy,
} from "./employee-service-order-guidance";

describe("Employee Service Order guidance", () => {
  it("puts the Service Order agreement before recording participation", () => {
    const steps = buildEmployeeServiceOrderSteps({
      legalAssentCurrent: false,
      participationStatus: "REQUIRED",
      safetyAndLocationComplete: false,
      completedStageCount: 0,
      totalStageCount: 3,
    });

    expect(steps.map((step) => step.label)).toEqual([
      "Service Order agreement",
      "Recording participation for this job",
      "Safety and location check",
      "Record three short videos",
    ]);
    expect(steps.map((step) => step.state)).toEqual(["current", "waiting", "waiting", "waiting"]);
  });

  it("advances through participation, safety, and all three videos", () => {
    const participation = buildEmployeeServiceOrderSteps({
      legalAssentCurrent: true,
      participationStatus: "REQUIRED",
      safetyAndLocationComplete: false,
      completedStageCount: 0,
      totalStageCount: 3,
    });
    expect(participation.map((step) => step.state)).toEqual(["complete", "current", "waiting", "waiting"]);

    const safety = buildEmployeeServiceOrderSteps({
      legalAssentCurrent: true,
      participationStatus: "ALLOWED",
      safetyAndLocationComplete: false,
      completedStageCount: 0,
      totalStageCount: 3,
    });
    expect(safety.map((step) => step.state)).toEqual(["complete", "complete", "current", "waiting"]);

    const videos = buildEmployeeServiceOrderSteps({
      legalAssentCurrent: true,
      participationStatus: "ALLOWED",
      safetyAndLocationComplete: true,
      completedStageCount: 2,
      totalStageCount: 3,
    });
    expect(videos.map((step) => step.state)).toEqual(["complete", "complete", "complete", "current"]);
    expect(videos[3].detail).toContain("2 of 3 videos saved");
  });

  it("uses the exact current lock reason instead of claiming manager review", () => {
    expect(employeeStageLockCopy({
      legalAssentCurrent: false,
      correctionRequested: false,
      awaitingManagerReview: false,
      canonicalResolution: "Verify recording participation.",
    })).toBe("Complete the Service Order agreement above before choosing recording participation.");

    expect(employeeStageLockCopy({
      legalAssentCurrent: true,
      correctionRequested: false,
      awaitingManagerReview: false,
      canonicalResolution: "Verify recording participation.",
    })).toBe("Recording controls are locked. Verify recording participation.");

    expect(employeeStageLockCopy({
      legalAssentCurrent: true,
      correctionRequested: false,
      awaitingManagerReview: true,
      canonicalResolution: null,
    })).toBe("Uploads are locked while manager review is pending.");
  });
});
