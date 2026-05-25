# Reliance Device — API Requirements (Gen 1)

> Status: living spec. **EXISTS** = endpoint is in code today and verified by inspection of `src/app/api/**`. **PROPOSED** = endpoint is required for the Gen 1 device flow but does not yet exist.
> Audience: Reliance backend (Cursor), hardware/firmware (Alex), Reliance app.
> Companion docs: `DEVICE_OPERATION_FLOW.md`, `DEVICE_MODES.md`, `DEVICE_EVENT_CONTRACT.md`, `DEVICE_TEST_PLAN_ALIGNMENT.md`.

---

## 1. Architectural reminder

Gen 1 is **phone-bridged**. The headset talks BLE to the employee's phone; the phone is the only thing that calls Reliance over HTTPS. Therefore:

- Auth on every Reliance call is the **employee phone's session** (existing `x-user-id` / cookie / interim Bearer JWT path in `src/lib/auth.ts`).
- The headset has no Reliance API key, no SAS URL, no certificate.
- Per-device credentials become a Gen 2 problem if/when the headset starts speaking HTTPS directly.

This drastically reduces what we need to build for Gen 1.

---

## 2. Endpoints already available (EXISTS)

These are real, verified, and used in production by the existing employee web flow. The hardware does not need new versions of these — the phone uses them as-is.

### 2.1 Auth + identity

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Phone signs the employee in. Returns session token + sets `userId` cookie. |

### 2.2 Pairing

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/device/pairing/request` | Vendor manager (or employee app, by re-using the same call) generates a 6-digit code with 5-minute TTL. |
| POST | `/api/device/pairing/confirm` | Device redeems the 6-digit code; upserts a `Device` row by `deviceUid`. Accepts `deviceType: "PHONE" \| "HEADSET"`. |
| POST | `/api/employee/device/pair` | Modern Prisma path used by the employee app to pair the **phone** to the active employee membership. Creates `Device` + `DeviceAssignment` and returns the canonical `deviceId`. |

### 2.3 Device assignment (manager-side)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/vendors/[vendorId]/headsets/[deviceId]/assign` | Bind a headset device to an employee membership. |
| POST | `/api/vendors/[vendorId]/headsets/[deviceId]/unassign` | Release that binding. |
| GET  | `/api/vendors/[vendorId]/devices` | List the vendor's devices (`firmwareVersion`, `model`, `os`, `appVersion`, `lastSeenAt`). |

### 2.4 Heartbeat

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/device/heartbeat` | Phone sends `{ phoneDeviceUid, deviceMeta }`. Server updates `Device.lastSeenAt` + `model/os/appVersion` and returns the active membership context. |

> **Caveat:** this is now a Prisma-backed compatibility route for the employee phone heartbeat. Headset telemetry should use the unified event ingest endpoint below.

### 2.4a Device telemetry

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/device/events` | Unified Gen 1 event ingest for every event in `DEVICE_EVENT_CONTRACT.md`; idempotent on `eventId`; updates `Device.lastSeenAt`; writes firmware version on `firmware_version_reported`; audits fatal `error_reported`. |
| GET | `/api/device/events` | Scoped telemetry read by `vendorId`, `deviceUid` / `deviceId`, `eventType`, `bookingId`, `since`, and `limit`. Admins can query across vendors; managers are vendor-scoped; employees are scoped to their active membership. |
| GET | `/api/vendors/[vendorId]/devices/status` | Manager-only device health summary derived from devices + recent events: online/recent/offline, latest event, battery/charging, assignment, firmware/app version, model/OS, and error/low-battery indicator. |
| POST | `/api/dev/device-events/seed` | Development-only synthetic telemetry generator. Returns 404 in production. Useful for exercising event ingest, duplicate handling, status derivation, and `/vendor/telemetry` without headset hardware. |

