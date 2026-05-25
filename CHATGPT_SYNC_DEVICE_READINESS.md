# Reliance — Device Readiness Sync (for Alex / hardware integration)

> Snapshot date: 2026-05-20 · Last updated 2026-05-20 (refreshed telemetry + device endpoint status).
> Source: read-only inspection of `c:\Users\Cesar Olivera\Project Reliance` (Next.js 15 + Prisma + Azure SQL + Azure Blob).
> Purpose: give a precise, no-guessing picture of what Reliance already has running today vs what still needs to be built before we can answer Alex's hardware/integration questions formally.
> Scope: read-only. No code, schema, or logic changes were made to produce this document.

## Companion docs (Gen 1 device contract)

| Doc | Role |
|---|---|
| [`DEVICE_OPERATION_FLOW.md`](./DEVICE_OPERATION_FLOW.md) | End-to-end phone-bridged lifecycle: onboarding → pairing → capture → upload → review → review attribution. |
| [`DEVICE_MODES.md`](./DEVICE_MODES.md) | LED, buzzer, and button behavior for every operational mode. |
| [`DEVICE_EVENT_CONTRACT.md`](./DEVICE_EVENT_CONTRACT.md) | JSON envelopes + per-event schemas + idempotency rules + server response shape. |
| [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) | Existing endpoints (verbatim contracts) + PROPOSED endpoints needed for Gen 1. |
| [`DEVICE_TEST_PLAN_ALIGNMENT.md`](./DEVICE_TEST_PLAN_ALIGNMENT.md) | Mapping from Alex's test plan to Reliance status (READY / PARTIAL / NOT READY). |

These five docs are **specifications**, not code. Where they say "EXISTS" the contract is already live in the repo (verified by inspection). Where they say "PROPOSED" the contract is committed-to but not yet implemented; §6 below tracks remaining implementation work.

---

## 1. Current app stack

| Concern | What's in the repo today |
|---|---|
| Frontend framework | Next.js 15.3 (App Router) + React 19 + TypeScript + Tailwind. UI primitives via Radix + lucide-react. Recharts/Chart.js for analytics. |
| Backend / API | Next.js Route Handlers under `src/app/api/**`. No separate Node service in production. A `backend/` folder exists for legacy auth code (bcrypt password hashing) but is NOT used by the active App Router login. |
| Database | Azure SQL Server, accessed exclusively through Prisma (`prisma/schema.prisma`, `provider = "sqlserver"`). `mssql` is a dependency but only used by `quick-test.js` diagnostics, not the app. |
| Media storage | Azure Blob Storage via `@azure/storage-blob`. Helpers in `src/lib/azure-blob-storage.ts`: `generateUploadSAS`, `generateDownloadSAS`, `generateUploadUrl`, `generateDownloadUrl`, `getBlobProperties`, `deleteBlob`. Time-limited SAS-based upload + download. |
| Auth / session | Custom. `POST /api/auth/login` returns `token: "temp-jwt-token"` and sets `userId` cookie; client also stores user in `localStorage`. API requests carry `x-user-id` (and `x-vendor-id` for vendor scope) and an optional `Authorization: Bearer` header. `src/lib/auth.ts` resolves identity in order: Bearer JWT payload → cookies → header IDs. JWT signature is **not** verified yet (interim parser only). Active login compares plaintext password against a dev registry (bcrypt path lives in unused `backend/`). |
| Notifications | Email via Resend (`src/lib/email-notifications.ts`), SMS via Twilio (`src/lib/sms/twilio.ts`). Used for: invite delivery, consent links, review reminders, review-window expiry. |
| Realtime | None. No WebSockets, no SignalR, no SSE pipeline today. |

### Azure services currently used

- **Azure SQL Database** — single source of truth. Verified reachable as of last infrastructure check; ERROR 42119 resolved.
- **Azure Blob Storage** — verified working; SAS upload + download in production code paths.

### Azure services explicitly **not** in the codebase today (relevant to device work)

- Azure Web PubSub — not present (`WebPubSub`, `web-pubsub` searches: 0 hits).
- Azure SignalR — not present.
- Azure Communication Services (ACS) — not present (`@azure/communication`, `acsToken`: 0 hits).
- Azure IoT Hub / Device Provisioning Service — not present.
- Azure Functions / Logic Apps — not present in this repo.
- Azure Front Door / Traffic Manager — not configured here.
- WebRTC / SFU (LiveKit, mediasoup, simple-peer) — not present.

---

## 2. Core Reliance flows that are real

All of the following are wired against Azure SQL + Azure Blob and verified by the `e2e/reliance-trust-loop.spec.ts` Playwright spec, which runs the entire pipeline end-to-end and currently passes.

