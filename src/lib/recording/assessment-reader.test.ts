import { describe, expect, it } from "vitest";

import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  RecordingAssessmentV2ValidationError,
} from "./assessment-v2";
import { interpretRecordingAssessment } from "./assessment-reader";
import { SIMPLIFIED_V1_ASSESSMENT_SCHEMA_VERSION } from "./scope-assessment";
import {
  deriveRecordingScopeAssessment,
  SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
} from "./scope-assessment";

function v2Evidence() {
  const canonical = parseRecordingAssessmentV2({
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    location: {
      type: "VENDOR_BUSINESS",
      snapshotEvidenceHash: "a".repeat(64),
    },
    intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
    expectedPeople: ["NO_IDENTIFIABLE_PEOPLE"],
    recordingFormat: "VIDEO_ONLY",
    recordingArea: { boundary: "SERVICE_AREA_ONLY" },
  });
  return {
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    scopeJson: canonical.scopeJson,
    subjectJson: canonical.subjectJson,
    scopeHash: canonical.scopeHash,
  };
}

describe("recording assessment version-aware reader", () => {
  it("validates the explicit simplified work-scope contract without legacy risk facts", () => {
    const canonical = deriveRecordingScopeAssessment(
      {
        recordingLocation: "customer-business",
        intentionalParticipantPlan: "customer_and_assigned_service_professional",
        audioRequested: true,
      },
      {
        locationSnapshotEvidenceHash: "b".repeat(64),
        generation: 2,
        completedByUserId: "manager-1",
        completedAt: new Date("2026-08-29T15:00:00.000Z"),
      },
    );
    const result = interpretRecordingAssessment({
      contractVersion: SIMPLIFIED_V1_ASSESSMENT_CONTRACT_VERSION,
      scopeJson: canonical.scopeJson,
      subjectJson: canonical.subjectJson,
      scopeHash: canonical.scopeHash,
      propertyScope: "not_applicable",
      peopleScope: "not_applicable",
      frameControl: "not_applicable",
      audioRequested: true,
      audioAllowed: true,
    });
    expect(result).toMatchObject({
      kind: "SIMPLIFIED_V1",
      canonical: {
        siteControl: "customer_controlled_business_location",
        intentionalParticipantPlan: "customer_and_assigned_service_professional",
        audioEnabled: true,
        permissionRequired: true,
        generation: 2,
      },
    });
    if (result.kind !== "SIMPLIFIED_V1") {
      throw new Error("Expected a simplified V1 assessment");
    }
    expect(result.subjectJson).not.toContain("minorMayAppear");
  });
  it("uses canonical scopeJson for an explicitly versioned V2 row", () => {
    const result = interpretRecordingAssessment(v2Evidence());
    expect(result.kind).toBe("V2");
    expect(result.contractVersion).toBe(RECORDING_ASSESSMENT_V2_CONTRACT_VERSION);
  });

  it("fails closed when explicit V2 evidence is non-canonical or hash-mismatched", () => {
    const evidence = v2Evidence();
    expect(() =>
      interpretRecordingAssessment({ ...evidence, scopeJson: ` ${evidence.scopeJson}` }),
    ).toThrowError(RecordingAssessmentV2ValidationError);
    expect(() =>
      interpretRecordingAssessment({ ...evidence, scopeHash: "0".repeat(64) }),
    ).toThrowError(RecordingAssessmentV2ValidationError);
    expect(() =>
      interpretRecordingAssessment({ ...evidence, subjectJson: "{}" }),
    ).toThrowError(RecordingAssessmentV2ValidationError);
  });

  it("dispatches a NULL-version current package-audio row without changing its evidence", () => {
    const scopeJson = JSON.stringify({
      schemaVersion: SIMPLIFIED_V1_ASSESSMENT_SCHEMA_VERSION,
      audioEnabled: true,
    });
    const row = {
      contractVersion: null,
      scopeJson,
      subjectJson: JSON.stringify({ protectedNonParticipantMayAppear: true }),
      scopeHash: "historical-v3-hash",
      propertyScope: "customer_owned",
      peopleScope: "multiple",
      frameControl: "partial",
      audioRequested: true,
      audioAllowed: true,
    };
    const result = interpretRecordingAssessment(row);
    expect(result).toMatchObject({
      kind: "CURRENT_V3",
      contractVersion: null,
      scopeSchemaVersion: SIMPLIFIED_V1_ASSESSMENT_SCHEMA_VERSION,
      scopeJson,
      subjectJson: row.subjectJson,
      scopeHash: "historical-v3-hash",
      subjectEvidence: { protectedNonParticipantMayAppear: true },
      scalarEvidence: {
        propertyScope: "customer_owned",
        peopleScope: "multiple",
        peopleSummary: "Multiple people — historical assessment",
        frameControl: "partial",
        audioRequested: true,
        audioAllowed: true,
      },
    });
  });

  it("keeps a legacy Video-only assessment under its historical contract", () => {
    const scopeJson = JSON.stringify({ schemaVersion: "recording-assessment-v1" });
    const result = interpretRecordingAssessment({
      contractVersion: null,
      scopeJson,
      subjectJson: JSON.stringify({ minorMayAppear: false }),
      scopeHash: "legacy-scope-hash",
      peopleScope: "none",
      audioRequested: false,
      audioAllowed: false,
    });
    expect(result).toMatchObject({
      kind: "LEGACY",
      scopeJson,
      scopeHash: "legacy-scope-hash",
      scalarEvidence: {
        peopleSummary: "No identifiable people — historical assessment",
        audioRequested: false,
        audioAllowed: false,
      },
    });
  });

  it("does not invent named V2 categories for historical multiple-person evidence", () => {
    const result = interpretRecordingAssessment({
      contractVersion: null,
      scopeJson: "{}",
      subjectJson: JSON.stringify({
        protectedNonParticipantMayAppear: true,
        minorMayAppear: true,
      }),
      scopeHash: "historical-hash",
      peopleScope: "multiple",
    });
    expect(result.kind).toBe("LEGACY");
    if (result.kind === "LEGACY") {
      expect(result.scalarEvidence.peopleSummary).toBe(
        "Multiple people — historical assessment",
      );
      expect(result.subjectJson).toContain("protectedNonParticipantMayAppear");
      expect(result.subjectEvidence).toEqual({
        protectedNonParticipantMayAppear: true,
        minorMayAppear: true,
      });
    }
  });

  it("requires the explicit database version for V2 scope evidence", () => {
    const evidence = v2Evidence();
    expect(() => interpretRecordingAssessment({ ...evidence, contractVersion: null })).toThrowError(
      expect.objectContaining({ code: "MISSING_EXPLICIT_CONTRACT_VERSION" }),
    );
  });

  it("fails closed for an unknown explicit contract version", () => {
    expect(() =>
      interpretRecordingAssessment({
        contractVersion: "recording-assessment-v99",
        scopeJson: "{}",
        subjectJson: "{}",
        scopeHash: "unknown-hash",
      }),
    ).toThrowError(expect.objectContaining({ code: "UNKNOWN_CONTRACT_VERSION" }));
  });
});
