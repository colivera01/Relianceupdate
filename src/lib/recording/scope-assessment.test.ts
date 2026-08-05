import { describe, expect, it } from "vitest";

import { deriveRecordingScopeAssessment, parseRecordingScopeAssessmentInput } from "./scope-assessment";

describe("recording subject assessment", () => {
  it("allows vendor authorization only for controlled vendor-owned property with no people or sensitive capture", () => {
    const parsed = parseRecordingScopeAssessmentInput({
      recordingLocation: "business",
      propertyScope: "vendor_owned",
      peopleScope: "none",
      frameControl: "controlled",
      authorityHolderType: "vendor_manager",
      serviceCanContinueWithoutRecording: true,
    });
    expect(parsed).not.toBeNull();
    const result = deriveRecordingScopeAssessment(parsed!);
    expect(result).toMatchObject({
      riskLevel: "LEVEL_1",
      permissionRequired: false,
      noticeRequired: true,
      audioAllowed: false,
    });
    expect(result.authorityRequirements).toEqual([
      { authorityType: "VENDOR_MANAGER", status: "VERIFIED", required: true },
    ]);
  });

  it.each(["residence", "customer-business"] as const)(
    "always requires affirmative customer authority at %s",
    (recordingLocation) => {
      const result = deriveRecordingScopeAssessment({
        recordingLocation,
        propertyScope: "customer_owned",
        peopleScope: "none",
        frameControl: "controlled",
        minorMayAppear: false,
        protectedNonParticipantMayAppear: false,
        sensitiveInformationMayAppear: false,
        identifiersMayAppear: false,
        residenceInterior: recordingLocation === "residence",
        businessInterior: recordingLocation === "customer-business",
        audioRequested: false,
        authorityHolderType: "authorized_representative",
        serviceCanContinueWithoutRecording: true,
        essentialPrivateRecording: false,
      });
      expect(result.permissionRequired).toBe(true);
      expect(result.authorityRequirements).toContainEqual({
        authorityType: "CUSTOMER_OR_REPRESENTATIVE",
        status: "PENDING",
        required: true,
      });
    },
  );

  it("raises uncontrolled minor capture to Level 4 and requires guardian authority", () => {
    const result = deriveRecordingScopeAssessment({
      recordingLocation: "business",
      propertyScope: "vendor_owned",
      peopleScope: "multiple",
      frameControl: "uncontrolled",
      minorMayAppear: true,
      protectedNonParticipantMayAppear: true,
      sensitiveInformationMayAppear: false,
      identifiersMayAppear: false,
      residenceInterior: false,
      businessInterior: true,
      audioRequested: false,
      authorityHolderType: "guardian",
      serviceCanContinueWithoutRecording: true,
      essentialPrivateRecording: false,
    });
    expect(result.riskLevel).toBe("LEVEL_4");
    expect(result.permissionRequired).toBe(true);
    expect(result.authorityRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ authorityType: "VERIFIED_GUARDIAN", status: "PENDING" }),
      expect.objectContaining({ authorityType: "PROTECTED_NON_PARTICIPANT", status: "PENDING" }),
    ]));
  });

  it("produces a stable scope hash and never enables audio", () => {
    const input = parseRecordingScopeAssessmentInput({
      recordingLocation: "business",
      propertyScope: "vendor_owned",
      peopleScope: "employee",
      frameControl: "controlled",
      authorityHolderType: "vendor_manager",
      audioRequested: true,
      serviceCanContinueWithoutRecording: true,
    });
    const first = deriveRecordingScopeAssessment(input!);
    const second = deriveRecordingScopeAssessment(input!);
    expect(first.scopeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.scopeHash).toBe(first.scopeHash);
    expect(first.audioRequested).toBe(false);
    expect(first.audioAllowed).toBe(false);
  });
});