| Flow | Real today |
|---|---|
| Customer booking (discover → book → confirmation → my-bookings) | YES |
| Vendor job management (list, assign, archive, reject) | YES |
| Employee assignment (manager → employee membership IDs on `Booking.customerMetadata`) | YES |
| Employee proof upload (Intro / In Progress / Completed videos via SAS upload + `MediaSession` + `MediaAsset`) | YES |
| Manager approve / reject job (status transitions: PENDING → CONFIRMED → AWAITING_REVIEW → COMPLETED, or back to IN_PROGRESS with rejection reason) | YES |
| Admin moderation (per-asset and per-package; gates customer visibility) | YES |
| Customer proof viewing (only `moderationStatus="approved"` + active assets reach the customer) | YES |
| Review submission with attribution to assigned employee membership | YES |
| Vendor dashboard metrics (jobs, recent reviews, employee performance, storage usage) | YES |
| Lifecycle audit trail (job assign / start / stage / approve / reject / device pair / membership accept all write `AdminAuditLog`) | YES (added 2026-05-06) |
| Per-employee `jobsCompleted` + `lastJobAt` aggregation on dashboard | YES (added 2026-05-06) |

Customer test path used today: phone `407-914-8888` / email `colivera080124@gmail.com`.

---

## 3. Device / pairing — current state

### Pair Device button

Located on `src/app/vendor/dashboard/page.tsx`. When a vendor manager clicks it:

1. Browser POSTs to `/api/device/pairing/request` with no body. Server reads `vendorId` from the request (cookie/JWT) and inserts a row in `device_pairing_codes` with a 6-digit numeric `code` and a 5-minute `expiresAt`.
2. The 6-digit code is shown to the user.
3. A device (today: a phone browser, future: real hardware) opens `/device/pair`, enters the code, generates/persists a local `reliance_device_uid`, and POSTs to `/api/device/pairing/confirm` with `{ code, deviceUid, deviceName?, deviceType }`.
4. Confirm route validates code, marks it used, upserts a row in `devices` keyed on `deviceUid` (with legacy `employeeId` fallback), and returns the device record.

### Auto-pair from employee jobs page

`src/app/employee/jobs/page.tsx` separately POSTs to `/api/employee/device/pair` whenever an employee opens the page. That route is the **modern Prisma path**: it requires an active `EMPLOYEE` `VendorMembership`, creates/updates `Device`, creates a `DeviceAssignment`, and updates `VendorMembership.pendingPhoneDeviceUid/Model/Os/AppVersion`. As of 2026-05-06 it returns the full pairing payload (`deviceId`, `deviceUid`, `model`, `os`, `appVersion`, `firstPairing`) and emits a `device_paired` lifecycle audit row on first creation.

### Device data model (`prisma/schema.prisma`)

```text
model Device {
  id              String     @id @default(cuid())
  vendorId        String
  deviceUid       String?    @unique     // canonical device identity
  employeeId      String?                // legacy fallback for old MVP rows
  deviceType      String                 // "PHONE" | "HEADSET"
  pairedAt        DateTime   @default(now())
  lastSeenAt      DateTime?
  isActive        Boolean    @default(true)
  firmwareVersion String?
  model           String?
  os              String?
  appVersion      String?
  // relations: Vendor, DeviceAssignment[], MediaSession[]
}

model DevicePairingCode {
  id, vendorId, code (unique 6 digits), expiresAt, used, createdAt
}

model DeviceAssignment {
  id, vendorId, deviceId, membershipId,
  assignedAt, unassignedAt, assignedByUserId
}
```

### Heartbeat

`POST /api/device/heartbeat` accepts `{ phoneDeviceUid, deviceMeta: { model, os, appVersion } }` and updates `devices.lastSeenAt` through Prisma. Looks up the active membership for that device's vendor and returns `{ status, vendorId, membershipId, role }`. It is still a phone-oriented compatibility route; the richer Gen 1 headset heartbeat should flow through `POST /api/device/events`.

### What is real

- 6-digit code issuance + redemption persists.
- `Device` row is created with vendor + UID + type + lastSeenAt timestamp.
- `DeviceAssignment` ties a device to a specific employee membership.
- `MediaAsset.deviceId` and `MediaSession.deviceId` already exist in schema.
- As of 2026-05-06, employee uploads from `/employee/jobs` send `deviceId` so every uploaded asset is attributed to the paired device.
- Heartbeat updates `lastSeenAt`, `model`, `os`, `appVersion`.
- Vendor `/vendor/devices` API surfaces `firmwareVersion`, `model`, `os`, `appVersion` for dashboards.
- `POST /api/device/events` now ingests the 15-event Gen 1 catalog, persists `DeviceEvent`, is idempotent on `eventId`, updates `Device.lastSeenAt`, and writes `Device.firmwareVersion` for `firmware_version_reported`.
- `GET /api/device/events` exposes scoped telemetry reads for admins, vendor managers, and employees.
- `GET /api/vendors/[vendorId]/devices/status` surfaces manager-facing device health: online/recent/offline, latest event, battery, charging, firmware/app version, assignment, and error/low-battery indicators.
- `/vendor/telemetry` is wired into the vendor sidebar and reads the device events + device-status APIs.
- `/api/dev/device-events/seed` can generate synthetic telemetry in non-production for local/test verification.

