# Reliance Device — Modes (Gen 1 Headset)

> Status: PROPOSED specification. LED/buzzer/button conventions below are defaults Reliance is proposing; Alex / hardware to confirm or override based on actual hardware constraints. Once Alex signs off, this becomes the contract for firmware behavior + Reliance phone-app expectations.
> Companion docs: `DEVICE_OPERATION_FLOW.md`, `DEVICE_EVENT_CONTRACT.md`, `DEVICE_API_REQUIREMENTS.md`.

---

## 0. Conventions

The headset is a Bluetooth-paired accessory to the employee's phone (see `DEVICE_OPERATION_FLOW.md` §1). "Server" below means **Reliance backend**, reached through the phone — the headset itself does not speak HTTPS in Gen 1.

**LED conventions used in this doc:**

- "Solid" = continuous, "Slow blink" = ~0.5 Hz (1s on, 1s off), "Fast blink" = ~2 Hz, "Pulse" = sinusoidal fade.
- LED colors assume one full RGB indicator. If hardware has only single-color, swap each "color" for a documented blink pattern.

**Buzzer conventions:**

- "Short beep" = ~150 ms, "Long beep" = ~600 ms, "Triple" = three short beeps spaced ~150 ms.
- Buzzer is OFF by default in Charging and Low Battery to avoid annoyance.

**Button vocabulary:**

- **Power** (long-press 2s = power on/off; short-press = wake from sleep)
- **Record** (short-press = start/stop record; long-press = end job stage)
- **Action** (short-press = confirm; long-press = cancel/reset; double-tap reserved for Gen 2)
- A device with fewer physical buttons MUST map combinations to the same effective verbs.

**State guarantees:**

- The headset MUST persist `deviceUid`, `firmwareVersion`, `pairedVendorId` (after pairing), and any in-flight chunk metadata across reboots.
- The headset MUST self-recover from any mode (except Power Off) without user intervention given enough time + power.

---

## 1. Mode reference

### 1.1 Power Off

| Aspect | Specification |
|---|---|
| Trigger | Power button long-press while in any mode, or battery cutoff. |
| LED | Off. |
| Buzzer | Single long beep on entry, then silent. |
| Allowed buttons | Power (to boot). All others ignored. |
| App expectation | Phone shows "Headset disconnected" if previously paired. |
| Server expectation | None. `Device.lastSeenAt` ages naturally. |
| Exit transitions | Power on → Booting. |

### 1.2 Booting

| Aspect | Specification |
|---|---|
| Trigger | Power on. |
| Duration target | ≤ 5 seconds. |
| LED | White slow pulse. |
| Buzzer | Single short beep on power-on, single short beep on boot complete. |
| Allowed buttons | None (input ignored until boot complete). |
| App expectation | None (BLE not yet advertising). |
| Server expectation | None. |
| Exit transitions | Boot complete + previously paired vendor → **Connected**. Boot complete + no prior pairing → **Pairing**. Self-test failure → **Error**. |
| Required actions | Run self-test (camera, mic, flash, BLE radio, storage). On success, emit `device_boot` event after BLE re-link in **Connected**. |

### 1.3 Pairing

| Aspect | Specification |
|---|---|
| Trigger | First boot, factory reset, or vendor unpairing. |
| LED | Blue slow blink. |
| Buzzer | Triple short beep on entry. |
| Allowed buttons | Action (cancel pairing, returns to Power Off). |
| BLE | Advertises name `Reliance-XXXXXX` (last 6 chars of `deviceUid`), advertises `firmwareVersion` characteristic. |
| App expectation | Phone scans, finds the headset, reads `deviceUid`, walks the user through the 6-digit code redemption. |
| Server expectation | Receives `POST /api/device/pairing/request` (6-digit code) and `POST /api/device/pairing/confirm` (with `deviceUid`, `deviceType: "HEADSET"`). On success, server may also receive `POST /api/vendors/[vendorId]/headsets/[deviceId]/assign`. |
| Exit transitions | Confirmed by phone → **Connected**. Cancelled or 5-min timeout → **Power Off**. |

