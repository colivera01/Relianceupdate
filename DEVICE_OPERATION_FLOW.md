# Reliance Device — Operation Flow (Gen 1)

> Status: foundational specification. Anything labelled **EXISTS** is in code today (verified by inspection of `src/app/**` + `prisma/schema.prisma`). Anything labelled **PROPOSED** is a contract we're committing to, but is not yet implemented.
> Audience: hardware/firmware (Alex), Reliance backend, Reliance app.
> Companion docs: `DEVICE_MODES.md`, `DEVICE_EVENT_CONTRACT.md`, `DEVICE_API_REQUIREMENTS.md`, `DEVICE_TEST_PLAN_ALIGNMENT.md`, `CHATGPT_SYNC_DEVICE_READINESS.md`.

---

## 1. Architectural premise: phone-bridged Gen 1

The Gen 1 Reliance headset is **not** an internet-connected device. It is a Bluetooth Low Energy (BLE) accessory paired to the employee's phone. The employee's phone is the only thing that talks to Reliance's backend over HTTPS.

```
+---------+       BLE        +-------+      HTTPS / SAS      +-----------+
| Headset | <--------------> | Phone | <-------------------> |  Reliance |
|  (Gen1) |     events +     |  app  |     auth + media      |  backend  |
|         |    media chunks  |       |                       | + Azure   |
+---------+                  +-------+                       +-----------+
```

Implications:

- The headset has no Wi-Fi credentials, no per-device API key, no SAS URL.
- The phone is the trust anchor. The phone is signed in as a real Reliance user with an `EMPLOYEE` `VendorMembership`, so all of Reliance's existing auth (`x-user-id` header + cookie + interim Bearer JWT) keeps working.
- The phone forwards headset events to Reliance through the Reliance employee app; Reliance forwards commands the other direction the same way.
- "Pairing" in this doc means **two pairings**: (a) phone ↔ headset over BLE, (b) phone+headset ↔ Reliance vendor over a 6-digit code (already implemented).
- All file uploads go phone → Azure Blob via the existing SAS-based pipeline. The headset hands chunks to the phone over BLE; the phone uploads.

This is what unblocks Gen 1 ship without inventing IoT Hub, ACS, OTA, or fleet management. Gen 2+ may move to Wi-Fi-direct devices; this doc is intentionally Gen-1 scoped.

---

## 2. First-time employee setup (end-to-end)

Goal: a brand-new hire goes from "manager just sent me a link" to "ready to record on a real job" in one continuous sitting.

### 2.1 Manager creates the invite

- Manager opens `/vendor/employees`.
- Submits the invite form. Triggers `POST /api/vendors/[vendorId]/employee-invites`.
- A row is written in `vendor_invites` with a tokenized URL. Optional Twilio SMS / Resend email is sent to the invited user. **EXISTS.**

### 2.2 Employee accepts the invite

- Employee opens the invite URL on their phone (`/vendor/invite/[token]`). Page calls `GET /api/vendor/invite/[token]` to validate the token.
- Employee taps **Accept**. Triggers `POST /api/vendor/invite/[token]`.
- Server upserts a `VendorMembership(role=EMPLOYEE, status=ACTIVE)` for that user + vendor, marks the invite consumed, emits a `membership_accepted` row in `AdminAuditLog`. **EXISTS.**

### 2.3 Employee logs in on their phone (web app, Gen 1)

- Employee navigates to `/auth/login` and signs in. `POST /api/auth/login` returns a session token + sets `userId` cookie. The Reliance employee surfaces are responsive web pages — Gen 1 does not require a native mobile app. **EXISTS.**

### 2.4 Phone auto-pairs with Reliance backend