### What is placeholder / mixed

- Two pairing pathways coexist: modern employee phone pairing (`/api/employee/device/pair`) and 6-digit headset code redemption (`/api/device/pairing/confirm`). Both now use Prisma and write the same `devices` table, but they are still separate UX paths.
- `src/app/employee/mobile/page.tsx` is a simulated demo (local state, not wired to live APIs) and should not be treated as device-spec.
- Telemetry ingestion exists, but the real BLE phone bridge that forwards headset events has not been built.

### What is missing for hardware

- No device authentication credential. Today the only "auth" for a device after pairing is its `deviceUid` knowledge. There is no per-device API key, no signed token, no certificate.
- No dedicated firmware-report route. Firmware version can be written today through the `firmware_version_reported` event on `POST /api/device/events`.
- No firmware update / OTA endpoint.
- No LED / buzzer / button command channel (no realtime bus exists).
- No device-side event/command JSON schema documented.
- No way to revoke a device (`isActive=false` exists but no admin/manager UI route to flip it).
- No device "modes" (e.g., RECORDING, IDLE, SUSPENDED) tracked anywhere.

---

## 4. Employee lifecycle — current state

| Step | Status | API / file |
|---|---|---|
| Manager creates invite | REAL | `POST /api/vendors/[vendorId]/employee-invites` → row in `vendor_invites`, optional Twilio SMS / Resend email send. |
| Employee accepts invite via tokenized link | REAL | `POST /api/vendor/invite/[token]` → `VendorMembership.upsert(role=EMPLOYEE, status=ACTIVE)`, marks invite consumed, emits `membership_accepted` audit row. |
| Self-invite dev shortcut | DEV-ONLY | Gated by `ALLOW_SELF_EMPLOYEE_INVITE_TEST` / `NEXT_PUBLIC_ALLOW_SELF_EMPLOYEE_INVITE_TEST`. Creates an alias user (e.g. `name+employee-test-...@domain`) so the manager keeps their MANAGER membership. Useful for testing only. |
| First login + device auto-pair | REAL | `/employee/jobs` page auto-pairs phone, shows green "Device paired" status. First-pairing emits `device_paired` audit row. |
| Manager assigns job | REAL | `PATCH /api/vendors/[vendorId]/jobs/[jobId]/actions` with `action: "ASSIGN_JOB"` — writes `vendor_job_assigned_membership_ids` + `vendor_job_assigned_employees` into `Booking.customerMetadata`. Emits `job_assigned` audit row. |
| Employee starts job | REAL | `POST /api/employee/jobs/[jobId]/start`. Booking PENDING → CONFIRMED. Emits `job_started`. |
| Employee uploads stage proof | REAL | session create → upload init (SAS) → PUT to blob → upload complete → `POST /api/employee/jobs/[jobId]/stage`. Asset is attributed to `membership` and `device`. Emits `job_stage_uploaded`. |
| Submit for manager review | REAL | After all 3 stages uploaded, booking status auto-advances to AWAITING_REVIEW. |
| Manager approve | REAL | `POST /api/vendors/[vendorId]/jobs/[jobId]/approve` — booking → COMPLETED, package re-queued for moderation. Emits `job_approved`. |
| Manager reject (with reason) | REAL | `POST /api/vendors/[vendorId]/jobs/[jobId]/reject` — booking → IN_PROGRESS, reason persisted on booking. Emits `job_rejected`. Employee sees rejection card on `/employee/jobs`. |
| Employee re-uploads + resubmits | REAL | Same upload pipeline; existing stage session is archived and replaced. |
| Admin moderation | REAL | `PATCH /api/admin/media/[assetId]/moderate` and `PATCH /api/admin/media/packages/[bookingId]/moderate`. |
| Customer review with attribution | REAL | Review carries `assignedMembershipId`, `assignedEmployeeName`, `assignedUserId`. |
| Vendor dashboard performance | REAL | `employeePerformance` per-membership: `averageRating`, `reviewCount`, `jobsCompleted`, `lastJobAt`, `active`. |

### Remaining gaps

