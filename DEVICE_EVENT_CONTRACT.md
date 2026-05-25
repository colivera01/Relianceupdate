# Reliance Device — Event Contract (Gen 1)

> Status: living specification for the JSON event envelope that the phone (acting as bridge for the headset) emits to Reliance, plus a small set of server responses. The server-side ingest path is now **EXISTS** (`POST /api/device/events` + `DeviceEvent`); phone-side BLE forwarding and server-to-device commands remain future work.
> Audience: hardware/firmware (Alex), Reliance backend, Reliance app.
> Companion docs: `DEVICE_OPERATION_FLOW.md`, `DEVICE_MODES.md`, `DEVICE_API_REQUIREMENTS.md`, `DEVICE_TEST_PLAN_ALIGNMENT.md`.

---

## 0. Envelope

Every device-originated event posted to Reliance uses the same envelope. Direction is always **device → server** (via the phone bridge in Gen 1). Server-side acks share a common shape too.

### 0.1 Common request envelope (EXISTS)

```json
{
  "eventId": "evt_2026-05-07T05:01:23Z_8d4e",
  "eventType": "recording_started",
  "occurredAt": "2026-05-07T05:01:23.117Z",
  "deviceUid": "hs_a3b1c2d4e5f6",
  "deviceType": "HEADSET",
  "vendorId": "cmnv...",
  "membershipId": "cmoh...",
  "firmwareVersion": "1.0.0",
  "phoneAppVersion": "employee-web-v1",
  "context": {
    "bookingId": "cmou...",
    "mediaSessionId": "cmou...",
    "stage": "INTRO"
  },
  "payload": { ... event-specific ... }
}
```

Field rules:

| Field | Type | Required | Notes |
|---|---|---|---|
| `eventId` | string | YES | Unique. Used for idempotency. Recommended format `evt_<ISO8601 minute>_<8 hex>`. |
| `eventType` | string | YES | One of the types listed in §1. |
| `occurredAt` | ISO 8601 string | YES | When the event happened on-device, not when the phone forwarded it. |
| `deviceUid` | string | YES | Canonical device identity. For phone events, the phone's `employee_device_uid`. For headset events, the headset's `deviceUid`. |
| `deviceType` | `"PHONE" \| "HEADSET"` | YES | Matches the `Device.deviceType` field in schema. |
| `vendorId` | string | YES | Server cross-checks against the requester's resolved membership. |
| `membershipId` | string | YES if known | The active employee `VendorMembership.id` at the time of event. Server fills in if missing using auth context. |
| `firmwareVersion` | string | YES for headset, optional for phone | |
| `phoneAppVersion` | string | YES | Helps debug regressions. |
| `context` | object | varies | Carries booking/session/stage IDs when applicable. |
| `payload` | object | varies | Event-specific shape; see §1. Always present, even if `{}`. |

### 0.2 Common response envelope (EXISTS)

```json
{
  "ok": true,
  "eventId": "evt_2026-05-07T05:01:23Z_8d4e",
  "ackedAt": "2026-05-07T05:01:23.421Z",
  "duplicate": false,
  "command": null
}
```

| Field | Type | Notes |
|---|---|---|
| `ok` | boolean | False only on validation/auth failure. |
| `eventId` | string | Echoed back so the device can log the round-trip. |
| `ackedAt` | ISO 8601 | Server timestamp. |
| `duplicate` | boolean | `true` if a previous event with the same `eventId` already existed; the request was a no-op. Idempotency contract. |
| `command` | object \| null | Optional: server may piggy-back a single command back to the device on the same response. See §3 for the command shape. |

### 0.3 Idempotency rule

The server treats `(eventId)` as a unique key. Re-posting the same `eventId` is a no-op and returns `duplicate: true`. The phone MAY freely retry a transient network failure without fear of double-counting. Recommended client-side retry: exponential backoff up to 5 attempts within 60 s; on persistent failure the phone enqueues to local storage and retries on next foreground.

### 0.4 Transport (EXISTS)

All events POST to a single endpoint:

```
POST /api/device/events
Content-Type: application/json
x-user-id: <employee user id>
Authorization: Bearer <session token>
```

Auth re-uses the existing employee session (the phone is the authenticated client; the headset has no Reliance credential of its own in Gen 1). The route verifies an active vendor membership for the supplied `vendorId`; see `DEVICE_API_REQUIREMENTS.md` §6.5 for the persistence model.

---

## 1. Event catalog