- The first time the employee opens `/employee/jobs`, the page POSTs to `/api/employee/device/pair` with a stable per-browser `deviceUid` (stored in `localStorage` as `employee_device_uid`).
- Server looks up the active employee `VendorMembership`, upserts a `Device` row (`deviceType: "PHONE"`, `vendorId`, `deviceUid`, `model`, `os`, `appVersion`, `pairedAt`, `lastSeenAt`), creates a `DeviceAssignment` linking the device to the membership, and stores phone metadata on the membership (`pendingPhoneDeviceUid`, etc.). **EXISTS.**
- Server emits a `device_paired` `AdminAuditLog` row on first creation. **EXISTS.**
- Page shows a green **Device paired** indicator with `model · OS`. **EXISTS.**

### 2.5 Phone pairs the headset over BLE — PROPOSED

- The Reliance employee app initiates BLE scan, finds the headset (advertising name `Reliance-XXXXXX` where `XXXXXX` is the last 6 chars of `deviceUid`), and pairs.
- The app reads the headset's `deviceUid` characteristic and `firmwareVersion` characteristic.
- The app POSTs to `POST /api/device/pairing/request` to fetch a 6-digit code (this currently runs from the vendor dashboard; for Gen 1 employee onboarding we will accept the same call from the employee surface — no new endpoint required, just a UI surface).
- The app POSTs to `POST /api/device/pairing/confirm` with `{ code, deviceUid: <headset uid>, deviceType: "HEADSET", deviceName: "<vendor + employee>" }`. Server upserts a `Device` row of `deviceType: "HEADSET"` and marks the pairing code consumed. **EXISTS** for the API; the BLE side is **PROPOSED** firmware work.
- The app then calls (PROPOSED) `POST /api/vendors/[vendorId]/headsets/[deviceId]/assign` with the active employee membership ID so the headset is bound to the same membership as the phone. **EXISTS** as an endpoint already.
- On success, the headset enters **Connected** mode (see `DEVICE_MODES.md`).

### 2.6 First-job-ready confirmation

- After §2.5 completes, the phone shows "Headset paired · ready for jobs".
- The employee jobs page begins polling `GET /api/employee/jobs` (it already does this). When a manager later assigns a job, the page picks it up. **EXISTS.**

---

## 3. Operational lifecycle of a single job

```
manager      employee phone        headset       Reliance backend       Azure Blob       customer
   |               |                  |                  |                  |               |
   | ASSIGN_JOB    |                  |                  |                  |               |
   |---->-->--->-->|                  |                  |                  |               |
   |               | (poll jobs)----->|                  |                  |               |
   |               |     "Start Job"  |                  |                  |               |
   |               |---POST /start--->|                  |                  |               |
   |               |     Intro recording                 |                  |               |
   |               |---BLE start ---> |                  |                  |               |
   |               |<---chunks-------|                  |                  |               |
   |               |---SAS init ----+----------------->|                  |               |
   |               |---PUT  ------- + -------------------------------+--->|               |
   |               |---upload/complete--------------->|                  |               |
   |               |---POST /stage   |                  |                  |               |
   |               |    (repeat for In Progress / Completed)              |               |
   |               |    booking auto-flips to AWAITING_REVIEW             |               |
   |   approve     |                  |                  |                  |               |
   |<--POST------- |                  |                  |                  |               |
   |               |                  |  admin moderation                  |               |
   |               |                  |   (asset/package)                  |               |
   |               |                  |                  |                  |--->customer-> |
   |               |                  |                  |                  |  reviews +   |
   |               |                  |                  |                  |  attribution |
```

### 3.1 Manager assigns the job

- Manager clicks **Assign** in `/vendor/jobs`. Triggers `PATCH /api/vendors/[vendorId]/jobs/[jobId]/actions` with `{ action: "ASSIGN_JOB", assignedMembershipIds: [...] }`.
- Server writes `vendor_job_assigned_membership_ids` and `vendor_job_assigned_employees` into `Booking.customerMetadata` and emits `job_assigned` audit row. **EXISTS.**

### 3.2 Employee sees the job

- `/employee/jobs` page lists assignments via `GET /api/employee/jobs`. The job card shows customer name + phone + booking date + 3 stage tiles (Intro / In Progress / Completed). **EXISTS.**

