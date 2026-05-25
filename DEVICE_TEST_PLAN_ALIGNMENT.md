# Reliance Device — Test Plan Alignment (Gen 1)

> Status: living spec. Maps Alex's prototype/firmware test plan to what Reliance can verify against today vs what still needs staging or new endpoints.
> Audience: hardware/firmware (Alex), Reliance backend, Reliance QA.
> Companion docs: `DEVICE_OPERATION_FLOW.md`, `DEVICE_MODES.md`, `DEVICE_EVENT_CONTRACT.md`, `DEVICE_API_REQUIREMENTS.md`.

---

## 0. Test environment legend

| Symbol | Meaning |
|---|---|
| ✅ READY | Verifiable today against the current Reliance backend. The relevant endpoint + schema + UI exist; the existing E2E spec `e2e/reliance-trust-loop.spec.ts` covers most of it. |
| ⚠️ READY (staging required) | The Reliance side works, but Alex's hardware needs a staging URL to run against. Production should not be used for prototype soak testing. |
| 🟡 PARTIAL | Some part exists; one or two pieces are still PROPOSED. Specific gap is named in the row. |
| ❌ NOT READY | Reliance does not yet have what's needed; tests would block on backend work. |

For each row, the "Reliance contract" column links to the doc that defines the contract Alex builds against.

---

## 1. Bluetooth pairing (phone ↔ headset)

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Headset advertises BLE name `Reliance-XXXXXX` | ❌ NOT READY | `DEVICE_OPERATION_FLOW.md` §2.5 / `DEVICE_MODES.md` §1.3 | Pure firmware work; no Reliance side. Reliance only cares once the phone has the BLE link and starts the 6-digit handshake. |
| Phone discovers and pairs over BLE | ❌ NOT READY | ditto | Phone-app BLE module is also new work; web-app would need a Capacitor or PWA-WebBluetooth shell. Out of Gen 1 web-only ship if we keep it pure web. |
| Phone reads `deviceUid` characteristic from headset | ❌ NOT READY | `DEVICE_EVENT_CONTRACT.md` §0 | The `deviceUid` is then forwarded into `/api/device/pairing/confirm` (EXISTS). |
| Phone reads `firmwareVersion` characteristic | ❌ NOT READY | `DEVICE_EVENT_CONTRACT.md` §1.15 | Required so the first `device_paired` event can carry it. |

**Bottom line for Alex:** the BLE side is firmware + phone-app work. Reliance has no opinion on the BLE protocol details (chunk format, characteristic UUIDs, OBEX vs custom GATT, etc.) yet — captured in `DEVICE_API_REQUIREMENTS.md` §11 row 6 as a joint document we still owe each other.

---

## 2. WiFi connectivity (phone)

The phone is the WiFi/cellular endpoint in Gen 1. The headset has no IP stack.

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Phone connects to a real-world WiFi or LTE | ✅ READY | n/a | Standard mobile / phone behavior. |
| Phone reaches `https://staging.reliance.app/api/services` (200) | ⚠️ READY (staging required) | `DEVICE_API_REQUIREMENTS.md` §6.9 | Identical to existing `https://<prod>/api/services` smoke we run before every E2E. Production version verified. Staging is what we still need to provision. |
| Phone re-establishes session after a transient WiFi drop | ✅ READY | `src/contexts/AuthContext.tsx`, `src/lib/client-session.ts` | Existing auth flow already tolerates transient failures. |
| Phone seamlessly continues an in-flight upload after WiFi drop | 🟡 PARTIAL | `DEVICE_OPERATION_FLOW.md` §4.2 | SAS URL is valid for 60 minutes, so re-PUT is fine. Truly resumable PUT (block-list semantics) is not implemented; today the upload restarts from byte 0. Acceptable for Gen 1 if files stay small (<50 MB per stage). |

---