For every event below: **direction is always device → server** (where "device" = phone forwarding for the headset).

### 1.1 `device_boot`

Emitted right after the headset boots and re-pairs to the phone. Lets us record uptime, firmware drift, and post-crash error context.

- **Required fields**: envelope baseline + `payload.bootReason` (one of `"cold"`, `"watchdog"`, `"firmware_update"`, `"power_on"`).
- **Optional payload fields**: `lastErrorCode`, `lastErrorAt`, `uptimeBeforeRestartMs`.
- **Server response**: ack only; may piggy-back a `firmware_update_available` command if a newer signed image exists (see §3).
- **Idempotency**: by `eventId`. Re-posting is a no-op.

```json
{
  "eventId": "evt_2026-05-07T05:00:01Z_b1a2",
  "eventType": "device_boot",
  "occurredAt": "2026-05-07T05:00:01.142Z",
  "deviceUid": "hs_a3b1c2d4e5f6",
  "deviceType": "HEADSET",
  "vendorId": "cmnv...",
  "firmwareVersion": "1.0.0",
  "phoneAppVersion": "employee-web-v1",
  "context": {},
  "payload": {
    "bootReason": "cold",
    "uptimeBeforeRestartMs": 3142000,
    "lastErrorCode": null,
    "lastErrorAt": null
  }
}
```

### 1.2 `device_paired`

Emitted by the phone after a successful 6-digit pairing handshake **and** the headset assignment write. The Reliance server already emits a `device_paired` audit row for phone-side pairing (see `src/app/api/employee/device/pair/route.ts`); this event lets the phone explicitly confirm the headset side as well.

