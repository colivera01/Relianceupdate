import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Vendor Manager review UI contract", () => {
  it("requires exact-package confirmation before the audit action", () => {
    const page = source("src/app/vendor/jobs/[jobId]/page.tsx");

    expect(page).toContain("Submit exact package to Reliance Audit");
    expect(page).toContain("I reviewed the three current stage videos");
    expect(page).toContain("managerReviewAcknowledged: true");
    expect(page).toContain("packageId: job.serviceVideoPackage.id");
    expect(page).toContain("disabled={submitting || !auditAcknowledged || !allStagesReviewed}");
    expect(page).toContain("Manager review progress");
    expect(page).toContain("allStagesReviewed");
  });

  it("presents a non-terminal exact-stage correction workflow", () => {
    const page = source("src/app/vendor/jobs/[jobId]/page.tsx");

    expect(page).toContain("Request stage correction");
    expect(page).toContain("stages: correctionStages");
    expect(page).toContain("Send Correction Request");
    expect(page).toContain("Unselected stages remain bound");
    expect(page).not.toContain("Reject Completed Work Order");
    expect(page).not.toContain("Reject Work Order");
  });

  it("keeps load failures separate from Manager action failures", () => {
    const page = source("src/app/vendor/jobs/[jobId]/page.tsx");

    expect(page).toContain("const [loadError, setLoadError]");
    expect(page).toContain("const [actionError, setActionError]");
    expect(page).toContain("That action was not completed.");
  });

  it("keeps dark-dialog actions readable", () => {
    const page = source("src/app/vendor/jobs/[jobId]/page.tsx");
    const readableCancelClasses =
      "border-slate-500 bg-transparent text-white hover:bg-white/10 hover:text-white";

    expect(page).toContain(readableCancelClasses);
    expect(page).toContain('aria-label="Watch previous stage video"');
    expect(page).toContain('aria-label="Watch next stage video"');
    expect(page).toContain("Corrected replacement");
    expect(page).toContain('aria-label={`${correctionRequestedForStage ? "Watch prior" : "Watch"} ${stage.label} video`}');
  });

  it("renders the dashboard API's exact current package version", () => {
    const page = source("src/app/vendor/jobs/page.tsx");

    expect(page).toContain("job.serviceVideoPackage.version || 1");
    expect(page).not.toContain("job.serviceVideoPackage.packageVersion || 1");
    expect(page).not.toContain("job.serviceVideoPackage?.packageVersion || 1");
  });

  it("uses compact, fully readable mobile navigation labels", () => {
    const layout = source("src/app/vendor/layout.tsx");

    expect(layout).toContain("if (label === 'Notifications') return 'Alerts'");
    expect(layout).toContain("if (label === 'Manage Jobs') return 'Jobs'");
    expect(layout).toContain("aria-label={link.label}");
  });
});