- Per-employee approval / rejection counts not yet aggregated; trivial follow-up using new audit rows.
- No `AdminNotification` rows yet for assignment / start / approve / reject (notifications path only fires for invites, consent, review reminders, storage thresholds, proof-ready).
- Job assignments live in JSON inside `Booking.customerMetadata`. A first-class `JobAssignment` table would make per-employee analytics trivial; not blocking.
- `src/app/employee/mobile/page.tsx` is a non-functional demo and should be removed or rebuilt.

---

## 5. API endpoints relevant to Alex

Status legend: **R** = production-ready, **P** = partial / safe but missing fields, **DEV** = development-only helper, **X** = not implemented.

### Pairing

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/api/device/pairing/request` | Vendor manager generates 6-digit code (5-min TTL). | Vendor identity (cookie/JWT) | R |
| POST | `/api/device/pairing/confirm` | Device redeems code, upserts `Device` row. | None — code IS the credential | R |
| POST | `/api/employee/device/pair` | Employee phone auto-pair against active membership. | Employee userId (header/cookie) | R |
| GET | `/api/vendors/[vendorId]/devices` | List devices for vendor (model/os/firmware/lastSeen). | Vendor membership | R |
| GET | `/api/vendors/[vendorId]/devices/status` | Manager health summary: online status, latest event, battery/charging, assignment, firmware/app version, alert indicator. | Manager | R |
| POST | `/api/vendors/[vendorId]/headsets/[deviceId]/assign` | Assign headset to a membership. | Manager | R |
| POST | `/api/vendors/[vendorId]/headsets/[deviceId]/unassign` | Unassign. | Manager | R |

### Heartbeat / device runtime

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/api/device/heartbeat` | Phone compatibility heartbeat: update `lastSeenAt` + `model/os/appVersion`, return membership context. | `phoneDeviceUid` body field only | P |
| POST | `/api/device/events` | Unified Gen 1 event ingest for 15 event types; idempotent on `eventId`; updates `lastSeenAt` and firmware version. | Active vendor membership (phone session) | R |
| GET | `/api/device/events` | Scoped telemetry query by vendor/device/event/since/booking. | Admin, manager, or employee scope | R |
| POST | `/api/dev/device-events/seed` | Dev-only synthetic event generator for local telemetry/status testing. | Active vendor membership; 404 in production | DEV |
| - | (none) | Server → device command channel | - | X |
| - | (none) | Firmware OTA | - | X |

### Job assignment + lifecycle

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/api/employee/jobs` | List jobs assigned to current employee. | Employee | R |
| POST | `/api/employee/jobs/[jobId]/start` | Employee starts a job; PENDING→CONFIRMED. | Employee on assigned booking | R |
| POST | `/api/employee/jobs/[jobId]/stage` | Mark a stage (Intro/InProgress/Completed) complete after upload. | Employee on assigned booking | R |
| POST | `/api/employee/jobs/[jobId]/complete` | Submit for manager review (all 3 stages required). | Employee on assigned booking | R |
| GET / PATCH / DELETE | `/api/vendors/[vendorId]/jobs/[jobId]/actions` | Read/update/archive job; `ASSIGN_JOB` action lives here. | Vendor membership / manager for some actions | R |
| POST | `/api/vendors/[vendorId]/jobs/[jobId]/approve` | Manager approval; booking→COMPLETED. | Manager | R |
| POST | `/api/vendors/[vendorId]/jobs/[jobId]/reject` | Manager rejection w/ reason; booking→IN_PROGRESS. | Manager | R |

### Media sessions + uploads

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/api/vendors/[vendorId]/media/sessions` | Create or reuse a stage session (Intro/InProgress/Completed) for a booking; accepts `deviceId`. | Vendor membership | R |
| GET | `/api/vendors/[vendorId]/media/sessions` | List sessions with filters. | Vendor membership | R |
| POST | `/api/vendors/[vendorId]/media/upload/init` | Issue Azure Blob SAS upload URL + `assetId` + `blobKey`. 60-minute expiry. | Vendor membership | R |
| POST | `/api/vendors/[vendorId]/media/upload/complete` | Persist `MediaAsset` after blob PUT; verifies blob exists + size; storage-limit gate; sets job to AWAITING_ADMIN_REVIEW when all 3 stages present. Accepts `deviceId`. | Vendor membership | R |

### Reviews

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/api/reviews/window/start` | Open review window after package approval. | Customer | R |
| POST | `/api/reviews/create` | Create review tied to window; preserves attribution. | Customer | R |
| GET | `/api/reviews/me` | Current user's reviews. | User | R |
| POST | `/api/reviews/window/expire` | Expire stale review windows. | System | R |

### Dashboard / employee performance

| Method | Path | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/api/vendors/[vendorId]/dashboard` | Returns `profile`, `stats`, `recentJobs`, `archivedJobs`, `recentReviews`, `employeePerformance`, `insights`, `notifications`, `pendingModerationProofs`, `approvedProofs`, `archivedProofs`, `totalProofAssets`, `storageUsedBytes`, `storageLimitBytes`, `storagePercentUsed`. | Vendor membership | R |

