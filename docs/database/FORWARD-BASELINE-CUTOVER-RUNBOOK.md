# Forward-baseline cutover runbook

This runbook is design evidence only until Checkpoint 3 explicitly authorizes beta cutover.

## Fixed target and candidate contract

- Beta resource: `/subscriptions/f50140d7-274d-4eec-b309-b109c6763615/resourceGroups/rg-reliance-beta-eastus/providers/Microsoft.Sql/servers/sql-reliance-beta-wcus/databases/reliance-beta-db`
- Beta server/database: `sql-reliance-beta-wcus.database.windows.net` / `reliance-beta-db`
- Authoritative deployed branch before cutover: `codex/rv8-package-visibility-part1-work`
- Approved parent: `5b27df55e3e53409aa8b61979128d44d39541fba`
- Baseline: `00000000000000_reliance_forward_baseline_20260910`
- Reconciliation: `20260910030000_enforce_one_active_device_assignment`

## Checkpoint 3 parent orchestrator

`scripts/release/cutover_orchestrator.cjs` is the only approved entry point for the future cutover. It has mutually exclusive `--dry-run` and `--execute` modes. Beta execute mode requires all of the following simultaneously:

- an unexpired Product Owner authorization artifact bound to the exact target resource ID, candidate SHA, and release-receipt SHA;
- `RELIANCE_PRODUCT_OWNER_AUTHORIZATION_SHA256` matching the authorization bytes;
- `RELIANCE_CUTOVER_EXECUTE=YES`;
- `RELIANCE_MIGRATION_WRITE_APPROVED=YES`;
- the exact target, artifact, receipt, source, smoke-baseline, and quiescence inputs.

The required retained inputs also include the protected-test result, Linux-validation result, previous runtime and its SHA-256, deterministic forward-recovery commit, and deterministic recovery-database name. A future non-deploying upload, if separately approved, should use `reliance-releases/<candidate-sha>/runtime/<artifact-name>` in the approved release storage account. Checkpoint 3 retains the artifact locally and does not upload it to live deployment storage.

The committed authorization template is deliberately invalid and cannot authorize execution. Custom execution adapters are permanently forbidden for beta. Disposable execution requires `RELIANCE_REHEARSAL_AUTHORIZATION=DISPOSABLE_ONLY` and a resource/database name containing a disposable marker.

The parent owns one session-scoped SQL application lock through a pinned control transaction. It checks the owning session and `Exclusive` lock mode before and after every phase, heartbeats while child processes run, and independently proves that a second connection cannot obtain the same lock. Child SQL and Prisma processes receive a short-lived token but never own or release the parent lock.

## Coordinated sequence

1. Validate the authorization state, source, artifacts, target, smoke baseline, and quiescence contract without writing.
2. Acquire the environment-wide SQL application lock using the exact database resource ID.
3. Capture fresh ledger, structural, application-data, protected-evidence, assignment, and review-reason preflight evidence.
4. Verify PITR readiness and the deterministic recovery database name.
5. Stop the exact App Service, verify that application writes are quiesced, and only then capture the exact pre-mutation recovery timestamp. Recheck every technical and procedural actor gate.
6. Fast-forward the authoritative branch once, without force, from the expected old SHA to the approved candidate.
7. Preserve the exact 64-row ledger by renaming it to `_prisma_migrations_legacy_20260910` through the guarded SQL runner.
8. Create a temporary baseline-only migration stage from byte-verified manifest inputs. Recognize the exact baseline with guarded `migrate resolve --applied`.
9. Run `migrate status` and `migrate deploy` against only the baseline stage. Require identical before/after structural, application-row, and protected-evidence hashes.
10. Destroy the baseline stage. Create and independently verify the baseline-plus-reconciliation stage.
11. Repeat the duplicate-active-assignment preflight, then run guarded `migrate deploy`. Require the reconciliation to be the only pending migration.
12. Prove that the only structural delta is the unique filtered index on `device_assignments(deviceId) WHERE unassignedAt IS NULL`; require unchanged application rows and protected evidence.
13. Deploy the exact Linux runtime artifact paired with the release receipt.
14. Restart behind temporary operator-only access restrictions, then perform health and authenticated read-only role smoke checks.
15. Require only the simple end-of-cutover Product Owner physical acceptance receipt. Do not ask technical questions in an intermediate state.
16. Create and atomically push acceptance tags only after acceptance.
17. Restore the captured access restrictions, finalize the receipt, then release the lock.

