import path from "path";

import { expect, test, type Page } from "@playwright/test";

const SCREENSHOT_ROOT = path.join(
  process.cwd(),
  "Project Management",
  "Epic 5 - Safe Capture Through Private Service Videos",
  "08_Screenshots"
);
const EMPLOYEE_JOB_ID = "epic5-controlled-employee-job";
const VENDOR_ID = "epic5-controlled-vendor";
const CAPTURE_TOKEN = "epic5-controlled-capture-token";

const unlockedEmployeeJob = {
  id: EMPLOYEE_JOB_ID,
  vendorId: VENDOR_ID,
  vendorName: "Controlled Proof Services",
  title: "Controlled outlet safety service",
  status: "PENDING",
  customer: {
    name: "Controlled Test Customer",
    email: "customer@example.test",
    phone: null,
  },
  bookingDate: "2026-08-05T14:00:00.000Z",
  recordingCompliance: {
    location: "business",
    locationVerified: true,
    locationVerifiedAt: "2026-08-05T13:58:00.000Z",
    serviceOrderReleasedAt: "2026-08-05T13:57:00.000Z",
    releasedMembershipIds: ["epic5-controlled-membership"],
    permissionRequired: false,
    permissionStatus: "not_required",
    recordingUnlocked: true,
    canonicalBlock: null,
    scopeSummary: {
      propertyScope: "WORK_AREA_ONLY",
      peopleScope: "NO_IDENTIFIABLE_PEOPLE",
    },
  },
  stageProgress: { INTRO: false, IN_PROGRESS: false, COMPLETED: false },
  canMarkComplete: false,
};

async function removeDevPortal(page: Page) {
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
}

async function capture(page: Page, folder: "Desktop" | "Mobile", fileName: string) {
  await removeDevPortal(page);
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, folder, fileName),
    fullPage: true,
  });
}

