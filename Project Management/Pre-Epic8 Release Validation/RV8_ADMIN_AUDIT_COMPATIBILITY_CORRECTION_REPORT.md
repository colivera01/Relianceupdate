# RV-8 Admin Audit Compatibility Correction Report

## Checkpoint

- **Objective:** Correct the current-schema admin audit write that failed because its compatibility SQL referenced a nonexistent legacy `action` column.
- **Repository:** `C:\Users\Cesar Olivera\Project Reliance-rv8-residence`
- **Branch:** `codex/rv8-residence-location-correction`
- **Starting commit:** `78e989968c5bdaaf0601ed4e563d639731c44f82`
- **Scope:** `AdminAuditLog` write compatibility only.
- **Database changes:** None.
- **Deployment:** Not performed. Product Owner deployment approval remains required.

## Proven Root Cause

`src/lib/admin-audit.ts` attempted one T-SQL batch containing branches for both a supposed legacy `action` column and the canonical `actionType` column. The beta database and current Prisma model contain `actionType` and do not contain `action`.

SQL Server must compile identifier references in the submitted batch before a runtime `IF COL_LENGTH(...)` branch can make an invalid identifier harmless. The references to `action` therefore produced `Invalid column name 'action'` even when the current-schema branch was the only branch intended to run. The Prisma fallback recovered the individual writes, but normal current-schema operation emitted a runtime SQL error and unnecessarily depended on fallback.

## Schema And History Verification

- `prisma/schema.prisma` defines `AdminAuditLog.actionType` and no `action` field.
- `prisma/migrations/20260408190000_add_admin_audit_logs/migration.sql` introduced `dbo.admin_audit_logs` with `actionType`, `previousValue`, and `newValue`.
- A repository-wide migration and history search found no committed migration that created an `action` column on `admin_audit_logs`.
- The legacy compatibility path was added later in commit `3cccbbcfd22de0c98a4cde5543342ff6a44d79fd` as an environment workaround; it was not backed by a supported repository schema.
- Active admin audit readers, filters, and callers use `actionType`.

Legacy `action` compatibility was therefore removed from this helper. No supported historical repository schema requires it.

## Exact Correction

`src/lib/admin-audit.ts` now performs one canonical parameterized insert containing only:

- `id`
- `actionType`
- `entityType`
- `entityId`
- `actorUserId`
- `previousValue`
- `newValue`
- `metadata`
- `createdAt`

The query is constructed with `Prisma.sql` and executed with `$executeRaw`; values are bound rather than interpolated into the SQL text. The obsolete `COL_LENGTH(..., 'action')` branches and unsafe string-literal builder were removed.

The existing Prisma `adminAuditLog.create` fallback remains available as defense in depth when the canonical raw write fails for an independent reason. It is not invoked during a successful current-schema write.

## Files Changed

- `src/lib/admin-audit.ts`
  - Replaced mixed-schema unsafe SQL with one parameterized canonical `actionType` insert.
  - Preserved the Prisma fallback.
- `src/lib/admin-audit.test.ts`
  - Added generated-model-aware canonical SQL contract coverage.
  - Added independently simulated fallback coverage.
- `Project Management/Pre-Epic8 Release Validation/RV8_ADMIN_AUDIT_COMPATIBILITY_CORRECTION_REPORT.md`
  - Records the correction and evidence.

No route, component, workflow, schema, migration, dependency, notification, Azure resource, or existing audit record changed.

## Canonical-Path Result

Focused coverage confirms:

- the normal path calls the canonical raw write exactly once;
- the Prisma fallback is not called;
- every inserted column exists on the generated Prisma `AdminAuditLog` model;
- no legacy `action` identifier appears in the SQL;
- values remain query parameters rather than executable SQL text;
- exactly one audit-write operation occurs.

## Fallback And Duplicate Prevention

An independently simulated canonical-write failure confirms:

- the canonical write is attempted once;
- the Prisma fallback is attempted once;
- the fallback receives the same canonical action, target, actor, prior state, resulting state, and metadata;
- no retry loop or second fallback write is created.

The fallback remains unchanged in its treatment of known schema-mismatch errors: unsupported legacy shapes are not fabricated or migrated by this correction.

## Audit Integrity

The corrected canonical path preserves:

- actor identity through `actorUserId`;
- role/request context supplied in existing metadata;
- action through `actionType`;
- target/object through `entityType` and `entityId`;
- timestamp through `SYSUTCDATETIME()`;
- prior/resulting state through `previousValue` and `newValue`;
- existing serialized metadata and caller-side redaction behavior.

The correction does not add an OTP, permission token, session secret, worker secret, SAS value, credential, or other secret to audit evidence. The permission-request service continues to delete the legacy consent token before audit metadata is created. Existing audit rows remain unchanged.

## Validation Results

### Focused admin-audit and admin/API regressions

Command:

```text
npx vitest run src/lib/admin-audit.test.ts src/app/api/admin/account-actions/account-actions.integration.test.ts src/app/api/admin/mfa/trusted-devices/trusted-devices.integration.test.ts
```

Result: **Passed** - 3 files, 7 tests.

### Prisma schema and generated client

Commands:

```text
npx prisma validate
npx prisma generate
```

Result: **Passed** using a synthetic, non-connecting SQL Server-format `DATABASE_URL`. The schema is valid and Prisma Client 6.19.0 generated successfully. No beta database was contacted.

### TypeScript

Command:

```text
npx tsc --noEmit --pretty false --incremental false
```

Result: **Passed**.

### Production build

Command:

```text
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```

Result: **Passed** with Next.js 15.5.21. Compilation, lint/type validation, static generation, and build tracing completed. The build generated 205 App Router pages and the two existing Pages Router compatibility pages.

Build-time database count probes could not reach the intentionally nonexistent synthetic localhost database and logged their existing fallback diagnostics; these did not fail the build and are unrelated to this correction.

### Diff validation

Command:

```text
git diff --check
```

Result: **Passed**.

## Deployment Readiness

The correction is ready for Product Owner deployment approval. It removes the confirmed current-schema SQL error, preserves the fallback, makes the canonical payload structurally verifiable against the generated Prisma model, and changes no application workflow or database state.

RV-8 remains paused. No beta deployment was performed, RV-9 was not started, and Epic 8 was not started.
