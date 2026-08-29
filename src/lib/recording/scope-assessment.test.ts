import { describe, expect, it, vi } from "vitest";

import {
  createRecordingScopeAssessment,
  deriveRecordingScopeAssessment,
  parseRecordingScopeAssessmentInput,
  SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
  SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
  SIMPLIFIED_V1_PROHIBITED_CONDITIONS,
} from "./scope-assessment";

const LOCATION_HASH = "a".repeat(64);
const COMPLETED_AT = new Date("2026-08-29T14:00:00.000Z");
const context = (generation = 1) => ({
  locationSnapshotEvidenceHash: LOCATION_HASH,
  generation,
  completedByUserId: "manager-1",
  completedAt: COMPLETED_AT,
});

describe("simplified V1 work-record recording scope", () => {
  it("derives safe vendor-business scope without customer permission", () => {
    const parsed = parseRecordingScopeAssessmentInput({
      recordingLocation: "business",
      intentionalParticipantPlan: "none",
      audioRequested: false,
    });
    expect(parsed).not.toBeNull();
    const result = deriveRecordingScopeAssessment(parsed!, context());
    expect(result).toMatchObject({
      contractVersion: SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
      siteControl: "vendor_controlled_business_location",
      intentionalParticipantPlan: "none",
      recordingBoundary: "service_area_equipment_item_and_work",
      permissionRequired: false,
      authorityHolderType: "vendor_manager",
      riskLevel: "LEVEL_1",
    });
    expect(result.authorityRequirements).toEqual([
      { authorityType: "VENDOR_MANAGER", status: "VERIFIED", required: true },
    ]);
  });

  it.each([
    ["residence", "customer_controlled_residence"],
    ["customer-business", "customer_controlled_business_location"],
  ] as const)("requires customer permission at %s", (recordingLocation, siteControl) => {
    const result = deriveRecordingScopeAssessment(
      { recordingLocation, intentionalParticipantPlan: "none", audioRequested: false },
      context(),
    );
    expect(result).toMatchObject({ permissionRequired: true, siteControl, authorityHolderType: "customer" });
    expect(result.authorityRequirements).toContainEqual({
      authorityType: "CUSTOMER",
      status: "PENDING",
      required: true,
    });
  });

  it("requires customer permission for intentional customer likeness at vendor business", () => {
    const result = deriveRecordingScopeAssessment(
      { recordingLocation: "business", intentionalParticipantPlan: "customer", audioRequested: false },
      context(),
    );
    expect(result.permissionRequired).toBe(true);
    expect(result.authorityRequirements).toContainEqual(
      expect.objectContaining({ authorityType: "CUSTOMER_LIKENESS" }),
    );
  });

  it("does not treat an assigned professional alone as a customer-permission trigger", () => {
    const result = deriveRecordingScopeAssessment(
      {
        recordingLocation: "business",
        intentionalParticipantPlan: "assigned_service_professional",
        audioRequested: true,
      },
      context(),
    );
    expect(result.permissionRequired).toBe(false);
    expect(result.audioAllowed).toBe(true);
    expect(result.authorityRequirements).toContainEqual(
      expect.objectContaining({ authorityType: "EMPLOYEE_LIKENESS" }),
    );
  });

  it("does not serialize removed predictive fields as false facts", () => {
    const result = deriveRecordingScopeAssessment(
      { recordingLocation: "business", intentionalParticipantPlan: "none", audioRequested: false },
      context(),
    );
    expect(result.subjectJson).not.toMatch(
      /minorMayAppear|protectedNonParticipantMayAppear|sensitiveInformationMayAppear|identifiersMayAppear|propertyScope|frameControl/,
    );
    expect(JSON.parse(result.subjectJson).prohibitedConditions).toEqual(
      SIMPLIFIED_V1_PROHIBITED_CONDITIONS,
    );
  });

  it("binds location, generation, actor, timestamp, participants, boundary, and audio into the hash", () => {
    const input = {
      recordingLocation: "business" as const,
      intentionalParticipantPlan: "none" as const,
      audioRequested: false,
    };
    const baseline = deriveRecordingScopeAssessment(input, context());
    expect(baseline.scopeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(deriveRecordingScopeAssessment(input, context()).scopeHash).toBe(baseline.scopeHash);
    expect(deriveRecordingScopeAssessment({ ...input, audioRequested: true }, context()).scopeHash).not.toBe(baseline.scopeHash);
    expect(deriveRecordingScopeAssessment(input, context(2)).scopeHash).not.toBe(baseline.scopeHash);
    expect(JSON.parse(baseline.scopeJson)).toMatchObject({
      contractVersion: SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
      assessment: { generation: 1, completedByUserId: "manager-1", completedAt: COMPLETED_AT.toISOString() },
      location: { type: "business", snapshotEvidenceHash: LOCATION_HASH },
    });
  });

  it("fails closed without intentional participants or valid immutable location evidence", () => {
    expect(parseRecordingScopeAssessmentInput({ recordingLocation: "business" })).toBeNull();
    expect(() =>
      deriveRecordingScopeAssessment(
        { recordingLocation: "business", intentionalParticipantPlan: "none", audioRequested: false },
        { ...context(), locationSnapshotEvidenceHash: "invalid" },
      ),
    ).toThrow(/location snapshot hash/i);
  });

  it("writes the explicit contract and uses not-applicable legacy columns", async () => {
    const assessment = deriveRecordingScopeAssessment(
      { recordingLocation: "business", intentionalParticipantPlan: "none", audioRequested: false },
      context(),
    );
    const create = vi.fn().mockResolvedValue({ id: "assessment-current-v1" });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    await createRecordingScopeAssessment({
      tx: { recordingScopeAssessment: { create }, recordingAuthorityRequirement: { createMany } },
      bookingId: "booking-1",
      vendorId: "vendor-1",
      completedByUserId: "manager-1",
      assessment,
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      contractVersion: SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
      propertyScope: SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
      peopleScope: SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
      frameControl: SIMPLIFIED_V1_LEGACY_FIELD_SENTINEL,
      completedAt: COMPLETED_AT,
    });
  });
});