### 2.5 Job assignment + lifecycle

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/employee/jobs` | List assignments for the current employee. Phone polls this to know what to arm the headset for. |
| POST | `/api/employee/jobs/[jobId]/start` | Booking PENDING → CONFIRMED. Audit row written. |
| POST | `/api/employee/jobs/[jobId]/stage` | Mark a stage uploaded (Intro/InProgress/Completed). Auto-flips booking to AWAITING_REVIEW when all 3 stages are present. |
| POST | `/api/employee/jobs/[jobId]/complete` | Manual completion endpoint (kept for parity with older flows; the auto-flip in `/stage` handles the common case). |
| PATCH | `/api/vendors/[vendorId]/jobs/[jobId]/actions` | Manager `ASSIGN_JOB` (and other admin actions). |
| POST | `/api/vendors/[vendorId]/jobs/[jobId]/approve` | Manager approval. |
| POST | `/api/vendors/[vendorId]/jobs/[jobId]/reject` | Manager rejection with `rejectionReason`. |

### 2.6 Media sessions and SAS upload pipeline

The hardware/firmware contract for upload is **the existing 4-step pipeline**. No changes required for Gen 1.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/vendors/[vendorId]/media/sessions` | Create or reuse a stage session. Accepts `bookingId`, `vendorJobVideoStage`, `sessionType: "JOB_SERVICE_VIDEO"`, `replaceExisting: true`, `locationContext`, `deviceId`, `deviceType`. |
| POST | `/api/vendors/[vendorId]/media/upload/init` | Returns `{ sasUrl, assetId, blobKey }` with a 60-minute TTL. |
| `PUT` | `<sasUrl>` (Azure Blob direct) | Headers: `x-ms-blob-type: BlockBlob`, `Content-Type: <mime>`. Body: file bytes. Direct-to-blob; bytes do not flow through Reliance backend. |
| POST | `/api/vendors/[vendorId]/media/upload/complete` | Server verifies blob exists + size, applies storage-limit gate, writes `MediaAsset` (with `deviceId` if supplied), and may auto-flip the booking to AWAITING_ADMIN_REVIEW after the 3rd stage. |

### 2.7 Customer + admin flows downstream

