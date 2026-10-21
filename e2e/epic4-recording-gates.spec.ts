import path from "path";

import { expect, test, type Page } from "@playwright/test";

const JOB_ID = "epic4-declined-residence-job";
const CAPTURE_TOKEN = "epic4-controlled-capture-token";
const SCREENSHOT_ROOT = path.join(
  process.cwd(),
  "Project Management",
  "Epic 4 - Universal Work Record and Recording Gates",
  "08_Screenshots"
);

const canonicalBlock = {
  code: "VERIFIED_PERMISSION_DECLINED",
  why: "The customer declined recording for this residence service.",
  responsibleParticipant: "VENDOR_MANAGER",
  resolution: "Continue the service without recording or create a new request only if the scope changes.",
  serviceMayContinue: true,
};

const blockedJob = {
  id: JOB_ID,
  vendorId: "epic4-controlled-vendor",
  vendorName: "Controlled Home Services",
  title: "Residence electrical safety check",
  status: "PENDING",
  customer: {
    name: "Controlled Test Customer",
    email: "c***@example.test",
    phone: null,
  },
  bookingDate: "2026-08-04T14:00:00.000Z",
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
    canonicalBlock,
  },
  stageProgress: { INTRO: false, IN_PROGRESS: false, COMPLETED: false },
  canMarkComplete: false,
};

const unlockedJob = {
  ...blockedJob,
  id: "epic4-unlocked-vendor-property-job",
  title: "Vendor workshop equipment check",
  recordingCompliance: {
    ...blockedJob.recordingCompliance,
    location: "vendor_business",
    locationVerified: true,
    locationVerifiedAt: "2026-08-04T14:05:00.000Z",
    serviceOrderReleasedAt: "2026-08-04T14:04:00.000Z",
    permissionRequired: false,
    permissionStatus: "not_required",
    recordingUnlocked: true,
    canonicalBlock: null,
  },
};

const locationBlockedJob = {
  ...blockedJob,
  id: "epic4-location-blocked-residence-job",
  title: "Residence outlet installation",
  recordingCompliance: {
    ...blockedJob.recordingCompliance,
    serviceOrderReleasedAt: "2026-08-04T14:04:00.000Z",
    permissionStatus: "allowed",
    certificationActive: true,
    canonicalBlock: {
      code: "LOCATION_VERIFICATION_REQUIRED",
      why: "The employee device has not verified the saved service location.",
      responsibleParticipant: "EMPLOYEE",
      resolution: "Allow precise location and verify the saved service address.",
      serviceMayContinue: true,
    },
  },
};

const stageSafetyBlock = {
  code: "V2_RUNTIME_SAFETY_CHECK_REQUIRED",
  why: "A stage-specific employee safety and location check is required before recording.",
  responsibleParticipant: "EMPLOYEE",
  resolution: "Complete a fresh safety and location check for this stage.",
  serviceMayContinue: true,
};

const v2SafetyBlockedJob = {
  ...blockedJob,
  id: "epic4-v2-stage-safety-job",
  title: "Controlled V2 stage safety check",
  membershipId: "membership-v2-1",
  recordingCompliance: {
    ...blockedJob.recordingCompliance,
    location: "vendor_business",
    serviceLocation: "407 Boxwood Circle, Winter Springs, FL, 32708",
    locationVerified: true,
    serviceOrderReleasedAt: "2026-10-21T14:04:00.000Z",
    permissionStatus: "allowed",
    certificationActive: true,
    canonicalBlock: stageSafetyBlock,
    stageRecordingAccess: Object.fromEntries(
      ["INTRO", "IN_PROGRESS", "COMPLETED"].map((stage) => [
        stage,
        { recordingUnlocked: false, canonicalBlock: stageSafetyBlock },
      ]),
    ),
    v2ServiceOrder: {
      contractVersion: "employee-v2-service-order-runtime-v1",
      contextHash: "controlled-v2-stage-safety-context",
      serviceOrderCurrent: true,
      scope: {
        locationType: "Vendor business",
        serviceLocation: "407 Boxwood Circle, Winter Springs, FL, 32708",
        recordingBoundary: "Service area only",
        boundaryExplanation: null,
        audio: "Video only",
        intentionalParticipants: ["Assigned service professional"],
        recordingSubjects: ["Service area or equipment"],
        stages: ["Starting Condition", "Work in Progress", "Final Result"],
        privateUseNotice: "This job-specific choice permits Reliance recording only. It does not authorize Public use.",
      },
      participation: {
        required: true,
        employeeStatus: "ALLOWED",
        otherRequiredEmployeesPending: 0,
        canDecide: false,
      },
      policy: {
        identifier: "employee-recording-participation-counsel-review-required-v1",
        classification: "COUNSEL_REVIEW_PENDING",
        counselReviewRequired: true,
        allow: { label: "Allow recording participation", text: "Controlled allow text", textHash: "allow-hash" },
        decline: { label: "Decline recording participation", text: "Controlled decline text", textHash: "decline-hash" },
      },
      nextState: {
        status: "WAITING",
        title: "Stage safety check required",
        detail: "Complete the current stage safety and location check before recording.",
      },
    },
  },
};

