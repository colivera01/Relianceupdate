# Epic 3 Phase A Beta Admin Grant Migration Correction Report

**Date:** 2026-08-03

**Repository:** `colivera01/Relianceupdate`

**Branch:** `codex/epic3-beta-admin-grant-correction`

**Starting commit:** `59d696f55f01e670846800822d295aa558a36f03`

**Status:** Isolated validation passed; beta application requires Product Owner approval

## Objective

Preserve the committed `20260802193000_add_platform_role_grants` migration and add one later, conditional data migration that grants `ADMIN` authority to the uniquely verified active administrator in the isolated beta database.

This checkpoint does not apply migrations to beta, deploy an application package, rotate secrets, begin Epic 3 Phase B, or change application behavior.

## Environment Verification

| Item | Verified value |
|---|---|
| Azure App Service | `app-reliance-beta-wcus` |
| Azure SQL server | `sql-reliance-beta-wcus.database.windows.net` |
| Azure SQL database | `reliance-beta-db` |
| Environment | Beta only |
| Verified beta administrator User ID | `cmqwvc0gp0003so84j1ckab1p` |
| Historical/internal User ID absent from beta | `D43B6BB3-1A72-45EC-A362-A6E1E0580EA0` |

The approved beta administrator lookup returned exactly one active user. No credentials, connection strings, passwords, tokens, or personal profile fields were recorded.

## Migration State Before Correction

- Repository migrations before this correction: 35.
- Only pending beta migration: `20260802193000_add_platform_role_grants`.
- `dbo.platform_role_grants` did not exist in beta.
- Beta contained 18 user rows.
- The historical/internal ID had zero beta matches.
- The original migration creates the role-grant table, indexes, and foreign keys, then conditionally attempts a backfill for the historical/internal ID.
- Because that ID is absent from beta, its conditional insert would create no grant and would not violate the foreign key.

### Original Migration Integrity

| Item | Result |
|---|---|
| Path | `prisma/migrations/20260802193000_add_platform_role_grants/migration.sql` |
| Commit | `0ffc9648e41e6e9b8be8d907f2ddb5aaefd62db2` |
| SHA-256 | `28D32FA8BFE2DE77D893B8C192544C2A32768A39F4A33DB91FB546C46CEEAE77` |
| Modified by this checkpoint | No |

## Corrective Migration

**Name:** `20260803200000_correct_beta_admin_platform_role_grant`

The migration:

- verifies the exact beta User ID exists and has active account status;
- inserts one `ACTIVE` `ADMIN` grant only when no grant exists for that user and role;
- uses a deterministic grant ID and a clear beta bootstrap reason;
- does not reference or grant the historical/internal ID;
- does not change users, memberships, employees, work records, permission evidence, media, reviews, Trust Score records, publication records, notifications, or legal records;
- leaves an existing grant unchanged; and
- is idempotent under `prisma migrate deploy`.

## Backup And Rollback Readiness

Azure SQL point-in-time restore was available before validation:

- database status: Online;
- service tier: Basic;
- short-term retention: 7 days;
- earliest observed restore point: `2026-07-28T03:42:54.494750+00:00`.

For a later beta application, the first rollback response is to revoke or remove only the corrective beta grant if authority must be withdrawn. The additive table should remain. Database point-in-time restore is reserved for demonstrated integrity impact, not routine authorization rollback.

## Isolated Migration Validation

### Clean-Database Attempt

A fresh empty Azure SQL validation database was created. The repository's historical migration chain failed before reaching Epic 3 at `20250101000000_add_unique_active_assignment` because it references `DeviceAssignment` before that object exists. The disposable failed database was deleted. No beta data changed.

This is pre-existing migration-baseline debt, not a defect in either Epic 3 migration.

### Isolated Beta-Copy Validation

An isolated Azure SQL copy named `reliance-epic3-migval-copy-0803` was used so the current beta schema and migration history could be tested without touching beta.

Pre-application evidence:

| Evidence | Result |
|---|---|
| Repository migrations | 36 |
| Pending migrations | Original role-grant migration and corrective migration only |
| Users | 18 |
| Verified beta administrator | Exactly one active match |
| Historical/internal ID | Zero matches |
| Role-grant table | Absent |
| Successful prior migrations | 34 |

Post-application evidence:

| Evidence | Result |
|---|---|
| Migration status | Current; no pending migrations |
| Users | 18, unchanged |
| Total platform grants | 1 |
| Active beta `ADMIN` grants | 1 |
| Historical/internal grants | 0 |
| Role-grant columns | 11 |
| Named indexes, including primary key | 4 |
| Foreign keys | 2 |

A second `prisma migrate deploy` reported no pending migrations and created no duplicate grant.

## Test Results

| Validation | Result |
|---|---|
| `npm ci` | Passed; no dependency versions changed |
| `prisma format` review | Completed; no schema change retained |
| `prisma validate` | Passed |
| `prisma generate` | Passed |
| Migration SQL review | Passed |
| Isolated role-grant migration | Passed |
| Migration idempotency | Passed |
| Focused authorization tests | 28/28 passed |
| Exact-package Epic 3 Playwright | 5/5 passed |
| `git diff --check` | Passed before documentation finalization |

The Playwright validation used the previously extracted exact package and the isolated migrated database. It confirmed:

- customer sessions cannot open vendor or admin routes;
- manager membership opens only the correct vendor shell;
- employee membership cannot exercise manager authority;
- an admin database grant requires an admin-scoped session; and
- mobile wrong-role behavior remains clear and fail-closed.

Unit tests also confirmed revoked or missing grants fail closed and general signed sessions are not treated as admin-scoped sessions.

## Package Integrity

The application package was not rebuilt or modified during this checkpoint.

- Expected ZIP SHA-256: `f254987e61e4e26cc69864657a056b3cc977a3a82a2d8c568919af634803fd55`
- Expected runtime manifest SHA-256: `daa7877601bd3022a4cf4094ae17668af3f6648b3c2fb025d34056274364b91e`

## Security And Product Impact

- Database authority remains separate from browser-session scope.
- The migration creates no authentication session.
- No permission event, review, rating, Trust Score input, publication approval, or Public media is created.
- No application, API, notification, dashboard, policy, or frozen-design behavior changed.
- No beta database change occurred in this checkpoint.

## Known Limitation

The full historical migration chain is not replayable from an empty database because an older migration references `DeviceAssignment` before its table exists. This should be resolved through a separately approved migration-baseline strategy; it does not block applying the two verified pending migrations to the current beta schema.

## Verdict

The corrective migration is safe for a separate Product Owner-approved beta application checkpoint. That checkpoint should re-confirm the target, restore window, unique active beta administrator, pending migration list, and pre-migration counts immediately before running `prisma migrate deploy`.

No deployment or secret rotation is authorized by this report.
