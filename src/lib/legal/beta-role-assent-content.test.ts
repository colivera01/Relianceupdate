import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BETA_ROLE_ASSENT_PACKAGE,
  ROLE_ASSENT_CONTENT_KEYS,
  roleAssentContentSet,
  roleAssentContentSetHash,
} from "./beta-role-assent-content";
import { legalEvidenceSha256 } from "./legal-evidence-core";

describe("approved beta role-assent content", () => {
  it("is the exact draft.3 package without becoming globally effective or counsel approved", () => {
    expect(BETA_ROLE_ASSENT_PACKAGE).toMatchObject({
      packageKey: "reliance-legal-content-drafts-2026-10-13-draft.3",
      packageSha256: "581d51137b2e592700612485604613702244211ca941d4e81bfcdbd2b4f4fb80",
      authorizationScope: "BETA_ROLE_ASSENT_SURFACES_ONLY",
      globallyEffective: false,
      counselApproved: false,
    });
    expect(BETA_ROLE_ASSENT_PACKAGE.entries).toHaveLength(4);
    for (const item of BETA_ROLE_ASSENT_PACKAGE.entries) {
      expect(item.sourceGovernanceStatus).toBe("DRAFT");
      expect(item.sourceRuntimeEffective).toBe(false);
      expect(item.sourceCounselApproved).toBe(false);
      expect(legalEvidenceSha256(item.contentSnapshot)).toBe(item.contentHash);
    }
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
    expect(employee).toContain("This Service Order is not for me");
    expect(employee).toContain("does not allow recording");
    expect(employee).toContain("Standing Public Service Video Participation is also separate and optional");
  });

  it("matches the committed generated artifact and source manifest identities", () => {
    const root = process.cwd();
    const generated = JSON.parse(
      fs.readFileSync(path.join(root, "src/config/beta-role-assent-content.generated.json"), "utf8"),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "docs/legal-content-drafts/2026-10-13-draft.3/manifest.json"), "utf8"),
    );
    expect(generated.packageSha256).toBe(manifest.packageSha256);
    for (const entry of generated.entries) {
      const source = manifest.entries.find((item: any) => item.contentKey === entry.contentKey);
      expect(entry.version).toBe(source.version);
      expect(entry.contentHash).toBe(source.publishableBodySha256);
    }
  });
});
