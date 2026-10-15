import { describe, expect, it } from "vitest";

import {
  BETA_ONBOARDING_LEGAL_PACKAGE,
  betaOnboardingContentSet,
  betaOnboardingDocument,
} from "./beta-onboarding-content";
import { legalEvidenceSha256 } from "./legal-evidence-core";

describe("beta onboarding legal content", () => {
  it("binds the exact prospective package without making it globally effective", () => {
    expect(BETA_ONBOARDING_LEGAL_PACKAGE).toMatchObject({
      packageKey: "reliance-beta-onboarding-legal-2026-10-14.1",
      packageSha256: "9c04ea7ee73d86028ed394423b313731ece2ac9ed2a43e57036a62c0824ded20",
      authorizationReference: "github-issue-1-comment-6180609703",
      globallyEffective: false,
      counselApproved: false,
      canonicalSupportEmail: "Relianceorg.support@gmail.com",
    });
    expect(BETA_ONBOARDING_LEGAL_PACKAGE.entries).toHaveLength(6);
    for (const entry of BETA_ONBOARDING_LEGAL_PACKAGE.entries) {
      expect(legalEvidenceSha256(entry.contentSnapshot)).toBe(entry.contentHash);
      expect(entry.predecessorVersion).toContain("2026-10-13-draft.3");
    }
  });

  it("keeps Customer, Vendor, and Employee document sets role-specific", () => {
    expect(betaOnboardingContentSet("customer").documentIds).toEqual([
      "terms",
      "privacy",
      "sms",
    ]);
    expect(betaOnboardingContentSet("vendor").documentIds).toEqual([
      "terms",
      "privacy",
      "vendor-organization",
    ]);
    expect(betaOnboardingContentSet("employee").documentIds).toEqual([
      "terms",
      "privacy",
      "employee-service-order",
    ]);
    expect(betaOnboardingContentSet("customer").documentIds).not.toContain(
      "vendor-organization",
    );
    expect(betaOnboardingContentSet("employee").documentIds).not.toContain(
      "vendor-organization",
    );
  });

  it("uses the approved Vendor title and four exact acknowledgments", () => {
    const vendor = betaOnboardingDocument("vendor-organization");
    expect(vendor.contentSnapshot).toContain("# Vendor Organization Agreement");
    expect(vendor.contentSnapshot).not.toContain("Vendor and Vendor Manager Assent");
    expect(vendor.contentSnapshot).not.toContain("## Job-specific Manager attestation");
    expect(BETA_ONBOARDING_LEGAL_PACKAGE.vendorAcknowledgements.map((item) => item.label)).toEqual([
      "I am authorized to act for and bind the identified Vendor organization.",
      "I agree to the exact Reliance Terms of Use version shown.",
      "I acknowledge that I reviewed the exact Reliance Privacy Notice version shown.",
      "I consent to receive and retain these terms, notices, receipts, and related records electronically.",
    ]);
  });

  it("keeps Manager Work Record attestation independently versioned", () => {
    const manager = betaOnboardingDocument("manager-work-record-attestation");
    expect(manager.contentKey).toBe("reliance.manager-work-record-attestation");
    expect(manager.presentation?.attestationText).toContain(
      "I am authorized to manage this Work Record",
    );
    expect(manager.presentation?.confirmationText).toContain(
      "this exact current Work Record",
    );
    expect(betaOnboardingContentSet("vendor").documentIds).not.toContain(
      "manager-work-record-attestation",
    );
  });
});