These are not called by the device or phone, but they are the backbone of "your proof made it to the customer":

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/bookings/[id]/media` | Customer fetches approved + visible media for a booking. |
| GET  | `/api/bookings/[id]/media/[assetId]/download` | Authorized download URL for an approved asset. |
| GET  | `/api/admin/media/moderation-queue` | Admin moderation queue. |
| PATCH | `/api/admin/media/[assetId]/moderate` | Admin per-asset moderation. |
| PATCH | `/api/admin/media/packages/[bookingId]/moderate` | Admin package-level moderation. |
| POST | `/api/reviews/window/start` | Open the review window after admin approval. |
| POST | `/api/reviews/create` | Customer review submission with employee attribution. |
| GET  | `/api/vendors/[vendorId]/dashboard` | Vendor dashboard, including `employeePerformance` per membership. |

---

## 3. Pairing flow contract (verbatim, for firmware to follow)

Step-by-step sequence the phone executes when binding a headset for the first time:

1. Phone calls `POST /api/device/pairing/request` (no body required if the phone is signed in as a vendor manager / employee). Server returns `{ code: "638492", expiresAt: "<ISO>" }`.
2. Phone displays the 6-digit code to the user OR pushes it to the headset over BLE if the headset has a screen.
3. Phone calls `POST /api/device/pairing/confirm` with body:
   ```json
   {
     "code": "638492",
     "deviceUid": "hs_a3b1c2d4e5f6",
     "deviceType": "HEADSET",
     "deviceName": "Vendor X · Jane D"
   }
   ```
   Server verifies the code is unused + unexpired, marks it used, and upserts a `Device` row keyed on `deviceUid`. Returns `{ success: true, device: {...} }`.
4. Phone calls `POST /api/vendors/[vendorId]/headsets/[deviceId]/assign` with the active employee `membershipId` to bind the headset to that membership.
5. Phone optionally posts a `device_paired` event (PROPOSED, see `DEVICE_EVENT_CONTRACT.md` §1.2) to confirm the headset side too.

That sequence is final. Firmware can build against it now.

---

## 4. Device authentication requirement

### 4.1 Gen 1 (current architecture)

- The phone is the authenticated client.
- The headset's `deviceUid` is the only piece of data the server uses to look up the headset's `Device` row.
- The headset does not need (and does not get) any Reliance secret material.
- Knowing a `deviceUid` alone is **not** sufficient to do anything privileged: any Reliance write requires the phone's authenticated session AND the active vendor membership AND server-side cross-checks.

### 4.2 Gen 2+ direction (NOT required for Gen 1 ship)

When/if the headset speaks HTTPS directly, we will add:

- A new `/api/device/auth/issue` route that exchanges a paired-device proof (signed challenge over BLE? out-of-band token? TBD) for a long-lived per-device credential.
- A `getDeviceFromRequest` helper that mirrors `getUserIdFromRequest`, resolves a `Device` from the request, verifies the signed credential, and gates Gen-2 endpoints.
- A revoke path (currently `Device.isActive=false` exists in schema; needs an admin/manager UI flip).

This is captured in §6 as future work and intentionally out of Gen 1 scope.

---

## 5. SAS upload flow (verbatim, for firmware to follow)

This is the most important "real" contract for the hardware. Unchanged from production today.

1. **Init:** phone calls `POST /api/vendors/[vendorId]/media/upload/init` with:
   ```json
   {
     "fileName": "intro_2026-05-07T05-04-32Z.mp4",
     "expectedBytes": 24837120,
     "mimeType": "video/mp4"
   }
   ```
   Server returns:
   ```json
   {
     "sasUrl": "https://relianceblob...?sig=...",
     "assetId": "cmua...",
     "blobKey": "vendor/<vid>/cmua...mp4",
     "expiresAt": "2026-05-07T06:04:32.000Z"
   }
   ```
2. **PUT to blob:** phone HTTP PUT to `sasUrl` with the file bytes. Required headers:
   - `x-ms-blob-type: BlockBlob`
   - `Content-Type: <same mime as init>`
   Body is the raw bytes. No auth header on this call (the SAS itself authorizes).
3. **Complete:** phone calls `POST /api/vendors/[vendorId]/media/upload/complete` with:
   ```json
   {
     "assetId": "cmua...",
     "blobKey": "vendor/<vid>/cmua...mp4",
     "blobUrl": null,
     "bytes": 24837120,
     "mimeType": "video/mp4",
     "mediaSessionId": "cmou...",
     "deviceId": "cmd1..."
   }
   ```
   Server verifies the blob exists in Azure, validates size, runs the per-vendor storage-limit gate, then writes `MediaAsset(moderationStatus="pending_review", visibilityStatus="private")` and returns:
   ```json
   { "success": true, "asset": {...}, "storage": {...} }
   ```
4. **Stage acknowledgment:** phone calls `POST /api/employee/jobs/<jobId>/stage` with `{ "stage": "INTRO" }`. Server may auto-flip the booking to AWAITING_REVIEW after the 3rd stage.

Failure handling:

- 401/403 → re-auth (signed out / membership revoked).
- 409 `STAGE_VIDEO_REQUIRED` → upload didn't actually finish; retry from step 2.
- 409 `JOB_ASSIGNMENT_REQUIRED` → manager hasn't assigned this employee; surface error and stop.
- 422 `COMPLIANCE_LOCATION_REQUIRED` → phone forgot to send `locationContext` on session create.
- 422 `INVALID_SESSION_STATUS` → bug; surface and stop.
- 403 `STORAGE_LIMIT_REACHED` → phone shows storage error, recommends contacting vendor admin. Retrying won't help.
- 5xx → exponential backoff up to 5 attempts within 60 s. After that, emit `upload_failed` event and let the employee tap retry.

---

## 6. Future / required work

These are the remaining gaps before Alex's prototype testing can run end-to-end with real firmware on Reliance staging. Server-side event ingest is now implemented; staging and the phone/headset bridge are the biggest blockers.

### 6.1 `POST /api/device/events` — unified event ingest **EXISTS**

Single endpoint for every event in `DEVICE_EVENT_CONTRACT.md`.

- **Auth:** existing employee session (phone is the caller).
- **Body:** event envelope from `DEVICE_EVENT_CONTRACT.md` §0.1.
- **Behavior:**
  1. Validate envelope.
  2. Verify caller is an active employee on `vendorId`.
  3. Look up `Device` by `deviceUid` (404 if absent).
  4. Insert `DeviceEvent` row keyed unique on `eventId`. Duplicate ⇒ no-op + `duplicate: true`.
  5. Update `Device.lastSeenAt`. For `firmware_version_reported`, also update `Device.firmwareVersion`.
  6. For `error_reported` with `severity: "fatal"`, write an `AdminAuditLog` row via the existing `recordLifecycleAudit` helper.
  7. Return `{ ok: true, eventId, ackedAt, duplicate, command: null }`.

### 6.2 `GET /api/device/events?since=<iso>&deviceUid=<uid>` — telemetry read **EXISTS**

Read endpoint for admin tooling, vendor telemetry UI, and E2E tests. Not required by the device. Returns events in reverse chronological order and supports filters for `vendorId`, `deviceUid`, `deviceId`, `eventType`, `bookingId`, `since`, and `limit`.

- **Auth:** admin can query across vendors; manager is restricted to their vendor; employee is restricted to their active employee membership.

### 6.3 `POST /api/device/firmware/report` — explicit firmware version write **PROPOSED**

Optional alternative to the embedded `firmware_version_reported` event. Not required for Gen 1 because `POST /api/device/events` already writes `Device.firmwareVersion` when that event is received.

- **Auth:** existing employee session.
- **Body:** `{ deviceUid, firmwareVersion, installedAt }`.
- **Behavior:** updates `Device.firmwareVersion`. Emits a `firmware_version_reported` audit row.

### 6.4 Realtime command channel — **PROPOSED, decision pending**

Today the phone polls `GET /api/employee/jobs`. This is fine for assignment polling but adds 30-60 s latency to job arming. If we want true push:

- **Option A — long-poll:** `GET /api/device/commands?since=<iso>` with 30 s server-side timeout. Cheapest. No new infra. PROPOSED default.
- **Option B — Azure Web PubSub:** subscribe per-membership channel. Requires provisioning. Better latency.
- **Option C — Azure IoT Hub C2D:** required only if Gen 2 devices speak directly. Out of Gen 1 scope.

We will not block Gen 1 firmware on this. The phone polls today; firmware does not need to know whether the phone polled or got pushed.

### 6.5 `DeviceEvent` model — **EXISTS**

Current schema in `prisma/schema.prisma`:

```prisma
model DeviceEvent {
  id             String   @id @default(cuid())
  eventId        String   @unique
  eventType      String
  occurredAt     DateTime
  receivedAt     DateTime @default(now())
  deviceId       String
  vendorId       String
  membershipId   String?
  bookingId      String?
  mediaSessionId String?
  assetId        String?
  stage          String?
  payloadJson    String?
  contextJson    String?
  firmwareVersion String?
  phoneAppVersion String?

  device         Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([deviceId, occurredAt])
  @@index([vendorId, occurredAt])
  @@index([eventType, occurredAt])
  @@index([membershipId, occurredAt])
  @@map("device_events")
}
```

The ingestion logic lives in `src/lib/device-events.ts` and is shared by the public route and the dev-only seeder.

### 6.6 Hardening of `/api/device/heartbeat` and `/api/device/pairing/confirm` — **DONE**

Both routes now use Prisma queries/transactions instead of raw SQL string interpolation. Remaining auth posture is unchanged: Gen 1 still trusts the phone session and the 6-digit code redemption flow, while per-device credentials are reserved for Gen 2.

### 6.7 Firmware OTA — **OUT OF GEN 1 SCOPE**

If we eventually ship OTA, the cheapest shape is:

- Firmware binaries hosted in a dedicated container in the same Azure Storage account (e.g. `firmware/<deviceModel>/<version>.bin`).
- Server endpoint `GET /api/device/firmware?deviceUid=<uid>` returns `{ availableVersion, signedUrl }` if a newer signed image exists.
- Phone fetches the binary and forwards over BLE OBEX.
- Headset enters **Firmware Update** mode (see `DEVICE_MODES.md` §1.13).

Gen 1 ships without this. Updates are physical (USB or factory-reflash).

### 6.8 `POST /api/device/auth/issue` — **OUT OF GEN 1 SCOPE**

Future endpoint to mint a per-device credential when Gen 2 devices speak HTTPS directly. See §4.2.

### 6.9 Staging endpoint — **REQUIRED for Alex**

Out-of-repo infrastructure work. Required before firmware can soak-test against real Reliance APIs.

- A separate Azure resource group (App Service / Container App, separate Azure SQL DB or schema, separate Blob container).
- DNS like `staging.reliance.app` with a valid HTTPS cert.
- Seeded with a demo vendor + manager + a few employees.
- Phone app's `APP_BASE_URL` configurable so a tester can flip between prod and staging.

The codebase is ready for this — every relevant call already uses the configurable `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` envs.

---

## 7. Heartbeat requirement (consolidated)

For Gen 1, heartbeats are sent by the phone every 60 s while the phone is foregrounded and at least one Reliance device (phone or headset) is paired.

- **Compatibility path:** `POST /api/device/heartbeat` for the employee phone row.
- **Headset / unified path:** `heartbeat` events posted to `POST /api/device/events` (EXISTS §6.1). The legacy heartbeat endpoint remains for backwards compatibility while the event ingest path rolls out through the phone bridge.
- **Cadence:** 60 s while active; suppress while in **Power Off** and **Charging+Idle** (see `DEVICE_MODES.md` §1).
- **Auth:** existing employee session.
- **Required fields:** see `DEVICE_EVENT_CONTRACT.md` §1.3.

---

## 8. Event ingestion requirement (consolidated)

- All events listed in `DEVICE_EVENT_CONTRACT.md` §1 are POSTed to `/api/device/events` (EXISTS §6.1).
- Ordered by `occurredAt`, idempotent on `eventId`.
- Phone retries on 5xx with exponential backoff; queues to local storage on persistent failure.
- Server stores them in `DeviceEvent` (EXISTS §6.5) and updates `Device.lastSeenAt` on every event.

---

## 9. Command channel decision still pending

Captured above in §6.4. Gen 1 default is "phone polls". Firmware does not need to know.

---

## 10. Staging endpoint requirement (consolidated)

Captured above in §6.9. **This is the single biggest blocker** for hardware-in-the-loop testing on Reliance APIs without polluting production data.

---

## 11. Quick reference — what Reliance owes Alex before firmware integration

Ranked by urgency:

| Rank | Item | Status | Owner |
|---|---|---|---|
| 1 | Staging environment + DNS + seeded demo vendor | not yet built | Reliance infra |
| 2 | Phone-side BLE bridge that forwards headset events/chunks and calls existing Reliance endpoints | not yet built | Reliance app + firmware |
| 3 | Phone-app surface to display/redeem the 6-digit code in the employee flow (today the code lives on the vendor dashboard only) | UI work | Cursor / frontend |
| 4 | Reliance-side BLE protocol document (handshake, characteristics, chunk format) | not yet written | Joint with Alex |
| 5 | Automated telemetry tests for `/api/device/events`, duplicate event IDs, firmware update, fatal-error audit, status summary, and dev seed route | not yet added | Cursor / QA |
| 6 | Firmware OTA pipeline | OUT OF GEN 1 SCOPE | future |
| 7 | Per-device API key issuance | OUT OF GEN 1 SCOPE | future |

Items 1-5 unblock Alex's prototype testing on real Reliance APIs. Items 6 and 7 are explicitly Gen 2 territory.
