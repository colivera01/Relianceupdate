# Legacy migration-chain fresh-bootstrap failure

- Failing migration: `20250101000000_add_unique_active_assignment`
- SQL Server error: 208, `Invalid object name 'DeviceAssignment'`
- Cause: the migration sorts before the migration that creates the physical `dbo.device_assignments` table and also references the obsolete logical name `DeviceAssignment`.
- Applied steps: 0
- Beta upgrade/runtime impact: none; the failed attempt was rolled back and the legacy ledger later recorded a zero-step successful resolution.
- Fresh-bootstrap/recovery impact: the 57-file historical chain is not a reliable clean bootstrap.
- Disposition: immutable historical evidence. A clean forward baseline replaces it for future bootstraps; the historical file is not edited.