---

## 6. Device integration gaps Alex would still need from us

> Status legend (per gap): **DOCUMENTED** = contract written in a companion doc, ready for sign-off. **IMPLEMENTED** = code lands in the repo. **OPEN** = not yet specified.
> A "DOCUMENTED" gap is **not** the same as fixed — it just means the contract is final enough to design firmware against.

### 6.1 Device operation flow — DOCUMENTED (not yet implemented)

Captured in [`DEVICE_OPERATION_FLOW.md`](./DEVICE_OPERATION_FLOW.md). Covers:

- Phone-bridged Gen 1 architecture (headset over BLE, phone over HTTPS).
- High-level state machine: `Power Off → Booting → Pairing → Connected → Assigned Job Ready → Recording → Uploading → (Connected | Upload Failed)` with overlays for `Offline`, `Low Battery`, `Charging`, `Error`, `Firmware Update`.
- Trigger conditions for each transition.
- Behavior on power loss / reboot mid-recording (firmware MUST flush in-progress chunks to flash before declaring offline).
- Behavior on lost network during recording (BLE persists, SAS upload retries within 60-minute window).

Implementation impact on this repo: none required — the flow uses the existing endpoints. Firmware + phone-app BLE module are the new work.

### 6.2 Device modes — DOCUMENTED (not yet implemented)

Captured in [`DEVICE_MODES.md`](./DEVICE_MODES.md). Covers all 13 modes the user listed: Power Off, Booting, Pairing, Connected, Assigned Job Ready, Recording, Uploading, Upload Failed, Offline, Low Battery, Charging, Error, Firmware Update. Each row specifies LED, buzzer, allowed buttons, expected app/server state, and exit transitions. Conventions are PROPOSED defaults — Alex confirms or overrides based on hardware.

Implementation impact on this repo: none required — Reliance only needs to issue the right BLE commands at the right moments (already covered by the existing `ARM_JOB`/`RECORD_START`/etc. semantics in the operation flow). Firmware drives LEDs and buzzer.

### 6.3 JSON event/message contract (device → server) — DOCUMENTED + IMPLEMENTED

Captured in [`DEVICE_EVENT_CONTRACT.md`](./DEVICE_EVENT_CONTRACT.md). Covers:

- Common envelope (`eventId`, `eventType`, `occurredAt`, `deviceUid`, `deviceType`, `vendorId`, `membershipId`, `firmwareVersion`, `phoneAppVersion`, `context`, `payload`).
- Common server response shape (`ok`, `eventId`, `ackedAt`, `duplicate`, `command`).
- Idempotency rule: server keys on `eventId` UNIQUE; duplicates are a no-op + `duplicate: true`.
- Per-event JSON schemas + sample payloads + expected server response for: `device_boot`, `device_paired`, `heartbeat`, `job_received`, `recording_started`, `recording_stopped`, `upload_started`, `upload_progress`, `upload_completed`, `upload_failed`, `battery_low`, `device_offline`, `device_reconnected`, `error_reported`, `firmware_version_reported`.

Implementation status in this repo:
- `DeviceEvent` exists in `prisma/schema.prisma` and maps to `device_events`.
- `POST /api/device/events` validates the envelope, checks the caller's active vendor membership, looks up the active device by `deviceUid`, inserts idempotently on `eventId`, updates `Device.lastSeenAt`, writes firmware version on `firmware_version_reported`, and records a lifecycle audit on fatal `error_reported`.
- `GET /api/device/events` returns scoped telemetry for admins, vendor managers, and employees.
- The remaining work is phone-side BLE forwarding from the headset into this endpoint, not the server ingest contract.

### 6.4 Command contract (server → device)

### 6.4 Command contract (server → device) — DOCUMENTED, decision deferred

Captured in [`DEVICE_EVENT_CONTRACT.md`](./DEVICE_EVENT_CONTRACT.md) §3 and [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) §6.4.

- Common command envelope (`commandId`, `type`, `issuedAt`, `expiresAt`, `params`) is defined and reuses the same response slot of every event ingest call (server piggy-backs commands on event acks).
- Gen 1 vocabulary: `ARM_JOB`, `DISARM_JOB`, `RECORD_START`, `RECORD_STOP`, `SOFT_RESET`, `FIRMWARE_UPDATE_AVAILABLE`, `CLEAR_FAILED_UPLOAD`.
- Transport choice (long-poll vs Azure Web PubSub vs IoT Hub) intentionally deferred — phone polling already works for the only command the system needs today (assignment notification via `/api/employee/jobs`). Firmware is unaffected by this decision.

