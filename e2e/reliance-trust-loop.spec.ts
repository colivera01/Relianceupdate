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
  await expect(page.getByRole("heading", { name: "Discover Services" })).toBeVisible();
  await page.getByPlaceholder("Search for services or vendors...").fill(fixture.serviceNameSearch);
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: "View Service" }).first().click();
  await page.waitForURL(`**/service/${fixture.serviceId}`);

  await page.getByRole("button", { name: "Book Now" }).click();
  await page.waitForURL(`**/booking/${fixture.serviceId}`);
  await page.locator('[data-testid^="booking-slot-date-"]').first().click();
  await page.locator('[data-testid^="booking-slot-time-"]').first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Enter your full name").fill(bookingClientName);
  await page.getByPlaceholder("Enter your email").fill(fixture.customerEmail);
  await page.getByPlaceholder("Enter your phone number").fill("555-0111");
  await page.getByPlaceholder("Enter the address where you need the service").fill("100 Trust Loop Ave");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await page.waitForURL(/\/confirmation\?bookingId=/, { timeout: 60_000 });
  const bookingIdMatch = page.url().match(/bookingId=([^&]+)/);
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
  await page.goto("/vendor/jobs");
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
  await page.goto("/employee/jobs");
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
  await page.goto("/vendor/jobs");
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

  // STEP 5 — Admin moderation approves package with customer_only visibility
  await page.goto("/admin/media-moderation");
  const moderationRes = await apiJson(
    request,
    "PATCH",
    `/api/admin/media/packages/${bookingId}/moderate`,
    { action: "approve", visibility: "customer_only" },
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

  // STEP 6 — Customer views proof
  await page.goto(`/my-bookings/${bookingId}?proofReady=1`);
  await expect(page.getByRole("heading", { name: "Proof of Completed Work" })).toBeVisible({
    timeout: 30_000,
  });

  const mediaRes = await request.fetch(`/api/bookings/${bookingId}/media`, {
    headers: { "x-user-id": String(booking?.userId) },
  });
  expect(mediaRes.ok()).toBeTruthy();
  const mediaJson = (await mediaRes.json()) as { videos?: Array<{ downloadUrl?: string | null }> };
  const videoSrc = String(mediaJson?.videos?.[0]?.downloadUrl || "");
  console.log("[trust-loop] video src:", videoSrc);
  expect(videoSrc.length).toBeGreaterThan(0);

  // STEP 7 — Customer submits review
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
  expect(reviewCreateRes.json?.review?.id).toBeTruthy();

  // STEP 8 — Verify dashboard attribution
  await page.goto("/vendor/dashboard");
  const dashboardRes = await request.fetch(`/api/vendors/${actors.vendorId}/dashboard`, {
    headers: {
      "x-user-id": actors.managerUserId,
      "x-vendor-id": actors.vendorId,
    },
  });
  expect(dashboardRes.ok()).toBeTruthy();
  const dashboardJson = (await dashboardRes.json()) as {
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
