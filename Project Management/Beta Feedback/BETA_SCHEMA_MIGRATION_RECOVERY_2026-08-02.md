# Beta Schema Migration Recovery - 2026-08-02

## Objective

Restore the vendor Dashboard, Analytics & Trust, Reviews, and Manage Jobs pages after the deployed Epic 1 application began querying permission fields that were not present in the beta database.

## Root Cause

The beta application package included the Epic 1 verified-permission code, but the two corresponding Prisma migrations had not been applied to the database configured on the Azure App Service. The first visible failure was a `ConsentRecord.lifecycleStatus` query against a database without that column. The repository `.env` referenced a different SQL endpoint than the running beta app, so migration status had initially been checked against the wrong connection.

The migrations also contained two SQL Server compatibility defects that prevented a normal `prisma migrate deploy`:

- indexes and a foreign key referenced newly added columns in the same compiled SQL Server batch;
- the legacy token unique constraint used the generated name `consent_records_token_key`, while the cleanup migration only recognized `UQ_consent_records_token`.

## Files Changed

- `prisma/migrations/20260731201500_add_verified_permission_infrastructure/migration.sql`
- `prisma/migrations/20260731203000_normalize_legacy_permission_secrets/migration.sql`

No application route, API, component, notification, policy, or frozen governing document was changed.

## Database Recovery

1. Confirmed the failed first migration had rolled back completely.
2. Deferred SQL Server compilation of indexes and the foreign key until after the new columns exist.
3. Applied `20260731201500_add_verified_permission_infrastructure`.
4. Updated legacy-constraint discovery to support either known constraint name.
5. Applied `20260731203000_normalize_legacy_permission_secrets`.
6. Confirmed all 34 repository migrations are applied.

Post-recovery evidence:

- `ConsentRecord.lifecycleStatus`, `isCurrent`, and `contentVersionId` exist.
- The permission content version row exists.
- The current-record and lifecycle indexes exist.
- One historical consent record remains preserved as legacy evidence.
- Zero raw consent tokens remain.
- No consent record is missing a lifecycle status.

## Security Impact

The fix restores the approved Epic 1 schema without broadening access. The cleanup migration removed the obsolete raw permission token while preserving the historical consent decision as legacy evidence. No OTP, permission token, credential, or connection string was printed or stored in this report.

## API And Dashboard Impact

The shared vendor dashboard data query no longer fails on the missing permission lifecycle column. Live signed-in validation passed for:

- `/vendor/dashboard`
- `/vendor/analytics`
- `/vendor/reviews`
- `/vendor/jobs`

All four pages rendered their normal content. The browser recorded no console errors during the validation run.

## Notification, AI, Legal, And Review Impact

- Notifications: unchanged.
- AI workflows: unchanged.
- Legal and policy text: unchanged.
- Reviews and Trust Score behavior: unchanged; only the page's ability to load was restored.

## Commands And Results

- `npx prisma migrate status` against the Azure app's configured database: initially reported two pending migrations.
- `npx prisma migrate deploy`: both Epic 1 migrations applied after SQL Server compatibility corrections.
- `npx prisma migrate status`: `Database schema is up to date!`
- `npx prisma validate`: passed.
- Focused Vitest run covering permission routes, booking creation, consent state/token handling, vendor analytics, and vendor service workflow: 9 files passed, 61 tests passed.
- `git diff --check`: passed.
- Direct database verification: expected columns, content version, and indexes present; zero raw consent tokens.
- Live browser validation: all four affected vendor pages passed; zero browser console errors.

## Regression Statement

Existing vendor data, customer data, media, reviews, Trust Score inputs, notifications, and access controls were intentionally preserved. No unrelated application behavior was changed. The recovery was limited to making the approved Epic 1 migrations executable on the current SQL Server schema and applying them to beta.

Potential regression risks reviewed:

- partial migration state: ruled out after each failed attempt; SQL Server rolled back the transaction;
- lost historical consent evidence: ruled out; the existing record remains as legacy evidence;
- exposed legacy permission secrets: ruled out; raw token count is zero;
- unrelated worktree changes: left unstaged and untouched.

## Known Unrelated Worktree State

Pre-existing deleted project-management and legal-audit files, `tsconfig.tsbuildinfo`, and the untracked `output/` folder were not changed or staged as part of this recovery.