### 6.5 Upload contract (device → blob) — DOCUMENTED + EXISTS

Captured in [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) §5 (verbatim 4-step contract).

- Existing 60-minute SAS pipeline is reused as-is.
- The phone (not the headset) is the authenticated client in Gen 1 — no per-device API key needed.
- The 4-step pipeline is verified end-to-end by `e2e/reliance-trust-loop.spec.ts`.

### 6.6 Pairing / auth contract — DOCUMENTED, Gen 2 deferred

Captured in [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) §3 (Gen 1 verbatim) and §4 (Gen 2 direction).

- Gen 1 contract: phone is authenticated, headset is identified by `deviceUid` only, no per-device API key. 6-digit code redemption already works (`POST /api/device/pairing/request` → `POST /api/device/pairing/confirm`).
- Gen 2 path: `POST /api/device/auth/issue` + `getDeviceFromRequest` helper + revoke flow. Out of Gen 1 scope, intentionally not scheduled.
- `/api/device/heartbeat` and `/api/device/pairing/confirm` have been migrated to Prisma. Gen 1 still relies on phone session auth; per-device credentials remain Gen 2 scope.

### 6.7 Offline / retry behavior — DOCUMENTED (not yet implemented)

Captured in [`DEVICE_OPERATION_FLOW.md`](./DEVICE_OPERATION_FLOW.md) §4 and [`DEVICE_MODES.md`](./DEVICE_MODES.md) §1.9.

- BLE-loss behavior, HTTPS-loss behavior, command-channel-loss behavior, and crash-mid-recording rules all defined.
- Server side: existing `replaceExisting: true` semantic plus the 60-minute SAS TTL absorbs most retries with no schema change. A "queued / draft asset" concept is intentionally **not** added in Gen 1.

### 6.8 Firmware update behavior — DOCUMENTED, OUT OF GEN 1 SCOPE

Captured in [`DEVICE_MODES.md`](./DEVICE_MODES.md) §1.13 (Firmware Update mode contract) and [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) §6.7.

- OTA pipeline is defined at a contract level (binary hosting, signed image, dual-bank flash, automatic rollback) but is explicitly deferred for Gen 1. Gen 1 firmware updates are physical (USB or factory-reflash).
- `Device.firmwareVersion` field exists in schema and can be written today through the embedded `firmware_version_reported` event. A dedicated `POST /api/device/firmware/report` route remains optional, not required for Gen 1.

### 6.9 LED / buzzer / button behavior — DOCUMENTED (Alex sign-off pending)

Captured in [`DEVICE_MODES.md`](./DEVICE_MODES.md) (full table per mode).

- LED color/blink, buzzer pattern, allowed buttons, and exit transitions are spelled out for every mode.
- Conventions are PROPOSED defaults; Alex confirms or overrides based on hardware constraints (e.g. RGB vs single-color LED, presence of buzzer/vibration motor).

### 6.10 Staging endpoint strategy — DOCUMENTED, infra work pending

Captured in [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) §6.9.

- Codebase already uses `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` as configurable origins, so flipping a build between prod and staging is a configuration change, not code.
- Outstanding infra: dedicated staging resource group (App Service / Container App + Azure SQL DB or schema + Blob container), `staging.reliance.app` DNS + cert, seeded demo vendor + manager + employees.

---

## 7. Azure readiness

| Area | Status | Detail |
|---|---|---|
| Azure SQL | OPERATIONAL | Provider `sqlserver`, `DATABASE_URL` points at `relianceorgsqlserver.database.windows.net / reliance-db`. Verified reachable; ERROR 42119 resolved; Prisma client connects cleanly. |
| Azure Blob (media uploads + downloads) | OPERATIONAL | SAS-based read/write via `src/lib/azure-blob-storage.ts`. Container governed by `AZURE_STORAGE_CONTAINER` / `AZURE_STORAGE_CONTAINER_NAME` env. Storage-limit gate active in `media/upload/complete`. |
| Azure Web PubSub | NOT CONFIGURED | Not present in code or dependencies. |
| Azure Communication Services | NOT CONFIGURED | Not present. |
| WebRTC | NOT IMPLEMENTED | No client or server code. |
| Azure IoT Hub / DPS | NOT CONFIGURED | Not present. |
| Azure Front Door / CDN | NOT CONFIGURED in repo | If present, it's at the infra layer outside this repo. |
| Staging subdomain | NOT CONFIGURED | All env points to production Azure resources. |
| Mobile app (Capacitor/Expo/RN) | NONE | No native app surface in this repo. `/employee/jobs` is a responsive web page; `/employee/mobile` is a non-functional demo. |

### What would be needed for device development testing