### 3.3 Employee starts the job

- Employee taps **Start Job**. Triggers `POST /api/employee/jobs/[jobId]/start`.
- Server verifies active employee membership, that the job is assigned to them, then transitions booking PENDING → CONFIRMED. Emits `job_started` audit row. **EXISTS.**
- App sends BLE command `{type: "ARM_JOB", bookingId, vendorId, mediaSessionHints: ["INTRO","IN_PROGRESS","COMPLETED"]}` to the headset. Headset enters **Assigned Job Ready** mode. **PROPOSED.**

### 3.4 Before / Intro capture

- Employee presses the **Record** button on the headset (or in the app — both must work in Gen 1).
- App sends BLE command `{type: "RECORD_START", stage: "INTRO"}`. Headset enters **Recording** mode. **PROPOSED.**
- Headset captures video + audio (mic-on-phone or mic-on-headset; see `DEVICE_TEST_PLAN_ALIGNMENT.md` §3 for open question), streams chunks back to phone over BLE.
- Employee presses **Stop** (or the headset auto-stops at a configured cap, e.g. 5 min). Headset enters **Uploading** mode. **PROPOSED.**

### 3.5 Phone uploads the Intro asset to Reliance

The phone runs the **existing** 4-step upload pipeline:

1. `POST /api/vendors/[vendorId]/media/sessions` with `{ bookingId, vendorJobVideoStage: "INTRO", sessionType: "JOB_SERVICE_VIDEO", replaceExisting: true, locationContext: "business" | "residence" | "customer-business", deviceId, deviceType }`.
   Server validates assignment, writes a `MediaSession` (one per stage). **EXISTS.**
2. `POST /api/vendors/[vendorId]/media/upload/init` with `{ fileName, expectedBytes, mimeType }`. Server returns `{ sasUrl, assetId, blobKey }` — 60-minute TTL. **EXISTS.**
3. `PUT <sasUrl>` with `x-ms-blob-type: BlockBlob` and the file body. Direct device → Azure Blob; bytes do not flow through Reliance backend. **EXISTS.**
4. `POST /api/vendors/[vendorId]/media/upload/complete` with `{ assetId, blobKey, bytes, mimeType, mediaSessionId, deviceId }`. Server verifies the blob exists + size, runs the storage-limit gate, and creates the `MediaAsset` row with `moderationStatus: "pending_review"`, `visibilityStatus: "private"`. **EXISTS.**
5. `POST /api/employee/jobs/[jobId]/stage` with `{ stage: "INTRO" }`. Server marks the stage progressed; if all 3 stages have an upload, booking auto-transitions to AWAITING_REVIEW. Emits `job_stage_uploaded` audit row. **EXISTS.**

### 3.6 During / In Progress capture

- Same flow as 3.4 + 3.5 with `stage: "IN_PROGRESS"`.

### 3.7 After / Completed capture

- Same flow with `stage: "COMPLETED"`.
- After the third stage uploads, the booking is automatically AWAITING_REVIEW (the existing logic in `media/upload/complete` and `employee/jobs/.../stage` handles this — no extra device call required).

### 3.8 Submit for manager review (no separate hardware step)

- The status change in §3.7 is the submission. The employee jobs page shows "Submitted for manager review" and the **Submit for Manager Review** button is disabled. **EXISTS.**
- App may optionally beep the headset (single confirm tone) and return it to **Connected** mode.

### 3.9 Manager review

- Manager opens `/vendor/jobs`, taps the AWAITING_REVIEW card.
- **Approve**: `POST /api/vendors/[vendorId]/jobs/[jobId]/approve`. Booking → COMPLETED, package re-queued for admin moderation. Emits `job_approved`. **EXISTS.**
- **Reject**: `POST /api/vendors/[vendorId]/jobs/[jobId]/reject` with `{ rejectionReason }`. Booking → IN_PROGRESS, reason persisted. Emits `job_rejected`. **EXISTS.**
- On reject, the employee jobs page shows the rejection card with the manager's reason; the employee re-uploads the requested stage (replaces in-place via `replaceExisting: true`) and re-submits. Loop repeats until approved.

