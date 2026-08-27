import { describe, expect, it } from "vitest";

import {
  parseRecordingAssessmentV2,
  RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
  RecordingAssessmentV2ValidationError,
} from "./assessment-v2";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function validAssessment(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: RECORDING_ASSESSMENT_V2_CONTRACT_VERSION,
    location: {
      type: "VENDOR_BUSINESS",
      snapshotEvidenceHash: HASH_A,
    },
    intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT"],
    expectedPeople: ["NO_IDENTIFIABLE_PEOPLE"],
    recordingFormat: "VIDEO_ONLY",
    recordingArea: { boundary: "SERVICE_AREA_ONLY" },
    ...overrides,
  };
}

function expectValidationCode(input: unknown, code: string) {
  try {
    parseRecordingAssessmentV2(input);
    throw new Error("Expected V2 validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(RecordingAssessmentV2ValidationError);
    expect((error as RecordingAssessmentV2ValidationError).code).toBe(code);
  }
}

describe("Recording Assessment V2 canonical contract", () => {
  it("accepts one intended subject", () => {
    expect(parseRecordingAssessmentV2(validAssessment()).assessment.intendedSubjects).toEqual([
      "SERVICE_AREA_OR_EQUIPMENT",
    ]);
  });

  it("sorts several subjects by fixed contract order independent of input order", () => {
    const subjects = [
      "COMPLETED_WORK_OR_FINAL_CONDITION",
      "SERVICE_AREA_OR_EQUIPMENT",
      "WORK_BEING_PERFORMED",
    ];
    const reversed = [...subjects].reverse();
    const first = parseRecordingAssessmentV2(validAssessment({ intendedSubjects: subjects }));
    const second = parseRecordingAssessmentV2(validAssessment({ intendedSubjects: reversed }));

    expect(first.assessment.intendedSubjects).toEqual([
      "SERVICE_AREA_OR_EQUIPMENT",
      "WORK_BEING_PERFORMED",
      "COMPLETED_WORK_OR_FINAL_CONDITION",
    ]);
    expect(first.scopeJson).toBe(second.scopeJson);
    expect(first.scopeHash).toBe(second.scopeHash);
  });

  it("rejects duplicate, unknown, and empty intended-subject selections", () => {
    expectValidationCode(
      validAssessment({
        intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT", "SERVICE_AREA_OR_EQUIPMENT"],
      }),
      "DUPLICATE_SELECTION",
    );
    expectValidationCode(validAssessment({ intendedSubjects: ["UNRESTRICTED_FILMING"] }), "UNKNOWN_ENUM_VALUE");
    expectValidationCode(validAssessment({ intendedSubjects: [] }), "EMPTY_SELECTION");
  });

  it("requires and canonically normalizes the OTHER description", () => {
    expectValidationCode(validAssessment({ intendedSubjects: ["OTHER"] }), "MISSING_TEXT");
    const parsed = parseRecordingAssessmentV2(
      validAssessment({
        intendedSubjects: ["OTHER"],
        otherSubjectDescription: "  Meter   label and   service markings  ",
      }),
    );
    expect(parsed.assessment.otherSubjectDescription).toBe("Meter label and service markings");
    expect(parsed.scopeJson).toContain("Meter label and service markings");
  });

  it("rejects control characters and an OTHER description without OTHER", () => {
    expectValidationCode(
      validAssessment({ intendedSubjects: ["OTHER"], otherSubjectDescription: "Meter\nlabel" }),
      "CONTROL_CHARACTER",
    );
    expectValidationCode(
      validAssessment({ otherSubjectDescription: "Unexpected description" }),
      "UNEXPECTED_OTHER_DESCRIPTION",
    );
  });

  it("accepts supported expected-person combinations and sorts them canonically", () => {
    const employee = parseRecordingAssessmentV2(
      validAssessment({ expectedPeople: ["ASSIGNED_SERVICE_PROFESSIONAL"] }),
    );
    expect(employee.assessment.expectedPeople).toEqual(["ASSIGNED_SERVICE_PROFESSIONAL"]);

    const first = parseRecordingAssessmentV2(
      validAssessment({ expectedPeople: ["CUSTOMER", "ASSIGNED_SERVICE_PROFESSIONAL"] }),
    );
    const second = parseRecordingAssessmentV2(
      validAssessment({ expectedPeople: ["ASSIGNED_SERVICE_PROFESSIONAL", "CUSTOMER"] }),
    );
    expect(first.assessment.expectedPeople).toEqual([
      "ASSIGNED_SERVICE_PROFESSIONAL",
      "CUSTOMER",
    ]);
    expect(first.scopeHash).toBe(second.scopeHash);
  });

  it("rejects duplicate, unknown, and empty expected-person selections", () => {
    expectValidationCode(
      validAssessment({ expectedPeople: ["CUSTOMER", "CUSTOMER"] }),
      "DUPLICATE_SELECTION",
    );
    expectValidationCode(validAssessment({ expectedPeople: ["VENDOR_OWNER"] }), "UNKNOWN_ENUM_VALUE");
    expectValidationCode(validAssessment({ expectedPeople: [] }), "EMPTY_SELECTION");
  });

  it.each(["CUSTOMER", "ASSIGNED_SERVICE_PROFESSIONAL"])(
    "rejects NO_IDENTIFIABLE_PEOPLE combined with %s",
    (person) => {
      expectValidationCode(
        validAssessment({ expectedPeople: ["NO_IDENTIFIABLE_PEOPLE", person] }),
        "CONTRADICTORY_PEOPLE_SCOPE",
      );
    },
  );

  it("rejects a people subject when no identifiable people are expected", () => {
    expectValidationCode(
      validAssessment({ intendedSubjects: ["SERVICE_PARTICIPANTS"] }),
      "CONTRADICTORY_PARTICIPANT_SCOPE",
    );
  });

  it.each([
    "MINOR",
    "BYSTANDER_NONPARTICIPANT",
    "OTHER_ADULT_SERVICE_PARTICIPANT",
  ])("derives PLAN_CHANGE_REQUIRED for unsupported intentional participant %s", (person) => {
    const result = parseRecordingAssessmentV2(validAssessment({ expectedPeople: [person] }));
    expect(result.assessment.derived.participantPolicyStatus).toBe("PLAN_CHANGE_REQUIRED");
  });

  it("does not emit participant authority records while parsing an unsupported plan", () => {
    const result = parseRecordingAssessmentV2(
      validAssessment({ expectedPeople: ["BYSTANDER_NONPARTICIPANT"] }),
    );
    expect(result.assessment).not.toHaveProperty("authorityRequirements");
  });

  it("keeps Video-only stable and derives vendor authority for a supported vendor plan", () => {
    const first = parseRecordingAssessmentV2(validAssessment());
    const second = parseRecordingAssessmentV2(validAssessment());
    expect(first.scopeJson).toBe(second.scopeJson);
    expect(first.scopeHash).toBe(second.scopeHash);
    expect(first.assessment.derived).toEqual({
      customerPermissionRequired: false,
      expectedAuthority: "VENDOR_MANAGER",
      participantPolicyStatus: "SUPPORTED",
    });
  });

  it("always requires customer permission for Video+Audio at a vendor business", () => {
    const result = parseRecordingAssessmentV2(
      validAssessment({ recordingFormat: "VIDEO_AUDIO" }),
    );
    expect(result.assessment.derived).toMatchObject({
      customerPermissionRequired: true,
      expectedAuthority: "CUSTOMER",
    });
  });

  it.each(["CUSTOMER_RESIDENCE", "CUSTOMER_BUSINESS"])(
    "requires customer permission at %s",
    (type) => {
      const result = parseRecordingAssessmentV2(
        validAssessment({ location: { type, snapshotEvidenceHash: HASH_A } }),
      );
      expect(result.assessment.derived.customerPermissionRequired).toBe(true);
      expect(result.assessment.derived.expectedAuthority).toBe("CUSTOMER");
    },
  );

  it("requires customer permission when the customer is expected", () => {
    const result = parseRecordingAssessmentV2(
      validAssessment({ expectedPeople: ["CUSTOMER"] }),
    );
    expect(result.assessment.derived.customerPermissionRequired).toBe(true);
  });

  it("accepts service-area-only without an explanation", () => {
    expect(parseRecordingAssessmentV2(validAssessment()).assessment.recordingArea).toEqual({
      boundary: "SERVICE_AREA_ONLY",
    });
  });

  it("requires and normalizes a necessary-surroundings explanation", () => {
    const base = {
      intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT", "NECESSARY_SURROUNDING_AREA"],
      recordingArea: {
        boundary: "NECESSARY_SURROUNDINGS",
        explanation: "  Show   required equipment   clearance.  ",
      },
    };
    const parsed = parseRecordingAssessmentV2(validAssessment(base));
    expect(parsed.assessment.recordingArea.explanation).toBe(
      "Show required equipment clearance.",
    );
    expectValidationCode(
      validAssessment({
        intendedSubjects: ["SERVICE_AREA_OR_EQUIPMENT", "NECESSARY_SURROUNDING_AREA"],
        recordingArea: { boundary: "NECESSARY_SURROUNDINGS", explanation: "   " },
      }),
      "MISSING_TEXT",
    );
  });

  it("changes the hash when the necessary-surroundings explanation changes", () => {
    const input = {
      intendedSubjects: ["NECESSARY_SURROUNDING_AREA"],
      recordingArea: {
        boundary: "NECESSARY_SURROUNDINGS",
        explanation: "Show equipment clearance.",
      },
    };
    const first = parseRecordingAssessmentV2(validAssessment(input));
    const second = parseRecordingAssessmentV2(
      validAssessment({
        ...input,
        recordingArea: {
          boundary: "NECESSARY_SURROUNDINGS",
          explanation: "Show equipment clearance and access path.",
        },
      }),
    );
    expect(first.scopeHash).not.toBe(second.scopeHash);
  });

  it("rejects recording-area contradictions and invalid explanations", () => {
    expectValidationCode(
      validAssessment({
        intendedSubjects: ["NECESSARY_SURROUNDING_AREA"],
        recordingArea: { boundary: "SERVICE_AREA_ONLY" },
      }),
      "CONTRADICTORY_RECORDING_AREA",
    );
    expectValidationCode(
      validAssessment({
        intendedSubjects: ["NECESSARY_SURROUNDING_AREA"],
        recordingArea: {
          boundary: "NECESSARY_SURROUNDINGS",
          explanation: "Equipment\tclearance",
        },
      }),
      "CONTROL_CHARACTER",
    );
  });

  it("hard-codes Private visibility without Public authorization", () => {
    expect(parseRecordingAssessmentV2(validAssessment()).assessment.visibility).toEqual({
      initialAudience: "PRIVATE",
      publicAuthorizationIncluded: false,
    });
    expectValidationCode(
      validAssessment({
        visibility: { initialAudience: "PUBLIC", publicAuthorizationIncluded: true },
      }),
      "PUBLIC_AUTHORIZATION_NOT_ALLOWED",
    );
  });

  it("rejects unknown fields and contradictory caller-supplied derived values", () => {
    expectValidationCode(validAssessment({ vendorMayPublish: true }), "UNKNOWN_FIELD");
    expectValidationCode(
      validAssessment({
        derived: {
          customerPermissionRequired: true,
          expectedAuthority: "CUSTOMER",
          participantPolicyStatus: "SUPPORTED",
        },
      }),
      "DERIVED_VALUE_MISMATCH",
    );
  });

  it("matches golden fixture A", () => {
    const result = parseRecordingAssessmentV2(validAssessment());
    const expectedScopeJson =
      '{"contractVersion":"recording-assessment-v4-multiscope-safety-v1","derived":{"customerPermissionRequired":false,"expectedAuthority":"VENDOR_MANAGER","participantPolicyStatus":"SUPPORTED"},"expectedPeople":["NO_IDENTIFIABLE_PEOPLE"],"intendedSubjects":["SERVICE_AREA_OR_EQUIPMENT"],"location":{"snapshotEvidenceHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","type":"VENDOR_BUSINESS"},"recordingArea":{"boundary":"SERVICE_AREA_ONLY"},"recordingFormat":"VIDEO_ONLY","visibility":{"initialAudience":"PRIVATE","publicAuthorizationIncluded":false}}';
    expect(result.scopeJson).toBe(expectedScopeJson);
    expect(result.scopeHash).toBe("9eddf097df685ac4bb41fc6985ba59d7a4a5936e1ec5916d25ba1da1f1be35c6");
  });

  it("matches golden fixture B", () => {
    const result = parseRecordingAssessmentV2(
      validAssessment({
        location: { type: "CUSTOMER_BUSINESS", snapshotEvidenceHash: HASH_B },
        intendedSubjects: [
          "COMPLETED_WORK_OR_FINAL_CONDITION",
          "WORK_BEING_PERFORMED",
          "EXISTING_CONDITION_OR_DAMAGE",
          "NECESSARY_SURROUNDING_AREA",
        ],
        expectedPeople: ["CUSTOMER", "ASSIGNED_SERVICE_PROFESSIONAL"],
        recordingFormat: "VIDEO_AUDIO",
        recordingArea: {
          boundary: "NECESSARY_SURROUNDINGS",
          explanation: "Document equipment clearance around the service area.",
        },
      }),
    );
    const expectedScopeJson =
      '{"contractVersion":"recording-assessment-v4-multiscope-safety-v1","derived":{"customerPermissionRequired":true,"expectedAuthority":"CUSTOMER","participantPolicyStatus":"SUPPORTED"},"expectedPeople":["ASSIGNED_SERVICE_PROFESSIONAL","CUSTOMER"],"intendedSubjects":["EXISTING_CONDITION_OR_DAMAGE","WORK_BEING_PERFORMED","COMPLETED_WORK_OR_FINAL_CONDITION","NECESSARY_SURROUNDING_AREA"],"location":{"snapshotEvidenceHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","type":"CUSTOMER_BUSINESS"},"recordingArea":{"boundary":"NECESSARY_SURROUNDINGS","explanation":"Document equipment clearance around the service area."},"recordingFormat":"VIDEO_AUDIO","visibility":{"initialAudience":"PRIVATE","publicAuthorizationIncluded":false}}';
    expect(result.scopeJson).toBe(expectedScopeJson);
    expect(result.scopeHash).toBe("d2e9eb2bb1be854edb9aa7c8df6f0dda46f1b7e7f91e6b122c082f81e5e70b23");
  });
});