async function installEmployeeFixture(
  page: Page,
  options: {
    failUpload?: boolean;
    allSaved?: boolean;
    awaitingReview?: boolean;
    correctionStage?: "INTRO" | "IN_PROGRESS" | "COMPLETED";
  } = {},
) {
  let saved = Boolean(options.allSaved);

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: {
              latitude: 28.6012,
              longitude: -81.3392,
              accuracy: 8,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition),
      },
    });
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
  });

  await page.route("https://uploads.reliance.test/**", async (route) => {
    if (options.failUpload) {
      await route.fulfill({ status: 503, body: "controlled upload failure" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill({ status: 201, body: "" });
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === "/api/employee/jobs") {
      const stageProgress = saved
        ? { INTRO: true, IN_PROGRESS: true, COMPLETED: true }
        : unlockedEmployeeJob.stageProgress;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          pendingServiceOrder: false,
          jobs: [{
            ...unlockedEmployeeJob,
            status: options.awaitingReview
              ? "AWAITING_REVIEW"
              : options.correctionStage
                ? "REJECTED"
                : unlockedEmployeeJob.status,
            rejectionReason: options.correctionStage ? "Please replace the Final Result stage." : null,
            stageProgress,
            canMarkComplete: options.awaitingReview ? false : saved,
            recordingCompliance: options.awaitingReview
              ? {
                  ...unlockedEmployeeJob.recordingCompliance,
                  recordingUnlocked: false,
                  canonicalBlock: {
                    code: "MANAGER_REVIEW_IN_PROGRESS",
                    why: "The completed Service Videos were submitted for manager review.",
                    responsibleParticipant: "VENDOR_MANAGER",
                    resolution: "Wait for manager review.",
                    serviceMayContinue: true,
                  },
                  stageRecordingAccess: {
                    INTRO: {
                      recordingUnlocked: false,
                      canonicalBlock: {
                        code: "MANAGER_REVIEW_IN_PROGRESS",
                        why: "The completed Service Videos were submitted for manager review.",
                        responsibleParticipant: "VENDOR_MANAGER",
                        resolution: "Wait for manager review.",
                        serviceMayContinue: true,
                      },
                    },
                    IN_PROGRESS: {
                      recordingUnlocked: false,
                      canonicalBlock: {
                        code: "MANAGER_REVIEW_IN_PROGRESS",
                        why: "The completed Service Videos were submitted for manager review.",
                        responsibleParticipant: "VENDOR_MANAGER",
                        resolution: "Wait for manager review.",
                        serviceMayContinue: true,
                      },
                    },
                    COMPLETED: {
                      recordingUnlocked: false,
                      canonicalBlock: {
                        code: "MANAGER_REVIEW_IN_PROGRESS",
                        why: "The completed Service Videos were submitted for manager review.",
                        responsibleParticipant: "VENDOR_MANAGER",
                        resolution: "Wait for manager review.",
                        serviceMayContinue: true,
                      },
                    },
                  },
                }
              : options.correctionStage
                ? {
                    ...unlockedEmployeeJob.recordingCompliance,
                    recordingUnlocked: true,
                    correctionRequestedStages: [options.correctionStage],
                    stageRecordingAccess: {
                      INTRO: {
                        recordingUnlocked: options.correctionStage === "INTRO",
                        canonicalBlock: options.correctionStage === "INTRO"
                          ? null
                          : {
                              code: "MANAGER_CORRECTION_STAGE_NOT_REQUESTED",
                              why: "The manager did not request a correction for this stage.",
                              responsibleParticipant: "EMPLOYEE",
                              resolution: "Record only the stage requested by the manager.",
                              serviceMayContinue: true,
                            },
                      },
                      IN_PROGRESS: {
                        recordingUnlocked: options.correctionStage === "IN_PROGRESS",
                        canonicalBlock: options.correctionStage === "IN_PROGRESS"
                          ? null
                          : {
                              code: "MANAGER_CORRECTION_STAGE_NOT_REQUESTED",
                              why: "The manager did not request a correction for this stage.",
                              responsibleParticipant: "EMPLOYEE",
                              resolution: "Record only the stage requested by the manager.",
                              serviceMayContinue: true,
                            },
                      },
                      COMPLETED: {
                        recordingUnlocked: options.correctionStage === "COMPLETED",
                        canonicalBlock: options.correctionStage === "COMPLETED"
                          ? null
                          : {
                              code: "MANAGER_CORRECTION_STAGE_NOT_REQUESTED",
                              why: "The manager did not request a correction for this stage.",
                              responsibleParticipant: "EMPLOYEE",
                              resolution: "Record only the stage requested by the manager.",
                              serviceMayContinue: true,
                            },
                      },
                    },
                  }
              : unlockedEmployeeJob.recordingCompliance,
          }],
        }),
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/sessions` && request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, session: { id: "epic5-controlled-session" } }),
      });
      return;
    }

    if (pathname === `/api/employee/jobs/${EMPLOYEE_JOB_ID}/verify-location`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, verified: true }),
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/upload/init`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          assetId: "epic5-controlled-asset",
          blobKey: "epic5/controlled-stage.mp4",
          sasUrl: "https://uploads.reliance.test/controlled-stage.mp4",
        }),
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/upload/proxy`) {
      await route.fulfill({
        status: options.failUpload ? 503 : 201,
        contentType: "application/json",
        body: JSON.stringify(
          options.failUpload
            ? { success: false, error: "Controlled network interruption" }
            : { success: true }
        ),
      });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/upload/status`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }

    if (pathname === `/api/vendors/${VENDOR_ID}/media/upload/complete`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, uploadState: "SAVED" }),
      });
      return;
    }

    if (pathname === `/api/employee/jobs/${EMPLOYEE_JOB_ID}/stage`) {
      saved = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
}

async function openEmployeeCapture(page: Page) {
  await page.goto(`/employee/jobs?jobId=${EMPLOYEE_JOB_ID}&ct=${CAPTURE_TOKEN}`);
  await expect(page.getByText(unlockedEmployeeJob.title, { exact: true })).toBeVisible();
}

async function createPlayableWebmFixture(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for the preview fixture.");

    const stream = canvas.captureStream(10);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
    let frame = 0;
    const frameTimer = window.setInterval(() => {
      context.fillStyle = frame % 2 === 0 ? "#0f172a" : "#172554";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#3b82f6";
      context.fillRect(8 + (frame % 12), 12, 40, 40);
      frame += 1;
    }, 80);

    recorder.start(100);
    await new Promise((resolve) => window.setTimeout(resolve, 1_200));
    window.clearInterval(frameTimer);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    return Array.from(new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer()));
  });

  return Buffer.from(bytes);
}

