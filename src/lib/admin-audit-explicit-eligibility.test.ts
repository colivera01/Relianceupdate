import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Admin Reliance Audit Public-display eligibility UI contract", () => {
  it("starts every PASS confirmation without a preselected eligibility outcome", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/admin/media-moderation/AdminMediaModerationClient.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "useState<PublicDisplayEligibility | null>(null)",
    );
    expect(source).not.toContain(
      "useState<PublicDisplayEligibility>('PUBLIC_DISPLAY_ELIGIBLE')",
    );
    expect(source).toContain(
      "auditConfirmationAction === 'pass' && (!auditPublicEligibility",
    );
  });
});