## 3. Camera / recording

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Headset begins recording on Record button press | ❌ NOT READY | `DEVICE_OPERATION_FLOW.md` §3.4 | Pure firmware work. |
| Recording stops cleanly on second press | ❌ NOT READY | ditto | |
| Recording auto-stops at firmware-configured cap (≤5 min suggested) | ❌ NOT READY | `DEVICE_MODES.md` §1.6 | Cap is firmware-configurable; Reliance does not enforce it server-side. |
| Recorded file mime is `video/mp4` (H.264 + AAC suggested) | ❌ NOT READY | `DEVICE_OPERATION_FLOW.md` §3.5 step 2 | Reliance accepts any `video/*` mime today; recommend `video/mp4` for compatibility with `<video>` playback in customer + admin UIs. |
| Recorded file ends up in Azure Blob | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §5 | Existing SAS pipeline; verified by `e2e/reliance-trust-loop.spec.ts`. |

**Open hardware question:** mic-on-phone vs mic-on-headset (see `DEVICE_OPERATION_FLOW.md` §7). Affects whether the headset uploads audio at all.

---

## 4. Flashlight / on-device LEDs

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| LED color changes per mode | ❌ NOT READY | `DEVICE_MODES.md` §1 | Pure firmware. Reliance only emits the mode-change *triggers* over BLE (commands like `ARM_JOB`, `RECORD_START`); the headset interprets and drives its LEDs. |
| Flashlight (if present) toggles via Action button | ❌ NOT READY | `DEVICE_MODES.md` §0 | Optional hardware; not in the modes list. If kept, Reliance will not control it. |

---

## 5. Microphone / audio

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Audio recorded alongside video | ❌ NOT READY | `DEVICE_OPERATION_FLOW.md` §7 #1 | Decision pending: mic-on-phone vs mic-on-headset. |
| Audio plays back in `/admin/media/moderation-queue` | ✅ READY | `src/app/admin/media/...` UI | The admin uses the standard HTML5 video player; if the uploaded file has audio, it plays. |
| Audio plays back in `/my-bookings/<id>` for the customer | ✅ READY | `src/app/api/bookings/[id]/media/...` | Same. Customer-visibility filter governs whether the asset reaches the customer at all. |

---

## 6. Upload to Azure Blob (the core trust path)

This is the single most important "real" path. **All four steps below are EXISTS-status today, in production.** The headset's contract is "hand bytes to the phone over BLE; the phone does the rest."

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Phone calls `POST /api/vendors/[v]/media/sessions` | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §2.6 | Verified end-to-end by E2E. |
| Phone calls `POST /api/vendors/[v]/media/upload/init` | ✅ READY | ditto | Returns `{ sasUrl, assetId, blobKey }`, 60 min TTL. |
| Phone PUTs file bytes to `sasUrl` | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §5 | Required headers documented. |
| Phone calls `POST /api/vendors/[v]/media/upload/complete` | ✅ READY | ditto | Includes `deviceId` so the asset is attributed to the headset. |
| Phone calls `POST /api/employee/jobs/[j]/stage` | ✅ READY | `DEVICE_OPERATION_FLOW.md` §3.5 step 5 | Auto-flips booking to AWAITING_REVIEW after 3rd stage. |

---

## 7. Heartbeat

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Phone sends heartbeat every 60 s | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §7 | Existing `POST /api/device/heartbeat`. |
| `Device.lastSeenAt` updates in DB | ✅ READY | ditto | Verified by inspection of `src/app/api/device/heartbeat/route.ts`. |
| Vendor telemetry reflects "device online" indicator | ✅ READY | `src/app/api/vendors/[vendorId]/devices/status/route.ts`, `/vendor/telemetry` | Manager status API derives online / recently seen / offline from `lastSeenAt` and recent events. |
| Heartbeat over `/api/device/events` | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §6.1 | Unified event ingest accepts `heartbeat`, persists `DeviceEvent`, and updates `Device.lastSeenAt`. |

---

## 8. Offline / retry

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Headset records to local flash while BLE link is down | ❌ NOT READY | `DEVICE_OPERATION_FLOW.md` §4.1 | Firmware behavior. |
| Phone re-pairs and the queued chunks transfer | ❌ NOT READY | `DEVICE_EVENT_CONTRACT.md` §1.13 | Firmware + phone-app BLE work. |
| Phone retries failed upload with same `assetId` and `replaceExisting: true` | ✅ READY | `src/app/api/vendors/[vendorId]/media/sessions/route.ts` | `replaceExisting` already implemented; existing session is archived and a new one is created. |
| Phone discards a permanently-failed upload | 🟡 PARTIAL | `DEVICE_EVENT_CONTRACT.md` §1.10 / §3 | Phone-side flow is straightforward; the optional `CLEAR_FAILED_UPLOAD` server command is PROPOSED. |