### 3.10 Admin moderation

- Admin opens `/admin/media/moderation-queue`.
- Per-asset moderation: `PATCH /api/admin/media/[assetId]/moderate` with `{ moderationStatus: "approved" | "rejected", visibilityStatus, moderationReason }`. **EXISTS.**
- Package-level moderation (Intro/InProgress/Completed atomically): `PATCH /api/admin/media/packages/[bookingId]/moderate`. **EXISTS.**
- Customer-visibility filter requires `moderationStatus="approved"` AND `visibilityStatus` allows customer AND asset is active. **EXISTS.**

### 3.11 Customer proof visibility

- Customer opens `/my-bookings`, taps the booking. Page calls `GET /api/bookings/[id]/media`, which only returns assets that pass the moderation/visibility filter. **EXISTS.**
- Customer can request a download URL via `GET /api/bookings/[id]/media/[assetId]/download`. **EXISTS.**

### 3.12 Review submission and impact on employee profile

- After admin approves the package, a `ReviewWindow` opens. Customer review submission via `POST /api/reviews/create` carries `assignedMembershipId`, `assignedEmployeeName`, `assignedUserId`, capturing employee attribution. **EXISTS.**
- Vendor dashboard `employeePerformance` per-membership now reflects the new review:
  - `averageRating`, `reviewCount` updated
  - `jobsCompleted` incremented (already counted via booking history)
  - `lastJobAt` updated
  **EXISTS** (added 2026-05-06).

---

## 4. Offline / retry behavior

### 4.1 Headset → Phone (BLE) loss

- If the BLE link drops mid-recording, headset MUST continue capturing to local storage (PROPOSED firmware behavior). Headset enters **Offline** mode (LED yellow blink).
- When BLE re-connects, headset emits `device_reconnected` event (see `DEVICE_EVENT_CONTRACT.md`) and resumes streaming queued chunks.

### 4.2 Phone → Reliance (HTTPS) loss

- Reliance employee app already tolerates fetch failures and surfaces them to the user with a retry button. **EXISTS.**
- `media/upload/init` SAS URLs are valid for 60 minutes; if the network returns within that window, the same SAS URL can be retried.
- If the SAS URL has expired, the app simply restarts the upload from §3.5 step 2 (`replaceExisting: true` is already passed).
- `MediaAsset` rows are only created on `upload/complete`, so a partially-uploaded blob does not produce a "ghost" asset row.

### 4.3 Phone → Reliance command channel loss

- Today there is no realtime command channel from Reliance to the phone. The phone polls `GET /api/employee/jobs` for new assignments. **EXISTS.**
- Future: if a Web PubSub or long-poll command channel is added (see `DEVICE_API_REQUIREMENTS.md` §6.4), the same offline behavior applies — the device reverts to polling.

### 4.4 Crash / reboot mid-recording

- Headset MUST finalize the in-progress chunk to flash before emitting any "boot complete" event so the phone can re-discover and upload the orphan chunk on next pairing. **PROPOSED firmware behavior.**

---

## 5. Failure states and how the system responds

| Failure | Detected by | UX outcome | Backend effect |
|---|---|---|---|
| Headset battery <10% | Headset firmware | Phone shows "Headset low battery", buzzer triple-beep | Phone emits `battery_low` event |
| Headset disconnects mid-record | Phone BLE callback | Recording continues on headset; phone shows "Reconnecting…" | No backend write until reconnect |
| SAS upload PUT fails (network) | Phone fetch | Stage tile shows "Upload failed, try again" | No `MediaAsset` written |
| SAS upload PUT fails (storage limit) | Server `upload/complete` | App shows storage-limit error | `STORAGE_LIMIT_REACHED`; admin alert may fire via existing storage helpers |
| `upload/complete` fails to verify blob | Server | App shows warning; asset still saved with warning flag | `MediaAsset.warning` set (existing logic) |
| Manager rejects with reason | Manager UI | Employee sees rejection card, re-uploads | Booking IN_PROGRESS + `rejectionReason`; `job_rejected` audit |
| Admin rejects asset | Admin UI | Customer never sees the asset | `MediaAsset.moderationStatus="rejected"` |
| Phone session expires | Existing auth | App redirects to `/auth/login` | None |
| Headset firmware crash | Headset watchdog | Auto-reboot; emits `device_boot` on next pairing | None |

