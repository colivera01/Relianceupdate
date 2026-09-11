# Forward-baseline cutover runbook

This runbook is design evidence only until Checkpoint 3 explicitly authorizes beta cutover.

## Fixed target and candidate contract

- Beta resource: `/subscriptions/f50140d7-274d-4eec-b309-b109c6763615/resourceGroups/rg-reliance-beta-eastus/providers/Microsoft.Sql/servers/sql-reliance-beta-wcus/databases/reliance-beta-db`
- Beta server/database: `sql-reliance-beta-wcus.database.windows.net` / `reliance-beta-db`
- Authoritative deployed branch before cutover: `codex/rv8-package-visibility-part1-work`
- Approved parent: `5b27df55e3e53409aa8b61979128d44d39541fba`
- Baseline: `00000000000000_reliance_forward_baseline_20260910`
- Reconciliation: `20260910030000_enforce_one_active_device_assignment`

## Coordinated sequence

1. Acquire the environment-wide SQL application lock using the exact beta resource ID.
2. Capture an approved point-in-time restore point plus fresh ledger, structural, application-data, and protected-evidence fingerprints.
3. Stop if any pre-cutover fingerprint differs from the release receipt.
4. Advance the authoritative source to the separately approved immutable candidate while deployment/migration automation remains locked.
5. Preserve the exact 64-row ledger by renaming it to `_prisma_migrations_legacy_20260910` through the guarded SQL runner.
6. Recognize the exact baseline with guarded `migrate resolve --applied`.
7. Verify one successful active baseline row and prove baseline deploy is a no-op.
8. Run guarded `migrate deploy` to apply only the active-assignment reconciliation.
9. Recompute structural, data, protected-record, ledger, and artifact evidence. Stop on any unapproved difference.
10. Deploy the exact application artifact named in the same release receipt.
11. Perform authenticated read-only Customer, Vendor Manager, Employee/accountless, and Admin smoke checks plus physical acceptance.
12. Release the lock only after all evidence passes.

## Safe intermediate windows

The source/ledger mismatch is safe only while the exclusive release lock is continuously held and all other deployers are disabled. It should last minutes, not hours. No overnight or unattended mismatch is acceptable.

Stop immediately if the lock is lost, the ledger destination exists, ledger counts differ, a migration other than the approved baseline/reconciliation appears, baseline no-op changes schema/data, active-assignment duplicates appear, target identity differs, application smoke fails, or rollback readiness is unavailable.

## Rollback

Before ledger rotation, simply abort and release the lock. After ledger rotation or reconciliation, the preferred rollback is the approved point-in-time restore followed by exact structural/data/protected fingerprint verification. The index-only rollback SQL is evidence for a narrowly authorized forward recovery; it is not permission to rewrite migration history or alter beta without a separate decision.
