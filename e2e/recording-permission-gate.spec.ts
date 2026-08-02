import path from "path";

import { expect, test, type Page } from "@playwright/test";

const CAPTURE_TOKEN = "controlled-declined-residence-capture";
const JOB_ID = "controlled-declined-residence-job";
const SCREENSHOT_ROOT = path.join(
  process.cwd(),
  "output",
  "epic1-screenshot-package",
  "After"
);

const declinedJob = {
  id: JOB_ID,
  vendorId: "controlled-vendor",
  vendorName: "Controlled Home Services",
  title: "Controlled residence service",
  status: "PENDING",
  customer: {
    name: "Controlled Test Customer",
    email: "c***@example.test",
    phone: null,
  },
  bookingDate: "2026-08-02T14:00:00.000Z",
  recordingCompliance: {
    location: "residence",
    locationVerified: false,
    locationVerifiedAt: null,
    serviceOrderReleasedAt: null,
    releasedMembershipIds: [],
    permissionRequired: true,
    permissionStatus: "declined",
    recordingUnlocked: false,
    recipientNeedsCorrection: false,
  },
  stageProgress: { INTRO: false, IN_PROGRESS: false, COMPLETED: false },
  canMarkComplete: false,
};

async function installDeclinedAssignment(page: Page) {
  let recordingRequestCount = 0;

  await page.route("**/api/employee/jobs?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, jobs: [declinedJob], pendingServiceOrder: false }),
    });
  });

  await page.route("**/api/vendors/**/media/**", async (route) => {
    recordingRequestCount += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        code: "VERIFIED_PERMISSION_REQUIRED",
        error: "Verified recording permission is required before recording can proceed.",
      }),
    });
  });

  return () => recordingRequestCount;
}

async function verifyDeclinedRecordingLock(page: Page) {
  await page.goto(`/employee/jobs?jobId=${JOB_ID}&ct=${CAPTURE_TOKEN}`);
  await expect(page.getByRole("heading", { name: "Record Service Videos" })).toBeVisible();
  await expect(page.getByText("Controlled residence service", { exact: true })).toBeVisible();
  await expect(page.getByText("Recording is locked")).toBeVisible();
  await expect(page.getByText("Status: declined", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Phone Camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record Live Camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Starting Condition/ })).toBeDisabled();
  await expect(page.getByText("Recording locked", { exact: true }).first()).toBeVisible();
}

test.describe("canonical recording permission gate", () => {
  test("declined residence assignment stays locked on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const getRecordingRequestCount = await installDeclinedAssignment(page);
    await verifyDeclinedRecordingLock(page);

    await page.getByRole("button", { name: /Starting Condition/ }).click({ force: true });
    await expect.poll(getRecordingRequestCount).toBe(0);

    await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
    await page.screenshot({
      path: path.join(SCREENSHOT_ROOT, "desktop-declined-residence-recording-locked.png"),
      fullPage: true,
    });
  });

  test("declined residence assignment stays locked on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const getRecordingRequestCount = await installDeclinedAssignment(page);
    await verifyDeclinedRecordingLock(page);

    await page.getByRole("button", { name: /Starting Condition/ }).click({ force: true });
    await expect.poll(getRecordingRequestCount).toBe(0);

    await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
    await page.screenshot({
      path: path.join(SCREENSHOT_ROOT, "mobile-declined-residence-recording-locked.png"),
      fullPage: true,
    });
  });
});
