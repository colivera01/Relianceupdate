import { describe, expect, it } from "vitest";

import {
  buildPrivacyCaseEventCandidate,
  buildPrivacyCaseReferenceCandidate,
} from "./privacy-case-infrastructure";

describe("neutral privacy-case infrastructure", () => {
  it("creates a neutral reference without rights, deadlines, or outcomes", () => {
    const reference = buildPrivacyCaseReferenceCandidate({
      referenceCode: "PRIV-ABC123",
      intakeChannel: "support_email",
      requesterPrincipalHash: "a".repeat(64),
      requesterRole: "FORMER_EMPLOYEE",
      intakeContext: { source: "SUPPORT", contactHash: "b".repeat(64) },
    });
    expect(reference).toMatchObject({
      referenceCode: "PRIV-ABC123",
      intakeChannel: "SUPPORT_EMAIL",
      requesterRole: "FORMER_EMPLOYEE",
    });
    expect(reference).not.toHaveProperty("deadlineAt");
    expect(reference).not.toHaveProperty("decision");
    expect(reference).not.toHaveProperty("entitlement");
    expect(reference).not.toHaveProperty("jurisdiction");
  });

  it("creates append-only neutral event evidence", () => {
    const event = buildPrivacyCaseEventCandidate({
      caseId: "case-1",
      eventType: "CORRESPONDENCE_RECORDED",
      actorPrincipalId: "support-1",
      actorRole: "SUPPORT",
      metadata: { channel: "EMAIL", messageDigest: "c".repeat(64) },
      occurredAt: new Date("2026-10-12T18:30:00.000Z"),
    });
    expect(event.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(event.metadataJson)).toEqual({ channel: "EMAIL", messageDigest: "c".repeat(64) });
  });

  it.each([
    ["RIGHT_APPROVED", { note: "x" }],
    ["INTERNAL_NOTE_RECORDED", { statutoryDeadline: "45 days" }],
    ["INTERNAL_NOTE_RECORDED", { entitlementApproved: true }],
    ["INTERNAL_NOTE_RECORDED", { jurisdiction: "Florida" }],
  ])("defers substantive legal event or metadata %s", (eventType, metadata) => {
    expect(() => buildPrivacyCaseEventCandidate({
      caseId: "case-1",
      eventType: eventType as any,
      metadata,
      occurredAt: new Date(),
    })).toThrow(/PRIVACY_CASE_(EVENT_REQUIRES_FUTURE_POLICY_AUTHORIZATION|SUBSTANTIVE_LEGAL_FIELD_DEFERRED)/);
  });

  it("rejects raw credentials from intake and event metadata", () => {
    expect(() => buildPrivacyCaseReferenceCandidate({
      intakeChannel: "WEB",
      intakeContext: { password: "secret" },
    })).toThrow(/LEGAL_EVIDENCE_PROTECTED_CREDENTIAL/);
    expect(() => buildPrivacyCaseEventCandidate({
      caseId: "case-1",
      eventType: "IDENTITY_CONTEXT_RECORDED",
      metadata: { serviceOrderUrl: "https://example.test/jobs/1?token=secret" },
      occurredAt: new Date(),
    })).toThrow(/LEGAL_EVIDENCE_PROTECTED_CREDENTIAL/);
  });
});
