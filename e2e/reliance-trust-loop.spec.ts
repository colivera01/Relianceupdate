import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

const FIXTURE_PATH = path.join(__dirname, "smoke-fixture.json");
const DEFAULT_PASSWORD = "E2E_Smoke_dev_only_9!";
const REVIEW_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const prisma = new PrismaClient();

type SmokeFixture = {
  serviceId: string;
  serviceNameSearch: string;
  customerEmail: string;
};

type ActorContext = {
  managerUserId: string;
  managerMembershipId: string;
  managerDisplayName: string;
  employeeUserId: string;
  employeeMembershipId: string;
  employeeRecordId: string;
  employeeDisplayName: string;
  adminUserId: string;
  vendorId: string;
  serviceId: string;
};

function readFixture(): SmokeFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as SmokeFixture;
}

async function waitForSignInToLeaveLoginPage(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForFunction(() => !window.location.pathname.includes("/auth/login"), null, {
    timeout: 30_000,
  });
}

async function apiJson(
  request: APIRequestContext,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body: unknown,
  headers: Record<string, string>
) {
  const response = await request.fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    data: body,
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function ensureActors(vendorId: string, serviceId: string): Promise<ActorContext> {
  const managerEmail = "e2e-trust-manager@reliance.test";
  const employeeEmail = "e2e-trust-employee@reliance.test";
  const adminEmail = "e2e-trust-admin@reliance.test";

  const managerUser = await prisma.user.upsert({
    where: { email: managerEmail },
    update: { name: "E2E Trust Manager" },
    create: { email: managerEmail, name: "E2E Trust Manager", demo: true },
    select: { id: true, name: true },
  });
  const employeeUser = await prisma.user.upsert({
    where: { email: employeeEmail },
    update: { name: "E2E Trust Employee" },
    create: { email: employeeEmail, name: "E2E Trust Employee", demo: true },
    select: { id: true, name: true },
  });
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "E2E Trust Admin" },
    create: { email: adminEmail, name: "E2E Trust Admin", demo: true },
    select: { id: true },
  });

  const managerMembership = await (prisma as any).vendorMembership.upsert({
    where: { vendorId_userId: { vendorId, userId: managerUser.id } },
    update: { role: "MANAGER", status: "ACTIVE", approvedAt: new Date() },
    create: {
      vendorId,
      userId: managerUser.id,
      role: "MANAGER",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
    select: { id: true },
  });
  const employeeMembership = await (prisma as any).vendorMembership.upsert({
    where: { vendorId_userId: { vendorId, userId: employeeUser.id } },
    update: { role: "EMPLOYEE", status: "ACTIVE", approvedAt: new Date() },
    create: {
      vendorId,
      userId: employeeUser.id,
      role: "EMPLOYEE",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
    select: { id: true },
  });
  const existingEmployeeRecord = await (prisma as any).employee.findFirst({
    where: {
      vendorId,
      email: employeeEmail,
    },
    select: { id: true },
  });
  const employeeRecord = existingEmployeeRecord
    ? await (prisma as any).employee.update({
        where: { id: existingEmployeeRecord.id },
        data: {
          name: "E2E Trust Employee",
          role: "TECHNICIAN",
        },
        select: { id: true },
      })
    : await (prisma as any).employee.create({
        data: {
          vendorId,
          name: "E2E Trust Employee",
          email: employeeEmail,
          role: "TECHNICIAN",
          demo: true,
        },
        select: { id: true },
      });

  await prisma.service.update({
    where: { id: serviceId },
    data: { isPublished: true },
  });

  return {
    managerUserId: managerUser.id,
    managerMembershipId: String(managerMembership.id),
    managerDisplayName: String(managerUser.name || "E2E Trust Manager"),
    employeeUserId: employeeUser.id,
    employeeMembershipId: String(employeeMembership.id),
    employeeRecordId: String(employeeRecord.id),
    employeeDisplayName: String(employeeUser.name || "E2E Trust Employee"),
    adminUserId: adminUser.id,
    vendorId,
    serviceId,
  };
}

test.describe.configure({ mode: "serial" });

test("full proof-to-review trust loop (live routes)", async ({ page, request }) => {
  test.setTimeout(720_000);
  page.on("dialog", (dialog) => dialog.accept());

  const fixture = readFixture();
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD;
  const runTag = Date.now();
  const bookingClientName = `E2E Trust Loop Client ${runTag}`;
  const reviewComment = `E2E trust loop review ${runTag}`;

  // STEP 1 — Customer creates booking
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(fixture.customerEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await waitForSignInToLeaveLoginPage(page);

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: /Discover( Services)?/i }).first()).toBeVisible();
  await page.getByPlaceholder("Search for services or vendors...").fill(fixture.serviceNameSearch);
  await page.keyboard.press("Enter");
  const serviceLink = page.getByRole("link", { name: "View Service" }).first();
  await expect(serviceLink).toBeVisible({ timeout: 30_000 });
  const serviceLinkHref = await serviceLink.getAttribute("href");
  const serviceLinkText = (await serviceLink.textContent())?.trim() || "";
  console.log("[trust-loop][book-now] discover url before service click:", page.url());
  console.log("[trust-loop][book-now] selected service link href:", serviceLinkHref);
  console.log("[trust-loop][book-now] selected service link text:", serviceLinkText);
  await serviceLink.click();
  await page.waitForURL(new RegExp(`/service/${fixture.serviceId}(\\?.*)?$`));
  console.log("[trust-loop][book-now] url after service click:", page.url());

  const bookNowButton = page.getByRole("link", { name: "Book Now" }).first();
  await expect(bookNowButton).toBeVisible({ timeout: 30_000 });
  await expect(bookNowButton).toBeEnabled({ timeout: 30_000 });
  console.log("[trust-loop][book-now] url before Book Now click:", page.url());
  await Promise.all([
    page.waitForURL(`**/booking/${fixture.serviceId}`, { timeout: 60_000 }),
    bookNowButton.click(),
  ]);
  console.log("[trust-loop][book-now] url after Book Now click:", page.url());
  await page.locator('[data-testid^="booking-slot-date-"]').first().click();
  await page.locator('[data-testid^="booking-slot-time-"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Enter your full name").fill(bookingClientName);
  await page.getByPlaceholder("Enter your email").fill(fixture.customerEmail);
  await page.getByPlaceholder("Enter your phone number").fill("555-0111");
  await page.getByPlaceholder("Enter the address where you need the service").fill("100 Trust Loop Ave");
  await page.getByRole("button", { name: "Continue" }).click();
  console.log("[trust-loop][booking] url before confirm click:", page.url());
  const bookingPostPromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/bookings");
  });
  await page.getByRole("button", { name: "Confirm booking" }).click();
  const bookingPostResponse = await bookingPostPromise;
  const bookingPostStatus = bookingPostResponse.status();
  const bookingPostBody = await bookingPostResponse.text().catch(() => "");
  console.log("[trust-loop][booking] POST /api/bookings status:", bookingPostStatus);
  console.log("[trust-loop][booking] POST /api/bookings body:", bookingPostBody);

  await page.waitForURL(new RegExp(`/booking/${fixture.serviceId}/confirmation\\?bookingId=`), { timeout: 60_000 });
  console.log("[trust-loop][booking] url after confirm click:", page.url());
  const bookingIdMatch = page.url().match(/bookingId=([^&]+)/);
  const confirmationHeadingVisible = await page
    .getByRole("heading", { name: "Booking Confirmed!" })
    .isVisible()
    .catch(() => false);
  const confirmationLoadErrorVisible = await page
    .getByText("Unable to load booking confirmation")
    .isVisible()
    .catch(() => false);
  console.log("[trust-loop][booking] confirmation heading visible:", confirmationHeadingVisible);
  console.log("[trust-loop][booking] confirmation load error visible:", confirmationLoadErrorVisible);
  expect(bookingIdMatch?.[1], "booking id should exist in confirmation URL").toBeTruthy();
  const bookingId = decodeURIComponent(String(bookingIdMatch?.[1]));
  console.log("[trust-loop] bookingId:", bookingId);

  // Some confirmation variants render different CTA labels; navigate directly.
  await page.goto("/my-bookings");
  await page.waitForURL(/\/my-bookings/);
  await expect(page.getByTestId(`my-bookings-row-${bookingId}`)).toBeVisible({ timeout: 30_000 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { vendorId: true, serviceId: true, userId: true },
  });
  expect(booking?.vendorId).toBeTruthy();
  expect(booking?.serviceId).toBeTruthy();
  expect(booking?.userId).toBeTruthy();

  const actors = await ensureActors(String(booking?.vendorId), String(booking?.serviceId));
  console.log("[trust-loop] selected employee:", actors.employeeDisplayName, actors.employeeMembershipId);

  // STEP 2 — Vendor assigns employee
  const assignRes = await apiJson(
    request,
    "PATCH",
    `/api/vendors/${actors.vendorId}/jobs/${bookingId}/actions`,
    {
      action: "ASSIGN_JOB",
      assignedMembershipIds: [actors.employeeMembershipId],
    },
    {
      "x-user-id": actors.managerUserId,
      "x-vendor-id": actors.vendorId,
    }
  );
  expect(assignRes.response.ok(), JSON.stringify(assignRes.json)).toBeTruthy();
  expect(assignRes.json?.job?.assignedMembershipIds?.includes(actors.employeeMembershipId)).toBeTruthy();

  // STEP 3 — Employee uploads stages (seed assets, then submit stage completion)
  const stageSessionIds: Record<"INTRO" | "IN_PROGRESS" | "COMPLETED", string> = {
    INTRO: "",
    IN_PROGRESS: "",
    COMPLETED: "",
  };
  for (const stage of ["INTRO", "IN_PROGRESS", "COMPLETED"] as const) {
    const employeeIdUsed = actors.employeeRecordId;
    console.log("[E2E MEDIA SESSION FK]", {
      employeeIdUsed,
      employeeUserId: actors.employeeUserId,
      employeeMembershipId: actors.employeeMembershipId,
      bookingId,
      vendorId: actors.vendorId,
    });
    const session = await (prisma as any).mediaSession.create({
      data: {
        vendorId: actors.vendorId,
        bookingId,
        serviceId: actors.serviceId,
        userId: String(booking?.userId),
        employeeId: employeeIdUsed,
        sessionType: "JOB_SERVICE_VIDEO",
        status: "COMPLETED",
        title: `E2E ${stage} proof ${runTag}`,
        vendorJobVideoStage: stage,
      },
      select: { id: true },
    });
    stageSessionIds[stage] = String(session.id);
    await (prisma as any).mediaAsset.create({
      data: {
        vendorId: actors.vendorId,
        mediaSessionId: session.id,
        uploadedByMembershipId: actors.employeeMembershipId,
        bytes: BigInt(2048),
        mimeType: "video/mp4",
        blobKey: `e2e/trust-loop/${bookingId}/${stage.toLowerCase()}.mp4`,
        blobUrl: REVIEW_VIDEO_URL,
        moderationStatus: "pending_review",
        visibilityStatus: "private",
        archiveStatus: "active",
      },
    });

    const stageRes = await apiJson(
      request,
      "POST",
      `/api/employee/jobs/${bookingId}/stage`,
      { stage },
      {
        "x-user-id": actors.employeeUserId,
      }
    );
    expect(stageRes.response.ok(), `${stage} failed: ${JSON.stringify(stageRes.json)}`).toBeTruthy();
  }
  const awaiting = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });
  expect(awaiting?.status).toBe("AWAITING_REVIEW");

  // STEP 4 — Manager approves completion
  const approveRes = await apiJson(
    request,
    "POST",
    `/api/vendors/${actors.vendorId}/jobs/${bookingId}/approve`,
    {},
    {
      "x-user-id": actors.managerUserId,
      "x-vendor-id": actors.vendorId,
    }
  );
  expect(approveRes.response.ok(), JSON.stringify(approveRes.json)).toBeTruthy();
  expect(String(approveRes.json?.job?.status || "").toUpperCase()).toBe("COMPLETED");

  // STEP 5 — Admin moderation approves package with public visibility
  const moderationRes = await apiJson(
    request,
    "PATCH",
    `/api/admin/media/packages/${bookingId}/moderate`,
    { action: "approve", visibility: "public" },
    {
      "x-user-id": actors.adminUserId,
      "x-user-role": "admin",
      "x-admin": "1",
    }
  );
  expect(moderationRes.response.ok(), JSON.stringify(moderationRes.json)).toBeTruthy();
  expect(Array.isArray(moderationRes.json?.updatedAssets)).toBeTruthy();

  // Ensure customer consent exists for review window start.
  await (prisma as any).consentRecord.create({
    data: {
      token: `e2e-trust-consent-${randomUUID()}`,
      bookingId,
      vendorId: actors.vendorId,
      mediaSessionId: stageSessionIds.COMPLETED,
      consentType: "video_access",
      status: "accepted",
      acceptedAt: new Date(),
    },
  });

  const startWindowRes = await apiJson(
    request,
    "POST",
    "/api/reviews/window/start",
    {
      bookingId,
      vendorId: actors.vendorId,
      mediaSessionId: stageSessionIds.COMPLETED,
    },
    {
      "x-user-id": String(booking?.userId),
    }
  );
  expect(startWindowRes.response.ok(), JSON.stringify(startWindowRes.json)).toBeTruthy();
  const reviewWindowId = String(startWindowRes.json?.reviewWindow?.id || "");
  expect(reviewWindowId).toBeTruthy();

  // STEP 6 — Customer views proof
  const bookingBeforeProofCheck = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, status: true },
  });
  const approvedCustomerVisibleMediaCount = await (prisma as any).mediaAsset.count({
    where: {
      moderationStatus: "approved",
      archiveStatus: { in: ["active", "ACTIVE"] },
      visibilityStatus: { in: ["customer_only", "public"] },
      mediaSession: {
        bookingId,
      },
    },
  });
  console.log("[trust-loop][proof] booking ownership/status:", {
    bookingId: bookingBeforeProofCheck?.id,
    bookingUserId: bookingBeforeProofCheck?.userId,
    expectedCustomerUserId: String(booking?.userId),
    status: bookingBeforeProofCheck?.status,
  });
  console.log("[trust-loop][proof] approved customer-visible media count:", approvedCustomerVisibleMediaCount);

  const customerBookingApiRes = await request.fetch(`/api/bookings/${bookingId}`, {
    headers: { "x-user-id": String(booking?.userId) },
  });
  const customerBookingApiBody = await customerBookingApiRes.text().catch(() => "");
  console.log("[trust-loop][proof] direct GET /api/bookings/:id status:", customerBookingApiRes.status());
  console.log("[trust-loop][proof] direct GET /api/bookings/:id body:", customerBookingApiBody);

  const customerMediaApiRes = await request.fetch(`/api/bookings/${bookingId}/media`, {
    headers: { "x-user-id": String(booking?.userId) },
  });
  const customerMediaApiBody = await customerMediaApiRes.text().catch(() => "");
  console.log("[trust-loop][proof] direct GET /api/bookings/:id/media status:", customerMediaApiRes.status());
  console.log("[trust-loop][proof] direct GET /api/bookings/:id/media body:", customerMediaApiBody);

  const proofBookingResponsePromise = page.waitForResponse((response) => {
    const url = response.url();
    return (
      response.request().method() === "GET" &&
      url.includes(`/api/bookings/${bookingId}`) &&
      !url.includes(`/api/bookings/${bookingId}/media`)
    );
  });
  const proofMediaResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === "GET" && response.url().includes(`/api/bookings/${bookingId}/media`);
  });
  await page.goto(`/my-bookings/${bookingId}?proofReady=1`);
  const [proofBookingResponse, proofMediaResponse] = await Promise.all([
    proofBookingResponsePromise,
    proofMediaResponsePromise,
  ]);
  console.log("[trust-loop][proof] browser GET /api/bookings/:id status:", proofBookingResponse.status());
  console.log(
    "[trust-loop][proof] browser GET /api/bookings/:id body:",
    await proofBookingResponse.text().catch(() => "")
  );
  console.log("[trust-loop][proof] browser GET /api/bookings/:id/media status:", proofMediaResponse.status());
  console.log(
    "[trust-loop][proof] browser GET /api/bookings/:id/media body:",
    await proofMediaResponse.text().catch(() => "")
  );
  console.log("[trust-loop][proof] url:", page.url());
  const customerSessionSnapshot = await page.evaluate(() => {
    const readStorage = (storage: Storage) => {
      const out: Record<string, string> = {};
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;
        out[key] = storage.getItem(key) || "";
      }
      return out;
    };
    return {
      localStorage: readStorage(window.localStorage),
      sessionStorage: readStorage(window.sessionStorage),
    };
  });
  const contextCookies = await page.context().cookies();
  console.log("[trust-loop][proof] customer storage snapshot:", customerSessionSnapshot);
  console.log(
    "[trust-loop][proof] customer cookies:",
    contextCookies.map((cookie) => ({ name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path }))
  );
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 1000);
  console.log("[trust-loop][proof] body text (first 1000 chars):", bodyText);
  const loadBookingProofErrorVisible = await page.getByText("We couldn't load this booking proof.").first().isVisible().catch(() => false);
  const loadingSkeletonVisible = (await page.locator(".animate-pulse").count().catch(() => 0)) > 0;
  const signInPromptVisible = await page.getByText("Sign in to continue").first().isVisible().catch(() => false);
  const accessDeniedVisible = await page.getByText("Unauthorized").first().isVisible().catch(() => false);
  console.log("[trust-loop][proof] load booking proof error visible:", loadBookingProofErrorVisible);
  console.log("[trust-loop][proof] loading skeleton visible:", loadingSkeletonVisible);
  console.log("[trust-loop][proof] sign-in prompt visible:", signInPromptVisible);
  console.log("[trust-loop][proof] access denied text visible:", accessDeniedVisible);
  const headingTexts = (await page.locator("h1, h2").allTextContents()).map((text) => text.trim()).filter(Boolean);
  console.log("[trust-loop][proof] visible headings:", headingTexts);
  const serviceVideosLabelVisible = await page.getByText("Service Videos").first().isVisible().catch(() => false);
  const proofTimelineVisible = await page.getByText("Service Video Timeline").first().isVisible().catch(() => false);
  const finalResultVisible = await page.getByText("Final Result").first().isVisible().catch(() => false);
  const pendingProofVisible = await page
    .getByText("Proof submitted, awaiting approval")
    .first()
    .isVisible()
    .catch(() => false);
  const noProofVisible = await page.getByText("Proof not available yet").first().isVisible().catch(() => false);
  const proofVideoVisible = await page.locator("video").first().isVisible().catch(() => false);
  console.log("[trust-loop][proof] serviceVideosLabelVisible:", serviceVideosLabelVisible);
  console.log("[trust-loop][proof] proofTimelineVisible:", proofTimelineVisible);
  console.log("[trust-loop][proof] finalResultVisible:", finalResultVisible);
  console.log("[trust-loop][proof] pendingProofVisible:", pendingProofVisible);
  console.log("[trust-loop][proof] noProofVisible:", noProofVisible);
  console.log("[trust-loop][proof] proofVideoVisible:", proofVideoVisible);

  await expect(page.getByText("Service Videos").first()).toBeVisible({ timeout: 30_000 });
  const consentPromptVisible = await page
    .getByText("This service video is ready to review, but we need your permission before playback.")
    .first()
    .isVisible()
    .catch(() => false);
  const requestVideoAccessVisible = await page
    .getByRole("button", { name: "Request video access" })
    .isVisible()
    .catch(() => false);
  console.log("[trust-loop][proof] consent prompt visible:", consentPromptVisible);
  console.log("[trust-loop][proof] request video access visible:", requestVideoAccessVisible);
  expect(proofVideoVisible || consentPromptVisible || requestVideoAccessVisible).toBeTruthy();

  const mediaRes = await request.fetch(`/api/bookings/${bookingId}/media`, {
    headers: { "x-user-id": String(booking?.userId) },
  });
  expect(mediaRes.ok()).toBeTruthy();
  const mediaJson = (await mediaRes.json()) as { videos?: Array<{ downloadUrl?: string | null }> };
  const videoSrc = String(mediaJson?.videos?.[0]?.downloadUrl || "");
  console.log("[trust-loop] video src:", videoSrc);
  expect(videoSrc.length).toBeGreaterThan(0);

  // STEP 7 — Customer submits review
  const reviewPayload = {
    reviewWindowId,
    bookingId,
    vendorId: actors.vendorId,
    mediaSessionId: stageSessionIds.COMPLETED,
    rating: 5,
    comment: reviewComment,
    submittedVia: "video_overlay",
  };
  console.log("[E2E REVIEW PAYLOAD]", reviewPayload);

  const reviewCreateRes = await apiJson(
    request,
    "POST",
    "/api/reviews/create",
    reviewPayload,
    {
      "x-user-id": String(booking?.userId),
    }
  );
  console.log("[trust-loop] review response:", JSON.stringify(reviewCreateRes.json));
  expect(reviewCreateRes.response.ok(), JSON.stringify(reviewCreateRes.json)).toBeTruthy();
  expect(reviewCreateRes.json?.success).toBeTruthy();
  const createdReviewId = String(reviewCreateRes.json?.review?.id || "");
  expect(createdReviewId).toBeTruthy();

  // STEP 8 — Admin approves the submitted review for public display
  const reviewModerationRes = await apiJson(
    request,
    "PATCH",
    `/api/admin/reviews/${createdReviewId}/moderate`,
    { action: "approve_public" },
    {
      "x-user-id": actors.adminUserId,
      "x-user-role": "admin",
      "x-admin": "1",
    }
  );
  expect(reviewModerationRes.response.ok(), JSON.stringify(reviewModerationRes.json)).toBeTruthy();
  expect(String(reviewModerationRes.json?.review?.visibilityStatus || "")).toBe("public");

  // STEP 9 — Verify public service/vendor trust signals
  const publicServiceRes = await request.fetch(`/api/services/${actors.serviceId}`);
  expect(publicServiceRes.ok()).toBeTruthy();
  const publicServiceJson = (await publicServiceRes.json()) as {
    service?: {
      hasPrimaryProofVideo?: boolean;
      primaryProofVideoUrl?: string | null;
      videos?: string[];
      vendor?: { reviewCount?: number | null };
    };
  };
  expect(publicServiceJson.service?.hasPrimaryProofVideo).toBeTruthy();
  expect(String(publicServiceJson.service?.primaryProofVideoUrl || "")).toContain("flower.mp4");
  expect(Number(publicServiceJson.service?.vendor?.reviewCount || 0)).toBeGreaterThan(0);

  const publicServiceReviewsRes = await request.fetch(`/api/services/${actors.serviceId}/reviews/public`);
  expect(publicServiceReviewsRes.ok()).toBeTruthy();
  const publicServiceReviewsJson = (await publicServiceReviewsRes.json()) as { reviews?: Array<{ comment?: string }> };
  expect(Array.isArray(publicServiceReviewsJson.reviews)).toBeTruthy();
  expect((publicServiceReviewsJson.reviews || []).length).toBeGreaterThan(0);
  expect(
    publicServiceReviewsJson.reviews?.some((review) => String(review.comment || "").includes("E2E trust loop review"))
  ).toBe(false);

  const publicVendorRes = await request.fetch(`/api/vendors/${actors.vendorId}/public`);
  expect(publicVendorRes.ok()).toBeTruthy();
  const publicVendorJson = (await publicVendorRes.json()) as {
    publicMedia?: Array<{ url?: string | null; isPrimaryProofVideo?: boolean }>;
    publicServices?: Array<{ serviceId?: string; previewMediaUrl?: string | null }>;
    vendor?: { reviewCount?: number | null };
  };
  expect(publicVendorJson.publicMedia?.some((item) => item.isPrimaryProofVideo && String(item.url || "").includes("flower.mp4"))).toBeTruthy();
  expect(publicVendorJson.publicServices?.some((item) => item.serviceId === actors.serviceId && String(item.previewMediaUrl || "").includes("flower.mp4"))).toBeTruthy();
  expect(Number(publicVendorJson.vendor?.reviewCount || 0)).toBeGreaterThan(0);

  const publicVendorReviewsRes = await request.fetch(`/api/vendors/${actors.vendorId}/reviews/public`);
  expect(publicVendorReviewsRes.ok()).toBeTruthy();
  const publicVendorReviewsJson = (await publicVendorReviewsRes.json()) as { reviews?: Array<{ comment?: string }> };
  expect(Array.isArray(publicVendorReviewsJson.reviews)).toBeTruthy();
  expect((publicVendorReviewsJson.reviews || []).length).toBeGreaterThan(0);
  expect(
    publicVendorReviewsJson.reviews?.some((review) => String(review.comment || "").includes("E2E trust loop review"))
  ).toBe(false);

  await page.context().clearCookies();
  await page.goto(`/vendors/${actors.vendorId}`);
  await expect(page.getByRole("heading", { name: "Metro Home Care Pros" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Featured service video").first()).toBeVisible();
  await expect(page.getByText("Load featured video").first()).toBeVisible();
  await expect(page.getByText("Customer rating").first()).toBeVisible();

  await page.goto(`/service/${actors.serviceId}`);
  await expect(page.getByText("Play featured service video").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Reviews \(/ }).click();
  await expect(page.getByText("Public approved").first()).toBeVisible();

  // STEP 10 — Verify dashboard attribution
  const dashboardHeaders = {
    "x-user-id": actors.managerUserId,
    "x-vendor-id": actors.vendorId,
  };
  const dashboardFetchStartedAt = Date.now();
  console.log("[trust-loop][dashboard] vendorId:", actors.vendorId);
  console.log("[trust-loop][dashboard] request headers:", dashboardHeaders);
  let dashboardRes;
  try {
    dashboardRes = await request.fetch(`/api/vendors/${actors.vendorId}/dashboard`, {
      headers: dashboardHeaders,
      timeout: 120_000,
    });
  } catch (error) {
    const elapsed = Date.now() - dashboardFetchStartedAt;
    console.log("[trust-loop][dashboard] fetch threw after ms:", elapsed);
    console.log("[trust-loop][dashboard] fetch error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
  const dashboardFetchElapsed = Date.now() - dashboardFetchStartedAt;
  console.log("[trust-loop][dashboard] response status:", dashboardRes.status());
  console.log("[trust-loop][dashboard] elapsed ms:", dashboardFetchElapsed);
  const dashboardBodyText = await dashboardRes.text().catch(() => "");
  console.log("[trust-loop][dashboard] response body:", dashboardBodyText);
  expect(dashboardRes.ok()).toBeTruthy();
  const dashboardJson = JSON.parse(dashboardBodyText || "{}") as {
    stats?: { ratingCount?: number };
    employeePerformance?: Array<{ membershipId?: string; displayName?: string; reviewCount?: number }>;
  };
  expect(Number(dashboardJson?.stats?.ratingCount || 0)).toBeGreaterThan(0);
  const employeePerformance = Array.isArray(dashboardJson?.employeePerformance)
    ? dashboardJson.employeePerformance
    : [];
  expect(
    employeePerformance.some(
      (entry) =>
        String(entry?.membershipId || "") === actors.employeeMembershipId ||
        String(entry?.displayName || "").includes(actors.employeeDisplayName)
    )
  ).toBeTruthy();
});
