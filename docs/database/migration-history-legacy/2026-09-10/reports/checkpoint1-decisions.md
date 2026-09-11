# Checkpoint 1 candidate decisions

## Review reason width

Keep beta and the new baseline at `NVARCHAR(MAX)`. Add `@db.NVarChar(Max)` to the prospective Prisma model. Do not deploy width-changing DDL. The original migration intentionally created `MAX`; no business, API, UI, or test limit of 1,000 was found.

## Active device assignment

Create a forward filtered unique index on `dbo.device_assignments(deviceId) WHERE unassignedAt IS NULL`. All current create/reassign paths implement one active owner per device; the Employee pair route has a find-then-create race outside a single transaction. `deviceId` is the correct database key because `devices.deviceUid` is separately unique but nullable for legacy rows.

## Repository/beta coordination

Prepare and review this exact change away from the deployment branch. During one controlled maintenance window, advance authoritative source to the approved commit, rotate/recognize the beta ledger, prove baseline no-op, apply the approved active-assignment migration, verify, and deploy the exact matching application artifact. Do not leave the deployment branch on the new active history while beta still has only the legacy ledger.

