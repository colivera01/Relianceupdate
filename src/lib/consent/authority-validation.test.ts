import { describe, expect, it } from "vitest";

import {
  AUTHORITY_ROLE_SCOPES,
  buildStoredAuthorityEvidence,
  evaluatePermissionAuthority,
  permissionAuthorityPresentation,
  storedAuthorityEvidenceIsCurrent,
} from "./authority-validation";

const customerAssessment = {
  id: "assessment-1",
  generation: 3,
  authorityHolderType: "customer",
  locationType: "residence",
  scopeHash: "scope-hash-3",
};

function evaluate(overrides: Record<string, unknown> = {}) {
  return evaluatePermissionAuthority({
    assessment: customerAssessment,
    claimedRole: "customer",
    authorityScope: AUTHORITY_ROLE_SCOPES.customer,
    verificationMethod: "email_otp",
    verifiedContactHash: "verified-contact-hash",
    ...overrides,
  });
}

describe("recording consent authority validation", () => {
  it("authorizes the expected customer with verified intended-destination evidence", () => {
    expect(evaluate()).toMatchObject({
      ok: true,
      code: "AUTHORITY_VERIFIED",
      expectedAuthority: "customer",
      claimedAuthority: "customer",
      expectedAndClaimedMatch: true,
    });
  });

  it.each([
    ["authorized_representative", AUTHORITY_ROLE_SCOPES.authorized_representative],
    ["guardian", AUTHORITY_ROLE_SCOPES.guardian],
    ["customer_business_representative", AUTHORITY_ROLE_SCOPES.customer_business_representative],
  ])("does not let verified destination control establish mismatched %s authority", (claimedRole, authorityScope) => {
    expect(evaluate({ claimedRole, authorityScope })).toMatchObject({
      ok: false,
      code: "AUTHORITY_MISMATCH",
      expectedAuthority: "customer",
      claimedAuthority: claimedRole,
      identityVerificationBasis: "email_otp",
    });
  });

  it("rejects unsupported authority and inconsistent role scope", () => {
    expect(evaluate({ claimedRole: "friend", authorityScope: "self_and_property" })).toMatchObject({
      ok: false,
      code: "CLAIMED_AUTHORITY_UNSUPPORTED",
    });
    expect(evaluate({ authorityScope: "guardian_for_minor" })).toMatchObject({
      ok: false,
      code: "AUTHORITY_SCOPE_INVALID",
    });
  });

  it("requires verified identity and destination evidence", () => {
    expect(evaluate({ verificationMethod: null })).toMatchObject({
      ok: false,
      code: "IDENTITY_EVIDENCE_MISSING",
    });
    expect(evaluate({ verifiedContactHash: null })).toMatchObject({
      ok: false,
      code: "IDENTITY_EVIDENCE_MISSING",
    });
  });

  it.each([
    ["authorized_representative", "residence", "authorized_representative", AUTHORITY_ROLE_SCOPES.authorized_representative],
    ["authorized_representative", "customer-business", "customer_business_representative", AUTHORITY_ROLE_SCOPES.customer_business_representative],
    ["guardian", "residence", "guardian", AUTHORITY_ROLE_SCOPES.guardian],
  ])("fails closed for unverified current beta authority %s at %s", (authorityHolderType, locationType, claimedRole, authorityScope) => {
    expect(evaluate({
      assessment: { ...customerAssessment, authorityHolderType, locationType },
      claimedRole,
      authorityScope,
    })).toMatchObject({
      ok: false,
      code: "AUTHORITY_VERIFICATION_REQUIRED",
      expectedAndClaimedMatch: true,
    });
  });

  it("treats vendor-manager authority as outside customer permission decisions", () => {
    expect(evaluate({
      assessment: { ...customerAssessment, authorityHolderType: "vendor_manager" },
    })).toMatchObject({
      ok: false,
      code: "CUSTOMER_PERMISSION_NOT_APPLICABLE",
    });
  });

  it("fails closed when expected authority is missing or ambiguous", () => {
    expect(evaluate({ assessment: { ...customerAssessment, authorityHolderType: null } })).toMatchObject({
      ok: false,
      code: "EXPECTED_AUTHORITY_MISSING",
    });
  });

  it("accepts only durable evidence tied to the current assessment generation and scope", () => {
    const validation = evaluate();
    const authority = buildStoredAuthorityEvidence({ assessment: customerAssessment, validation });
    const decisionEvidence = {
      claimedRole: "customer",
      authorityScope: AUTHORITY_ROLE_SCOPES.customer,
      verificationMethod: "email_otp",
      verifiedContactHash: "verified-contact-hash",
      scopeHash: customerAssessment.scopeHash,
      metadata: JSON.stringify({ authority }),
    };

    expect(storedAuthorityEvidenceIsCurrent({ assessment: customerAssessment, decisionEvidence })).toMatchObject({
      ok: true,
      code: "AUTHORITY_VERIFIED",
    });
    expect(storedAuthorityEvidenceIsCurrent({
      assessment: { ...customerAssessment, generation: 4 },
      decisionEvidence,
    })).toMatchObject({ ok: false, code: "AUTHORITY_VERIFICATION_REQUIRED" });
    expect(storedAuthorityEvidenceIsCurrent({
      assessment: customerAssessment,
      decisionEvidence: { ...decisionEvidence, metadata: "{}" },
    })).toMatchObject({ ok: false, code: "AUTHORITY_VERIFICATION_REQUIRED" });
    expect(storedAuthorityEvidenceIsCurrent({
      assessment: customerAssessment,
      decisionEvidence: { ...decisionEvidence, scopeHash: "stale-scope" },
    })).toMatchObject({ ok: false, code: "AUTHORITY_VERIFICATION_REQUIRED" });
  });

  it("offers only authority choices the current flow can actually verify", () => {
    expect(permissionAuthorityPresentation(customerAssessment)).toMatchObject({
      permittedClaimedRoles: ["customer"],
      canAuthorizeInCurrentFlow: true,
    });
    expect(permissionAuthorityPresentation({
      ...customerAssessment,
      authorityHolderType: "guardian",
    })).toMatchObject({
      permittedClaimedRoles: [],
      canAuthorizeInCurrentFlow: false,
    });
  });
});
