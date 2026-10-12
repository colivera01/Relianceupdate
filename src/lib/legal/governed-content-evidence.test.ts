import { describe, expect, it } from "vitest";

import {
  buildGovernedContentVersionCandidate,
  buildPublicChoiceContentEvidenceCandidate,
  buildRoleAssentEvidenceCandidate,
} from "./governed-content-evidence";
import { legalEvidenceSha256 } from "./legal-evidence-core";

function policyContent() {
  return {
    id: "content-1",
    ...buildGovernedContentVersionCandidate({
      contentKey: "VENDOR_TERMS",
      contentClass: "POLICY" as const,
      audienceRole: "VENDOR_MANAGER",
      version: "draft-1",
      governanceStatus: "PRODUCT_OWNER_APPROVED" as const,
      contentSnapshot: "Exact prospective policy snapshot.",
      productOwnerApprovedByPrincipalId: "product-owner-1",
      productOwnerApprovedAt: new Date("2026-10-12T12:00:00.000Z"),
    }),
  };
}

function publicChoiceContent() {
  return {
    id: "content-public-1",
    ...buildGovernedContentVersionCandidate({
      contentKey: "SHARE_PUBLICLY_CONFIRMATION",
      contentClass: "PUBLIC_CHOICE" as const,
      audienceRole: "CUSTOMER",
      version: "draft-1",
      contentSnapshot: "Exact prospective Public-choice snapshot.",
    }),
  };
}