async function selectFallbackVideo(page: Page, playableWebm?: Buffer) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Starting Condition/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(
    playableWebm
      ? { name: "controlled-preview.webm", mimeType: "video/webm", buffer: playableWebm }
      : path.join(process.cwd(), "public", "homepage", "service-video-stages", "before-service.mp4")
  );
  await expect(page.getByText("Preview before saving", { exact: true })).toBeVisible();
}

test.describe("Epic 5 safe Private Service Video UX", () => {
  test("keeps every submitted stage read-only after refresh and a fresh link open", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installEmployeeFixture(page, { allSaved: true, awaitingReview: true });
    await openEmployeeCapture(page);

    await expect(page.getByText("Service Videos submitted", { exact: true })).toBeVisible();
    await expect(page.getByText("Manager review is in progress.", { exact: true })).toBeVisible();
    await expect(page.getByText("Locked for manager review", { exact: true })).toHaveCount(3);
    await expect(page.getByText("Saved - tap to replace", { exact: true })).toHaveCount(0);

    await page.reload();
    await expect(page.getByText("Locked for manager review", { exact: true })).toHaveCount(3);

    const reopenedPage = await context.newPage();
    await installEmployeeFixture(reopenedPage, { allSaved: true, awaitingReview: true });
    await openEmployeeCapture(reopenedPage);
    await expect(reopenedPage.getByText("Locked for manager review", { exact: true })).toHaveCount(3);
    await expect(reopenedPage.getByText("Saved - tap to replace", { exact: true })).toHaveCount(0);
  });

  test("reopens only the exact stage requested by the manager", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installEmployeeFixture(page, { allSaved: true, correctionStage: "COMPLETED" });
    await openEmployeeCapture(page);

    await expect(page.getByText("Manager requested changes", { exact: true })).toBeVisible();
    await expect(page.getByText("Locked - no correction requested", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Correction requested - tap to replace", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Saved - tap to replace", { exact: true })).toHaveCount(0);
  });

  test("shows server-confirmed Saved stages and ready-to-submit progress", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await installEmployeeFixture(page, { allSaved: true });
    await openEmployeeCapture(page);
    await expect(page.getByText("3 of 3 stages uploaded", { exact: true })).toBeVisible();
    await expect(page.getByText("Saved - tap to replace", { exact: true })).toHaveCount(3);
    await capture(page, "Desktop", "01-employee-three-stages-saved.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText("3 of 3 stages uploaded", { exact: true })).toBeVisible();
    await capture(page, "Mobile", "01-employee-three-stages-saved.png");
  });

  test("shows Uploading then Retry Required while preserving the preview", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installEmployeeFixture(page, { failUpload: true });
    await openEmployeeCapture(page);
    await selectFallbackVideo(page);
    await page.getByRole("button", { name: "Confirm and Save" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Retry Required: Controlled network interruption" })
    ).toBeVisible();
    await expect(page.getByText("Retry required", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry Save" })).toBeEnabled();
    await capture(page, "Mobile", "02-employee-retry-required-draft-preserved.png");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture(page, "Desktop", "02-employee-retry-required-draft-preserved.png");
  });

  test("plays the local draft explicitly before Confirm and Save", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const playableWebm = await createPlayableWebmFixture(page);
    expect(playableWebm.byteLength).toBeGreaterThan(100);
    await installEmployeeFixture(page);
    await openEmployeeCapture(page);
    await selectFallbackVideo(page, playableWebm);

    const preview = page.locator("video").last();
    await expect(page.getByRole("button", { name: "Play Preview" })).toBeVisible();
    await page.getByRole("button", { name: "Play Preview" }).click();
    await expect.poll(() => preview.evaluate((video) => !(video as HTMLVideoElement).paused)).toBe(true);
    await expect(page.getByRole("button", { name: "Pause Preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm and Save" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Retake", exact: true })).toBeEnabled();
  });
});