---

## 6. Review impact on employee profile

The vendor dashboard's `employeePerformance` array (returned by `GET /api/vendors/[vendorId]/dashboard`) is the canonical surface for "how is this employee doing":

```json
{
  "membershipId": "cmoh...",
  "displayName": "Jane Doe",
  "averageRating": 4.7,
  "reviewCount": 18,
  "jobsCompleted": 22,
  "lastJobAt": "2026-05-06T18:24:00.000Z",
  "active": true
}
```

Each new approved customer review updates `averageRating` and `reviewCount`. Each completed job updates `jobsCompleted` and `lastJobAt`. Top-performer indicators are derived from this list in the dashboard UI. **EXISTS.**

Future per-employee aggregates that are not yet exposed (out of Gen-1 scope but cheap to add later): rejection-rate, moderation-issue-rate, average-time-to-stage. All can be computed from existing `AdminAuditLog` rows.

---

## 7. Open architectural decisions that affect this flow

These are **not blockers** for Gen 1 ship, but they will move the diagrams above when we make the calls:

1. **Mic location.** Mic on phone vs mic on headset. Affects whether the headset uploads audio at all.
2. **Max recording length per stage.** Currently no enforced cap; firmware should enforce ~5 min per stage.
3. **Concurrent recordings.** Gen 1 = single active stage at a time. Documented here, not enforced in firmware yet.
4. **Realtime command channel.** Today the phone polls. If/when Web PubSub is added, the phone subscribes and the polling loop becomes a fallback (see `DEVICE_API_REQUIREMENTS.md` §6).
5. **OTA pipeline.** Out of scope for Gen 1.

---

## 8. Quick reference — what a real first-time job looks like in API calls

```text
1.  POST /api/auth/login                                   # employee signs in on phone
2.  GET  /api/vendor/invite/<token>                        # only if accepting an invite
3.  POST /api/vendor/invite/<token>                        # accepts invite -> ACTIVE membership
4.  POST /api/employee/device/pair                         # phone auto-pair to backend
5.  (BLE) phone <-> headset pair                           # firmware-only, no API call
6.  POST /api/device/pairing/request                       # 6-digit code
7.  POST /api/device/pairing/confirm                       # headset row written
8.  POST /api/vendors/<v>/headsets/<d>/assign              # bind headset to membership
9.  GET  /api/employee/jobs                                # employee surface polls
10. POST /api/employee/jobs/<j>/start                      # PENDING -> CONFIRMED
   for each stage in [INTRO, IN_PROGRESS, COMPLETED]:
11.   POST /api/vendors/<v>/media/sessions
12.   POST /api/vendors/<v>/media/upload/init
13.   PUT  <sasUrl>
14.   POST /api/vendors/<v>/media/upload/complete
15.   POST /api/employee/jobs/<j>/stage
16. (auto) booking -> AWAITING_REVIEW
17. POST /api/vendors/<v>/jobs/<j>/approve                 # manager approves
18. PATCH /api/admin/media/packages/<j>/moderate           # admin moderates
19. POST /api/reviews/window/start                         # customer review window
20. POST /api/reviews/create                               # customer submits review
21. GET  /api/vendors/<v>/dashboard                        # employeePerformance reflects new review
```

Steps 1-4 and 6-21 already work end-to-end (verified by `e2e/reliance-trust-loop.spec.ts`). Step 5 is new firmware work.
