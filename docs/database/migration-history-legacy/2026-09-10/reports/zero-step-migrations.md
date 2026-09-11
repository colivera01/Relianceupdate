# Zero-step active-assignment migrations

The legacy ledger contains successful rows with `applied_steps_count = 0` for:

- `20250101000000_add_unique_active_assignment`
- `add_unique_active_assignment`

Their current source raw SHA-256 values match the successful beta ledger checksums. They are therefore **not checksum mismatches**.

They remain serious migration-history and bootstrap debt: both target the obsolete `DeviceAssignment` table name, neither established the intended filtered uniqueness on the actual `dbo.device_assignments` table, and the first causes the clean-bootstrap error documented separately.

Checksum equality does not imply successful DDL or reproducibility.