### 1.4 Connected

| Aspect | Specification |
|---|---|
| Trigger | Boot with prior pairing, or successful pairing handshake completes, or returning from any active state with no current job. |
| LED | Solid green. |
| Buzzer | Single short beep on entry. |
| Allowed buttons | Power (off), Action (cycle status display, optional). |
| BLE | Connected to phone; idle keep-alive. |
| App expectation | "Headset paired · ready for jobs" indicator. Polling `GET /api/employee/jobs` for new assignments. |
| Server expectation | Receives `heartbeat` events forwarded by the phone. `Device.lastSeenAt` updated. |
| Exit transitions | Phone forwards `ARM_JOB` command → **Assigned Job Ready**. BLE drops > 10s → **Offline**. Battery < 10% → **Low Battery**. Power button long-press → **Power Off**. |

### 1.5 Assigned Job Ready

| Aspect | Specification |
|---|---|
| Trigger | Phone forwards `ARM_JOB` command (job started in Reliance app). |
| LED | Solid cyan. |
| Buzzer | Two short beeps on entry. |
| Allowed buttons | Record (start capture), Action (cancel arming and return to **Connected**), Power (off). |
| App expectation | Phone shows job card with three stage tiles; tap-or-press Record begins Intro. |
| Server expectation | None until first stage upload completes. |
| Exit transitions | Record pressed → **Recording (INTRO/IN_PROGRESS/COMPLETED)**. `DISARM_JOB` from phone (job rejected/cancelled) → **Connected**. |
| Notes | The headset MUST internally remember which stages are still pending so it can advance the badge label without server help. |

### 1.6 Recording

| Aspect | Specification |
|---|---|
| Trigger | Record button pressed in Assigned Job Ready, or `RECORD_START` BLE command from phone. |
| LED | Red fast blink. |
| Buzzer | One short beep on start, one short beep on stop. |
| Allowed buttons | Record (stop), Power (emergency-stop = stop + go to **Connected**). All other inputs ignored to avoid mid-record interference. |
| BLE | Streams chunked video/audio frames to phone. |
| App expectation | Phone displays "Recording …" with a timer. |
| Server expectation | None during recording. |
| Exit transitions | Record pressed (stop) → **Uploading**. Storage critically low → **Error**. Battery < 5% → stop + **Low Battery**. |
| Hard cap | Suggested 5-minute max per stage; firmware should auto-stop and proceed to **Uploading**. |

### 1.7 Uploading

| Aspect | Specification |
|---|---|
| Trigger | Recording stops with non-empty buffer, or **Offline** mode reconnects with queued chunks. |
| LED | White fast blink (during active transfer to phone). |
| Buzzer | Silent during uploading; one short beep on complete. |
| Allowed buttons | Power (off — but defers actual shutdown until current chunk to phone is flushed). |
| BLE | Sends remaining chunks to phone. |
| App expectation | Phone runs the SAS upload pipeline (`media/upload/init` → PUT → `media/upload/complete` → `employee/jobs/.../stage`). |
| Server expectation | Receives `MediaSession`, `MediaAsset`, and stage-marking calls. Booking auto-flips to `AWAITING_REVIEW` after 3rd stage. |
| Exit transitions | All chunks acknowledged + server reports stage success → **Assigned Job Ready** (if more stages pending) or **Connected** (if all 3 stages done). Upload fails permanently → **Upload Failed**. BLE drops mid-upload → **Offline**. |

### 1.8 Upload Failed

| Aspect | Specification |
|---|---|
| Trigger | Phone reports terminal upload failure (e.g. expired SAS, storage limit, server error after retries exhausted). |
| LED | Red slow blink. |
| Buzzer | One long beep on entry. |
| Allowed buttons | Action (retry — re-enters **Uploading**), Power (off — preserves chunks for next boot). |
| App expectation | Phone shows "Upload failed, try again" on the affected stage tile. |
| Server expectation | No `MediaAsset` row written for this attempt. The next retry runs the full session-create + init + put + complete sequence again (`replaceExisting: true`). |
| Exit transitions | Retry succeeds → **Assigned Job Ready** or **Connected**. User long-presses Action to discard the failed chunk → **Connected** (audit-logged on phone side). |

