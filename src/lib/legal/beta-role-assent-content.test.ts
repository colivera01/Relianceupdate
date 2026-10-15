import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BETA_ROLE_ASSENT_PACKAGE,
  ROLE_ASSENT_CONTENT_KEYS,
  managerWorkRecordAttestationPresentation,
  roleAssentContentSet,
  roleAssentContentSetHash,
} from "./beta-role-assent-content";
import { legalEvidenceSha256 } from "./legal-evidence-core";

describe("approved beta role-assent content", () => {
  it("is the exact Product Owner-approved onboarding package without becoming globally effective or counsel approved", () => {
    expect(BETA_ROLE_ASSENT_PACKAGE).toMatchObject({
      packageKey: "reliance-beta-onboarding-legal-2026-10-14.1",
      packageSha256: "9c04ea7ee73d86028ed394423b313731ece2ac9ed2a43e57036a62c0824ded20",
      authorizationScope: "BETA_ROLE_ASSENT_SURFACES_ONLY",
      globallyEffective: false,
      counselApproved: false,
    });
    expect(BETA_ROLE_ASSENT_PACKAGE.entries).toHaveLength(5);
    for (const item of BETA_ROLE_ASSENT_PACKAGE.entries) {
      expect(item.sourceGovernanceStatus).toBe("DRAFT");
      expect(item.sourceRuntimeEffective).toBe(false);
      expect(item.sourceCounselApproved).toBe(false);
      expect(legalEvidenceSha256(item.contentSnapshot)).toBe(item.contentHash);
    }
  });

  it("keeps the Manager Work Record attestation outside the organization assent bundle", () => {
    const presentation = managerWorkRecordAttestationPresentation();
    expect(presentation.contentKey).toBe(
      ROLE_ASSENT_CONTENT_KEYS.MANAGER_WORK_RECORD_ATTESTATION,
    );
    expect(presentation.attestationText).toContain(
      "I am authorized to manage this Work Record",
    );
    expect(roleAssentContentSet("VENDOR").map((item) => item.contentKey)).not.toContain(
      ROLE_ASSENT_CONTENT_KEYS.MANAGER_WORK_RECORD_ATTESTATION,
    );
  });

  it("keeps separate Terms, Privacy, and role-specific versions in each bundle", () => {
    expect(roleAssentContentSet("VENDOR").map((item) => item.contentKey)).toEqual([
      ROLE_ASSENT_CONTENT_KEYS.TERMS,
      ROLE_ASSENT_CONTENT_KEYS.PRIVACY,
      ROLE_ASSENT_CONTENT_KEYS.VENDOR,
    ]);
    expect(roleAssentContentSet("EMPLOYEE").map((item) => item.contentKey)).toEqual([
      ROLE_ASSENT_CONTENT_KEYS.TERMS,
      ROLE_ASSENT_CONTENT_KEYS.PRIVACY,
      ROLE_ASSENT_CONTENT_KEYS.EMPLOYEE,
    ]);
    expect(roleAssentContentSetHash("VENDOR")).toMatch(/^[a-f0-9]{64}$/);
    expect(roleAssentContentSetHash("EMPLOYEE")).not.toBe(roleAssentContentSetHash("VENDOR"));
  });

  it("preserves no-proxy, no-retaliation, wrong-recipient, and decision separation copy", () => {
    const vendor = roleAssentContentSet("VENDOR")[2].contentSnapshot;
    const employee = roleAssentContentSet("EMPLOYEE")[2].contentSnapshot;
    expect(vendor).toContain("will not retaliate against, coerce, or misrepresent");
    expect(vendor).toContain("will not accept or decline recording participation");
    expect(vendor).toContain("# Vendor Organization Agreement");
    expect(vendor).not.toContain("## Job-specific Manager attestation");
    expect(employee).toContain("This Service Order is not for me");
    expect(employee).toContain("does not allow recording");
    expect(employee).toContain("Standing Public Service Video Participation is also separate and optional");
  });

  it("matches the committed generated onboarding artifact and preserves its draft.3 predecessors", () => {
    const root = process.cwd();
    const generated = JSON.parse(
      fs.readFileSync(path.join(root, "src/config/beta-role-assent-content.generated.json"), "utf8"),
    );
    const onboarding = JSON.parse(
      fs.readFileSync(path.join(root, "src/config/beta-onboarding-legal-content.generated.json"), "utf8"),
    );
    expect(generated.packageSha256).toBe(onboarding.packageSha256);
    for (const entry of generated.entries) {
      const source = onboarding.entries.find((item: any) => item.contentKey === entry.contentKey);
      expect(entry.version).toBe(source.version);
      expect(entry.contentHash).toBe(source.contentHash);
      expect(source.predecessorVersion).toContain("2026-10-13-draft.3");
    }
  });
});