async function installJobsResponse(
  page: Page,
  options: { jobs?: unknown[]; delayMs?: number; status?: number; error?: string } = {}
) {
  await page.route("**/api/employee/jobs?**", async (route) => {
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    const status = options.status ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status >= 400
          ? { success: false, error: options.error ?? "Assigned jobs are temporarily unavailable." }
          : { success: true, jobs: options.jobs ?? [], pendingServiceOrder: false }
      ),
    });
  });
}

async function installBlockedJob(page: Page) {
  let protectedRecordingRequestCount = 0;

  await page.route("**/api/employee/jobs?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, jobs: [blockedJob], pendingServiceOrder: false }),
    });
  });

  await page.route("**/api/vendors/**/media/**", async (route) => {
    protectedRecordingRequestCount += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: canonicalBlock.code, error: canonicalBlock.why }),
    });
  });

  return () => protectedRecordingRequestCount;
}

async function assertBlockedExperience(page: Page) {
  await page.goto(`/employee/jobs?jobId=${JOB_ID}&ct=${CAPTURE_TOKEN}`);

  await expect(page.getByRole("heading", { name: "Record Service Videos" })).toBeVisible();
  await expect(page.getByText(blockedJob.title, { exact: true })).toBeVisible();
  await expect(page.getByText("Recording is locked", { exact: true })).toBeVisible();
  await expect(page.getByText(canonicalBlock.why, { exact: false })).toBeVisible();
  await expect(page.getByText(/Who acts next:/)).toBeVisible();
  await expect(page.getByText(/vendor manager/i)).toBeVisible();
  await expect(page.getByText(canonicalBlock.resolution, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("The service may continue without recording while this is resolved.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Starting Condition/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Work in Progress/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Final Result/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Open Phone Camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record Live Camera" })).toHaveCount(0);
}

async function capture(page: Page, folder: "Desktop" | "Mobile", fileName: string) {
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, folder, fileName),
    fullPage: true,
  });
}

