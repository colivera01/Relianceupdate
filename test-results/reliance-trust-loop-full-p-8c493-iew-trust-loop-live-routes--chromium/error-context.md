# Test info

- Name: full proof-to-review trust loop (live routes)
- Location: C:\Users\Cesar Olivera\Project Reliance\e2e\reliance-trust-loop.spec.ts:160:5

# Error details

```
Error: apiRequestContext.fetch: Target page, context or browser has been closed
Call log:
  - → POST http://127.0.0.1:3000/api/reviews/create
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.25 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - Content-Type: application/json
    - x-user-id: e2e-smoke-customer
    - content-length: 260

    at apiJson (C:\Users\Cesar Olivera\Project Reliance\e2e\reliance-trust-loop.spec.ts:52:34)
    at C:\Users\Cesar Olivera\Project Reliance\e2e\reliance-trust-loop.spec.ts:386:33
```

# Page snapshot

```yaml
- complementary:
  - img "Reliance Logo"
  - img "E2E Smoke"
  - text: E2E Smoke e2e-smoke-customer@reliance.test Premium Member
  - navigation:
    - text: Navigation
    - link "Home":
      - /url: /user-dashboard
    - link "Discover":
      - /url: /discover
    - link "My Services":
      - /url: /my-bookings
    - link "Favorites":
      - /url: /favorites
    - link "Reviews":
      - /url: /reviews
    - link "Messages":
      - /url: /messages
    - link "Profile & Settings":
      - /url: /profile-settings
    - button "Log Out"
  - text: Switch View
  - link "Home Page":
    - /url: /
    - button "Home Page"
  - link "User View":
    - /url: /user-dashboard
    - button "User View"
  - link "Vendor View":
    - /url: /vendor/dashboard
    - button "Vendor View"
  - link "Admin View":
    - /url: /admin/dashboard
    - button "Admin View"
  - text: Reliance © 2024 All rights reserved
- main:
  - heading "Proof of Completed Work" [level=1]
  - paragraph: Review approved media shared for this specific booking.
  - button "Refresh"
  - link "Back to My Services":
    - /url: /my-bookings
  - paragraph: E2E Smoke Service
  - paragraph: "Vendor: E2E Smoke Vendor"
  - paragraph: "Booking status: Completed"
  - text: "Service date: 2026-04-27 Service time: 13:00:00 Your service proof is ready."
  - paragraph: Completed Service Proof
  - text: Primary proof Proof ready
  - paragraph: After Service (Completed Proof)
  - paragraph: You must accept video access before viewing this service proof.
  - button "Review & Accept Access"
  - paragraph: Service Proof Timeline
  - button "View Before Service":
    - paragraph: Before Service
    - paragraph: Intro / condition overview
    - paragraph: View proof
  - button "View During Service":
    - paragraph: During Service
    - paragraph: Work in progress
    - paragraph: View proof
  - button "View After Service":
    - paragraph: After Service
    - paragraph: Completed proof
    - paragraph: Now Viewing
  - paragraph: "Current stage: After Service (Completed Proof)"
  - paragraph: While watching the proof video, you may be prompted to leave a review or share quick feedback.
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open Tanstack query devtools":
  - img
```

# Test source