1. Provision a **staging Azure resource group** (separate App Service / Container App, separate Azure SQL DB or schema, separate Blob container). Mirror env shape.
2. Issue a **staging DNS** (e.g. `staging.reliance.app`) and corresponding HTTPS cert.
3. Create a **device-dev tier** of accounts (one demo vendor, one demo manager, a few demo memberships) seeded into the staging DB.
4. Pick the realtime bus (Web PubSub vs IoT Hub vs polling) before device firmware reaches feature-freeze.
5. Add a `/api/device/auth/issue` route that exchanges a paired-device proof for a signed device credential.
6. Decide where firmware binaries are hosted (a `firmware` container in staging Blob is cheapest).

---

## 8. Companion docs (now in repo)

| Doc | Status | Purpose |
|---|---|---|
| [`DEVICE_OPERATION_FLOW.md`](./DEVICE_OPERATION_FLOW.md) | DOCUMENTED | Full state machine, transition triggers, failure handling. |
| [`DEVICE_MODES.md`](./DEVICE_MODES.md) | DOCUMENTED | Mode list + LED/buzzer/button behavior per mode. |
| [`DEVICE_EVENT_CONTRACT.md`](./DEVICE_EVENT_CONTRACT.md) | DOCUMENTED | JSON schema for every device → server event. |
| [`DEVICE_API_REQUIREMENTS.md`](./DEVICE_API_REQUIREMENTS.md) | DOCUMENTED | Definitive list of HTTP endpoints the device must call, with request/response shapes and credential rules. |
| [`DEVICE_TEST_PLAN_ALIGNMENT.md`](./DEVICE_TEST_PLAN_ALIGNMENT.md) | DOCUMENTED | Mapping from Alex's test plan items to (a) endpoints we expose, (b) staging env IDs, (c) E2E spec coverage. |

All five docs now exist in the repo root. They are specifications, not code: a "DOCUMENTED" gap is ready for sign-off and firmware/backend implementation, but is not yet wired into the running app unless the doc explicitly says **EXISTS**.

---

## 9. What we should NOT promise yet

- **Live WebRTC streaming.** Zero infrastructure for this in code today. Promising it would be unsafe.
- **Production public website.** Production domain, SSL, CDN, and prod resource sizing are infrastructure work outside this repo's current scope.
- **Production device fleet management.** No fleet console, no mass-revoke, no firmware rollout pipeline.
- **Real mobile app release.** No native shell, no app-store presence. The web `/employee/jobs` works on phones but is not a native app.
- **Final firmware OTA process.** No OTA endpoint exists; any timeline is speculative until firmware tooling and binary hosting are decided.
- **Final Azure Communication Services architecture.** ACS hasn't been integrated. Naming a final shape now would be premature.

---

## 10. Immediate next steps

### What Cursor / backend should build next (high-value, low-risk; ranked)

1. **Provision staging** (App Service / Container App, Azure SQL DB or schema, Blob container, DNS/cert, seeded demo vendor + employees). This is now the biggest blocker for Alex's hardware-in-the-loop tests.
2. **Build the phone-side BLE bridge** that reads headset `deviceUid`/`firmwareVersion`, assigns the headset, streams chunks, and forwards headset events to `POST /api/device/events`.
3. **Surface the 6-digit headset pairing flow on the employee onboarding/job surface.** Today the code generator is available from the vendor dashboard; Gen 1 needs it in the employee phone flow.
4. **Add focused telemetry tests** for `/api/device/events`, duplicate `eventId`, firmware-version updates, fatal-error audit, `/api/vendors/[vendorId]/devices/status`, and the dev seed route.
5. **`AdminNotification` rows on `job_assigned` / `job_rejected` / `job_approved`** so managers and admins see lifecycle events without polling. Trivial follow-up to the existing `recordLifecycleAudit` pattern.
6. **(Gen 2, deferred)** `POST /api/device/auth/issue` and `getDeviceFromRequest` helper. Not on the Gen 1 critical path.

### What Alex can safely proceed with NOW

- Firmware design assuming the **phone-bridged Gen 1 architecture** in [`DEVICE_OPERATION_FLOW.md`](./DEVICE_OPERATION_FLOW.md): headset speaks BLE only, phone owns HTTPS.
- Firmware module that uploads files to a SAS URL via PUT (`x-ms-blob-type: BlockBlob`) — contract is final and tested in production.
- Device pairing UX (6-digit code redemption) — flow is final.
- Device storing two URLs in firmware: a staging base URL and a production base URL, switchable via DIP-switch or factory config.
- Treating `deviceUid` as a stable per-device identifier the device will remember and present on every request.
- The 13 modes and LED/buzzer/button mapping in [`DEVICE_MODES.md`](./DEVICE_MODES.md) (Alex confirms or overrides the conventions).
- The 15-event JSON catalog in [`DEVICE_EVENT_CONTRACT.md`](./DEVICE_EVENT_CONTRACT.md), now backed by `POST /api/device/events` and `DeviceEvent`.