### 1.9 Offline

| Aspect | Specification |
|---|---|
| Trigger | BLE link to phone drops while in any active state (Recording, Uploading, Connected, Assigned Job Ready). |
| LED | Yellow slow blink. |
| Buzzer | One long beep on entry; silent thereafter to preserve battery. |
| Allowed buttons | Record (continues recording to local storage if a session was already active), Power (off — preserves data). |
| BLE | Advertises and attempts reconnect every 10 s. |
| App expectation | Phone shows "Headset disconnected — recording will resume when re-paired". |
| Server expectation | None. Phone may keep polling `GET /api/employee/jobs` so the membership state is fresh. |
| Exit transitions | BLE re-pairs → emits `device_reconnected` event → **Recording** (if a recording was in progress) or **Uploading** (if pending chunks) or **Connected**. |
| Data integrity | Headset MUST flush in-progress chunks to flash storage before declaring **Offline** mode. |

### 1.10 Low Battery

| Aspect | Specification |
|---|---|
| Trigger | Battery <10%. |
| LED | Yellow fast blink. |
| Buzzer | Triple short beep on entry; one short beep every 60 s thereafter. |
| Allowed buttons | All. Recording is allowed but discouraged in UI. |
| App expectation | Phone shows "Headset battery low — please charge". |
| Server expectation | Phone forwards a `battery_low` event (see `DEVICE_EVENT_CONTRACT.md`). |
| Exit transitions | Charger detected → **Charging** (overlay; recording remains possible). Battery drops <3% and not charging → **Power Off**. |

### 1.11 Charging

| Aspect | Specification |
|---|---|
| Trigger | Charging cable connected. |
| LED | Solid amber while charging; solid green at 100%. |
| Buzzer | Single short beep on cable insert; silent thereafter. |
| Allowed buttons | All. Headset can record while charging if Recording mode is active. |
| App expectation | Phone shows a charging icon next to the paired-headset indicator. |
| Server expectation | None directly. `Device.lastSeenAt` continues to update via heartbeat. |
| Exit transitions | Cable removed → returns to whichever mode was active before charging started. |

### 1.12 Error

| Aspect | Specification |
|---|---|
| Trigger | Hardware self-test failure, fatal storage failure, watchdog reset, or unhandled firmware exception. |
| LED | Red solid. |
| Buzzer | One long beep on entry, then triple short beep every 30 s until cleared. |
| Allowed buttons | Action (acknowledge — attempts soft reset back to **Booting**), Power (off). |
| App expectation | Phone shows "Headset reported an error: <code>" with a retry/contact-support button. |
| Server expectation | Phone forwards an `error_reported` event. |
| Exit transitions | Soft reset succeeds → **Booting**. Soft reset fails 3× → remains in **Error** until power cycle. |
| Required behavior | Firmware MUST capture the error code + last-known stack and persist it for the next boot's `device_boot` event so it ships back to Reliance. |

### 1.13 Firmware Update

| Aspect | Specification |
|---|---|
| Trigger | Phone forwards an OTA package over BLE OBEX (or equivalent). Gen 1 has no direct-from-cloud OTA — the phone is always the bridge. |
| LED | Purple slow blink during transfer; purple fast blink during write/verify; solid green for 2 s on success. |
| Buzzer | Two short beeps on entry; one long beep on success or failure. |
| Allowed buttons | Power (cancel — only honored if a confirmed safe rollback point exists). |
| BLE | Receiving firmware blob from phone. |
| App expectation | Phone displays a progress bar; user is asked not to disconnect. Phone fetched the firmware blob from a Reliance-controlled URL (PROPOSED OTA endpoint, see `DEVICE_API_REQUIREMENTS.md` §6.7). |
| Server expectation | Phone may emit a `firmware_version_reported` event after update success. |
| Exit transitions | Update success → **Booting** (with new firmware). Update failure → rollback to previous version → **Booting** → **Error** if rollback fails too. |
| Hard requirement | Firmware update MUST never brick the device — dual-bank flash + signed image + automatic rollback are required for Gen 1 production. |