Every temporary migration stage is created under an isolated random directory, contains only manifest-approved byte-identical SQL, is independently verified, cannot contain archive paths, and is destroyed after the operation.

## Actor quiescence

The chosen mechanism is **stop the App Service, then restart behind an operator-IP restriction**. Stopping the app is the enforceable control for database-writing user traffic. The wrapper snapshots the existing access restrictions before stopping, refuses name collisions, adds one operator allow rule plus a deny-all rule for smoke/acceptance, and restores the exact snapshot before unlock. Deployment Center must remain manual with no active deployment. GitHub automation, WebJobs, local tasks, and SQL/Prisma runners are re-inventoried immediately before execution. Manual Azure custody and closure of other Codex/Work tasks remain explicitly recorded procedural residual risks.

## Forward-only source recovery

Before authorization, create a deterministic recovery commit whose parent is the final candidate and whose tree equals the old authoritative tree. Rehearse old → candidate → recovery against an isolated bare remote with three ordinary fast-forward pushes and no force option. The recovery commit is used only with a PITR-restored legacy-ledger database and the previous runtime. Moving the authoritative branch backward is forbidden.

## Safe intermediate windows

The source/ledger mismatch is safe only while the exclusive release lock is continuously held and all other deployers are disabled. It should last minutes, not hours. No overnight or unattended mismatch is acceptable.

Stop immediately if the lock is lost, the ledger destination exists, ledger counts differ, a migration other than the approved baseline/reconciliation appears, baseline no-op changes schema/data, active-assignment duplicates appear, target identity differs, application smoke fails, or rollback readiness is unavailable.

## Rollback

Before source promotion, restore quiescence and release the lock without database recovery. After source promotion but before database mutation, fast-forward only to the approved recovery commit and restore quiescence; no database restore is performed. After ledger rotation, baseline recognition, reconciliation, or application deployment, restore the database from the post-quiescence PITR point to the deterministic recovery database, verify its Azure resource ID plus ledger/schema/application/protected hashes, switch the App Service connection without printing the secret, restore the previous runtime, apply the forward-only source recovery commit, restart behind the restriction, pass health and protected checks, restore access restrictions, and only then release the lock.

The original mutated database remains preserved for diagnosis; rollback never falsifies or hand-edits migration history. The index-only rollback SQL remains evidence for a separately authorized forward repair and is not the default rollback.

### Database lock scope and fail-closed recovery

SQL application locks are database-scoped. The original database lock is never described as protecting a PITR-restored database or the Azure environment. The controller therefore holds a separate environment-control lock in the SQL server's `master` database for the full operation, plus the original database lock. The App Service remains stopped throughout original-database mutation, PITR, restored-database verification, and connection switching; Deployment Center remains manual or unconfigured and exclusive operator custody remains an explicit procedural control.

After PITR reports the restored database Online, the controller first re-verifies the environment and original-database locks, then acquires a distinct lock inside the restored database and proves a second actor is blocked. Only then may it inspect the restored database, switch the connection, restore the prior runtime and forward-only Git recovery commit, or restart behind deny-all access restrictions. The restored-database lock remains held through connection switching, restricted restart, health verification, and traffic restoration.

If either the environment-control lock or original-database lock is lost during the provider operation, the controller stops before restored-database inspection or connection switching. It does not run rollback across an untrusted lock boundary and does not call the traffic-unfreeze operation. Closing the remaining lock connections cannot restart the App Service or remove deny-all restrictions. Recovery then requires a new, explicit operator-controlled assessment; normal application and deployment writes do not reopen automatically.

### Bradley Employee smoke scope

Bradley Coopers has no conventional Employee login or dashboard requirement. Bradley's Employee capability is the accountless Service Order / Employee Work Order link delivered to his email. The Reliance Admin is a separate principal; use of the same mailbox is only a testing convenience and is never identity evidence.

An existing, currently valid Work Order token may be checked without mutation. If none exists, record `UNPROVEN_NO_CURRENT_VALID_TOKEN`; do not generate or resend one for this migration-only release. That result is non-blocking only when prior physical acceptance is recorded as passed, this release changes no Employee access or business-flow code, and protected regression remains passed.
