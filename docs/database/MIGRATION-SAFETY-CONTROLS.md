# Migration safety controls

The forward-baseline release must fail closed. A connection string alone never proves a target is safe.

## Command policy

All migration writes use `scripts/release/run_guarded_prisma.cjs` or `scripts/release/run_guarded_sql.cjs`. Direct `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, `prisma migrate deploy`, and `prisma migrate resolve` invocations are rejected by the repository scanner.

`migrate dev`, `migrate reset`, and `db push` are allowed only when all of these are true:

- `RELIANCE_DB_ENVIRONMENT=disposable`
- `RELIANCE_DISPOSABLE=YES`
- the database name contains `rehearsal`, `checkpoint`, `disposable`, `test`, or `dev`
- the server/database does not match a known or name-detected beta/production target

They are permanently blocked for beta and production.

Protected `migrate deploy`, `migrate resolve`, or guarded SQL additionally requires an exact target specification, release receipt, Product Owner write authorization flag, Azure resource-ID verification, database structural/ledger verification, and the token issued by the exclusive lock wrapper.

## Identity verification

`verify_database_target.cjs` compares:

- declared environment;
- parsed connection server/database without printing credentials;
- Azure resource ID returned by the control plane;
- SQL Server and database reported by the live connection;
- expected structural fingerprint;
- expected ledger digest, row count, and successful migration count;
- target-spec hash embedded in the release receipt.

Any difference stops execution.

## Exclusive lock

`with_migration_lock.cjs` obtains a SQL Server session-owned exclusive `sp_getapplock` keyed by the SHA-256 of the exact Azure database resource ID. It holds the connection while the verified child command runs.

- Acquisition: exclusive, session-owned; default timeout zero, configurable only from 0–60 seconds.
- Owner: host, process ID, and required release-owner label are logged without credentials.
- Timeout: failure to acquire stops the operation.
- Stale handling: SQL Server automatically releases a session lock when its owning process/connection dies.
- Normal release: `sp_releaseapplock` in `finally` after the child exits.
- Emergency release: an authorized DBA verifies the recorded session ID and dead owner, then terminates that SQL session. No automatic force-release command is supplied.

Every deployment/migration actor must use the same wrapper and resource key. CI must block unguarded commands. The lock does not make arbitrary external commands safe.

## Credentials

Runtime/build identities should have no DDL permissions. A short-lived DDL credential is supplied only to the locked migration process through an approved secret channel. Credentials must never enter source, receipts, logs, or artifacts.