describe("dormant governed content and evidence candidates", () => {
  it("supports only DRAFT and PRODUCT_OWNER_APPROVED without an effective state", () => {
    const draft = buildGovernedContentVersionCandidate({
      contentKey: "EMPLOYEE_TERMS",
      contentClass: "POLICY",
      version: "draft-1",
      contentSnapshot: "Draft text",
    });
    expect(draft.governanceStatus).toBe("DRAFT");
    expect(draft).not.toHaveProperty("effectiveAt");
    expect(draft).not.toHaveProperty("counselApprovedAt");
    expect(() => buildGovernedContentVersionCandidate({
      contentKey: "EMPLOYEE_TERMS",
      contentClass: "POLICY",
      version: "bad",
      governanceStatus: "EFFECTIVE" as any,
      contentSnapshot: "Not authorized",
    })).toThrow("GOVERNED_CONTENT_STATUS_NOT_AUTHORIZED");
    expect(() => buildGovernedContentVersionCandidate({
      contentKey: "EMPLOYEE_TERMS",
      contentClass: "POLICY",
      version: "bad",
      governanceStatus: "COUNSEL_APPROVED" as any,
      contentSnapshot: "Not authorized",
    })).toThrow("GOVERNED_CONTENT_STATUS_NOT_AUTHORIZED");
  });

  it("preserves exact content and derives its SHA-256", () => {
    const content = policyContent();
    expect(content.contentSnapshot).toBe("Exact prospective policy snapshot.");
    expect(content.contentHash).toBe(legalEvidenceSha256(content.contentSnapshot));
  });

  it("builds exact role/context-bound append-only assent evidence", () => {
    const evidence = buildRoleAssentEvidenceCandidate({
      content: policyContent(),
      actorPrincipalId: "principal-1",
      actorUserId: "user-1",
      actorRole: "vendor_manager",
      vendorId: "vendor-1",
      membershipId: "membership-1",
      bookingId: "booking-1",
      contextType: "vendor_membership",
      contextId: "membership-1",
      context: { membershipGeneration: 2, vendorId: "vendor-1" },
      decision: "ASSENT",
      verificationMethod: "AUTHENTICATED_SESSION",
      verificationContext: { sessionClass: "PASSWORD_PLUS_EMAIL_VERIFICATION" },
      sequence: 1,
      requestId: "request-1",
      request: { decision: "ASSENT", contextRevision: 2 },
      decidedAt: new Date("2026-10-12T13:00:00.000Z"),
    });
    expect(evidence.actorRole).toBe("VENDOR_MANAGER");
    expect(evidence.contextType).toBe("VENDOR_MEMBERSHIP");
    expect(evidence.contentSnapshot).toBe(policyContent().contentSnapshot);
    expect(evidence.contentHash).toBe(policyContent().contentHash);
    expect(evidence.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence).not.toHaveProperty("token");
    expect(evidence).not.toHaveProperty("password");
  });

  it("rejects invalid decision values before persistence", () => {
    expect(() => buildRoleAssentEvidenceCandidate({
      content: policyContent(),
      actorPrincipalId: "principal-1",
      actorRole: "EMPLOYEE",
      contextType: "SERVICE_ORDER",
      contextId: "order-1",
      context: { orderId: "order-1" },
      decision: "ALLOW" as any,
      verificationMethod: "AUTHENTICATED_SESSION",
      verificationContext: {},
      sequence: 1,
      requestId: "request-1",
      request: {},
      decidedAt: new Date(),
    })).toThrow("ROLE_ASSENT_DECISION_INVALID");
    expect(() => buildPublicChoiceContentEvidenceCandidate({
      content: publicChoiceContent(),
      bookingId: "booking-1",
      packageId: "package-1",
      packageVersion: 1,
      packageHash: "a".repeat(64),
      stageSetHash: "b".repeat(64),
      customerUserId: "customer-1",
      choice: "KEEP_PRIVATE" as any,
      includesAudio: false,
      audioDisclosureIncluded: false,
      outsideCopyDisclosureIncluded: false,
      verificationMethod: "AUTHENTICATED_CUSTOMER_SESSION",
      verificationContext: {},
      requestId: "request-2",
      request: {},
      recordedAt: new Date(),
    })).toThrow("PUBLIC_CHOICE_DECISION_INVALID");
  });

  it.each([
    [{ rawOtp: "123456" }],
    [{ password: "not-allowed" }],
    [{ serviceOrderUrl: "https://example.test/order?token=secret" }],
    [{ authorizationHeader: "Bearer secret-value" }],
    [{ nested: { databaseUrl: "sqlserver://user:pass@example.test/db" } }],
  ])("rejects protected verification material from legal evidence", (verificationContext) => {
    expect(() => buildRoleAssentEvidenceCandidate({
      content: policyContent(),
      actorPrincipalId: "principal-1",
      actorRole: "EMPLOYEE",
      contextType: "SERVICE_ORDER",
      contextId: "order-1",
      context: { orderId: "order-1" },
      decision: "ASSENT",
      verificationMethod: "EMAIL_OTP",
      verificationContext,
      sequence: 1,
      requestId: "request-1",
      request: { decision: "ASSENT" },
      decidedAt: new Date(),
    })).toThrow(/LEGAL_EVIDENCE_PROTECTED_CREDENTIAL/);
  });

  it("allows only hashed credential references in evidence context", () => {
    expect(() => buildRoleAssentEvidenceCandidate({
      content: policyContent(),
      actorPrincipalId: "principal-1",
      actorRole: "EMPLOYEE",
      contextType: "SERVICE_ORDER",
      contextId: "order-1",
      context: { orderId: "order-1" },
      decision: "ASSENT",
      verificationMethod: "EMAIL_OTP",
      verificationContext: { verifiedContactHash: "a".repeat(64), sessionDigest: "b".repeat(64) },
      sequence: 1,
      requestId: "request-1",
      request: { decision: "ASSENT" },
      decidedAt: new Date(),
    })).not.toThrow();
  });

  it("builds immutable Public-choice copy evidence without becoming visibility authority", () => {
    const evidence = buildPublicChoiceContentEvidenceCandidate({
      content: publicChoiceContent(),
      bookingId: "booking-1",
      packageId: "package-1",
      packageVersion: 2,
      packageHash: "a".repeat(64),
      stageSetHash: "b".repeat(64),
      customerUserId: "customer-1",
      choice: "SHARE_PUBLICLY",
      includesAudio: true,
      audioDisclosureIncluded: true,
      outsideCopyDisclosureIncluded: true,
      verificationMethod: "AUTHENTICATED_CUSTOMER_SESSION",
      verificationContext: { sessionClass: "CUSTOMER" },
      requestId: "request-public-1",
      request: { choice: "SHARE_PUBLICLY", packageVersion: 2 },
      recordedAt: new Date("2026-10-12T14:00:00.000Z"),
    });
    expect(evidence.choice).toBe("SHARE_PUBLICLY");
    expect(evidence.contentSnapshot).toBe(publicChoiceContent().contentSnapshot);
    expect(evidence).not.toHaveProperty("isCurrent");
    expect(evidence).not.toHaveProperty("publicAllowed");
  });

  it("requires audio and outside-copy disclosure evidence for future Public choice", () => {
    const base = {
      content: publicChoiceContent(), bookingId: "booking-1", packageId: "package-1",
      packageVersion: 1, packageHash: "a".repeat(64), stageSetHash: "b".repeat(64),
      customerUserId: "customer-1", choice: "SHARE_PUBLICLY" as const,
      verificationMethod: "AUTHENTICATED_CUSTOMER_SESSION", verificationContext: {},
      requestId: "request-1", request: {}, recordedAt: new Date(),
    };
    expect(() => buildPublicChoiceContentEvidenceCandidate({
      ...base, includesAudio: true, audioDisclosureIncluded: false, outsideCopyDisclosureIncluded: true,
    })).toThrow("PUBLIC_CHOICE_AUDIO_DISCLOSURE_REQUIRED");
    expect(() => buildPublicChoiceContentEvidenceCandidate({
      ...base, includesAudio: false, audioDisclosureIncluded: false, outsideCopyDisclosureIncluded: false,
    })).toThrow("PUBLIC_CHOICE_OUTSIDE_COPY_DISCLOSURE_REQUIRED");
  });
});
