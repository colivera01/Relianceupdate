import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Vendor operations UI contract", () => {
  it("keeps team invitations accessible and protects removal behind confirmation", () => {
    const page = source("src/app/vendor/employees/page.tsx");

    expect(page).toContain("Invite team member");
    expect(page).toContain("Public Service Video participation");
    expect(page).toContain('aria-labelledby="remove-team-member-title"');
    expect(page).toContain("Existing Work Records, assignments, consent evidence");
    expect(page).toContain("setMemberPendingRemoval(emp)");
    expect(page).toContain("formatRelianceDateTime");
  });

  it("exposes notification filters and repeated actions with distinct names", () => {
    const page = source("src/app/vendor/notifications/page.tsx");

    expect(page).toContain('role="tablist"');
    expect(page).toContain("aria-selected={filter === value}");
    expect(page).toContain("View details for ${notification.title}");
    expect(page).toContain("Mark ${notification.title} as read");
    expect(page).toContain("formatRelianceDateTime(notification.time)");
  });

  it("keeps services usable on mobile and labels repeated actions", () => {
    const page = source("src/app/vendor/services/page.tsx");
    const workflow = source("src/lib/vendor-service-workflow.ts");

    expect(workflow).toContain("{ value: 'all', label: 'All active' }");
    expect(page).toContain('aria-label="Filter services by workflow stage"');
    expect(page).toContain("block sm:hidden");
    expect(page).toContain("Edit ${service.name}");
    expect(page).toContain('aria-labelledby="service-editor-title"');
    expect(page).toContain("formatRelianceDate(service.updatedAt)");
  });

  it("distinguishes saved customer hours from unsaved profile drafts", () => {
    const page = source("src/app/vendor/profile/page.tsx");

    expect(page).toContain("const savedBusinessHoursStatus = getBusinessHoursStatus(savedBusinessHoursJson)");
    expect(page).toContain("const businessHoursDirty = serializeBusinessHours(businessHours) !== savedBusinessHoursJson");
    expect(page).toContain("Customers still see the saved hours above");
    expect(page).toContain("Suggested weekday hours are shown as a draft");
    expect(page).toContain('aria-label={`${businessHourDayLabels[day.day]} hours enabled`}');
    expect(page).toContain('type="button"');
  });

  it("separates exact current package assets from retained media history", () => {
    const page = source("src/app/vendor/telemetry/page.tsx");
    const route = source("src/app/api/vendors/[vendorId]/media/route.ts");

    expect(page).toContain("Current package v{asset.currentPackageVersion}");
    expect(page).toContain("Media history");
    expect(page).toContain("Open Work Record");
    expect(page).not.toContain("See whether employee devices are connected");
    expect(route).toContain("parsePackageStageAssets");
    expect(route).toContain("isCurrentPackageAsset: Boolean(currentPackage)");
    expect(route).toContain("bookingId: { in: bookingIds }, isCurrent: true");
  });
});
