# Device Pairing Flow Audit (2026-04-27)

## Current Pairing Flow (MVP)
1. Vendor opens dashboard and clicks **Pair Device**.
2. Dashboard calls `POST /api/device/pairing/request`.
3. Server creates 6-digit code in `devicePairingCode` with 5-minute expiry.
4. Employee/mobile opens `/device/pair`, app creates/persists local `deviceUid` in `localStorage`.
5. Device submits code + `deviceUid` + detected metadata to `POST /api/device/pairing/confirm`.
6. Server validates code, marks it used, and upserts a row in `devices`.
7. Device can send heartbeat via `POST /api/device/heartbeat`.

## API Routes Used
- Canonical pairing API family:
  - `POST /api/device/pairing/request`
  - `POST /api/device/pairing/confirm`
  - `POST /api/device/heartbeat`
- `POST /api/device/pairing/request`
  - Auth path depends on `getVendorIdFromRequest`.
  - Returns `{ code, expiresAt }`.
- `POST /api/device/pairing/confirm`
  - Validates 6-digit code + device metadata.
  - Upserts device via raw SQL.
- `POST /api/device/heartbeat`
  - Looks up device by UID and updates `lastSeenAt`.
  - Attempts to resolve active vendor membership for authorization context.

## DB Fields Used
- `device_pairing_codes` (via Prisma model `devicePairingCode`):
  - `vendorId`, `code`, `expiresAt`, `used`.
- `devices` table:
  - `id`, `vendorId`, `deviceUid`, `employeeId` (legacy), `deviceType`, `deviceName`, `lastSeenAt`, `createdAt`, `userAgent`, `model`, `os`, `appVersion`.

## Transition Status
- Canonical `devices.deviceUid` column is now the primary identity for pairing + heartbeat.
- Legacy compatibility remains in place: reads fall back to `employeeId` for older rows created during MVP workaround period.
- Pairing writes now persist `deviceUid` and also preserve `employeeId` as legacy compatibility data.

## Migration / Backfill Applied
- Safe migration adds `deviceUid` column when missing.
- Backfill copies legacy `employeeId` -> `deviceUid` for rows where `deviceUid` is null (dedup-safe).
- Filtered unique index enforces unique non-null `deviceUid`.

## How Device -> Recording -> Upload Should Eventually Work
- Pairing establishes trusted device identity (`deviceUid`) tied to vendor + membership.
- Device heartbeat confirms active membership + role + app version compatibility.
- Device requests upload session scoped to assigned booking/job stage.
- Device uploads stage media (`INTRO`, `IN_PROGRESS`, `COMPLETED`) with provenance metadata (`deviceUid`, membershipId, timestamp, geofence/consent proofs where applicable).
- Manager approves/rejects package; admin moderates final proof package.
- Customer gets proof-ready notification when approved visibility permits.

## Current Gaps
- No strict binding yet between paired device and a single employee membership record.
- Heartbeat membership lookup depends on `pendingPhoneDeviceUid` path and can miss linked devices.
- Legacy duplicate `/api/pairing/*` routes were removed; canonical surface is now `/api/device/pairing/*` + `/api/device/heartbeat`.
- No formal device revocation/unpair lifecycle exposed in UI.