---

## 2. Mode transition matrix (compact view)

```text
                ┌─────────┐  power-on   ┌─────────┐  paired       ┌────────────┐
                │Power Off│ ──────────> │ Booting │ ────────────> │  Pairing   │
                └─────────┘             └─────────┘               └────────────┘
                    ▲                       │                            │
                    │ long-press            │ prior pair                 │ confirm
                    │                       ▼                            ▼
                    │                  ┌──────────┐               ┌──────────────┐
                    │                  │Connected │ <─────────────│  Connected   │
                    │                  └──────────┘ <───┐         └──────────────┘
                    │                       │           │ done            │
                    │                  ARM_JOB          │                 │ ARM_JOB
                    │                       ▼           │                 ▼
                    │                ┌──────────────┐   │           ┌──────────────┐
                    │                │ Assigned Job │ ──┘           │ (same node)  │
                    │                │   Ready      │               └──────────────┘
                    │                └──────────────┘
                    │                       │ Record
                    │                       ▼
                    │                ┌──────────────┐  stop  ┌──────────────┐
                    │                │  Recording   │ ─────> │  Uploading   │
                    │                └──────────────┘        └──────┬───────┘
                    │                                              │ ok
                    │                       ┌─────────────────────┐│
                    │                       │  Upload Failed      │◄─ fail
                    │                       └─────────────────────┘
                    │
                    │ overlays (any active mode):
                    │   - Offline (BLE drops)
                    │   - Low Battery (<10%)
                    │   - Charging (cable in)
                    │   - Error (fatal)
                    │   - Firmware Update (phone-pushed)
```

---

## 3. State persistence requirements

The headset MUST persist across reboots (in flash, not RAM):

- `deviceUid` (factory-burned, never overwritten in-field)
- `firmwareVersion`
- `pairedVendorId` and `pairedDeviceId` (set after successful 6-digit confirm; cleared on factory reset)
- Last in-progress recording chunk metadata (so offline crash recovery works)
- Last error code + timestamp (cleared after successfully reported via `device_boot`)

The headset MUST NOT persist:

- Vendor employees' personal data
- Customer PII
- Any cached SAS URLs or Reliance API tokens

---

## 4. Mode → event mapping (cross-reference)

| Mode entered | Event the phone should emit to Reliance |
|---|---|
| Booting (post boot complete) | `device_boot` (see `DEVICE_EVENT_CONTRACT.md`) |
| Pairing → Connected (first time) | `device_paired` (server already emits this from `/api/employee/device/pair` for the phone; PROPOSED to also emit when a HEADSET is paired) |
| Connected (steady state) | `heartbeat` every 60 s |
| Assigned Job Ready | `job_received` (PROPOSED) |
| Recording | `recording_started` (PROPOSED), then `recording_stopped` |
| Uploading | `upload_started`, `upload_progress`, `upload_completed` |
| Upload Failed | `upload_failed` |
| Offline → reconnected | `device_reconnected` |
| Low Battery | `battery_low` |
| Error | `error_reported` |
| Firmware Update completes | `firmware_version_reported` |

---

## 5. Open hardware questions impacting modes

These do not block the spec but will refine LED/buzzer constants once decided:

1. Does the headset have a screen? If yes, modes can include text labels and reduce LED color requirements.
2. Number of physical buttons (1, 2, or 3)? If 1, double-tap and long-press encode all verbs.
3. Single-color vs RGB LED.
4. Buzzer presence at all (some BOMs may omit for cost) — if no buzzer, all "buzzer" rows above degrade to LED-only signaling.
5. Vibration motor presence — if present, useful for Recording start/stop confirmation when buzzer is off.
6. Battery capacity → drives the 10 % / 5 % / 3 % thresholds in §1.10.