---

## 9. Device pairing (Reliance side)

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Vendor manager generates 6-digit code | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §2.2 | Verified — button on `/vendor/dashboard`. |
| Phone redeems code via `POST /api/device/pairing/confirm` | ✅ READY | ditto | Headset row written, code marked used. |
| Headset device row appears in `/vendor/devices` list | ✅ READY | `src/app/api/vendor/devices/route.ts` | |
| Manager can assign headset to a specific employee | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §2.3 | `POST /api/vendors/[v]/headsets/[d]/assign`. |
| Manager can unassign / revoke headset | 🟡 PARTIAL | ditto | Endpoint exists; `Device.isActive=false` flip is supported but no UI yet. |
| Code is rejected after 5 minutes | ✅ READY | `src/app/api/device/pairing/confirm/route.ts` (`expiresAt < new Date()`) | |
| Code is rejected after redemption | ✅ READY | ditto (`pairing.used`) | |
| Pairing route uses Prisma / parameterized DB access | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §6.6 | `POST /api/device/pairing/confirm` now uses Prisma transaction/update/create calls. |

---

## 10. Employee job workflow (manager → employee → manager → admin → customer)

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Manager assigns a job to an employee | ✅ READY | `DEVICE_API_REQUIREMENTS.md` §2.5 (`PATCH .../actions` with `ASSIGN_JOB`) | Audit row written. |
| Employee sees the job on `/employee/jobs` | ✅ READY | `src/app/employee/jobs/page.tsx` | Auto-pairs phone on load. |
| Employee starts the job | ✅ READY | `POST /api/employee/jobs/[j]/start` | Booking PENDING → CONFIRMED. |
| Three-stage proof (Intro / In Progress / Completed) flows through SAS pipeline | ✅ READY | §6 above | Verified by `e2e/reliance-trust-loop.spec.ts`. |
| Booking auto-flips to AWAITING_REVIEW when 3 stages present | ✅ READY | `src/app/api/vendors/[v]/media/upload/complete/route.ts` | Server-side. |
| Manager approves the job | ✅ READY | `POST /api/vendors/[v]/jobs/[j]/approve` | Booking → COMPLETED. Audit row. |
| Manager rejects with `rejectionReason` | ✅ READY | `POST /api/vendors/[v]/jobs/[j]/reject` | Booking → IN_PROGRESS. Employee sees rejection card. Audit row. |
| Employee re-uploads the requested stage | ✅ READY | `replaceExisting: true` already supported. | |
| Lifecycle audit visible in `AdminAuditLog` | ✅ READY | `src/lib/lifecycle-audit.ts` | `job_assigned`, `job_started`, `job_stage_uploaded`, `job_approved`, `job_rejected`, `device_paired`, `membership_accepted`. |

---

## 11. Proof upload (per-asset and per-package)

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Per-asset moderation by admin | ✅ READY | `PATCH /api/admin/media/[assetId]/moderate` | |
| Per-package (booking-level) moderation | ✅ READY | `PATCH /api/admin/media/packages/[bookingId]/moderate` | |
| Customer-visibility filter | ✅ READY | `src/app/api/bookings/[id]/media/route.ts` | Only `moderationStatus="approved"` + active assets reach the customer. |
| Storage-limit gate prevents upload past quota | ✅ READY | `src/app/api/vendors/[vendorId]/media/upload/complete/route.ts` | Returns `STORAGE_LIMIT_REACHED`. |

---

## 12. Manager / admin / customer flow

