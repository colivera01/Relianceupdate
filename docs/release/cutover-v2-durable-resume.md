# Cutover V2 durable resume contract

This control extends the existing external Cutover V2 control blob. It does not create a second lock or deployment system.

## Entry point

`scripts/release/cutover_v2/orchestrator.cjs` is the only reviewed end-to-end entry point:

- `--dry-run`: live-safe read-only preflight.
- `--execute`: begins one new cutover from an exact OPEN generation.
- `--resume` or `--adopt`: adopts one existing frozen operation using an exact adoption-evidence file.

The live and disposable modes call the same controller, journal, quiescence, migration, package-pointer, PITR, lock-handoff, and recovery implementations. Runtime activation remains an immutable `WEBSITE_RUN_FROM_PACKAGE` pointer update through the structured settings updater.

## Durable journal

The external lease-protected control blob records the cutover identity, target App Service/SQL/database resource IDs, candidate and recovery package identities, migration and receipt hashes, original authorization hash, current durable phase, last completed checkpoint, current database role, current package state, immutable snapshot identity, recovery point, controller identity, hashed lease identity, lease generation, timestamps, and transition evidence. Git state is part of that same journal: remote/repository/branch, expected start, candidate, rollback commit and rollback tree, observed remote before/after, promotion and rollback attempts/results, and reviewed tag names, targets, phase, and verification results.

Every non-OPEN phase keeps the environment state FROZEN. Unexpected transitions, missing evidence, unknown runtime/database state, snapshot mismatch, lease loss, and ambiguous interrupted migration steps fail closed. Only a validated acceptance or recovery receipt can complete `CLEANUP_IN_PROGRESS -> OPEN`.

The controller acquires the external control-blob lease, captures and applies App Service quiescence, and binds that immutable snapshot before publishing the durable `FROZEN` checkpoint. A controller loss after the checkpoint therefore cannot leave normal application writes running. If quiescence fails before the checkpoint, no database or package mutation has started; a partially stopped application remains stopped for review.

## Immutable quiescence snapshot

The original snapshot is created once with exclusive file creation and is bound to the cutover ID, control generation, target App Service ID, candidate SHA, original authorization hash, original controller ID, lease generation, and cutover creation time. Its exact byte hash and snapshot ID are written to the durable journal.

Existing snapshots are never accepted by filename alone. Freeze, restricted restart, and restore verify the journal-bound ID, byte hash, full binding, target resource, creation time, and mutation boundary. A missing, changed, stale, cross-cutover, cross-target, cross-candidate, or wrong-generation snapshot stops the operation while FROZEN.

## Adoption evidence

Resume requires an immutable JSON document with:

- `adoptionVersion: 1`
- `expectedGeneration`
- `expectedPhase`
- `previousControllerStatus`: `LEASE_EXPIRED`, `PROCESS_CONFIRMED_LOST`, or `EXPLICITLY_RELINQUISHED`
- the exact journal `quiescenceSnapshot` identity when one exists

The orchestrator independently binds the remaining identity fields from the reviewed release binding and the original authorization. Before lease transfer it verifies package availability, current package state, configured database, database fingerprints, and the bound snapshot. Acquiring the lease proves there is no active competing controller; the generation comparison prevents a race between observation and adoption. The transfer records both controllers, both hashed lease identities, the reason, timestamp, and unchanged durable phase.

## Phase-aware recovery

Resume continues from the journal checkpoint. Completed ledger, baseline, reconciliation, Git-promotion, package, database-switch, runtime-recovery, Git-recovery, and final-tag checkpoints are not replayed. At an uncertain Git boundary the replacement controller reads the authoritative remote: original means promotion was not completed, candidate means promotion completed, and the reviewed rollback commit means recovery completed. Any other remote identity fails closed. The same reconciliation rule makes candidate promotion, forward-only rollback, and exact-target tag creation idempotent without rewriting history.

Provider PITR uses the already persisted recovery point, an unambiguously named recovery/restore database, deterministic recovery database identity, and provider request fingerprint. The initial Azure restore is submitted asynchronously. If a replacement controller cannot yet see the target, it must find an accepted, non-failed Azure write for that exact recovery resource before waiting; it cannot submit a second restore. Provider visibility and Online-state waits use the configured worst-case recovery allowance instead of a short fixed poll window.

The durable journal stores only recovery database names, resource IDs, provider request fingerprints, and status. Connection values are reconstructed from the already verified source configuration inside the active controller and are never persisted in the journal or evidence package.

An interrupted destructive migration sub-step is deliberately ambiguous and becomes `FAILED_FROZEN`; it is not replayed by guesswork. Runtime pointer changes occur while the app remains stopped. The journal records the transition before the pointer write and permits only the reviewed candidate/recovery states during rollback convergence. The controller starts the app in restricted read-only mode before health verification. Recovery pointer restoration is likewise performed while stopped and is health-verified only after the verified recovery database is locked and selected.

On every terminal controller error or injected loss, local SQL sessions are closed and control-blob lease renewal stops while the durable state remains FROZEN. This allows the fixed Azure lease to expire naturally and prevents an orphaned rehearsal process from retaining ownership.

## Package validity

Both candidate and recovery bindings must cover the planned cutover end plus the 30-minute Product Owner acceptance window and the configured worst-case recovery allowance. The signed reference must then extend at least 24 additional hours beyond that required-through timestamp. The same verification runs before initial execution and before adoption. Full signed references are not written to the durable journal.