test.describe("Epic 4 canonical recording gate UX", () => {
  test("captures loading, empty, and failure states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installJobsResponse(page, { delayMs: 900 });
    const navigation = page.goto(`/employee/jobs?jobId=loading-job&ct=${CAPTURE_TOKEN}`);
    await expect(page.getByText(/Loading assigned jobs/)).toBeVisible();
    await capture(page, "Desktop", "02-loading-assigned-work.png");
    await navigation;
    await expect(page.getByText("Welcome to your work view")).toBeVisible();
    await capture(page, "Desktop", "03-empty-assigned-work.png");

    await page.unrouteAll({ behavior: "wait" });
    await installJobsResponse(page, { status: 503, error: "Assigned jobs are temporarily unavailable." });
    await page.reload();
    await expect(page.getByText("Employee workspace could not be loaded")).toBeVisible();
    await capture(page, "Desktop", "04-assigned-work-failure.png");
  });

  test("captures a canonically unlocked property-only assignment", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installJobsResponse(page, { jobs: [unlockedJob] });
    await page.goto(`/employee/jobs?jobId=${unlockedJob.id}&ct=${CAPTURE_TOKEN}`);

    await expect(page.getByText(unlockedJob.title, { exact: true })).toBeVisible();
    await expect(page.getByText("Recording is locked", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Starting Condition/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Work in Progress/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Final Result/ })).toBeEnabled();
    await capture(page, "Desktop", "05-recording-unlocked-success.png");
  });

  test("lets the employee resolve a residence location block from a stage", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 28.6989, longitude: -81.3081 });
    await installJobsResponse(page, { jobs: [locationBlockedJob] });

    let verificationRequestCount = 0;
    await page.route(`**/api/employee/jobs/${locationBlockedJob.id}/verify-location`, async (route) => {
      verificationRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          verified: true,
          location: "residence",
          distanceMeters: 8,
          recordingGate: { recordingUnlocked: true, blockCode: null, block: null },
        }),
      });
    });

    await page.goto(`/employee/jobs?jobId=${locationBlockedJob.id}&ct=${CAPTURE_TOKEN}`);
    await expect(page.getByText("Recording is locked", { exact: true })).toBeVisible();
    const startingCondition = page.getByRole("button", { name: /Starting Condition/ });
    await expect(startingCondition).toBeEnabled();
    await expect(startingCondition.getByText("Verify location to record", { exact: true })).toBeVisible();
    await capture(page, "Mobile", "06-residence-location-verification-action.png");

    await startingCondition.click();
    await expect.poll(() => verificationRequestCount).toBe(1);
  });

  test("shows visible safety acknowledgments and unlocks only the checked V2 stage", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 28.6989, longitude: -81.3081 });

    let safetyPassed = false;
    await page.route("**/api/employee/legal-assent?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, status: { current: true } }),
      });
    });
    await page.route("**/api/employee/jobs?**", async (route) => {
      const recordingCompliance = safetyPassed
        ? {
            ...v2SafetyBlockedJob.recordingCompliance,
            recordingUnlocked: true,
            canonicalBlock: null,
            stageRecordingAccess: {
              ...v2SafetyBlockedJob.recordingCompliance.stageRecordingAccess,
              INTRO: { recordingUnlocked: true, canonicalBlock: null },
            },
          }
        : v2SafetyBlockedJob.recordingCompliance;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          jobs: [{ ...v2SafetyBlockedJob, recordingCompliance }],
          pendingServiceOrder: false,
        }),
      });
    });
    await page.route(`**/api/employee/jobs/${v2SafetyBlockedJob.id}/verify-location`, async (route) => {
      const body = route.request().postDataJSON();
      expect(body.recordingStage).toBe("INTRO");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          verified: true,
          locationAttemptId: "location-attempt-v2-1",
          recordingGate: { recordingUnlocked: false, blockCode: stageSafetyBlock.code },
        }),
      });
    });
    await page.route(`**/api/employee/jobs/${v2SafetyBlockedJob.id}/safety-check`, async (route) => {
      const body = route.request().postDataJSON();
      expect(body.recordingStage).toBe("INTRO");
      expect(body.locationAttemptId).toBe("location-attempt-v2-1");
      expect(Object.values(body.acknowledgments)).toEqual([true, true, true, true, true]);
      safetyPassed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          recordingGate: { recordingUnlocked: true, blockCode: null, block: null },
        }),
      });
    });

    await page.goto(`/employee/jobs?jobId=${v2SafetyBlockedJob.id}&ct=${CAPTURE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "Complete safety and location check" })).toBeVisible();
    const acknowledgments = page.getByRole("checkbox");
    await expect(acknowledgments).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Verify location and complete check" })).toBeDisabled();

    for (let index = 0; index < 5; index += 1) {
      const acknowledgment = acknowledgments.nth(index);
      await acknowledgment.locator("xpath=..").click();
      await expect(acknowledgment).toBeChecked();
      await expect(acknowledgment.locator("xpath=following-sibling::span[1]").locator("svg")).toBeVisible();
    }

    await page.getByRole("button", { name: "Verify location and complete check" }).click();
    await expect(page.getByText("Starting Condition safety and location checks passed.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /Starting Condition/ }).getByText("Tap to record Before", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Complete safety and location check" })).toHaveCount(0);
  });

  test("explains a declined residence block on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const requestCount = await installBlockedJob(page);

    await assertBlockedExperience(page);
    await page.getByRole("button", { name: /Starting Condition/ }).click({ force: true });
    await expect.poll(requestCount).toBe(0);
    await capture(page, "Desktop", "01-declined-residence-recording-locked.png");
  });

  test("explains a declined residence block on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const requestCount = await installBlockedJob(page);

    await assertBlockedExperience(page);
    await page.getByRole("button", { name: /Starting Condition/ }).click({ force: true });
    await expect.poll(requestCount).toBe(0);
    await capture(page, "Mobile", "01-declined-residence-recording-locked.png");
  });
});
