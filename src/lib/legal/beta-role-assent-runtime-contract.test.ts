import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("beta-only role-assent runtime contract", () => {
  it("gates authenticated Manager operations while leaving the assent endpoint able to establish evidence", () => {
    const membership = read("src/lib/membership-auth.ts");
    const vendorAssent = read("src/app/api/vendor/legal-assent/route.ts");
    expect(membership).toContain("assertCurrentVendorRoleAssent");
    expect(vendorAssent).toContain("requireActorVendorManager");
    expect(vendorAssent).not.toContain("requireVendorManager(");
  });

  it("covers the direct Manager write routes that do not use the shared membership guard", () => {
    for (const route of [
      "src/app/api/vendor/profile/route.ts",
      "src/app/api/services/route.ts",
      "src/app/api/services/[id]/route.ts",
      "src/app/api/vendors/[vendorId]/media/[assetId]/route.ts",
    ]) {
      expect(read(route), route).toContain("assertCurrentVendorRoleAssent");
    }
  });

  it("requires signed current Service Order entry for accountless Employee assent", () => {
    const route = read("src/app/api/employee/legal-assent/route.ts");
    expect(route).toContain('purpose: EMPLOYEE_DECISION_PURPOSES.SERVICE_ORDER_LEGAL_ASSENT');
    expect(route).toContain('actor.entryMethod !== "SERVICE_ORDER_ENTRY"');
    expect(route).toContain("EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED");
    expect(route).toContain("recordEmployeeRoleAssent");
  });

  it("keeps wrong-recipient correction separate from assent and recording participation", () => {
    const route = read("src/app/api/employee/legal-assent/route.ts");
    const correction = route.indexOf('decision === "WRONG_RECIPIENT"');
    const assentWrite = route.indexOf("recordEmployeeRoleAssent({");
    expect(correction).toBeGreaterThan(0);
    expect(assentWrite).toBeGreaterThan(correction);
    expect(route).toContain('verifiedEmployeeAssent: false');
    expect(route).not.toContain("recordEmployeeRecordingParticipationDecision");
  });

  it("keeps activation beta-specific and never promotes the draft package globally", () => {
    const config = read("src/lib/legal/beta-role-assent-content.ts");
    expect(config).toContain('BETA_ROLE_ASSENT_FLAG = "LEGAL_ROLE_ASSENT_BETA_ENABLED"');
    expect(config).toContain("globallyEffective: false");
    expect(config).toContain("counselApproved: false");
    expect(config).not.toContain("NEXT_PUBLIC_LEGAL_ROLE_ASSENT");
  });
});
