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
    expect(page).toContain("Pending team invites");
    expect(page).toContain('if (r === "EMPLOYEE") return "Employee"');
    expect(page).toContain("Verified customer rating:");
    expect(page).not.toContain("Top rated");
    expect(page).not.toContain("Needs attention");
    expect(page).toContain('aria-labelledby="edit-team-member-title"');
    expect(page).toContain('aria-describedby="edit-team-member-description"');
    expect(page).toContain('aria-describedby="remove-team-member-description"');
    expect(page).toContain('fixed inset-0 z-[60]');
    expect(page).toContain('aria-controls={`pending-invite-${invite.id}`}');
    expect(page).toContain("A sign-in email can be changed only by the account owner");
    expect(page).toContain('aria-labelledby="remove-team-member-title"');
    expect(page).toContain("Existing Work Records, assignments, consent evidence");
    expect(page).toContain("setMemberPendingRemoval(emp)");
    expect(page).toContain("formatRelianceDateTime");
  });

  it("exposes notification filters and repeated actions with distinct names", () => {
    const page = source("src/app/vendor/notifications/page.tsx");

    expect(page).toContain('role="tablist"');
    expect(page).toContain("aria-selected={filter === value}");
    expect(page).toContain('aria-controls="notification-list"');
    expect(page).not.toContain('tabIndex={filter === value ? 0 : -1}');
    expect(page).toContain("pendingNotificationId");
    expect(page).toContain("View details for ${notification.title}");
    expect(page).toContain("Mark ${notification.title} as read");
    expect(page).toContain("formatRelianceDateTime(notification.time)");
  });

  it("keeps services usable on mobile and labels repeated actions", () => {
    const page = source("src/app/vendor/services/page.tsx");
    const workflow = source("src/lib/vendor-service-workflow.ts");

    expect(workflow).toContain("{ value: 'all', label: 'All active' }");
    expect(page).toContain('aria-label="Filter services by workflow stage"');
    expect(page).toContain('aria-label={`${tab.label} (${workflowTabCounts[tab.value]})`}');
    expect(page).toContain("block sm:hidden");
    expect(page).toContain("Edit ${service.name}");
    expect(page).toContain('aria-labelledby="service-editor-title"');
    expect(page).toContain('aria-describedby="service-editor-description"');
    expect(page).toContain('fixed inset-0 z-[60]');
    expect(page).toContain("Service created and queued for admin approval.");
    expect(page).toContain('type="submit"');
    expect(page).toContain("formatRelianceDate(service.updatedAt)");
  });

  it("distinguishes saved customer hours from unsaved profile drafts", () => {
    const page = source("src/app/vendor/profile/page.tsx");

    expect(page).toContain("const savedBusinessHoursStatus = getBusinessHoursStatus(savedBusinessHoursJson)");
    expect(page).toContain("const businessHoursDirty = serializeBusinessHours(businessHours) !== savedBusinessHoursJson");
    expect(page).toContain("Customers still see the saved hours above");
    expect(page).toContain("Suggested weekday hours are shown as a draft");
    expect(page).toContain("Your saved profile is still shown, but the last request failed");
    expect(page).toContain("Business-reported coverage status");
    expect(page).toContain("profileFieldErrors");
    expect(page).toContain("securitySettingsError");
    expect(page).toContain("<DialogDescription");
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
    expect(route).toContain("where: { vendorId, isCurrent: true }");
    expect(route).toContain("missingCurrentAssetIds");
  });

  it("integrates passive work-record access into the workflow panel", () => {
    const page = source("src/app/vendor/jobs/page.tsx");
    const smoke = source("e2e/route-smoke.spec.ts");

    expect(page).toContain("return 'Open Work Record'");
    expect(page).not.toContain("return 'View Job'");
    expect(page).toContain('aria-label="Work record progress"');
    expect(page).toContain('data-testid={`vendor-job-primary-action-${job.id}`}');
    expect(smoke).toContain("name: 'Open Work Record'");
  });

  it("keeps the assignment roster consistent with the employees shown in Assign Job", () => {
    const page = source("src/app/vendor/jobs/page.tsx");

    expect(page).toContain("Active Employees Eligible for Assignment");
    expect(page).toContain("{teamMembers.length} active");
    expect(page).toContain("These active employees appear in Assign Job");
    expect(page).toContain("{teamMembers.map(employee => (");
    expect(page).toContain("No active employees are eligible for assignment.");
    expect(page).not.toContain("getAvailableEmployees");
    expect(page).not.toContain("jobBlocksEmployeeAvailability");
  });

  it("routes unreleased Service Orders through Manager attestation before delivery", () => {
    const listPage = source("src/app/vendor/jobs/page.tsx");
    const detailPage = source("src/app/vendor/jobs/[jobId]/page.tsx");
    const attestation = source("src/components/vendor/ManagerWorkRecordAttestation.tsx");

    expect(listPage).toContain("serviceOrderReviewRequired:");
    expect(listPage).toContain("workflowAction === 'Review & Send Service Order'");
    expect(listPage).toContain("openJobDetails(job)");
    expect(detailPage).toContain("onStatusChange={setManagerAttestationCurrent}");
    expect(detailPage).toContain('action: "RELEASE_EMPLOYEE_SERVICE_ORDER"');
    expect(detailPage).toContain("managerAttestationCurrent &&");
    expect(detailPage).toContain('normalizeStatus(job.recordingCompliance?.permissionStatus)');
    expect(attestation).toContain("props.onStatusChange?.(body?.status?.current === true)");
  });

  it("warns managers when a secure permission link expires before scheduled service", () => {
    const page = source("src/app/vendor/jobs/page.tsx");

    expect(page).toContain("resolveVendorPermissionExpiryRisk");
    expect(page).toContain("Recording-permission link expires before this appointment");
    expect(page).toContain("send a new 48-hour link closer to service");
    expect(page).toContain("Manage Recording Permission");
  });
});