| Test step | Status | Reliance contract | Notes |
|---|---|---|---|
| Customer creates booking, vendor manages, employee fulfills, admin moderates, customer reviews | ✅ READY | `e2e/reliance-trust-loop.spec.ts` | Single Playwright spec runs the entire chain on the live backend in 2 min. |
| Review attribution to assigned employee | ✅ READY | `src/app/api/reviews/create/route.ts` | `assignedMembershipId`, `assignedEmployeeName`, `assignedUserId`. |
| Vendor dashboard reflects new review (`employeePerformance`) | ✅ READY | `src/app/api/vendors/[vendorId]/dashboard/route.ts` | `averageRating`, `reviewCount`, `jobsCompleted`, `lastJobAt`, `active`. |

---

## 13. Tests not ready yet (blocked on staging or app/firmware work)

The following test categories require either a staging environment (Reliance infra work) or the phone/headset BLE bridge. Server-side event ingest is no longer the blocker.

| Test category | What's missing | Doc |
|---|---|---|
| Long-soak heartbeat against staging | Staging environment | `DEVICE_API_REQUIREMENTS.md` §6.9 |
| Multi-device fleet test (>1 paired headset per vendor) | Staging environment | ditto |
| Hardware-in-the-loop full lifecycle | Staging + BLE protocol doc | `DEVICE_API_REQUIREMENTS.md` §11 row 6 |
| Battery profiling under realistic upload load | Staging + firmware power profile | none |
| Event ingest correctness for the full event catalog (`device_boot`, `device_paired`, `heartbeat`, `job_received`, `recording_started`, `recording_stopped`, `upload_started`, `upload_progress`, `upload_completed`, `upload_failed`, `battery_low`, `device_offline`, `device_reconnected`, `error_reported`, `firmware_version_reported`) | Endpoint/model exist; needs automated route tests and/or seeded staging hardware run | `DEVICE_API_REQUIREMENTS.md` §6.1, §6.5; `DEVICE_EVENT_CONTRACT.md` §1 |
| Idempotency of duplicate `eventId` posts | Endpoint behavior exists; needs automated regression coverage | ditto |
| Server piggy-backed commands (`ARM_JOB`, `DISARM_JOB`, etc.) | Command channel decision | `DEVICE_API_REQUIREMENTS.md` §6.4 |
| Firmware OTA round-trip | Out of Gen 1 scope | `DEVICE_API_REQUIREMENTS.md` §6.7 |
| Per-device API key flow | Out of Gen 1 scope | `DEVICE_API_REQUIREMENTS.md` §6.8 |

---

## 14. What Alex can run **right now** against production-like infra

If we want a confidence build before staging exists, Alex can validate the upload contract using a synthetic phone (script or Postman collection) hitting the existing production endpoints with a demo vendor account. Steps:

1. Login as the demo vendor's employee user → cookie + token.
2. Pair a phone via `POST /api/employee/device/pair` with a fake `deviceUid`.
3. Have a manager assign a job to the employee.
4. Run the 4-step SAS upload pipeline 3 times (Intro / In Progress / Completed) using a small test `.mp4` (any 1-5 MB clip).
5. Watch the booking flip to AWAITING_REVIEW.
6. Approve + admin-moderate.
7. Customer review.

This validates the entire trust path **without firmware**. It's exactly what `e2e/reliance-trust-loop.spec.ts` does today; Alex can lift the spec as a reference implementation.

---

## 15. Sign-off matrix

For each row, both sides need to agree before the firmware contract is final. Suggested order:

1. Confirm or override LED/buzzer/button mapping (`DEVICE_MODES.md`).
2. Confirm event catalog and JSON shapes (`DEVICE_EVENT_CONTRACT.md`).
3. Confirm command vocabulary (Gen 1 minimum: `ARM_JOB`, `DISARM_JOB`, `RECORD_START`, `RECORD_STOP`).
4. Decide mic location (phone vs headset).
5. Decide max recording length per stage.
6. Reliance commits to the remaining Gen 1 blockers in `DEVICE_API_REQUIREMENTS.md` §11: staging, phone-side BLE bridge, employee-side 6-digit code surface, BLE protocol doc, and telemetry regression tests.
7. Joint authorship of the BLE protocol doc.

When all seven items above are checked off, the prototype testing can run end-to-end on staging without further blocking on backend or paperwork.