### What requires a staging environment first

- Anything firmware-tested over the air against real APIs.
- Live recording → upload → moderation → review round-trip from a hardware device.
- Multi-device fleet test (>1 paired device per vendor).
- Long-soak battery + heartbeat cadence measurement.

### Questions that must be answered before hardware PCB finalization

1. **Realtime bus choice.** Long-poll commands vs Azure Web PubSub vs IoT Hub. This decides whether the device needs an MQTT stack or just HTTPS.
2. **Power-loss-during-recording behavior.** Does the device finalize the in-progress chunk on next boot, or discard it? Drives storage layout.
3. **Audio-on-the-device vs audio-on-the-phone.** Determines whether the headset MUST have a mic or whether it's video-only and the customer's voice rides with the phone.
4. **Pairing direction.** Does the device generate the code shown on its screen, or does the device read a code shown on the vendor dashboard? (Today: the dashboard generates and the device redeems — keep it that way unless a hardware constraint forces otherwise.)
5. **Number of concurrent active recordings the device must support.** Affects firmware buffer sizing.
6. **Maximum upload chunk size.** Drives RAM budget and Azure block-blob block size.
7. **Field-resettable factory mode.** Necessary for refurb / re-deployment after vendor offboarding.

---

## Summary

**What is ready today**

- End-to-end customer → vendor → employee → manager → admin → review trust loop, verified by an active Playwright E2E spec.
- Azure SQL + Azure Blob production paths, including SAS-based uploads and storage-limit gating.
- Device pairing schema (`Device`, `DevicePairingCode`, `DeviceAssignment`) and a working modern Prisma pair endpoint.
- Server-side Gen 1 telemetry ingest: `DeviceEvent`, `POST/GET /api/device/events`, device status summary, and vendor telemetry page.
- Per-asset device attribution (`MediaAsset.deviceId`, `MediaSession.deviceId`) — newly wired into employee uploads.
- Lifecycle audit trail covering assignments, starts, stage uploads, approvals, rejections, device pairings, and membership acceptances.
- Per-employee performance metrics on the vendor dashboard (`averageRating`, `reviewCount`, `jobsCompleted`, `lastJobAt`, `active`).

**What is documented vs what is implemented**

| Concern | Documented | Implemented |
|---|---|---|
| End-to-end Gen 1 operation flow | YES — `DEVICE_OPERATION_FLOW.md` | partially (existing endpoints work; phone-side BLE module is new firmware/UI work) |
| Modes + LED/buzzer/button | YES — `DEVICE_MODES.md` | NO (firmware) |
| Event JSON contract | YES — `DEVICE_EVENT_CONTRACT.md` | YES for server ingest (`POST /api/device/events` + `DeviceEvent`); phone BLE forwarding still missing |
| API requirements (existing + PROPOSED) | YES — `DEVICE_API_REQUIREMENTS.md` | partially (server telemetry + hardening are live; staging, BLE bridge, command channel, OTA, and Gen 2 auth are not) |
| Test plan alignment | YES — `DEVICE_TEST_PLAN_ALIGNMENT.md` | n/a (mapping doc) |

**What is still missing for device integration (after this documentation pass)**

- A staging environment Alex can hit from outside our network.
- Phone-side BLE module (firmware-app integration; covered conceptually in `DEVICE_OPERATION_FLOW.md` §2.5 but not implemented).
- Employee-side headset pairing UX around the existing 6-digit code flow.
- Test coverage for the new telemetry endpoints and status derivation.
- Mobile native app shell (only responsive web today; web BLE has limited support).
- Gen 2 items intentionally deferred: per-device credentials, realtime command channel, firmware OTA pipeline.

**What Alex can safely proceed with**

- Firmware design against the phone-bridged Gen 1 architecture (`DEVICE_OPERATION_FLOW.md`).
- LED/buzzer/button conventions in `DEVICE_MODES.md` (confirm or override).
- 15-event JSON catalog in `DEVICE_EVENT_CONTRACT.md`, backed by the implemented event ingest endpoint.
- Existing SAS upload contract (final and live; verbatim in `DEVICE_API_REQUIREMENTS.md` §5).
- 6-digit pairing-code redemption flow (verbatim in `DEVICE_API_REQUIREMENTS.md` §3).
- Storing `deviceUid` as the stable device identity.

**What we should not answer prematurely**

- Live WebRTC streaming, ACS architecture, OTA pipeline timelines, native mobile app release timing, production fleet-management features. None of those exist in code yet, and committing dates would be guessing.

---

_Maintainer note: when the five recommended docs in §8 are written, link them at the top of this file and mark the corresponding gaps in §6 as resolved._