```ts
   1 | import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
   2 | import fs from "fs";
   3 | import path from "path";
   4 | import { randomUUID } from "crypto";
   5 | import { PrismaClient } from "@prisma/client";
   6 |
   7 | const FIXTURE_PATH = path.join(__dirname, "smoke-fixture.json");
   8 | const DEFAULT_PASSWORD = "E2E_Smoke_dev_only_9!";
   9 | const REVIEW_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
   10 |
   11 | const prisma = new PrismaClient();
   12 |
   13 | type SmokeFixture = {
   14 |   serviceId: string;
   15 |   serviceNameSearch: string;
   16 |   customerEmail: string;
   17 | };
   18 |
   19 | type ActorContext = {
   20 |   managerUserId: string;
   21 |   managerMembershipId: string;
   22 |   managerDisplayName: string;
   23 |   employeeUserId: string;
   24 |   employeeMembershipId: string;
   25 |   employeeRecordId: string;
   26 |   employeeDisplayName: string;
   27 |   adminUserId: string;
   28 |   vendorId: string;
   29 |   serviceId: string;
   30 | };
   31 |
   32 | function readFixture(): SmokeFixture {
   33 |   const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
   34 |   return JSON.parse(raw) as SmokeFixture;
   35 | }
   36 |
   37 | async function waitForSignInToLeaveLoginPage(page: Page) {
   38 |   await page.waitForLoadState("domcontentloaded");
   39 |   await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
   40 |   await page.waitForFunction(() => !window.location.pathname.includes("/auth/login"), null, {
   41 |     timeout: 30_000,
   42 |   });
   43 | }
   44 |
   45 | async function apiJson(
   46 |   request: APIRequestContext,
   47 |   method: "GET" | "POST" | "PATCH",
   48 |   url: string,
   49 |   body: unknown,
   50 |   headers: Record<string, string>
   51 | ) {
>  52 |   const response = await request.fetch(url, {
      |                                  ^ Error: apiRequestContext.fetch: Target page, context or browser has been closed
   53 |     method,
   54 |     headers: {
   55 |       "Content-Type": "application/json",
   56 |       ...headers,
   57 |     },
   58 |     data: body,
   59 |   });
   60 |   const json = await response.json().catch(() => ({}));
   61 |   return { response, json };
   62 | }
   63 |
   64 | async function ensureActors(vendorId: string, serviceId: string): Promise<ActorContext> {
   65 |   const managerEmail = "e2e-trust-manager@reliance.test";
   66 |   const employeeEmail = "e2e-trust-employee@reliance.test";
   67 |   const adminEmail = "e2e-trust-admin@reliance.test";
   68 |
   69 |   const managerUser = await prisma.user.upsert({
   70 |     where: { email: managerEmail },
   71 |     update: { name: "E2E Trust Manager" },
   72 |     create: { email: managerEmail, name: "E2E Trust Manager", demo: true },
   73 |     select: { id: true, name: true },
   74 |   });
   75 |   const employeeUser = await prisma.user.upsert({
   76 |     where: { email: employeeEmail },
   77 |     update: { name: "E2E Trust Employee" },
   78 |     create: { email: employeeEmail, name: "E2E Trust Employee", demo: true },
   79 |     select: { id: true, name: true },
   80 |   });
   81 |   const adminUser = await prisma.user.upsert({
   82 |     where: { email: adminEmail },
   83 |     update: { name: "E2E Trust Admin" },
   84 |     create: { email: adminEmail, name: "E2E Trust Admin", demo: true },
   85 |     select: { id: true },
   86 |   });
   87 |
   88 |   const managerMembership = await (prisma as any).vendorMembership.upsert({
   89 |     where: { vendorId_userId: { vendorId, userId: managerUser.id } },
   90 |     update: { role: "MANAGER", status: "ACTIVE", approvedAt: new Date() },
   91 |     create: {
   92 |       vendorId,
   93 |       userId: managerUser.id,
   94 |       role: "MANAGER",
   95 |       status: "ACTIVE",
   96 |       approvedAt: new Date(),
   97 |     },
   98 |     select: { id: true },
   99 |   });
  100 |   const employeeMembership = await (prisma as any).vendorMembership.upsert({
  101 |     where: { vendorId_userId: { vendorId, userId: employeeUser.id } },
  102 |     update: { role: "EMPLOYEE", status: "ACTIVE", approvedAt: new Date() },
  103 |     create: {
  104 |       vendorId,
  105 |       userId: employeeUser.id,
  106 |       role: "EMPLOYEE",
  107 |       status: "ACTIVE",
  108 |       approvedAt: new Date(),
  109 |     },
  110 |     select: { id: true },
  111 |   });
  112 |   const existingEmployeeRecord = await (prisma as any).employee.findFirst({
  113 |     where: {
  114 |       vendorId,
  115 |       email: employeeEmail,
  116 |     },
  117 |     select: { id: true },
  118 |   });
  119 |   const employeeRecord = existingEmployeeRecord
  120 |     ? await (prisma as any).employee.update({
  121 |         where: { id: existingEmployeeRecord.id },
  122 |         data: {
  123 |           name: "E2E Trust Employee",
  124 |           role: "TECHNICIAN",
  125 |         },
  126 |         select: { id: true },
  127 |       })
  128 |     : await (prisma as any).employee.create({
  129 |         data: {
  130 |           vendorId,
  131 |           name: "E2E Trust Employee",
  132 |           email: employeeEmail,
  133 |           role: "TECHNICIAN",
  134 |           demo: true,
  135 |         },
  136 |         select: { id: true },
  137 |       });
  138 |
  139 |   await prisma.service.update({
  140 |     where: { id: serviceId },
  141 |     data: { isPublished: true },
  142 |   });
  143 |
  144 |   return {
  145 |     managerUserId: managerUser.id,
  146 |     managerMembershipId: String(managerMembership.id),
  147 |     managerDisplayName: String(managerUser.name || "E2E Trust Manager"),
  148 |     employeeUserId: employeeUser.id,
  149 |     employeeMembershipId: String(employeeMembership.id),
  150 |     employeeRecordId: String(employeeRecord.id),
  151 |     employeeDisplayName: String(employeeUser.name || "E2E Trust Employee"),
  152 |     adminUserId: adminUser.id,
```