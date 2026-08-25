import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { persistAllowedRecordingGateDecision } from "./service-video-evidence";

const supportedEvidenceFields = new Set(
  Prisma.dmmf.datamodel.models
    .find((model) => model.name === "RecordingGateDecisionEvidence")
    ?.fields.map((field) => field.name) || [],
);

describe("RecordingGateDecisionEvidence persistence contract", () => {
  it("writes only generated-model fields while preserving audio scope evidence", async () => {
    expect(supportedEvidenceFields.size).toBeGreaterThan(0);

    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const unsupported = Object.keys(data).filter((key) => !supportedEvidenceFields.has(key));
      if (unsupported.length > 0) {
        throw new Error(`Unsupported RecordingGateDecisionEvidence fields: ${unsupported.join(", ")}`);
      }
      return { id: "gate-evidence-1", ...data };
    });

    await persistAllowedRecordingGateDecision({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      actorKind: "EMPLOYEE",
      surface: "media_session",
      gate: {
        block: null,
        blockCode: null,
        recordingUnlocked: true,
        releaseAllowed: true,
        permissionRequired: true,
        permissionDecisionEvidenceId: "permission-evidence-1",
        consentRecordId: "consent-1",
        assessmentId: "assessment-1",
        assessmentGeneration: 1,
        scopeHash: "scope-hash-1",
        certificationId: "certification-1",
        assignmentGeneration: 1,
        locationAttemptId: "location-attempt-1",
        locationExceptionId: null,
        audioAllowed: false,
      } as any,
      tx: { recordingGateDecisionEvidence: { create } },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("audioAllowed");
    expect(data).toEqual(expect.objectContaining({
      bookingId: "booking-1",
      vendorId: "vendor-1",
      assessmentId: "assessment-1",
      permissionEvidenceId: "permission-evidence-1",
      decision: "ALLOWED",
      audioExpected: false,
      audioContractVersion: 2,
    }));

    const snapshot = JSON.parse(String(data.snapshotJson));
    expect(snapshot).toEqual(expect.objectContaining({
      audioAllowed: false,
      assessmentId: "assessment-1",
      scopeHash: "scope-hash-1",
    }));
  });
});