- **Required fields**: envelope baseline + `payload.pairedDeviceId` (the headset's `Device.id` returned by `/api/device/pairing/confirm`), `payload.pairedDeviceUid`.
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Server tolerates repeats but only writes one `AdminAuditLog(actionType="device_paired")` per `eventId`.

```json
{
  "eventId": "evt_2026-05-07T05:00:11Z_c2d3",
  "eventType": "device_paired",
  "occurredAt": "2026-05-07T05:00:11.011Z",
  "deviceUid": "hs_a3b1c2d4e5f6",
  "deviceType": "HEADSET",
  "vendorId": "cmnv...",
  "membershipId": "cmoh...",
  "firmwareVersion": "1.0.0",
  "phoneAppVersion": "employee-web-v1",
  "context": {},
  "payload": {
    "pairedDeviceId": "cmd1...",
    "pairedDeviceUid": "hs_a3b1c2d4e5f6"
  }
}
```

### 1.3 `heartbeat`

The Reliance app already calls `POST /api/device/heartbeat` for the phone side. The PROPOSED `/api/device/events` endpoint accepts a `heartbeat` event that updates `Device.lastSeenAt` for **either** the phone or headset depending on `deviceUid`.

- **Cadence**: every 60 s while in **Connected** or any active mode. Suppress while in **Power Off** and **Charging+Idle**.
- **Required fields**: envelope baseline + `payload.batteryPercent` (0-100, integer), `payload.charging` (boolean), `payload.bleRssi` (negative int, dBm — only for headset).
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Repeats simply update `lastSeenAt` if newer.

```json
{
  "eventId": "evt_2026-05-07T05:01:00Z_d3e4",
  "eventType": "heartbeat",
  "occurredAt": "2026-05-07T05:01:00.000Z",
  "deviceUid": "hs_a3b1c2d4e5f6",
  "deviceType": "HEADSET",
  "vendorId": "cmnv...",
  "firmwareVersion": "1.0.0",
  "phoneAppVersion": "employee-web-v1",
  "context": {},
  "payload": {
    "batteryPercent": 78,
    "charging": false,
    "bleRssi": -54
  }
}
```

### 1.4 `job_received`

Emitted when the headset enters **Assigned Job Ready** because the phone forwarded an `ARM_JOB` command for a freshly-started job. Allows Reliance to record "device acknowledged the assignment".

- **Required fields**: envelope baseline + `context.bookingId`, `context.stage` (`"INTRO"` initially), and `payload.assignedAt`.
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Re-posting for the same booking + stage is a no-op (server can also key on `(deviceUid, bookingId, stage, "armed")`).

```json
{
  "eventId": "evt_2026-05-07T05:02:00Z_e4f5",
  "eventType": "job_received",
  "occurredAt": "2026-05-07T05:02:00.500Z",
  "deviceUid": "hs_a3b1c2d4e5f6",
  "deviceType": "HEADSET",
  "vendorId": "cmnv...",
  "membershipId": "cmoh...",
  "firmwareVersion": "1.0.0",
  "phoneAppVersion": "employee-web-v1",
  "context": {
    "bookingId": "cmou...",
    "stage": "INTRO"
  },
  "payload": {
    "assignedAt": "2026-05-07T05:01:55.000Z"
  }
}
```

### 1.5 `recording_started`

Emitted when the headset transitions into **Recording** mode.

- **Required fields**: envelope + `context.bookingId`, `context.stage`, `payload.startedAt`.
- **Optional payload fields**: `payload.expectedDurationMs` (firmware's planned cap, e.g. `300000`).
- **Server response**: ack only.
- **Idempotency**: by `eventId`.

```json
{
  "eventType": "recording_started",
  "context": { "bookingId": "cmou...", "stage": "INTRO" },
  "payload": {
    "startedAt": "2026-05-07T05:02:14.000Z",
    "expectedDurationMs": 300000
  }
}
```

### 1.6 `recording_stopped`

Emitted when the user (or the firmware cap) stops recording.

- **Required fields**: envelope + `context.bookingId`, `context.stage`, `payload.stoppedAt`, `payload.durationMs`, `payload.byteCount`, `payload.stopReason` (`"user"`, `"cap"`, `"low_battery"`, `"error"`).
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Re-posting overwrites payload fields (because the duration/bytes might have been refined client-side).

```json
{
  "eventType": "recording_stopped",
  "context": { "bookingId": "cmou...", "stage": "INTRO" },
  "payload": {
    "stoppedAt": "2026-05-07T05:04:32.117Z",
    "durationMs": 138117,
    "byteCount": 24837120,
    "stopReason": "user"
  }
}
```

### 1.7 `upload_started`

Emitted when the phone begins the SAS upload pipeline for a stage. Optional, but useful for surfacing "uploading" indicators in vendor dashboards in the future.

- **Required fields**: envelope + `context.bookingId`, `context.mediaSessionId`, `context.stage`, `payload.assetId`, `payload.expectedBytes`.
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Re-posting is a no-op.

```json
{
  "eventType": "upload_started",
  "context": {
    "bookingId": "cmou...",
    "mediaSessionId": "cmou...",
    "stage": "INTRO"
  },
  "payload": {
    "assetId": "cmua...",
    "expectedBytes": 24837120
  }
}
```

### 1.8 `upload_progress`

Optional finer-grained progress stream during PUT-to-blob. Phones SHOULD emit no more than once every 5 seconds to avoid event-stream noise. Phones MAY skip this event entirely if the upload completes quickly.

- **Required fields**: envelope + `context.bookingId`, `context.mediaSessionId`, `context.stage`, `payload.assetId`, `payload.bytesUploaded`, `payload.bytesTotal`.
- **Server response**: ack only.
- **Idempotency**: by `eventId`. The server keeps only the most recent (highest `bytesUploaded`) per `assetId`.

```json
{
  "eventType": "upload_progress",
  "context": { "bookingId": "cmou...", "mediaSessionId": "cmou...", "stage": "INTRO" },
  "payload": {
    "assetId": "cmua...",
    "bytesUploaded": 12000000,
    "bytesTotal": 24837120
  }
}
```

### 1.9 `upload_completed`

Emitted **after** the existing `POST /api/vendors/[vendorId]/media/upload/complete` call succeeds. This is informational — the actual `MediaAsset` row is already written by the existing endpoint (**EXISTS**). The event lets us correlate "the device finished" with "the asset is live in Reliance".

- **Required fields**: envelope + `context.bookingId`, `context.mediaSessionId`, `context.stage`, `payload.assetId`, `payload.byteCount`, `payload.completedAt`.
- **Server response**: ack only. Server cross-checks that `assetId` exists in `media_assets`; if not, returns `ok:false` with `error: "ASSET_NOT_FOUND"`.
- **Idempotency**: by `eventId`.

```json
{
  "eventType": "upload_completed",
  "context": { "bookingId": "cmou...", "mediaSessionId": "cmou...", "stage": "INTRO" },
  "payload": {
    "assetId": "cmua...",
    "byteCount": 24837120,
    "completedAt": "2026-05-07T05:05:09.821Z"
  }
}
```

### 1.10 `upload_failed`

Emitted when the phone exhausts its retry budget or hits a terminal server error.

- **Required fields**: envelope + `context.bookingId`, `context.stage`, `payload.assetId` (if known), `payload.errorCode`, `payload.errorMessage`, `payload.attempts`, `payload.failedAt`.
- **Server response**: ack only. May piggy-back a `clear_failed_upload` command (PROPOSED, see §3).
- **Idempotency**: by `eventId`.

```json
{
  "eventType": "upload_failed",
  "context": { "bookingId": "cmou...", "stage": "INTRO" },
  "payload": {
    "assetId": "cmua...",
    "errorCode": "STORAGE_LIMIT_REACHED",
    "errorMessage": "Vendor storage limit exceeded",
    "attempts": 4,
    "failedAt": "2026-05-07T05:06:11.000Z"
  }
}
```

### 1.11 `battery_low`

Emitted on entry to **Low Battery** mode (battery dropped below 10 %).

- **Required fields**: envelope + `payload.batteryPercent`, `payload.charging`.
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Server may dedupe further by `(deviceUid, day)` to avoid spamming `AdminNotification` rows if/when those are wired in.

```json
{
  "eventType": "battery_low",
  "payload": { "batteryPercent": 9, "charging": false }
}
```

### 1.12 `device_offline`

Emitted by the phone when it detects the headset's BLE link has been down for >10 s. Allows Reliance to mark `Device.lastSeenAt` stale and surface "Headset disconnected" in the vendor dashboard.

- **Required fields**: envelope + `payload.detectedAt`, `payload.lastBleRssi`.
- **Server response**: ack only.
- **Idempotency**: by `eventId`. Server keeps only the most recent per `deviceUid` for status display.

```json
{
  "eventType": "device_offline",
  "payload": {
    "detectedAt": "2026-05-07T05:07:01.000Z",
    "lastBleRssi": -86
  }
}
```

### 1.13 `device_reconnected`

Emitted when the phone re-pairs the headset after an offline window.

- **Required fields**: envelope + `payload.disconnectedAt`, `payload.reconnectedAt`, `payload.queuedChunkCount` (count of unsent recording chunks waiting on the headset).
- **Server response**: ack only.
- **Idempotency**: by `eventId`.

```json
{
  "eventType": "device_reconnected",
  "payload": {
    "disconnectedAt": "2026-05-07T05:07:01.000Z",
    "reconnectedAt": "2026-05-07T05:07:42.000Z",
    "queuedChunkCount": 3
  }
}
```

### 1.14 `error_reported`

Emitted on transition into **Error** mode or any non-fatal warning the firmware wants to surface.

- **Required fields**: envelope + `payload.errorCode`, `payload.errorMessage`, `payload.severity` (`"info" | "warning" | "fatal"`).
- **Optional payload fields**: `payload.componentName` (e.g. `"camera"`, `"storage"`, `"ble"`), `payload.diagnosticData` (free-form JSON for firmware-side detail).
- **Server response**: ack only. Optionally returns a `command: "soft_reset"` for fatal severities.
- **Idempotency**: by `eventId`. Same `errorCode` from the same `deviceUid` within 30 s SHOULD be coalesced client-side (don't spam).

```json
{
  "eventType": "error_reported",
  "payload": {
    "errorCode": "CAMERA_INIT_FAIL",
    "errorMessage": "Camera self-test timed out after 3000 ms",
    "severity": "fatal",
    "componentName": "camera"
  }
}
```

### 1.15 `firmware_version_reported`

Emitted after a firmware update completes successfully (or, optionally, after every boot to keep `Device.firmwareVersion` accurate).

- **Required fields**: envelope + `payload.previousVersion`, `payload.newVersion`, `payload.installedAt`.
- **Server response**: ack only. Server writes `payload.newVersion` to `Device.firmwareVersion` (PROPOSED — schema field exists).
- **Idempotency**: by `eventId`. The server only updates the column if the incoming `newVersion` is different from the stored value.

```json
{
  "eventType": "firmware_version_reported",
  "payload": {
    "previousVersion": "1.0.0",
    "newVersion": "1.0.1",
    "installedAt": "2026-05-07T06:00:00.000Z"
  }
}
```

---

## 2. Server-side persistence rules (EXISTS)

The implemented `/api/device/events` endpoint:

1. Validate the envelope (required fields + recognized `eventType`).
2. Verify the caller's session resolves to an active `VendorMembership` for the supplied `vendorId`.
3. Look up an active `Device` by `deviceUid` on the canonical column, scoped to `vendorId`. Return `404` if not found.
4. Insert a row into `DeviceEvent` keyed on `(eventId)` UNIQUE. If the insert violates the unique constraint, treat as a duplicate and return `duplicate: true`.
5. Update `Device.lastSeenAt` to `NOW()` for any event.
6. For `firmware_version_reported`, also update `Device.firmwareVersion`.
7. For `error_reported` with `severity: "fatal"`, also write an `AdminAuditLog(actionType="device_error", entityType="device", entityId=deviceId)` row using the existing `recordLifecycleAudit` helper.
8. Return `command: null` for now. The response slot is reserved for future piggy-backed commands (see §3).

The server MUST NOT crash the request if any of the optional behaviors fail; the audit and notification writes are best-effort.

---

## 3. Server → device commands (PROPOSED, deferred)

Today the phone polls `GET /api/employee/jobs` for new assignments. Reliance does not push commands. When/if we add a command channel (see `DEVICE_API_REQUIREMENTS.md` §6.4), the same response envelope already has a `command` slot:

```json
{
  "ok": true,
  "eventId": "...",
  "ackedAt": "...",
  "duplicate": false,
  "command": {
    "commandId": "cmd_2026-05-07T05:09:00Z_a8b9",
    "type": "ARM_JOB",
    "issuedAt": "2026-05-07T05:08:59.000Z",
    "expiresAt": "2026-05-07T05:13:59.000Z",
    "params": {
      "bookingId": "cmou...",
      "stages": ["INTRO", "IN_PROGRESS", "COMPLETED"]
    }
  }
}
```

PROPOSED command vocabulary for Gen 1:

| Command | When sent | Phone effect |
|---|---|---|
| `ARM_JOB` | Right after manager assigns + employee taps Start | BLE command to headset enters **Assigned Job Ready** |
| `DISARM_JOB` | Manager rejects job or cancels assignment | BLE command back to **Connected** |
| `RECORD_START` | Phone-side start (alternative to physical button) | BLE record-start |
| `RECORD_STOP` | Phone-side stop | BLE record-stop |
| `SOFT_RESET` | Server response to a fatal `error_reported` | BLE reboot command |
| `FIRMWARE_UPDATE_AVAILABLE` | Server sees a newer signed image | Phone fetches firmware via `/api/device/firmware` (PROPOSED) and forwards over BLE |
| `CLEAR_FAILED_UPLOAD` | Manager / admin discards a stuck stage upload | Phone purges queued chunks for that stage |

Each command requires a phone-side ack via a follow-up event (PROPOSED `command_ack`, not yet specified — captured here as a future addition).

---

## 4. Versioning and forward-compatibility

- The envelope carries `firmwareVersion` and `phoneAppVersion` so the server can route legacy clients leniently.
- Unknown `eventType` values MUST be 422'd, never silently accepted, to avoid silent data loss.
- Adding new optional `payload` fields is backwards-compatible. Removing or renaming required fields is a breaking change and bumps the contract version (PROPOSED `contract_version` envelope field, default `"1"`).

---

## 5. Worked example: full Intro stage event stream

Below is the sequence of events (with elided IDs) the phone would emit during a single Intro stage capture-and-upload cycle:

```text
t=05:00:01  device_boot                  (after morning power-on)
t=05:00:11  device_paired                (BLE handshake done)
t=05:00:30  heartbeat                    batt 78 %, charging false
t=05:01:30  heartbeat                    batt 77 %
t=05:02:00  job_received                 booking=cmou..., stage=INTRO
t=05:02:14  recording_started            booking=cmou..., stage=INTRO
t=05:04:32  recording_stopped            duration=138117ms, bytes=24,837,120
t=05:04:33  upload_started               assetId=cmua..., bytes=24,837,120
t=05:04:55  upload_progress              bytes=12,000,000 / 24,837,120
t=05:05:09  upload_completed             assetId=cmua...
```

If the upload had failed twice and finally succeeded:

```text
t=05:04:33  upload_started
t=05:04:55  upload_failed                attempts=1, code=NETWORK
t=05:05:00  upload_started
t=05:05:25  upload_failed                attempts=2, code=NETWORK
t=05:05:31  upload_started
t=05:05:55  upload_completed
```

The server retains all event rows (idempotent on `eventId`), the `MediaAsset` row is only written by the existing `media/upload/complete` endpoint, and the booking auto-flips to AWAITING_REVIEW after the third stage's `upload_completed` event lines up with the `/employee/jobs/.../stage` call.
